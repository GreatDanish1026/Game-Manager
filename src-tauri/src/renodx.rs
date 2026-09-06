use reqwest::Client;
use serde::Serialize;
use std::time::Duration;

const RENODX_MODS_RAW_URL: &str =
    "https://raw.githubusercontent.com/wiki/clshortfuse/renodx/Mods.md";

const RENODX_MODS_PAGE_URL: &str = "https://github.com/clshortfuse/renodx/wiki/Mods";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenoDxModStatus {
    pub available: bool,
    pub status: String,
    pub matched_name: Option<String>,
    pub category: Option<String>,
    pub notes: Option<String>,
    pub page_url: String,
}

impl RenoDxModStatus {
    fn not_found() -> Self {
        Self {
            available: false,
            status: "not_found".to_string(),
            matched_name: None,
            category: None,
            notes: None,
            page_url: RENODX_MODS_PAGE_URL.to_string(),
        }
    }
}

#[tauri::command]
pub async fn get_renodx_mod_status(name: String) -> Result<RenoDxModStatus, String> {
    println!("========================================");
    println!("[RenoDX] Checking game: {}", name);

    let client = Client::builder()
        .user_agent("GameManager/0.1 RenoDX compatibility checker")
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| format!("Failed to create RenoDX HTTP client: {}", error))?;

    let response = client
        .get(RENODX_MODS_RAW_URL)
        .send()
        .await
        .map_err(|error| format!("Failed to download RenoDX mod list: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "RenoDX mod list returned HTTP {}",
            response.status()
        ));
    }

    let markdown = response
        .text()
        .await
        .map_err(|error| format!("Failed to read RenoDX mod list: {}", error))?;

    let result = find_game_in_markdown(&markdown, &name);

    println!("[RenoDX] Result: {}", result.status);

    if let Some(matched_name) = &result.matched_name {
        println!("[RenoDX] Matched: {}", matched_name);
    }

    if let Some(category) = &result.category {
        println!("[RenoDX] Category: {}", category);
    }

    println!("========================================");

    Ok(result)
}

fn find_game_in_markdown(markdown: &str, game_name: &str) -> RenoDxModStatus {
    let target = normalize_game_name(game_name);

    let target_relaxed = normalize_game_name_relaxed(game_name);

    let mut category = "Dedicated Mod".to_string();

    for line in markdown.lines() {
        let trimmed = line.trim();

        // Anything below this heading should not
        // count as an available RenoDX mod.
        if trimmed.to_lowercase().starts_with("# deprecated mods") {
            break;
        }

        // Track which section of the RenoDX page
        // we're currently parsing.

        if trimmed.starts_with("# List") {
            category = "Dedicated Mod".to_string();
        }

        if trimmed.starts_with("### Unreal Engine") {
            category = "Unreal Engine".to_string();
        }

        if trimmed.starts_with("### UE Extended") {
            category = "UE Extended".to_string();
        }

        if trimmed.to_lowercase().contains("unity") && trimmed.starts_with("###") {
            category = "Unity".to_string();
        }

        if trimmed.starts_with("# Related Mods") {
            category = "Related Mod".to_string();
        }

        // Only Markdown table rows matter.
        if !trimmed.starts_with('|') {
            continue;
        }

        let columns = split_markdown_row(trimmed);

        if columns.len() < 2 {
            continue;
        }

        let raw_name = columns[0].trim();

        if raw_name.is_empty() {
            continue;
        }

        if raw_name.eq_ignore_ascii_case("name") {
            continue;
        }

        if raw_name.starts_with(':') {
            continue;
        }

        let clean_name = clean_markdown_name(raw_name);

        if clean_name.is_empty() {
            continue;
        }

        let normalized = normalize_game_name(&clean_name);

        let relaxed = normalize_game_name_relaxed(&clean_name);

        let exact_match = normalized == target;

        let relaxed_match = relaxed == target_relaxed;

        if !exact_match && !relaxed_match {
            continue;
        }

        let entire_row = columns.join(" ");

        let status = detect_status(&entire_row);

        let available = status != "not_found";

        let notes = extract_notes(&columns);

        return RenoDxModStatus {
            available,
            status: status.to_string(),

            matched_name: Some(clean_name),

            category: Some(category.clone()),

            notes,

            page_url: RENODX_MODS_PAGE_URL.to_string(),
        };
    }

    RenoDxModStatus::not_found()
}

fn detect_status(row: &str) -> &'static str {
    let lower = row.to_lowercase();

    if lower.contains(":white_check_mark:") || row.contains('✅') {
        return "working";
    }

    if lower.contains(":construction:") || row.contains('🚧') {
        return "in_progress";
    }

    // If it exists in the active RenoDX tables
    // but doesn't have one of the standard
    // markers, still report it as listed.
    "listed"
}

fn split_markdown_row(line: &str) -> Vec<String> {
    line.trim_matches('|')
        .split('|')
        .map(|column| column.trim().to_string())
        .collect()
}

fn clean_markdown_name(value: &str) -> String {
    let mut result = value
        .replace("&amp;", "&")
        .replace("<br>", " ")
        .replace("<br/>", " ")
        .replace("<br />", " ");

    // Convert:
    //
    // [Cyberpunk 2077](https://...)
    //
    // into:
    //
    // Cyberpunk 2077

    if result.starts_with('[') {
        if let Some(closing) = result.find("](") {
            result = result[1..closing].to_string();
        }
    }

    result = result.replace('™', "").replace('®', "");

    result.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn normalize_game_name(value: &str) -> String {
    value
        .to_lowercase()
        .replace('™', "")
        .replace('®', "")
        .replace('©', "")
        .replace('’', "'")
        .replace('–', "-")
        .replace('—', "-")
        .replace(':', " ")
        .replace('-', " ")
        .replace('_', " ")
        .replace('.', " ")
        .replace(',', " ")
        .replace('\'', "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn normalize_game_name_relaxed(value: &str) -> String {
    let mut value = value.to_string();

    // Remove parenthetical technical qualifiers
    // such as "(DX12)" and "(DX10)".
    loop {
        let Some(start) = value.find('(') else {
            break;
        };

        let Some(relative_end) = value[start..].find(')') else {
            break;
        };

        let end = start + relative_end;

        value.replace_range(start..=end, " ");
    }

    normalize_game_name(&value)
}

fn extract_notes(columns: &[String]) -> Option<String> {
    if columns.len() < 3 {
        return None;
    }

    // Three-column generic tables use:
    //
    // Name | Status | Notes
    //
    // Four-column dedicated tables use:
    //
    // Name | Maintainer | Links | Status
    //
    // We only want actual notes from the former.

    if columns.len() == 3 {
        let notes = columns[2]
            .replace("<br>", " ")
            .replace("<br/>", " ")
            .replace("<br />", " ");

        let notes = notes.split_whitespace().collect::<Vec<_>>().join(" ");

        if notes.is_empty() {
            None
        } else {
            Some(notes)
        }
    } else {
        None
    }
}
