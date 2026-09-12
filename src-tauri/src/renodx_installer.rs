use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const RELEASES_API: &str = "https://api.github.com/repos/clshortfuse/renodx/releases?per_page=20";
const RENODX_MODS_RAW_URL: &str = "https://raw.githubusercontent.com/wiki/clshortfuse/renodx/Mods.md";

#[derive(Debug, Clone, Deserialize)]
struct Release {
    tag_name: String,
    name: Option<String>,
    prerelease: bool,
    assets: Vec<Asset>,
}

#[derive(Debug, Clone, Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
    size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageInfo {
    pub found: bool,
    pub release_tag: Option<String>,
    pub release_name: Option<String>,
    pub asset_name: Option<String>,
    pub asset_url: Option<String>,
    pub asset_size_bytes: Option<u64>,
    pub match_type: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub installed: bool,
    pub release_tag: String,
    pub asset_name: String,
    pub installed_path: String,
    pub installed_size_bytes: u64,
    pub backup_path: Option<String>,
    pub message: String,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UninstallResult {
    pub removed: bool,
    pub asset_name: String,
    pub removed_path: String,
    pub backup_path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenoDxUpdateStatus {
    pub checked: bool,
    pub state: String,
    pub installed_asset_name: Option<String>,
    pub available_asset_name: Option<String>,
    pub installed_size_bytes: Option<u64>,
    pub available_size_bytes: Option<u64>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenoDxBackupInfo {
    pub found: bool,
    pub asset_name: Option<String>,
    pub backup_path: Option<String>,
    pub created_unix: Option<u64>,
    pub size_bytes: Option<u64>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub restored: bool,
    pub asset_name: String,
    pub restored_path: String,
    pub restored_size_bytes: u64,
    pub source_backup_path: String,
    pub safety_backup_path: Option<String>,
    pub message: String,
}


fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "HOME is not available.".to_string())
}

fn backup_root() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let base = env::var_os("LOCALAPPDATA")
            .or_else(|| env::var_os("APPDATA"))
            .or_else(|| env::var_os("USERPROFILE"))
            .map(PathBuf::from)
            .ok_or_else(|| {
                "Could not determine the Windows GameAtlas data directory."
                    .to_string()
            })?;

        return Ok(
            base.join("GameAtlas")
                .join("renodx-backups")
        );
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home = env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or_else(|| {
                "HOME is not available."
                    .to_string()
            })?;

        Ok(
            home.join(".local")
                .join("share")
                .join("GameAtlas")
                .join("renodx-backups")
        )
    }
}

fn stamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|v| v.as_secs().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

fn normalize(value: &str) -> String {
    value
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
}

fn title_variants(title: &str) -> Vec<String> {
    let mut variants = vec![normalize(title)];
    let lower = title.to_ascii_lowercase();

    for suffix in [
        " remastered",
        " remake",
        " director's cut",
        " directors cut",
        " complete edition",
        " definitive edition",
        " game of the year edition",
        " goty",
    ] {
        if let Some(index) = lower.find(suffix) {
            variants.push(normalize(&title[..index]));
        }
    }

    if let Some(open) = title.rfind(" (") {
        if title.ends_with(')') {
            let inside = &title[open + 2..title.len() - 1];

            if inside.len() == 4 && inside.chars().all(|character| character.is_ascii_digit()) {
                variants.push(normalize(&title[..open]));
            }
        }
    }

    let acronym_source = title.split('(').next().unwrap_or(title);

    let acronym: String = acronym_source
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|word| !word.is_empty())
        .filter_map(|word| word.chars().next())
        .flat_map(|character| character.to_lowercase())
        .collect();

    if acronym.len() >= 2 {
        variants.push(acronym);
    }

    variants.sort();
    variants.dedup();
    variants
}

fn asset_stem(asset_name: &str) -> String {
    let lower = asset_name.to_ascii_lowercase();

    let mut stem = if let Some(suffix) = [".addon64", ".addon32"]
        .into_iter()
        .find(|suffix| lower.ends_with(suffix))
    {
        asset_name[..asset_name.len() - suffix.len()].to_string()
    } else {
        asset_name.to_string()
    };

    if stem.to_ascii_lowercase().starts_with("renodx-") {
        stem = stem["renodx-".len()..].to_string();
    }

    stem
}

