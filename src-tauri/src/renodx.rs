use serde::Serialize;

const RENODX_RAW_URL: &str = "https://raw.githubusercontent.com/wiki/clshortfuse/renodx/Mods.md";

const RENODX_PAGE_URL: &str = "https://github.com/clshortfuse/renodx/wiki/Mods";

const LUMA_RAW_URL: &str =
    "https://raw.githubusercontent.com/wiki/Filoppi/Luma-Framework/Mods-List.md";

const LUMA_PAGE_URL: &str = "https://github.com/Filoppi/Luma-Framework/wiki/Mods-List";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModSourceStatus {
    pub found: bool,
    pub available: bool,

    pub status: String,

    pub matched_name: Option<String>,
    pub category: Option<String>,
    pub notes: Option<String>,

    pub page_url: String,
    pub download_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HdrModStatus {
    /*
     * True when at least one usable RenoDX or Luma
     * implementation exists.
     */
    pub available: bool,

    /*
     * renodx
     * luma
     * both
     * none
     */
    pub preferred_source: String,

    pub renodx: ModSourceStatus,
    pub luma: ModSourceStatus,
}

fn empty_source(page_url: &str) -> ModSourceStatus {
    ModSourceStatus {
        found: false,
        available: false,

        status: "not_found".to_string(),

        matched_name: None,
        category: None,
        notes: None,

        page_url: page_url.to_string(),

        download_url: None,
    }
}

/*
 * ============================================================
 * NAME MATCHING
 * ============================================================
 */

fn normalize_game_name(value: &str) -> String {
    let mut output = String::new();

    for character in value.to_lowercase().chars() {
        /*
         * Remove common trademark symbols and normalize
         * punctuation into spaces.
         */
        if character.is_alphanumeric() {
            output.push(character);
        } else {
            output.push(' ');
        }
    }

    output.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn strip_common_suffixes(value: &str) -> String {
    let mut normalized = normalize_game_name(value);

    for suffix in [
        " dx11",
        " dx12",
        " dx10",
        " directx 11",
        " directx 12",
        " steam",
        " gog",
        " epic",
    ] {
        if normalized.ends_with(suffix) {
            let new_len = normalized.len() - suffix.len();

            normalized = normalized[..new_len].trim().to_string();
        }
    }

    normalized
}

fn name_match_score(requested_name: &str, candidate_name: &str) -> i32 {
    let requested = strip_common_suffixes(requested_name);

    let candidate = strip_common_suffixes(candidate_name);

    if requested.is_empty() || candidate.is_empty() {
        return 0;
    }

    /*
     * Exact normalized match.
     */
    if requested == candidate {
        return 100;
    }

    /*
     * Handle combined rows such as:
     *
     * Dishonored 2 + Death of the Outsider
     * Batman Arkham City + Origin
     * Metro Redux (2033 and Last Light)
     */
    if candidate.contains(&requested) && requested.len() >= 5 {
        return 90;
    }

    if requested.contains(&candidate) && candidate.len() >= 5 {
        return 85;
    }

    /*
     * Token comparison for slightly different storefront
     * names. Require nearly all of the shorter title's
     * significant words.
     */
    let requested_tokens: Vec<&str> = requested
        .split_whitespace()
        .filter(|token| token.len() > 1)
        .collect();

    let candidate_tokens: Vec<&str> = candidate
        .split_whitespace()
        .filter(|token| token.len() > 1)
        .collect();

    if requested_tokens.is_empty() || candidate_tokens.is_empty() {
        return 0;
    }

    let matches = requested_tokens
        .iter()
        .filter(|token| candidate_tokens.contains(token))
        .count();

    let shorter = requested_tokens.len().min(candidate_tokens.len());

    if shorter >= 2 && matches == shorter {
        return 75;
    }

    0
}

/*
 * ============================================================
 * MARKDOWN HELPERS
 * ============================================================
 */

fn markdown_label(value: &str) -> String {
    let mut output = value.trim().to_string();

    /*
     * Convert:
     *
     * [Arknights: Endfield](url)
     *
     * to:
     *
     * Arknights: Endfield
     */
    if output.starts_with('[') {
        if let Some(close) = output.find("](") {
            output = output[1..close].to_string();
        }
    }

    output
        .replace("**", "")
        .replace("__", "")
        .replace('`', "")
        .trim()
        .to_string()
}

fn first_markdown_url(value: &str) -> Option<String> {
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

        if url.starts_with("http://") || url.starts_with("https://") {
            /*
             * Skip shield/badge image URLs.
             */
            if !url.contains("img.shields.io") {
                return Some(url.to_string());
            }
        }

        search_from = end + 1;
    }

    None
}

fn clean_markdown_text(value: &str) -> Option<String> {
    let mut output = value
        .replace("<br>", " ")
        .replace("<br/>", " ")
        .replace("<br />", " ")
        .replace("**", "")
        .replace("__", "")
        .replace('`', "");

    /*
     * Remove simple HTML detail wrappers.
     */
    for tag in ["<details>", "</details>", "<summary>", "</summary>"] {
        output = output.replace(tag, " ");
    }

    let output = output
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();

    if output.is_empty() {
        None
    } else {
        Some(output)
    }
}

fn is_status_only_text(value: &str) -> bool {
    let normalized = value.trim().to_lowercase().replace(' ', "");

    matches!(
        normalized.as_str(),
        ":white_check_mark:"
            | ":heavy_check_mark:"
            | ":checkered_flag:"
            | ":construction:"
            | ":bulb:"
            | ":no_entry:"
            | ":x:"
            | ":cross_mark:"
            | "✅"
            | "✔"
            | "☑"
            | "🚧"
            | "💡"
            | "⛔"
            | "❌"
            | "working"
            | "in_progress"
            | "in-progress"
            | "planned"
            | "incompatible"
    )
}

fn clean_mod_notes(value: &str) -> Option<String> {
    let cleaned = clean_markdown_text(value)?;

    if is_status_only_text(&cleaned) {
        None
    } else {
        Some(cleaned)
    }
}

fn split_markdown_row(line: &str) -> Vec<String> {
    line.trim()
        .trim_start_matches('|')
        .trim_end_matches('|')
        .split('|')
        .map(|part| part.trim().to_string())
        .collect()
}

fn is_separator_row(parts: &[String]) -> bool {
    if parts.is_empty() {
        return true;
    }

    parts.iter().all(|part| {
        let compact = part.replace(':', "").replace('-', "").trim().to_string();

        compact.is_empty()
    })
}

/*
 * ============================================================
 * RENODX PARSER
 * ============================================================
 */

fn parse_renodx_status(markdown: &str, game_name: &str) -> ModSourceStatus {
    let mut best_match: Option<(i32, ModSourceStatus)> = None;

    let mut current_category = "RenoDX".to_string();

    let mut in_deprecated = false;

    for line in markdown.lines() {
        let trimmed = line.trim();

        if trimmed.eq_ignore_ascii_case("# Deprecated mods") {
            in_deprecated = true;

            continue;
        }

        if in_deprecated {
            continue;
        }

        if trimmed.starts_with('#') {
            current_category = trimmed.trim_start_matches('#').trim().to_string();

            continue;
        }

        if !trimmed.starts_with('|') {
            continue;
        }

        let parts = split_markdown_row(trimmed);

        if parts.len() < 2 || is_separator_row(&parts) {
            continue;
        }

        let raw_name = &parts[0];

        if raw_name.eq_ignore_ascii_case("name") {
            continue;
        }

        let candidate_name = markdown_label(raw_name);

        let score = name_match_score(game_name, &candidate_name);

        if score == 0 {
            continue;
        }

        /*
         * RenoDX's normal list uses:
         *
         * Name | Maintainer | Links | Status
         *
         * Some generic engine tables use slightly
         * different columns, so status detection scans
         * the whole row.
         */
        let full_row = parts.join(" ");

        let status = if full_row.contains(":white_check_mark:") {
            "working"
        } else if full_row.contains(":construction:") {
            "in_progress"
        } else {
            "listed"
        };

        let available = status == "working" || status == "in_progress";

        let links = parts.get(2).map(|value| value.as_str()).unwrap_or("");

        let notes = if parts.len() >= 4 {
            clean_mod_notes(&parts[parts.len() - 1])
        } else {
            None
        };

        let result = ModSourceStatus {
            found: true,
            available,

            status: status.to_string(),

            matched_name: Some(candidate_name),

            category: if current_category.eq_ignore_ascii_case("legend") {
                None
            } else {
                Some(current_category.clone())
            },

            notes,

            page_url: RENODX_PAGE_URL.to_string(),

            download_url: first_markdown_url(links),
        };

        let replace = best_match
            .as_ref()
            .map(|(current_score, current_result)| {
                score > *current_score
                    || (score == *current_score && result.available && !current_result.available)
            })
            .unwrap_or(true);

        if replace {
            best_match = Some((score, result));
        }
    }

    best_match
        .map(|(_, result)| result)
        .unwrap_or_else(|| empty_source(RENODX_PAGE_URL))
}

/*
 * ============================================================
 * LUMA PARSER
 * ============================================================
 */

fn luma_status_rank(status: &str) -> i32 {
    match status {
        "working" => 4,
        "in_progress" => 3,
        "planned" => 2,
        "incompatible" => 1,
        _ => 0,
    }
}

fn status_from_luma_symbol(value: &str) -> &'static str {
    if value.contains('✅') {
        "working"
    } else if value.contains('🚧') {
        "in_progress"
    } else if value.contains('💡') {
        "planned"
    } else if value.contains('⛔') {
        "incompatible"
    } else {
        "listed"
    }
}

