use serde::{Deserialize, Serialize};

const VORTEX_MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/Nexus-Mods/Vortex-Backend/main/out/extensions-manifest.json";

const VORTEX_REPOSITORY_URL: &str = "https://github.com/Nexus-Mods/Vortex";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VortexSupportStatus {
    pub supported: bool,

    /*
     * extension
     * built_in
     * none
     */
    pub support_type: String,

    pub matched_game_name: Option<String>,
    pub extension_name: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,

    pub page_url: Option<String>,

    pub mod_id: Option<u64>,
    pub game_id: Option<String>,

    pub match_score: i32,
}

#[derive(Debug, Deserialize)]
struct VortexManifest {
    #[serde(default)]
    extensions: Vec<VortexExtension>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VortexExtension {
    name: Option<String>,

    #[serde(rename = "type")]
    extension_type: Option<String>,

    game_name: Option<String>,
    game_id: Option<String>,

    author: Option<String>,
    version: Option<String>,

    mod_id: Option<u64>,

    github: Option<String>,
    github_raw_path: Option<String>,

    hide: Option<bool>,

    description: Option<VortexDescription>,
}

#[derive(Debug, Deserialize)]
struct VortexDescription {
    short: Option<String>,
    long: Option<String>,
}

// ================================================================
// EMPTY RESULT
// ================================================================

fn empty_result() -> VortexSupportStatus {
    VortexSupportStatus {
        supported: false,

        support_type: "none".to_string(),

        matched_game_name: None,
        extension_name: None,
        description: None,
        author: None,
        version: None,

        page_url: Some(VORTEX_REPOSITORY_URL.to_string()),

        mod_id: None,
        game_id: None,

        match_score: 0,
    }
}

// ================================================================
// GAME NAME NORMALIZATION
// ================================================================

fn normalize_game_name(value: &str) -> String {
    let mut output = String::with_capacity(value.len());

    for character in value.to_lowercase().chars() {
        match character {
            /*
             * Ignore storefront trademark symbols.
             */
            '™' | '®' | '©' | '℠' => {}

            /*
             * Normalize ampersands.
             */
            '&' => {
                output.push_str(" and ");
            }

            /*
             * Keep letters and numbers.
             */
            character if character.is_alphanumeric() => {
                output.push(character);
            }

            /*
             * Everything else becomes whitespace.
             */
            _ => {
                output.push(' ');
            }
        }
    }

    output.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn remove_common_store_suffixes(value: &str) -> String {
    let mut value = normalize_game_name(value);

    /*
     * Remove only obvious storefront/platform suffixes.
     *
     * Do not remove words such as:
     *
     * Remastered
     * Complete
     * Definitive
     *
     * because those can identify different games.
     */
    for suffix in [" steam", " gog", " epic", " epic games", " windows", " pc"] {
        if value.ends_with(suffix) {
            let new_length = value.len() - suffix.len();

            value = value[..new_length].trim().to_string();
        }
    }

    value
}

fn significant_tokens(value: &str) -> Vec<String> {
    normalize_game_name(value)
        .split_whitespace()
        .filter(|token| !matches!(*token, "the" | "a" | "an" | "of" | "and" | "for"))
        .map(|token| token.to_string())
        .collect()
}

// ================================================================
// MATCH SCORING
// ================================================================

fn calculate_match_score(installed_name: &str, vortex_name: &str) -> i32 {
    let installed = remove_common_store_suffixes(installed_name);

    let vortex = remove_common_store_suffixes(vortex_name);

    if installed.is_empty() || vortex.is_empty() {
        return 0;
    }

    /*
     * Perfect normalized match.
     *
     * Examples:
     *
     * "007 First Light"
     * "007 First Light"
     *
     * "BioShock Infinite"
     * "Bioshock Infinite"
     */
    if installed == vortex {
        return 100;
    }

    /*
     * One full title contains the other.
     *
     * Useful for cases where a storefront includes a
     * publisher prefix/suffix.
     */
    if installed.contains(&vortex) && vortex.len() >= 6 {
        return 92;
    }

    if vortex.contains(&installed) && installed.len() >= 6 {
        return 90;
    }

    /*
     * Token comparison.
     */
    let installed_tokens = significant_tokens(&installed);

    let vortex_tokens = significant_tokens(&vortex);

    if installed_tokens.is_empty() || vortex_tokens.is_empty() {
        return 0;
    }

    let common = installed_tokens
        .iter()
        .filter(|token| vortex_tokens.contains(token))
        .count();

    let shorter = installed_tokens.len().min(vortex_tokens.len());

    let longer = installed_tokens.len().max(vortex_tokens.len());

    /*
     * Every meaningful token in the shorter title matches.
     */
    if shorter >= 2 && common == shorter {
        if shorter == longer {
            return 88;
        }

        return 80;
    }

    /*
     * Very high overlap fallback.
     */
    if shorter >= 3 {
        let ratio = common as f32 / shorter as f32;

        if ratio >= 0.8 {
            return 70;
        }
    }

    0
}

// ================================================================
// DESCRIPTION CLEANUP
// ================================================================

fn clean_description(value: Option<String>) -> Option<String> {
    let value = value?;

    /*
     * The manifest contains Nexus BBCode and HTML.
     *
     * The short description is generally clean, but strip a
     * few common tags so the card looks nicer.
     */
    let cleaned = value
        .replace("<br />", " ")
        .replace("<br/>", " ")
        .replace("<br>", " ")
        .replace("[b]", "")
        .replace("[/b]", "")
        .replace("[i]", "")
        .replace("[/i]", "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();

    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

// ================================================================
// EXTENSION URL
// ================================================================

fn extension_page_url(extension: &VortexExtension) -> Option<String> {
    /*
     * Reviewed downloadable Vortex extensions live under:
     *
     * nexusmods.com/site/mods/<id>
     */
    if let Some(mod_id) = extension.mod_id {
        return Some(format!("https://www.nexusmods.com/site/mods/{}", mod_id));
    }

    /*
     * Some bundled/legacy entries reference GitHub.
     */
    if let Some(github) = extension.github.as_deref() {
        let path = extension.github_raw_path.as_deref();

        return Some(match path {
            Some(path) if !path.is_empty() => {
                format!("https://github.com/{}/tree/master/{}", github, path)
            }

            _ => {
                format!("https://github.com/{}", github)
            }
        });
    }

    Some(VORTEX_REPOSITORY_URL.to_string())
}

// ================================================================
// SUPPORT TYPE
// ================================================================

fn determine_support_type(extension: &VortexExtension) -> String {
    /*
     * A modId means this is a downloadable extension listed
     * through Nexus Mods' Vortex Extensions system.
     */
    if extension.mod_id.is_some() {
        return "extension".to_string();
    }

    /*
     * GitHub-backed entries without a Nexus extension mod ID
     * are treated as bundled/built-in support.
     */
    if extension.github.is_some() || extension.hide.unwrap_or(false) {
        return "built_in".to_string();
    }

    "built_in".to_string()
}

// ================================================================
// CONVERT MANIFEST ENTRY TO RESULT
// ================================================================

fn create_result(extension: VortexExtension, score: i32) -> VortexSupportStatus {
    let description = extension.description.as_ref().and_then(|description| {
        description
            .short
            .clone()
            .or_else(|| description.long.clone())
    });

    let description = clean_description(description);

    let page_url = extension_page_url(&extension);

    VortexSupportStatus {
        supported: true,

        support_type: determine_support_type(&extension),

        matched_game_name: extension.game_name.clone(),

        extension_name: extension.name.clone(),

        description,

        author: extension.author,

        version: extension.version,

        page_url,

        mod_id: extension.mod_id,

        game_id: extension.game_id,

        match_score: score,
    }
}

// ================================================================
// TAURI COMMAND
// ================================================================

#[tauri::command]
pub async fn get_vortex_support(name: String) -> Result<VortexSupportStatus, String> {
    println!("");
    println!("[VORTEX] ========================================");

    println!("[VORTEX] Checking game: {:?}", name);

    println!("[VORTEX] Normalized game: {:?}", normalize_game_name(&name));

    let client = reqwest::Client::builder()
        .user_agent("GameManager/0.3.0 Vortex extension integration")
        .build()
        .map_err(|error| format!("Failed to create Vortex HTTP client: {}", error))?;

    println!("[VORTEX] Downloading LIVE Vortex manifest:");

    println!("[VORTEX] {}", VORTEX_MANIFEST_URL);

    let response = client
        .get(VORTEX_MANIFEST_URL)
        .send()
        .await
        .map_err(|error| format!("Failed to download Vortex extension manifest: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "Vortex manifest returned HTTP {}",
            response.status()
        ));
    }

    let manifest: VortexManifest = response
        .json()
        .await
        .map_err(|error| format!("Failed to parse Vortex extension manifest: {}", error))?;

    println!(
        "[VORTEX] Live manifest entries: {}",
        manifest.extensions.len()
    );

    let mut best_match: Option<(i32, VortexExtension)> = None;

    let mut game_extension_count = 0;

    for extension in manifest.extensions {
        /*
         * The live manifest contains many things:
         *
         * themes
         * translations
         * utilities
         * game extensions
         *
         * We only want:
         *
         * "type": "game"
         */
        let is_game_extension = extension
            .extension_type
            .as_deref()
            .map(|extension_type| extension_type.eq_ignore_ascii_case("game"))
            .unwrap_or(false);

        if !is_game_extension {
            continue;
        }

        game_extension_count += 1;

        let Some(game_name) = extension.game_name.as_deref() else {
            continue;
        };

        let score = calculate_match_score(&name, game_name);

        if score == 0 {
            continue;
        }

        println!("[VORTEX] Candidate: {:?}", game_name);

        println!("[VORTEX]     Extension: {:?}", extension.name);

        println!("[VORTEX]     Game ID: {:?}", extension.game_id);

        println!("[VORTEX]     Mod ID: {:?}", extension.mod_id);

        println!("[VORTEX]     Match score: {}", score);

        let replace = best_match
            .as_ref()
            .map(|(current_score, _)| score > *current_score)
            .unwrap_or(true);

        if replace {
            best_match = Some((score, extension));
        }
    }

    println!(
        "[VORTEX] Game extensions examined: {}",
        game_extension_count
    );

    let Some((score, extension)) = best_match else {
        println!("[VORTEX] No matching Vortex game extension found");

        println!("[VORTEX] ========================================");

        println!("");

        return Ok(empty_result());
    };

    let result = create_result(extension, score);

    println!("[VORTEX] MATCH FOUND");

    println!("[VORTEX] Supported: {}", result.supported);

    println!("[VORTEX] Matched Game: {:?}", result.matched_game_name);

    println!("[VORTEX] Extension: {:?}", result.extension_name);

    println!("[VORTEX] Version: {:?}", result.version);

    println!("[VORTEX] Mod ID: {:?}", result.mod_id);

    println!("[VORTEX] Support Type: {}", result.support_type);

    println!("[VORTEX] Match Score: {}", result.match_score);

    println!("[VORTEX] Page URL: {:?}", result.page_url);

    println!("[VORTEX] ========================================");

    println!("");

    Ok(result)
}