fn score_asset(asset_name: &str, titles: &[String]) -> Option<(i32, String)> {
    let stem = normalize(&asset_stem(asset_name));
    for title in titles {
        if stem == *title {
            return Some((100, "exact".to_string()));
        }
    }
    for title in titles {
        if title.len() >= 5 && (stem.starts_with(title) || title.starts_with(&stem)) {
            return Some((85, "prefix".to_string()));
        }
    }
    for title in titles {
        if title.len() >= 7 && stem.contains(title) {
            return Some((70, "contains".to_string()));
        }
    }
    None
}


fn markdown_urls(value: &str) -> Vec<String> {
    let mut urls = Vec::new();
    let mut search_from = 0;

    while search_from < value.len() {
        let Some(relative_start) = value[search_from..].find("](") else {
            break;
        };

        let start = search_from + relative_start + 2;
        let Some(relative_end) = value[start..].find(')') else {
            break;
        };

        let end = start + relative_end;
        let url = value[start..end].trim();

        if (url.starts_with("https://") || url.starts_with("http://"))
            && !url.contains("img.shields.io")
        {
            urls.push(url.to_string());
        }

        search_from = end + 1;
    }

    urls
}

fn markdown_label(value: &str) -> String {
    let trimmed = value.trim();

    if let Some(open) = trimmed.find('[') {
        if let Some(close_rel) = trimmed[open + 1..].find(']') {
            let close = open + 1 + close_rel;
            return trimmed[open + 1..close].trim().to_string();
        }
    }

    trimmed.to_string()
}

fn split_markdown_row(line: &str) -> Vec<String> {
    line.trim()
        .trim_matches('|')
        .split('|')
        .map(|part| part.trim().to_string())
        .collect()
}

fn official_package_from_wiki(
    markdown: &str,
    game_name: &str,
    matched_name: Option<&str>,
    architecture: &str,
) -> Option<PackageInfo> {
    let suffix = if architecture == "32-bit" {
        ".addon32"
    } else {
        ".addon64"
    };

    let mut requested_titles = title_variants(game_name);

    if let Some(name) = matched_name {
        requested_titles.extend(title_variants(name));
    }

    requested_titles.sort();
    requested_titles.dedup();

    let mut best: Option<(i32, String, String)> = None;

    for line in markdown.lines() {
        let trimmed = line.trim();

        if !trimmed.starts_with('|') {
            continue;
        }

        let parts = split_markdown_row(trimmed);

        if parts.len() < 3 {
            continue;
        }

        let candidate = markdown_label(&parts[0]);

        if candidate.eq_ignore_ascii_case("name") {
            continue;
        }

        let candidate_variants = title_variants(&candidate);

        let mut title_score = 0;

        for requested in &requested_titles {
            for variant in &candidate_variants {
                if requested == variant {
                    title_score = title_score.max(100);
                } else if requested.len() >= 5
                    && (requested.starts_with(variant) || variant.starts_with(requested))
                {
                    title_score = title_score.max(85);
                } else if requested.len() >= 7
                    && (requested.contains(variant) || variant.contains(requested))
                {
                    title_score = title_score.max(70);
                }
            }
        }

        if title_score == 0 {
            continue;
        }

        /*
         * The official RenoDX list can point to:
         * - clshortfuse GitHub Pages
         * - contributor GitHub Pages
         * - contributor GitHub Releases
         * - Nexus / Discord
         *
         * Only accept a direct architecture-specific addon URL here.
         * This avoids guessing asset names or downloading HTML pages.
         */
        let direct_url = markdown_urls(&parts[2])
            .into_iter()
            .find(|url| {
                let lower = url.to_ascii_lowercase();
                lower.contains(suffix)
            });

        let Some(url) = direct_url else {
            continue;
        };

        let asset_name = url
            .split('?')
            .next()
            .unwrap_or(&url)
            .rsplit('/')
            .next()
            .unwrap_or("")
            .to_string();

        if asset_name.is_empty()
            || !asset_name.to_ascii_lowercase().ends_with(suffix)
        {
            continue;
        }

        let replace = best
            .as_ref()
            .map(|(score, _, _)| title_score > *score)
            .unwrap_or(true);

        if replace {
            best = Some((title_score, asset_name, url));
        }
    }

    best.map(|(score, asset_name, url)| PackageInfo {
        found: true,
        release_tag: Some("official".to_string()),
        release_name: Some("RenoDX official Mods list".to_string()),
        asset_name: Some(asset_name.clone()),
        asset_url: Some(url),
        asset_size_bytes: None,
        match_type: if score >= 100 {
            "official-exact".to_string()
        } else if score >= 85 {
            "official-prefix".to_string()
        } else {
            "official-contains".to_string()
        },
        message: format!(
            "Matched {} using the official RenoDX Mods list.",
            asset_name
        ),
    })
}