fn luma_available(status: &str) -> bool {
    status == "working" || status == "in_progress"
}

fn parse_luma_status(markdown: &str, game_name: &str) -> ModSourceStatus {
    let mut best_match: Option<(i32, i32, ModSourceStatus)> = None;

    let mut section = String::new();

    for line in markdown.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with('#') {
            section = trimmed.trim_start_matches('#').trim().to_string();

            continue;
        }

        if !trimmed.starts_with('|') {
            continue;
        }

        let parts = split_markdown_row(trimmed);

        if parts.len() < 2 || is_separator_row(&parts) {
            continue;
        }

        let raw_name = &parts[0];

        if raw_name.eq_ignore_ascii_case("name") {
            continue;
        }

        let candidate_name = markdown_label(raw_name);

        let score = name_match_score(game_name, &candidate_name);

        if score == 0 {
            continue;
        }

        let section_lower = section.to_lowercase();

        /*
         * --------------------------------------------------------
         * Completed Mods
         * --------------------------------------------------------
         *
         * Name | Author | Download | Status | Notes | Features
         */
        let (status, download_url, notes, category) = if section_lower == "completed mods" {
            let status_cell = parts.get(3).map(|value| value.as_str()).unwrap_or("");

            let status = status_from_luma_symbol(status_cell);

            let download = parts.get(2).and_then(|value| first_markdown_url(value));

            let notes = parts.get(4).and_then(|value| clean_mod_notes(value));

            (status, download, notes, "Completed Mods".to_string())
        }
        /*
         * ----------------------------------------------------
         * WIP Mods
         * ----------------------------------------------------
         *
         * Name | Author | Status
         */
        else if section_lower == "wip mods" {
            let status_cell = parts.get(2).map(|value| value.as_str()).unwrap_or("");

            let status = status_from_luma_symbol(status_cell);

            (status, None, None, "WIP Mods".to_string())
        }
        /*
         * ----------------------------------------------------
         * Unreal Engine
         * ----------------------------------------------------
         *
         * Name | DLSS/FSR | HDR | Notes | UE version
         */
        else if section_lower == "unreal engine" {
            let dlss_cell = parts.get(1).map(|value| value.as_str()).unwrap_or("");

            let hdr_cell = parts.get(2).map(|value| value.as_str()).unwrap_or("");

            let combined = format!("{} {}", dlss_cell, hdr_cell);

            let status = if combined.contains('✅') {
                "working"
            } else if combined.contains('🚧') {
                "in_progress"
            } else if combined.contains('⛔') {
                "incompatible"
            } else {
                "listed"
            };

            let mut notes = parts.get(3).and_then(|value| clean_markdown_text(value));

            let ue_version = parts
                .get(4)
                .map(|value| value.trim())
                .filter(|value| !value.is_empty());

            if let Some(version) = ue_version {
                let version_note = format!("Unreal Engine {}", version);

                notes = Some(match notes {
                    Some(existing) => format!("{} — {}", existing, version_note),

                    None => version_note,
                });
            }

            (
                    status,

                    /*
                     * Generic UE package URL.
                     */
                    Some(
                        "https://github.com/Filoppi/Luma-Framework/releases/latest/download/Luma-Unreal_Engine.zip"
                            .to_string()
                    ),

                    notes,

                    "Unreal Engine"
                        .to_string(),
                )
        } else {
            continue;
        };

        let result = ModSourceStatus {
            found: true,

            available: luma_available(status),

            status: status.to_string(),

            matched_name: Some(candidate_name),

            category: Some(category),

            notes,

            page_url: LUMA_PAGE_URL.to_string(),

            download_url,
        };

        let status_rank = luma_status_rank(status);

        /*
         * Pick the strongest match:
         *
         * 1. Better title match
         * 2. Working > WIP > Planned > Incompatible
         *
         * This matters because a game can appear in more
         * than one Luma table.
         */
        let replace = best_match
            .as_ref()
            .map(|(current_score, current_rank, _)| {
                score > *current_score || (score == *current_score && status_rank > *current_rank)
            })
            .unwrap_or(true);

        if replace {
            best_match = Some((score, status_rank, result));
        }
    }

    best_match
        .map(|(_, _, result)| result)
        .unwrap_or_else(|| empty_source(LUMA_PAGE_URL))
}