async fn official_package(
    game_name: &str,
    matched_name: Option<&str>,
    architecture: &str,
) -> Result<Option<PackageInfo>, String> {
    let markdown = reqwest::Client::builder()
        .user_agent("GameAtlas/2.1 RenoDX Manager")
        .build()
        .map_err(|e| e.to_string())?
        .get(RENODX_MODS_RAW_URL)
        .send()
        .await
        .map_err(|e| format!("Could not reach the RenoDX Mods list: {}", e))?
        .error_for_status()
        .map_err(|e| format!("RenoDX Mods list returned an error: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Could not read the RenoDX Mods list: {}", e))?;

    Ok(official_package_from_wiki(
        &markdown,
        game_name,
        matched_name,
        architecture,
    ))
}

async fn releases() -> Result<Vec<Release>, String> {
    reqwest::Client::builder()
        .user_agent("GameAtlas/2.1 RenoDX Manager")
        .build()
        .map_err(|e| e.to_string())?
        .get(RELEASES_API)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Could not reach RenoDX GitHub releases: {}", e))?
        .error_for_status()
        .map_err(|e| format!("RenoDX GitHub releases returned an error: {}", e))?
        .json::<Vec<Release>>()
        .await
        .map_err(|e| format!("Could not parse RenoDX release metadata: {}", e))
}


fn resolve(
    release: &Release,
    game_name: &str,
    matched_name: Option<&str>,
    architecture: &str,
) -> PackageInfo {
    let suffix = if architecture == "32-bit" {
        ".addon32"
    } else {
        ".addon64"
    };
    let mut titles = title_variants(game_name);
    if let Some(name) = matched_name {
        titles.extend(title_variants(name));
    }
    titles.sort();
    titles.dedup();
    let mut best: Option<(i32, String, &Asset)> = None;
    for asset in &release.assets {
        if !asset.name.to_ascii_lowercase().ends_with(suffix) {
            continue;
        }
        let Some((score, kind)) = score_asset(&asset.name, &titles) else {
            continue;
        };
        if best.as_ref().map(|(s, _, _)| score > *s).unwrap_or(true) {
            best = Some((score, kind, asset));
        }
    }
    if let Some((_, kind, asset)) = best {
        PackageInfo {
            found: true,
            release_tag: Some(release.tag_name.clone()),
            release_name: release.name.clone(),
            asset_name: Some(asset.name.clone()),
            asset_url: Some(asset.browser_download_url.clone()),
            asset_size_bytes: Some(asset.size),
            match_type: kind,
            message: format!("Matched {} in RenoDX {}.", asset.name, release.tag_name),
        }
    } else {
        PackageInfo { found: false, release_tag: Some(release.tag_name.clone()), release_name: release.name.clone(), asset_name: None, asset_url: None, asset_size_bytes: None, match_type: "none".to_string(), message: format!("RenoDX support is reported, but GameAtlas could not safely match a {} asset in {}.", suffix, release.tag_name) }
    }
}


/*
 * RENODX_PHASE_6_2_OFFICIAL_SOURCE_AUTHORITY
 *
 * The official RenoDX Mods table is authoritative for games it lists.
 * A listed manual/Nexus/Discord source must never be replaced by a fuzzy
 * match to an unrelated generic nightly addon.
 */
fn official_renodx_addon_filename(
    url: &str,
    architecture: &str,
) -> Option<String> {
    let without_fragment =
        url.split('#').next().unwrap_or(url);

    let without_query =
        without_fragment
            .split('?')
            .next()
            .unwrap_or(without_fragment);

    let filename =
        without_query
            .rsplit('/')
            .next()
            .unwrap_or("")
            .trim();

    if filename.is_empty() {
        return None;
    }

    let lower =
        filename.to_ascii_lowercase();

    let expected_suffix =
        if architecture == "32-bit" {
            ".addon32"
        } else {
            ".addon64"
        };

    if lower.ends_with(expected_suffix) {
        Some(filename.to_string())
    } else {
        None
    }
}


fn official_renodx_manual_message(
    matched_name: Option<&str>,
    source_url: Option<&str>,
) -> String {
    let title =
        matched_name
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("This game");

    match source_url {
        Some(url) if !url.trim().is_empty() =>
            format!(
                "{} is supported by RenoDX, but the official Mods list points to a manual download source rather than a direct addon file. Manual installation is required: {}",
                title,
                url
            ),

        _ =>
            format!(
                "{} is supported by RenoDX, but the official Mods list does not publish a direct addon file. Manual installation is required.",
                title
            ),
    }
}


#[tauri::command]
pub async fn get_renodx_package_info(
    game_name: String,
    renodx_match_name: Option<String>,
    architecture: String,
) -> Result<PackageInfo, String> {
    /*
     * Phase 6.2 authoritative-source gate.
     *
     * If the official RenoDX table contains this game, this block decides
     * whether GameAtlas may auto-install it. Only an architecture-matching
     * direct .addon64/.addon32 URL is eligible.
     *
     * If the official source is Nexus, Discord, another webpage, or no direct
     * URL at all, return "manual required" here and DO NOT allow the resolver
     * below to substitute a fuzzy package.
     */
    let official_lookup_name =
        renodx_match_name
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| game_name.clone());

    let official_status =
        crate::renodx::get_renodx_mod_status(
            official_lookup_name.clone()
        )
        .await?;

    if official_status.renodx.found {
        let official_matched_name =
            official_status
                .renodx
                .matched_name
                .clone()
                .or_else(|| {
                    Some(official_lookup_name.clone())
                });

        if let Some(official_url) =
            official_status
                .renodx
                .download_url
                .clone()
        {
            if let Some(official_asset_name) =
                official_renodx_addon_filename(
                    &official_url,
                    &architecture,
                )
            {
                return Ok(
                    PackageInfo {
                        found: true,
                        release_tag:
                            Some(
                                "official-mods-list"
                                    .to_string()
                            ),
                        release_name:
                            official_matched_name,
                        asset_name:
                            Some(
                                official_asset_name
                                    .clone()
                            ),
                        asset_url:
                            Some(official_url),
                        asset_size_bytes:
                            None,
                        match_type:
                            "official-direct"
                                .to_string(),
                        message:
                            format!(
                                "Matched {} from the official RenoDX Mods list.",
                                official_asset_name
                            ),
                    }
                );
            }

            return Ok(
                PackageInfo {
                    found: false,
                    release_tag:
                        Some(
                            "official-mods-list"
                                .to_string()
                        ),
                    release_name:
                        official_matched_name
                            .clone(),
                    asset_name: None,
                    asset_url: None,
                    asset_size_bytes: None,
                    match_type:
                        "official-manual"
                            .to_string(),
                    message:
                        official_renodx_manual_message(
                            official_matched_name
                                .as_deref(),
                            Some(
                                official_url
                                    .as_str()
                            ),
                        ),
                }
            );
        }

        return Ok(
            PackageInfo {
                found: false,
                release_tag:
                    Some(
                        "official-mods-list"
                            .to_string()
                    ),
                release_name:
                    official_matched_name
                        .clone(),
                asset_name: None,
                asset_url: None,
                asset_size_bytes: None,
                match_type:
                    "official-manual"
                        .to_string(),
                message:
                    official_renodx_manual_message(
                        official_matched_name
                            .as_deref(),
                        None,
                    ),
            }
        );
    }


    /*
     * Primary source: the official RenoDX Mods list.
     *
     * The list is authoritative for where each game is actually hosted.
     * Many addons live in contributor repositories or GitHub Pages and
     * therefore do not exist in clshortfuse/renodx release assets.
     */
    if let Some(package) = official_package(
        &game_name,
        renodx_match_name.as_deref(),
        &architecture,
    )
    .await?
    {
        return Ok(package);
    }

    /*
     * Compatibility fallback:
     * Some addons may still exist only in clshortfuse release assets.
     * Keep the conservative release matcher for those cases.
     */
    let releases = releases().await?;

    let nightly_releases: Vec<&Release> = releases
        .iter()
        .filter(|release| release.tag_name.starts_with("nightly-"))
        .collect();

    for release in &nightly_releases {
        let package = resolve(
            release,
            &game_name,
            renodx_match_name.as_deref(),
            &architecture,
        );

        if package.found {
            return Ok(package);
        }
    }

    let suffix = if architecture == "32-bit" {
        ".addon32"
    } else {
        ".addon64"
    };

    Ok(PackageInfo {
        found: false,
        release_tag: None,
        release_name: Some("RenoDX official Mods list".to_string()),
        asset_name: None,
        asset_url: None,
        asset_size_bytes: None,
        match_type: "none".to_string(),
        message: format!(
            "RenoDX support is reported, but the official Mods list does not expose a direct {} download for this game.",
            suffix
        ),
    })
}