/*
 * ============================================================
 * HTTP
 * ============================================================
 */

async fn fetch_text(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Failed to retrieve {}: {}", url, error))?;

    if !response.status().is_success() {
        return Err(format!("{} returned HTTP {}", url, response.status()));
    }

    response
        .text()
        .await
        .map_err(|error| format!("Failed to read {}: {}", url, error))
}

/*
 * ============================================================
 * TAURI COMMAND
 * ============================================================
 */

#[tauri::command]
pub async fn get_renodx_mod_status(name: String) -> Result<HdrModStatus, String> {
    println!("");
    println!("[HDR MODS] =====================================");
    println!("[HDR MODS] Checking: {}", name);

    let client = reqwest::Client::builder()
        .user_agent("GameManager/0.3.0 HDR mod integration")
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    /*
     * Fetch RenoDX and Luma independently.
     *
     * One source being unavailable should not prevent
     * the other from returning useful information.
     */
    let renodx_markdown = match fetch_text(&client, RENODX_RAW_URL).await {
        Ok(value) => Some(value),

        Err(error) => {
            println!("[HDR MODS] RenoDX lookup failed: {}", error);

            None
        }
    };

    let luma_markdown = match fetch_text(&client, LUMA_RAW_URL).await {
        Ok(value) => Some(value),

        Err(error) => {
            println!("[HDR MODS] Luma lookup failed: {}", error);

            None
        }
    };

    let renodx = renodx_markdown
        .as_deref()
        .map(|markdown| parse_renodx_status(markdown, &name))
        .unwrap_or_else(|| empty_source(RENODX_PAGE_URL));

    let luma = luma_markdown
        .as_deref()
        .map(|markdown| parse_luma_status(markdown, &name))
        .unwrap_or_else(|| empty_source(LUMA_PAGE_URL));

    let available = renodx.available || luma.available;

    let preferred_source = if renodx.available && luma.available {
        "both"
    } else if renodx.available {
        "renodx"
    } else if luma.available {
        "luma"
    } else {
        "none"
    }
    .to_string();

    println!(
        "[HDR MODS] RenoDX: found={}, available={}, status={}, match={:?}",
        renodx.found, renodx.available, renodx.status, renodx.matched_name
    );

    println!(
        "[HDR MODS] Luma: found={}, available={}, status={}, match={:?}",
        luma.found, luma.available, luma.status, luma.matched_name
    );

    println!("[HDR MODS] Any usable mod: {}", available);

    println!("[HDR MODS] =====================================");
    println!("");

    Ok(HdrModStatus {
        available,
        preferred_source,
        renodx,
        luma,
    })
}