fn backup_existing(path: &Path, game_key: &str) -> Result<Option<PathBuf>, String> {
    if !path.is_file() {
        return Ok(None);
    }
    let dir = backup_root()?.join(game_key).join(stamp()).join("renodx");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Could not create RenoDX backup directory: {}", e))?;
    let name = path
        .file_name()
        .ok_or_else(|| "Could not determine RenoDX filename.".to_string())?;
    let dest = dir.join(name);
    fs::copy(path, &dest).map_err(|e| format!("Could not back up RenoDX file: {}", e))?;
    Ok(Some(dest))
}

#[tauri::command]
pub async fn install_renodx_package_linux(
    game_name: String,
    renodx_match_name: Option<String>,
    architecture: String,
    binary_directory: String,
    game_key: String,
) -> Result<InstallResult, String> {
    

    let package = get_renodx_package_info(game_name, renodx_match_name, architecture).await?;
if !package.found {
    return Err(package.message);
}
let asset_name = package
    .asset_name
    .clone()
    .ok_or_else(|| "RenoDX asset name is missing.".to_string())?;
let asset_url = package
    .asset_url
    .clone()
    .ok_or_else(|| "RenoDX asset URL is missing.".to_string())?;
let release_tag = package
    .release_tag
    .clone()
    .ok_or_else(|| "RenoDX release tag is missing.".to_string())?;
let expected = package.asset_size_bytes.unwrap_or(0);
let target = PathBuf::from(binary_directory);
if !target.is_dir() {
    return Err(format!(
        "RenoDX target directory does not exist: {}",
        target.display()
    ));
}

let bytes = reqwest::Client::builder()
    .user_agent("GameAtlas/2.1 RenoDX Manager")
    .build()
    .map_err(|e| e.to_string())?
    .get(&asset_url)
    .header("Accept", "application/octet-stream")
    .send()
    .await
    .map_err(|e| format!("Could not download RenoDX: {}", e))?
    .error_for_status()
    .map_err(|e| format!("RenoDX download returned an error: {}", e))?
    .bytes()
    .await
    .map_err(|e| e.to_string())?;

if bytes.len() < 100_000 {
    return Err(format!(
        "Downloaded RenoDX asset is unexpectedly small ({} bytes).",
        bytes.len()
    ));
}
if expected > 0 && bytes.len() as u64 != expected {
    return Err(format!(
        "RenoDX download size mismatch: expected {} bytes, downloaded {} bytes.",
        expected,
        bytes.len()
    ));
}

let destination = target.join(&asset_name);
let backup = backup_existing(&destination, &game_key)?;
let temporary = target.join(format!("{}.gameatlas-tmp", asset_name));
fs::write(&temporary, &bytes)
    .map_err(|e| format!("Could not write RenoDX temp file: {}", e))?;
let temp_size = fs::metadata(&temporary).map_err(|e| e.to_string())?.len();
if temp_size != bytes.len() as u64 {
    let _ = fs::remove_file(&temporary);
    return Err("RenoDX write verification failed before commit.".to_string());
}
if destination.exists() {
    fs::remove_file(&destination)
        .map_err(|e| format!("Could not replace existing RenoDX file: {}", e))?;
}
fs::rename(&temporary, &destination)
    .map_err(|e| format!("Could not commit RenoDX file: {}", e))?;
let final_size = fs::metadata(&destination)
    .map_err(|e| format!("RenoDX final verification failed: {}", e))?
    .len();
if final_size != bytes.len() as u64 {
    return Err(format!(
        "RenoDX final size verification failed: expected {} bytes, found {} bytes.",
        bytes.len(),
        final_size
    ));
}

Ok(InstallResult {
    installed: true,
    release_tag,
    asset_name: asset_name.clone(),
    installed_path: destination.to_string_lossy().to_string(),
    installed_size_bytes: final_size,
    backup_path: backup.map(|p| p.to_string_lossy().to_string()),
    message: format!("RenoDX installed and verified: {}.", destination.display()),
})
}

#[tauri::command]
pub async fn uninstall_renodx_package_linux(
    asset_name: String,
    binary_directory: String,
    game_key: String,
) -> Result<UninstallResult, String> {
    

    if asset_name.trim().is_empty() {
    return Err("RenoDX asset name is missing.".to_string());
}

let file_name = Path::new(&asset_name)
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| "RenoDX asset name is invalid.".to_string())?;

if file_name != asset_name {
    return Err("RenoDX uninstall refused a non-filename asset path.".to_string());
}

let lower = file_name.to_ascii_lowercase();
if !(lower.ends_with(".addon64") || lower.ends_with(".addon32")) {
    return Err(format!(
        "RenoDX uninstall refused unexpected file type: {}",
        file_name
    ));
}

let target = PathBuf::from(binary_directory);
if !target.is_dir() {
    return Err(format!(
        "RenoDX target directory does not exist: {}",
        target.display()
    ));
}

let destination = target.join(file_name);
if !destination.is_file() {
    return Err(format!(
        "RenoDX file is not installed at the expected path: {}",
        destination.display()
    ));
}

let backup = backup_existing(&destination, &game_key)?;
fs::remove_file(&destination)
    .map_err(|e| format!("Could not remove RenoDX file: {}", e))?;

if destination.exists() {
    return Err(format!(
        "RenoDX uninstall verification failed; file still exists: {}",
        destination.display()
    ));
}

Ok(UninstallResult {
    removed: true,
    asset_name: file_name.to_string(),
    removed_path: destination.to_string_lossy().to_string(),
    backup_path: backup.map(|path| path.to_string_lossy().to_string()),
    message: format!(
        "RenoDX removed safely. Backup saved before removal: {}.",
        file_name
    ),
})
}


fn latest_renodx_backup(
    game_key: &str,
) -> Result<Option<(u64, PathBuf)>, String> {
    let game_root = backup_root()?.join(game_key);

    if !game_root.is_dir() {
        return Ok(None);
    }

    let mut best: Option<(u64, PathBuf)> = None;

    let entries = fs::read_dir(&game_root)
        .map_err(|e| format!("Could not read RenoDX backup directory: {}", e))?;

    for entry in entries.flatten() {
        let stamp_dir = entry.path();

        if !stamp_dir.is_dir() {
            continue;
        }

        let stamp_value = stamp_dir
            .file_name()
            .and_then(|value| value.to_str())
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(0);

        let renodx_dir = stamp_dir.join("renodx");

        if !renodx_dir.is_dir() {
            continue;
        }

        let Ok(files) = fs::read_dir(&renodx_dir) else {
            continue;
        };

        for file in files.flatten() {
            let path = file.path();

            if !path.is_file() {
                continue;
            }

            let lower = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();

            if !(lower.ends_with(".addon64") || lower.ends_with(".addon32")) {
                continue;
            }

            let replace = best
                .as_ref()
                .map(|(current_stamp, _)| stamp_value > *current_stamp)
                .unwrap_or(true);

            if replace {
                best = Some((stamp_value, path));
            }
        }
    }

    Ok(best)
}

fn validate_renodx_filename(
    asset_name: &str,
) -> Result<&str, String> {
    if asset_name.trim().is_empty() {
        return Err("RenoDX filename is missing.".to_string());
    }

    let file_name = Path::new(asset_name)
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "RenoDX filename is invalid.".to_string())?;

    if file_name != asset_name {
        return Err(
            "RenoDX restore refused a filename containing a path.".to_string()
        );
    }

    let lower = file_name.to_ascii_lowercase();

    if !(lower.ends_with(".addon64") || lower.ends_with(".addon32")) {
        return Err(format!(
            "RenoDX restore refused unexpected file type: {}",
            file_name
        ));
    }

    Ok(file_name)
}

#[tauri::command]
pub fn get_latest_renodx_backup(
    game_key: String,
) -> Result<RenoDxBackupInfo, String> {
    let Some((created_unix, path)) =
        latest_renodx_backup(&game_key)?
    else {
        return Ok(RenoDxBackupInfo {
            found: false,
            asset_name: None,
            backup_path: None,
            created_unix: None,
            size_bytes: None,
            message: "No RenoDX backup is available for this game.".to_string(),
        });
    };

    let asset_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Could not determine RenoDX backup filename.".to_string())?
        .to_string();

    validate_renodx_filename(&asset_name)?;

    let size_bytes = fs::metadata(&path)
        .map_err(|e| format!("Could not inspect RenoDX backup: {}", e))?
        .len();

    Ok(RenoDxBackupInfo {
        found: true,
        asset_name: Some(asset_name.clone()),
        backup_path: Some(path.to_string_lossy().to_string()),
        created_unix: Some(created_unix),
        size_bytes: Some(size_bytes),
        message: format!(
            "Previous RenoDX backup is available: {}.",
            asset_name
        ),
    })
}

#[tauri::command]
pub fn restore_latest_renodx_backup_linux(
    game_key: String,
    binary_directory: String,
    current_asset_name: Option<String>,
) -> Result<RestoreResult, String> {
    

    let Some((_created_unix, backup_path)) =
    latest_renodx_backup(&game_key)?
else {
    return Err(
        "No RenoDX backup is available for this game.".to_string()
    );
};

if !backup_path.is_file() {
    return Err(format!(
        "RenoDX backup no longer exists: {}",
        backup_path.display()
    ));
}

let backup_name = backup_path
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| {
        "Could not determine RenoDX backup filename.".to_string()
    })?
    .to_string();

let backup_name = validate_renodx_filename(&backup_name)?.to_string();

let target = PathBuf::from(binary_directory);

if !target.is_dir() {
    return Err(format!(
        "RenoDX target directory does not exist: {}",
        target.display()
    ));
}

let destination = target.join(&backup_name);
let mut safety_backup: Option<PathBuf> = None;

if let Some(current_name) = current_asset_name.as_deref() {
    let current_name = validate_renodx_filename(current_name)?;
    let current_path = target.join(current_name);

    if current_path.is_file() && current_path != destination {
        safety_backup = backup_existing(
            &current_path,
            &game_key,
        )?;

        fs::remove_file(&current_path)
            .map_err(|e| {
                format!(
                    "Could not remove current RenoDX file before restore: {}",
                    e
                )
            })?;
    }
}

if destination.is_file() {
    let same_name_backup = backup_existing(
        &destination,
        &game_key,
    )?;

    if safety_backup.is_none() {
        safety_backup = same_name_backup;
    }
}

let backup_size = fs::metadata(&backup_path)
    .map_err(|e| format!("Could not inspect RenoDX backup: {}", e))?
    .len();

let temporary = target.join(
    format!("{}.gameatlas-restore-tmp", backup_name)
);

fs::copy(&backup_path, &temporary)
    .map_err(|e| format!("Could not stage RenoDX restore: {}", e))?;

let temporary_size = fs::metadata(&temporary)
    .map_err(|e| format!("Could not verify staged RenoDX restore: {}", e))?
    .len();

if temporary_size != backup_size {
    let _ = fs::remove_file(&temporary);

    return Err(
        "RenoDX restore verification failed before commit.".to_string()
    );
}

if destination.exists() {
    fs::remove_file(&destination)
        .map_err(|e| {
            format!(
                "Could not replace current RenoDX file during restore: {}",
                e
            )
        })?;
}

fs::rename(&temporary, &destination)
    .map_err(|e| format!("Could not commit RenoDX restore: {}", e))?;

let final_size = fs::metadata(&destination)
    .map_err(|e| format!("Could not verify restored RenoDX file: {}", e))?
    .len();

if final_size != backup_size {
    return Err(
        "RenoDX restore verification failed after commit.".to_string()
    );
}

Ok(RestoreResult {
    restored: true,
    asset_name: backup_name.clone(),
    restored_path: destination.to_string_lossy().to_string(),
    restored_size_bytes: final_size,
    source_backup_path: backup_path.to_string_lossy().to_string(),
    safety_backup_path: safety_backup
        .map(|path| path.to_string_lossy().to_string()),
    message: format!(
        "Previous RenoDX backup restored and verified: {}.",
        backup_name
    ),
})
}


#[tauri::command]
pub async fn get_renodx_update_status_linux(
    game_name: String,
    renodx_match_name: Option<String>,
    architecture: String,
    binary_directory: String,
    installed_asset_name: Option<String>,
) -> Result<RenoDxUpdateStatus, String> {
    

    let target =
    PathBuf::from(
        binary_directory
    );

if !target.is_dir() {
    return Err(
        format!(
            "RenoDX target directory does not exist: {}",
            target.display()
        )
    );
}

/*
 * Resolve the official package FIRST.
 *
 * An update can change the addon filename. In that case an older
 * addon may still exist in the game directory and the readiness
 * scan can return that stale file first. The current official
 * filename is therefore authoritative when it is already present.
 */
let package =
    get_renodx_package_info(
        game_name,
        renodx_match_name,
        architecture,
    )
    .await?;

if !package.found {
    return Ok(RenoDxUpdateStatus {
        checked: false,
        state: "unavailable".to_string(),
        installed_asset_name,
        available_asset_name: None,
        installed_size_bytes: None,
        available_size_bytes: None,
        message:
            package.message,
    });
}

let available_name =
    package
        .asset_name
        .clone()
        .ok_or_else(
            || {
                "RenoDX package filename is missing."
                    .to_string()
            }
        )?;

validate_renodx_filename(
    &available_name
)?;

let official_local_path =
    target.join(
        &available_name
    );

let comparison_name =
    if official_local_path.is_file() {
        available_name.clone()
    } else if let Some(
        detected_name
    ) = installed_asset_name
    {
        validate_renodx_filename(
            &detected_name
        )?
        .to_string()
    } else {
        return Ok(
            RenoDxUpdateStatus {
                checked: true,
                state:
                    "not-installed"
                        .to_string(),
                installed_asset_name:
                    None,
                available_asset_name:
                    Some(
                        available_name
                    ),
                installed_size_bytes:
                    None,
                available_size_bytes:
                    package
                        .asset_size_bytes,
                message:
                    "RenoDX is not currently installed."
                        .to_string(),
            }
        );
    };

let installed_path =
    target.join(
        &comparison_name
    );

if !installed_path.is_file() {
    return Ok(
        RenoDxUpdateStatus {
            checked: true,
            state:
                "not-installed"
                    .to_string(),
            installed_asset_name:
                Some(
                    comparison_name
                ),
            available_asset_name:
                Some(
                    available_name
                ),
            installed_size_bytes:
                None,
            available_size_bytes:
                package
                    .asset_size_bytes,
            message:
                "GameAtlas no longer finds the detected RenoDX addon."
                    .to_string(),
        }
    );
}

let installed_size =
    fs::metadata(
        &installed_path
    )
    .map_err(
        |e| {
            format!(
                "Could not inspect installed RenoDX addon: {}",
                e
            )
        }
    )?
    .len();

let asset_url =
    package
        .asset_url
        .clone()
        .ok_or_else(
            || {
                "RenoDX package URL is missing."
                    .to_string()
            }
        )?;

let expected_size =
    package
        .asset_size_bytes
        .unwrap_or(0);

let available_bytes =
    reqwest::Client::builder()
        .user_agent(
            "GameAtlas/2.1 RenoDX Manager"
        )
        .build()
        .map_err(
            |e| e.to_string()
        )?
        .get(
            &asset_url
        )
        .header(
            "Accept",
            "application/octet-stream",
        )
        .send()
        .await
        .map_err(
            |e| {
                format!(
                    "Could not download current RenoDX build for comparison: {}",
                    e
                )
            }
        )?
        .error_for_status()
        .map_err(
            |e| {
                format!(
                    "Current RenoDX build returned an error: {}",
                    e
                )
            }
        )?
        .bytes()
        .await
        .map_err(
            |e| {
                format!(
                    "Could not read current RenoDX build: {}",
                    e
                )
            }
        )?;

if available_bytes.len()
    < 100_000
{
    return Err(
        format!(
            "Current RenoDX addon is unexpectedly small ({} bytes).",
            available_bytes.len()
        )
    );
}

if expected_size > 0
    && available_bytes.len()
        as u64
        != expected_size
{
    return Err(
        format!(
            "RenoDX comparison download size mismatch: expected {} bytes, downloaded {} bytes.",
            expected_size,
            available_bytes.len()
        )
    );
}

let available_size =
    available_bytes.len()
        as u64;

let is_current =
    if installed_size
        != available_size
    {
        false
    } else {
        let installed_bytes =
            fs::read(
                &installed_path
            )
            .map_err(
                |e| {
                    format!(
                        "Could not read installed RenoDX addon for comparison: {}",
                        e
                    )
                }
            )?;

        installed_bytes
            .as_slice()
            == available_bytes
                .as_ref()
    };

if is_current {
    Ok(
        RenoDxUpdateStatus {
            checked: true,
            state:
                "up-to-date"
                    .to_string(),
            installed_asset_name:
                Some(
                    comparison_name
                ),
            available_asset_name:
                Some(
                    available_name
                ),
            installed_size_bytes:
                Some(
                    installed_size
                ),
            available_size_bytes:
                Some(
                    available_size
                ),
            message:
                "Installed RenoDX exactly matches the current official build."
                    .to_string(),
        }
    )
} else {
    Ok(
        RenoDxUpdateStatus {
            checked: true,
            state:
                "update-available"
                    .to_string(),
            installed_asset_name:
                Some(
                    comparison_name
                ),
            available_asset_name:
                Some(
                    available_name
                ),
            installed_size_bytes:
                Some(
                    installed_size
                ),
            available_size_bytes:
                Some(
                    available_size
                ),
            message:
                "A newer or different official RenoDX build is available."
                    .to_string(),
        }
    )
}
}

