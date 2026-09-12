use reqwest::Client;
use serde::{Deserialize, Serialize};

const PCGW_BASE_URL: &str = "https://www.pcgamingwiki.com";

const PCGW_API_URL: &str = "https://www.pcgamingwiki.com/w/api.php";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PcgwGameData {
    pub found: bool,

    pub page_name: Option<String>,
    pub page_url: Option<String>,
    pub cover_image_url: Option<String>,

    // ============================================================
    // OVERVIEW
    // ============================================================
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub engine: Option<String>,
    pub release_date: Option<String>,

    // ============================================================
    // ESSENTIAL IMPROVEMENTS
    // ============================================================
    pub essential_improvements_html: Option<String>,

    // ============================================================
    // VIDEO
    // ============================================================
    pub wsgf_link: Option<String>,

    pub widescreen_wsgf_award: Option<String>,
    pub multimonitor_wsgf_award: Option<String>,
    pub ultrawidescreen_wsgf_award: Option<String>,
    pub four_k_ultra_hd_wsgf_award: Option<String>,

    pub widescreen_resolution: Option<String>,
    pub widescreen_resolution_notes: Option<String>,

    pub multimonitor: Option<String>,
    pub multimonitor_notes: Option<String>,

    pub ultrawidescreen: Option<String>,
    pub ultrawidescreen_notes: Option<String>,

    pub four_k_ultra_hd: Option<String>,
    pub four_k_ultra_hd_notes: Option<String>,

    pub fov: Option<String>,
    pub fov_notes: Option<String>,

    pub windowed: Option<String>,
    pub windowed_notes: Option<String>,

    pub borderless_windowed: Option<String>,
    pub borderless_windowed_notes: Option<String>,

    pub anisotropic: Option<String>,
    pub anisotropic_notes: Option<String>,

    pub antialiasing: Option<String>,
    pub antialiasing_notes: Option<String>,

    pub upscaling: Option<String>,
    pub upscaling_tech: Option<String>,
    pub upscaling_notes: Option<String>,

    pub frame_generation: Option<String>,
    pub frame_generation_tech: Option<String>,
    pub frame_generation_notes: Option<String>,

    pub vsync: Option<String>,
    pub vsync_notes: Option<String>,

    pub sixty_fps: Option<String>,
    pub sixty_fps_notes: Option<String>,

    pub one_twenty_fps: Option<String>,
    pub one_twenty_fps_notes: Option<String>,

    pub hdr: Option<String>,
    pub hdr_notes: Option<String>,

    pub ray_tracing: Option<String>,
    pub ray_tracing_notes: Option<String>,

    pub color_blind: Option<String>,
    pub color_blind_notes: Option<String>,

    pub controller_support: Option<String>,

    // ============================================================
    // TECHNICAL INFORMATION
    // ============================================================
    pub graphics_api: Option<String>,
    pub config_location: Option<String>,
    pub save_location: Option<String>,

    // ============================================================
    // CONTROLLERS
    // ============================================================
    pub xbox_controller_support: Option<String>,
    pub xbox_controller_models: Option<String>,

    pub playstation_controller_support: Option<String>,
    pub playstation_controller_models: Option<String>,
    pub playstation_prompts: Option<String>,
    pub playstation_connection_modes: Option<String>,
    pub playstation_motion_sensors: Option<String>,
    pub playstation_light_bar: Option<String>,

    pub dualsense_adaptive_triggers: Option<String>,
    pub dualsense_adaptive_trigger_modes: Option<String>,
    pub dualsense_haptics: Option<String>,

    pub nintendo_controller_support: Option<String>,
    pub nintendo_controller_models: Option<String>,

    pub controller_hotplug: Option<String>,

    pub raw_wikitext_available: bool,
}

// ================================================================
// MEDIAWIKI RESPONSE TYPES
// ================================================================

#[derive(Debug, Deserialize)]
struct ParseApiResponse {
    parse: Option<ParseResult>,
}

#[derive(Debug, Deserialize)]
struct ParseResult {
    title: String,

    wikitext: WikitextResult,

    #[serde(default)]
    sections: Vec<SectionResult>,
}

#[derive(Debug, Deserialize)]
struct SectionResult {
    index: String,
    line: String,
}

#[derive(Debug, Deserialize)]
struct WikitextResult {
    #[serde(rename = "*")]
    content: String,
}

#[derive(Debug, Deserialize)]
struct ParseTextApiResponse {
    parse: Option<ParseTextResult>,
}

#[derive(Debug, Deserialize)]
struct ParseTextResult {
    text: WikitextResult,
}

// ================================================================
// PCGW NAME SEARCH RESULT
// ================================================================

#[derive(Debug)]
struct PcgwNameSearchResult {
    exact: Option<String>,
    fallback: Option<String>,
}

// ================================================================
// EMPTY RESULT
// ================================================================

fn empty_result() -> PcgwGameData {
    PcgwGameData {
        found: false,

        page_name: None,
        page_url: None,
        cover_image_url: None,

        developer: None,
        publisher: None,
        engine: None,
        release_date: None,

        essential_improvements_html: None,

        wsgf_link: None,

        widescreen_wsgf_award: None,
        multimonitor_wsgf_award: None,
        ultrawidescreen_wsgf_award: None,
        four_k_ultra_hd_wsgf_award: None,

        widescreen_resolution: None,
        widescreen_resolution_notes: None,

        multimonitor: None,
        multimonitor_notes: None,

        ultrawidescreen: None,
        ultrawidescreen_notes: None,

        four_k_ultra_hd: None,
        four_k_ultra_hd_notes: None,

        fov: None,
        fov_notes: None,

        windowed: None,
        windowed_notes: None,

        borderless_windowed: None,
        borderless_windowed_notes: None,

        anisotropic: None,
        anisotropic_notes: None,

        antialiasing: None,
        antialiasing_notes: None,

        upscaling: None,
        upscaling_tech: None,
        upscaling_notes: None,

        frame_generation: None,
        frame_generation_tech: None,
        frame_generation_notes: None,

        vsync: None,
        vsync_notes: None,

        sixty_fps: None,
        sixty_fps_notes: None,

        one_twenty_fps: None,
        one_twenty_fps_notes: None,

        hdr: None,
        hdr_notes: None,

        ray_tracing: None,
        ray_tracing_notes: None,

        color_blind: None,
        color_blind_notes: None,

        controller_support: None,

        graphics_api: None,
        config_location: None,
        save_location: None,

        xbox_controller_support: None,
        xbox_controller_models: None,

        playstation_controller_support: None,
        playstation_controller_models: None,
        playstation_prompts: None,
        playstation_connection_modes: None,
        playstation_motion_sensors: None,
        playstation_light_bar: None,

        dualsense_adaptive_triggers: None,
        dualsense_adaptive_trigger_modes: None,
        dualsense_haptics: None,

        nintendo_controller_support: None,
        nintendo_controller_models: None,

        controller_hotplug: None,

        raw_wikitext_available: false,
    }
}

// ================================================================
// GENERIC WIKITEXT HELPERS
// ================================================================

fn normalize_key(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .replace('_', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn strip_html_comments(input: &str) -> String {
    let mut output = input.to_string();

    loop {
        let Some(start) = output.find("<!--") else {
            break;
        };

        let Some(relative_end) = output[start + 4..].find("-->") else {
            break;
        };

        let end = start + 4 + relative_end + 3;

        output.replace_range(start..end, "");
    }

    output
}

fn strip_refs(input: &str) -> String {
    let mut output = input.to_string();

    loop {
        let lower = output.to_ascii_lowercase();

        let Some(start) = lower.find("<ref") else {
            break;
        };

        let remaining = &lower[start..];

        if let Some(end) = remaining.find("/>") {
            output.replace_range(start..start + end + 2, "");

            continue;
        }

        let Some(open_end) = remaining.find('>') else {
            break;
        };

        let after_open = start + open_end + 1;

        let lower_after = output[after_open..].to_ascii_lowercase();

        if let Some(close_relative) = lower_after.find("</ref>") {
            let close_end = after_open + close_relative + "</ref>".len();

            output.replace_range(start..close_end, "");
        } else {
            break;
        }
    }

    output
}

fn strip_wiki_links(input: &str) -> String {
    let mut result = input.to_string();

    loop {
        let Some(start) = result.find("[[") else {
            break;
        };

        let Some(relative_end) = result[start + 2..].find("]]") else {
            break;
        };

        let end = start + 2 + relative_end;

        let contents = result[start + 2..end].to_string();

        let replacement = if let Some(pipe) = contents.rfind('|') {
            contents[pipe + 1..].trim().to_string()
        } else {
            contents.trim().to_string()
        };

        result.replace_range(start..end + 2, &replacement);
    }

    result
}

fn strip_external_links(input: &str) -> String {
    let mut result = input.to_string();

    let mut search_from = 0;

    while search_from < result.len() {
        let Some(relative_start) = result[search_from..].find('[') else {
            break;
        };

        let start = search_from + relative_start;

        if result[start..].starts_with("[[") {
            search_from = start + 2;

            continue;
        }

        let Some(relative_end) = result[start..].find(']') else {
            break;
        };

        let end = start + relative_end;

        let contents = result[start + 1..end].to_string();

        if contents.starts_with("http://") || contents.starts_with("https://") {
            let replacement = if let Some(space) = contents.find(' ') {
                contents[space + 1..].trim().to_string()
            } else {
                contents
            };

            result.replace_range(start..end + 1, &replacement);

            search_from = start + replacement.len();
        } else {
            search_from = end + 1;
        }
    }

    result
}

fn simplify_pcgw_row_templates(input: &str) -> String {
    let mut output = input.to_string();

    loop {
        let lower = output.to_ascii_lowercase();

        let Some(start) = lower.find("{{infobox game/row/") else {
            break;
        };

        let Some(relative_end) = output[start..].find("}}") else {
            break;
        };

        let end = start + relative_end + 2;

        let template = output[start..end].to_string();

        let inner = template.trim_start_matches("{{").trim_end_matches("}}");

        let parts: Vec<&str> = inner.split('|').collect();

        let replacement = if parts.len() >= 2 {
            parts[1..]
                .iter()
                .map(|part| part.trim())
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join(", ")
        } else {
            String::new()
        };

        output.replace_range(start..end, &replacement);
    }

    output
}

fn simplify_templates(input: &str) -> String {
    let mut output = input.to_string();

    for wrapper in [
        "{{Plainlist|",
        "{{plainlist|",
        "{{Plain list|",
        "{{plain list|",
        "{{Unbulleted list|",
        "{{unbulleted list|",
        "{{Flatlist|",
        "{{flatlist|",
    ] {
        output = output.replace(wrapper, "");
    }

    output = output
        .replace("<br />", ", ")
        .replace("<br/>", ", ")
        .replace("<br>", ", ");

    let lines: Vec<String> = output
        .lines()
        .map(|line| {
            line.trim()
                .trim_start_matches('*')
                .trim_start_matches('#')
                .trim()
                .to_string()
        })
        .filter(|line| !line.is_empty())
        .collect();

    output = lines.join(", ");

    while output.trim_end().ends_with("}}") {
        let trimmed = output.trim_end();

        output = trimmed[..trimmed.len() - 2].trim().to_string();
    }

    output
}

fn clean_value(value: &str) -> Option<String> {
    let mut cleaned = simplify_pcgw_row_templates(value);

    cleaned = strip_html_comments(&cleaned);

    cleaned = strip_refs(&cleaned);

    cleaned = strip_wiki_links(&cleaned);

    cleaned = strip_external_links(&cleaned);

    cleaned = simplify_templates(&cleaned);

    cleaned = cleaned
        .replace("'''", "")
        .replace("''", "")
        .replace("&nbsp;", " ")
        .replace("&ndash;", "–")
        .replace("&mdash;", "—");

    let cleaned = cleaned
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches(',')
        .trim()
        .to_string();

    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

// ================================================================
// FEATURE CLEANUP
// ================================================================

/*
 * Remove any leftover balanced {{ ... }} templates.
 *
 * This is intentionally used for display notes only.
 */
fn strip_remaining_templates(input: &str) -> String {
    let mut output = input.to_string();

    loop {
        let Some(start) = output.find("{{") else {
            break;
        };

        let Some((_, end)) = find_complete_template(&output, start) else {
            /*
             * Incomplete template. Drop everything from the
             * opening braces rather than exposing raw markup.
             */
            output.truncate(start);

            break;
        };

        output.replace_range(start..end, "");
    }

    output
}

/*
 * Feature status parameters should be very small values such as:
 *
 * true
 * false
 * limited
 * hackable
 * always on
 *
 * If unrelated wiki content gets attached to the parameter, only
 * keep the first sensible status-sized portion.
 */
fn clean_feature_status(value: Option<String>) -> Option<String> {
    let value = value?;

    let value = strip_remaining_templates(&value);

    /*
     * Stop as soon as obvious table or heading markup appears.
     */
    let mut cutoff = value.len();

    for marker in ["{|", "|}", "==", "\n|", "\n!"] {
        if let Some(position) = value.find(marker) {
            cutoff = cutoff.min(position);
        }
    }

    let first_part = value[..cutoff].lines().next().unwrap_or("").trim();

    let cleaned = first_part
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches(',')
        .trim()
        .to_string();

    if cleaned.is_empty() {
        None
    } else if cleaned.len() > 100 {
        /*
         * A support status should never be a long paragraph.
         * Treat obviously malformed values as unknown.
         */
        None
    } else {
        Some(cleaned)
    }
}

/*
 * Notes can be descriptive, but should not contain raw templates,
 * full wiki tables, or giant settings dumps.
 */
fn clean_feature_note(value: Option<String>) -> Option<String> {
    let value = value?;

    let mut cleaned = strip_remaining_templates(&value);

    /*
     * Drop everything starting with a MediaWiki table.
     */
    if let Some(table_start) = cleaned.find("{|") {
        cleaned.truncate(table_start);
    }

    /*
     * Remove common leftover wiki table delimiters.
     */
    cleaned = cleaned
        .replace("|}", " ")
        .replace("|-", " ")
        .replace("!!", " ")
        .replace("||", " ");

    cleaned = cleaned
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches(',')
        .trim()
        .to_string();

    /*
     * Long notes are useful, but a feature card should not become
     * several screens tall. Keep a readable summary.
     */
    const MAX_NOTE_CHARS: usize = 420;

    if cleaned.len() > MAX_NOTE_CHARS {
        let mut truncate_at = MAX_NOTE_CHARS;

        while truncate_at > 0 && !cleaned.is_char_boundary(truncate_at) {
            truncate_at -= 1;
        }

        cleaned.truncate(truncate_at);

        if let Some(last_space) = cleaned.rfind(' ') {
            cleaned.truncate(last_space);
        }

        cleaned.push('…');
    }

    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn extract_parameter(wikitext: &str, parameter_names: &[&str]) -> Option<String> {
    let normalized_names: Vec<String> = parameter_names
        .iter()
        .map(|name| normalize_key(name))
        .collect();

    let lines: Vec<&str> = wikitext.lines().collect();

    let mut index = 0;

    while index < lines.len() {
        let trimmed = lines[index].trim_start();

        if !trimmed.starts_with('|') {
            index += 1;
            continue;
        }

        let without_pipe = trimmed[1..].trim_start();

        let Some(equals_position) = without_pipe.find('=') else {
            index += 1;
            continue;
        };

        let key = normalize_key(&without_pipe[..equals_position]);

        if !normalized_names.iter().any(|name| name == &key) {
            index += 1;
            continue;
        }

        let mut value = without_pipe[equals_position + 1..].trim().to_string();

        let mut next_index = index + 1;

        while next_index < lines.len() {
            let next_line = lines[next_index];

            let next_trimmed = next_line.trim_start();

            if next_trimmed.starts_with('|') {
                let next_without_pipe = next_trimmed[1..].trim_start();

                if let Some(next_equals) = next_without_pipe.find('=') {
                    let possible_key = next_without_pipe[..next_equals].trim();

                    if !possible_key.is_empty() {
                        break;
                    }
                }
            }

            if !value.is_empty() {
                value.push('\n');
            }

            value.push_str(next_line.trim());

            next_index += 1;
        }

        if let Some(cleaned) = clean_value(&value) {
            return Some(cleaned);
        }

        index = next_index;
    }

    None
}

// ================================================================
// GRAPHICS API
// ================================================================

fn meaningful_api_value(value: Option<String>) -> Option<String> {
    let value = value?;

    let normalized = value.trim().to_lowercase();

    if normalized.is_empty()
        || normalized == "false"
        || normalized == "unknown"
        || normalized == "none"
        || normalized == "n/a"
    {
        return None;
    }

    Some(value)
}

fn graphics_api_entry(label: &str, value: Option<String>) -> Option<String> {
    let value = meaningful_api_value(value)?;

    if value.eq_ignore_ascii_case("true") {
        return Some(label.to_string());
    }

    Some(format!("{} {}", label, value))
}

fn extract_graphics_api(wikitext: &str) -> Option<String> {
    let mut entries = Vec::new();

    for (label, field) in [
        ("Direct3D", "direct3d versions"),
        ("Vulkan", "vulkan versions"),
        ("OpenGL", "opengl versions"),
        ("Glide", "glide versions"),
    ] {
        if let Some(value) = graphics_api_entry(label, extract_parameter(wikitext, &[field])) {
            entries.push(value);
        }
    }

    if let Some(value) =
        graphics_api_entry("Metal", extract_parameter(wikitext, &["metal support"]))
    {
        entries.push(value);
    }

    if entries.is_empty() {
        None
    } else {
        Some(entries.join(", "))
    }
}

// ================================================================
// GAME DATA PATH PARSING
// ================================================================

fn find_complete_template(input: &str, start: usize) -> Option<(String, usize)> {
    let bytes = input.as_bytes();

    let mut index = start;

    let mut depth: i32 = 0;

    while index + 1 < bytes.len() {
        if bytes[index] == b'{' && bytes[index + 1] == b'{' {
            depth += 1;
            index += 2;
            continue;
        }

        if bytes[index] == b'}' && bytes[index + 1] == b'}' {
            depth -= 1;
            index += 2;

            if depth == 0 {
                return Some((input[start..index].to_string(), index));
            }

            continue;
        }

        index += 1;
    }

    None
}

fn find_templates(wikitext: &str, template_name: &str) -> Vec<String> {
    let lower = wikitext.to_ascii_lowercase();

    let marker = format!("{{{{{}|", template_name.to_ascii_lowercase());

    let mut templates = Vec::new();

    let mut search_from = 0;

    while search_from < lower.len() {
        let Some(relative_start) = lower[search_from..].find(&marker) else {
            break;
        };

        let start = search_from + relative_start;

        if let Some((template, end)) = find_complete_template(wikitext, start) {
            templates.push(template);

            search_from = end;
        } else {
            break;
        }
    }

    templates
}

fn split_template_arguments(template: &str) -> Vec<String> {
    let inner = template
        .trim()
        .trim_start_matches("{{")
        .trim_end_matches("}}");

    let bytes = inner.as_bytes();

    let mut parts = Vec::new();

    let mut start = 0;

    let mut index = 0;

    let mut template_depth: i32 = 0;

    let mut link_depth: i32 = 0;

    while index < bytes.len() {
        if index + 1 < bytes.len() && bytes[index] == b'{' && bytes[index + 1] == b'{' {
            template_depth += 1;
            index += 2;
            continue;
        }

        if index + 1 < bytes.len() && bytes[index] == b'}' && bytes[index + 1] == b'}' {
            if template_depth > 0 {
                template_depth -= 1;
            }

            index += 2;
            continue;
        }

        if index + 1 < bytes.len() && bytes[index] == b'[' && bytes[index + 1] == b'[' {
            link_depth += 1;
            index += 2;
            continue;
        }

        if index + 1 < bytes.len() && bytes[index] == b']' && bytes[index + 1] == b']' {
            if link_depth > 0 {
                link_depth -= 1;
            }

            index += 2;
            continue;
        }

        if bytes[index] == b'|' && template_depth == 0 && link_depth == 0 {
            parts.push(inner[start..index].trim().to_string());

            start = index + 1;
        }

        index += 1;
    }

    parts.push(inner[start..].trim().to_string());

    parts
}

fn simplify_path_templates(input: &str) -> String {
    let mut output = input.to_string();

    loop {
        let lower = output.to_ascii_lowercase();

        let Some(start) = lower.find("{{p|") else {
            break;
        };

        let Some(relative_end) = output[start..].find("}}") else {
            break;
        };

        let end = start + relative_end + 2;

        let template = output[start..end].to_string();

        let inner = template.trim_start_matches("{{").trim_end_matches("}}");

        let parts: Vec<&str> = inner.split('|').collect();

        let key = parts
            .get(1)
            .map(|value| value.trim().to_lowercase())
            .unwrap_or_default();

        let replacement = match key.as_str() {
            "userprofile" => "%USERPROFILE%".to_string(),

            "appdata" => "%APPDATA%".to_string(),

            "localappdata" => "%LOCALAPPDATA%".to_string(),

            "programdata" => "%PROGRAMDATA%".to_string(),

            "documents" => "%USERPROFILE%\\Documents".to_string(),

            "savedgames" | "saved games" => "%USERPROFILE%\\Saved Games".to_string(),

            "game" => "<game>".to_string(),

            "steam" => "<Steam>".to_string(),

            "uid" => "<user-id>".to_string(),

            "username" => "<username>".to_string(),

            "" => String::new(),

            _ => format!("<{}>", key),
        };

        output.replace_range(start..end, &replacement);
    }

    output
}

fn clean_game_data_path(path: &str) -> Option<String> {
    let mut cleaned = simplify_path_templates(path);

    cleaned = strip_html_comments(&cleaned);

    cleaned = strip_refs(&cleaned);

    cleaned = strip_wiki_links(&cleaned);

    cleaned = strip_external_links(&cleaned);

    cleaned = cleaned
        .replace("'''", "")
        .replace("''", "")
        .replace("&nbsp;", " ");

    let cleaned = cleaned.trim().to_string();

    if cleaned.is_empty() || cleaned.eq_ignore_ascii_case("unknown") {
        None
    } else {
        Some(cleaned)
    }
}

fn extract_game_data_location(wikitext: &str, template_name: &str) -> Option<String> {
    let templates = find_templates(wikitext, template_name);

    let mut windows_paths = Vec::new();

    let mut fallback_paths = Vec::new();

    for template in templates {
        let parts = split_template_arguments(&template);

        if parts.len() < 3 {
            continue;
        }

        let platform = parts[1].trim();

        let mut paths = Vec::new();

        for raw_path in parts.iter().skip(2) {
            if let Some(path) = clean_game_data_path(raw_path) {
                if !paths.contains(&path) {
                    paths.push(path);
                }
            }
        }

        if paths.is_empty() {
            continue;
        }

        if platform.eq_ignore_ascii_case("windows") {
            windows_paths.extend(paths);
        } else if fallback_paths.is_empty() {
            fallback_paths = paths;
        }
    }

    let mut selected = if !windows_paths.is_empty() {
        windows_paths
    } else {
        fallback_paths
    };

    selected.sort();
    selected.dedup();

    if selected.is_empty() {
        None
    } else {
        Some(selected.join(" | "))
    }
}

// ================================================================
// PAGE URL HELPERS
// ================================================================

fn make_page_url(page_name: &str) -> String {
    let page = page_name.replace(' ', "_");

    format!("{}/wiki/{}", PCGW_BASE_URL, urlencoding::encode(&page))
}

fn page_name_from_url(url: &str) -> Option<String> {
    let marker = "/wiki/";

    let position = url.find(marker)?;

    let encoded_title = &url[position + marker.len()..];

    if encoded_title.is_empty() {
        return None;
    }

    let decoded = urlencoding::decode(encoded_title).ok()?;

    Some(decoded.replace('_', " "))
}

// ================================================================
// STOREFRONT NAME CLEANUP
// ================================================================

fn clean_storefront_game_name(name: &str) -> String {
    let mut cleaned = String::with_capacity(name.len());

    for character in name.chars() {
        match character {
            '™' | '®' | '©' | '℠' => {}

            '\u{00A0}' => {
                cleaned.push(' ');
            }

            _ => {
                cleaned.push(character);
            }
        }
    }

    cleaned.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn pcgw_search_candidates(name: &str) -> Vec<String> {
    let original = name.trim().to_string();

    let cleaned = clean_storefront_game_name(name);

    let mut candidates = Vec::new();

    if !original.is_empty() {
        candidates.push(original.clone());
    }

    if !cleaned.is_empty() && !cleaned.eq_ignore_ascii_case(&original) {
        candidates.push(cleaned);
    }

    candidates
}

// ================================================================
// EXACT STOREFRONT LOOKUPS
// ================================================================

async fn lookup_by_steam_id(client: &Client, app_id: &str) -> Result<Option<String>, String> {
    let url = format!(
        "{}/api/appid.php?appid={}",
        PCGW_BASE_URL,
        urlencoding::encode(app_id)
    );

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|error| format!("Failed Steam PCGW lookup: {}", error))?;

    if !response.status().is_success() {
        return Ok(None);
    }

    Ok(page_name_from_url(response.url().as_str()))
}

async fn lookup_by_gog_id(client: &Client, gog_id: &str) -> Result<Option<String>, String> {
    let url = format!(
        "{}/api/gog.php?page={}",
        PCGW_BASE_URL,
        urlencoding::encode(gog_id)
    );

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|error| format!("Failed GOG PCGW lookup: {}", error))?;

    if !response.status().is_success() {
        return Ok(None);
    }

    Ok(page_name_from_url(response.url().as_str()))
}

// ================================================================
// NAME LOOKUP
// ================================================================

async fn search_pcgw_name(client: &Client, name: &str) -> Result<PcgwNameSearchResult, String> {
    println!("[PCGW] Searching PCGamingWiki for: {:?}", name);

    let response = client
        .get(PCGW_API_URL)
        .query(&[
            ("action", "opensearch"),
            ("search", name),
            ("limit", "10"),
            ("namespace", "0"),
            ("redirects", "resolve"),
            ("format", "json"),
        ])
        .send()
        .await
        .map_err(|error| format!("Failed PCGW search for {:?}: {}", name, error))?;

    if !response.status().is_success() {
        return Err(format!(
            "PCGamingWiki search for {:?} returned HTTP {}",
            name,
            response.status()
        ));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("Invalid PCGW search response for {:?}: {}", name, error))?;

    let Some(results) = json.get(1).and_then(|value| value.as_array()) else {
        return Ok(PcgwNameSearchResult {
            exact: None,

            fallback: None,
        });
    };

    let exact = results
        .iter()
        .filter_map(|value| value.as_str())
        .find(|result| result.eq_ignore_ascii_case(name))
        .map(|result| result.to_string());

    let fallback = results
        .first()
        .and_then(|value| value.as_str())
        .map(|value| value.to_string());

    Ok(PcgwNameSearchResult { exact, fallback })
}

async fn lookup_by_name(client: &Client, name: &str) -> Result<Option<String>, String> {
    let candidates = pcgw_search_candidates(name);

    println!("[PCGW] Name lookup candidates: {:?}", candidates);

    let mut first_fallback: Option<String> = None;

    for candidate in &candidates {
        match search_pcgw_name(client, candidate).await {
            Ok(result) => {
                if let Some(exact) = result.exact {
                    println!("[PCGW] Exact name match {:?} -> {:?}", candidate, exact);

                    return Ok(Some(exact));
                }

                if first_fallback.is_none() {
                    first_fallback = result.fallback;
                }
            }

            Err(error) => {
                println!("[PCGW] Search failed for {:?}: {}", candidate, error);
            }
        }
    }

    if let Some(fallback) = first_fallback {
        println!(
            "[PCGW] No exact match found. Using fuzzy fallback: {:?}",
            fallback
        );

        return Ok(Some(fallback));
    }

    Ok(None)
}

// ================================================================
// GET WIKITEXT + SECTIONS
// ================================================================

async fn get_page_data(
    client: &Client,
    page_name: &str,
) -> Result<Option<(String, String, Option<String>)>, String> {
    let response = client
        .get(PCGW_API_URL)
        .query(&[
            ("action", "parse"),
            ("page", page_name),
            ("redirects", "1"),
            ("prop", "wikitext|sections"),
            ("format", "json"),
        ])
        .send()
        .await
        .map_err(|error| format!("Failed PCGW page request: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "PCGamingWiki page request returned HTTP {}",
            response.status()
        ));
    }

    let parsed: ParseApiResponse = response
        .json()
        .await
        .map_err(|error| format!("Failed PCGW parse response: {}", error))?;

    let Some(parse) = parsed.parse else {
        return Ok(None);
    };

    let essential_section = parse
        .sections
        .iter()
        .find(|section| {
            section
                .line
                .trim()
                .eq_ignore_ascii_case("Essential improvements")
        })
        .map(|section| section.index.clone());

    Ok(Some((
        parse.title,
        parse.wikitext.content,
        essential_section,
    )))
}

// ================================================================
// ESSENTIAL IMPROVEMENTS HTML
// ================================================================

async fn get_section_html(
    client: &Client,
    page_name: &str,
    section_index: &str,
) -> Result<Option<String>, String> {
    let response = client
        .get(PCGW_API_URL)
        .query(&[
            ("action", "parse"),
            ("page", page_name),
            ("redirects", "1"),
            ("section", section_index),
            ("prop", "text"),
            ("format", "json"),
        ])
        .send()
        .await
        .map_err(|error| format!("Failed to retrieve Essential improvements: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "Essential improvements request returned HTTP {}",
            response.status()
        ));
    }

    let parsed: ParseTextApiResponse = response
        .json()
        .await
        .map_err(|error| format!("Failed to parse Essential improvements response: {}", error))?;

    let Some(parse) = parsed.parse else {
        return Ok(None);
    };

    let html = parse.text.content.trim().to_string();

    if html.is_empty() {
        Ok(None)
    } else {
        Ok(Some(html))
    }
}

// ================================================================
// COVER IMAGE
// ================================================================

/*
 * PCGamingWiki stores the infobox cover as a MediaWiki File title,
 * not as a direct image URL. Resolve that title through imageinfo.
 *
 * MediaWiki's image repository handling also allows this to work
 * when the file is provided by a shared repository such as Commons.
 */
async fn get_cover_image_url(
    client: &Client,
    cover_filename: &str,
) -> Result<Option<String>, String> {
    let mut filename = cover_filename.trim().to_string();

    if filename.is_empty()
        || filename.eq_ignore_ascii_case("none")
        || filename.eq_ignore_ascii_case("unknown")
    {
        return Ok(None);
    }

    if filename.to_ascii_lowercase().starts_with("file:") {
        filename = filename["file:".len()..].trim().to_string();
    }

    if filename.is_empty() {
        return Ok(None);
    }

    let file_title = format!("File:{}", filename);

    println!("[PCGW] Resolving cover file: {:?}", file_title);

    let response = client
        .get(PCGW_API_URL)
        .query(&[
            ("action", "query"),
            ("titles", file_title.as_str()),
            ("prop", "imageinfo"),
            ("iiprop", "url"),
            ("iiurlwidth", "600"),
            ("format", "json"),
        ])
        .send()
        .await
        .map_err(|error| format!("Failed to retrieve PCGW cover image: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "PCGW cover image request returned HTTP {}",
            response.status()
        ));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("Failed to parse PCGW cover image response: {}", error))?;

    let Some(pages) = json
        .get("query")
        .and_then(|value| value.get("pages"))
        .and_then(|value| value.as_object())
    else {
        return Ok(None);
    };

    for page in pages.values() {
        let image_info = page
            .get("imageinfo")
            .and_then(|value| value.as_array())
            .and_then(|values| values.first());

        let Some(image_info) = image_info else {
            continue;
        };

        /*
         * Prefer MediaWiki's resized image. It is much smaller than
         * downloading the original cover and is more than enough for
         * the Game Manager header.
         */
        if let Some(url) = image_info.get("thumburl").and_then(|value| value.as_str()) {
            return Ok(Some(url.to_string()));
        }

        if let Some(url) = image_info.get("url").and_then(|value| value.as_str()) {
            return Ok(Some(url.to_string()));
        }
    }

    Ok(None)
}

// ================================================================
// PARSE PCGW GAME DATA
// ================================================================

fn parse_game_data(page_name: String, wikitext: String) -> PcgwGameData {
    // ============================================================
    // OVERVIEW
    // ============================================================

    let developer = extract_parameter(&wikitext, &["developer", "developers"]);

    let publisher = extract_parameter(&wikitext, &["publisher", "publishers"]);

    let engine = extract_parameter(&wikitext, &["engine"]);

    let release_date = extract_parameter(&wikitext, &["release date", "release dates", "released"]);

    // ============================================================
    // WSGF
    // ============================================================

    let wsgf_link = extract_parameter(&wikitext, &["wsgf link"]);

    let widescreen_wsgf_award = extract_parameter(&wikitext, &["widescreen wsgf award"]);

    let multimonitor_wsgf_award = extract_parameter(&wikitext, &["multimonitor wsgf award"]);

    let ultrawidescreen_wsgf_award = extract_parameter(&wikitext, &["ultrawidescreen wsgf award"]);

    let four_k_ultra_hd_wsgf_award = extract_parameter(&wikitext, &["4k ultra hd wsgf award"]);

    // ============================================================
    // VIDEO
    // ============================================================

    let widescreen_resolution =
        clean_feature_status(extract_parameter(&wikitext, &["widescreen resolution"]));

    let widescreen_resolution_notes = clean_feature_note(extract_parameter(
        &wikitext,
        &["widescreen resolution notes"],
    ));

    let multimonitor = clean_feature_status(extract_parameter(&wikitext, &["multimonitor"]));

    let multimonitor_notes =
        clean_feature_note(extract_parameter(&wikitext, &["multimonitor notes"]));

    let ultrawidescreen = clean_feature_status(extract_parameter(&wikitext, &["ultrawidescreen"]));

    let ultrawidescreen_notes =
        clean_feature_note(extract_parameter(&wikitext, &["ultrawidescreen notes"]));

    let four_k_ultra_hd = clean_feature_status(extract_parameter(&wikitext, &["4k ultra hd"]));

    let four_k_ultra_hd_notes =
        clean_feature_note(extract_parameter(&wikitext, &["4k ultra hd notes"]));

    let fov = clean_feature_status(extract_parameter(&wikitext, &["fov"]));

    let fov_notes = clean_feature_note(extract_parameter(&wikitext, &["fov notes"]));

    let windowed = clean_feature_status(extract_parameter(&wikitext, &["windowed"]));

    let windowed_notes = clean_feature_note(extract_parameter(&wikitext, &["windowed notes"]));

    let borderless_windowed =
        clean_feature_status(extract_parameter(&wikitext, &["borderless windowed"]));

    let borderless_windowed_notes =
        clean_feature_note(extract_parameter(&wikitext, &["borderless windowed notes"]));

    let anisotropic = clean_feature_status(extract_parameter(&wikitext, &["anisotropic"]));

    let anisotropic_notes =
        clean_feature_note(extract_parameter(&wikitext, &["anisotropic notes"]));

    let antialiasing = clean_feature_status(extract_parameter(&wikitext, &["antialiasing"]));

    let antialiasing_notes =
        clean_feature_note(extract_parameter(&wikitext, &["antialiasing notes"]));

    let upscaling = clean_feature_status(extract_parameter(&wikitext, &["upscaling"]));

    let upscaling_tech = clean_feature_note(extract_parameter(&wikitext, &["upscaling tech"]));

    let upscaling_notes = clean_feature_note(extract_parameter(&wikitext, &["upscaling notes"]));

    let frame_generation = clean_feature_status(extract_parameter(&wikitext, &["framegen"]));

    let frame_generation_tech =
        clean_feature_note(extract_parameter(&wikitext, &["framegen tech"]));

    let frame_generation_notes =
        clean_feature_note(extract_parameter(&wikitext, &["framegen notes"]));

    let vsync = clean_feature_status(extract_parameter(&wikitext, &["vsync"]));

    let vsync_notes = clean_feature_note(extract_parameter(&wikitext, &["vsync notes"]));

    let sixty_fps = clean_feature_status(extract_parameter(&wikitext, &["60 fps"]));

    let sixty_fps_notes = clean_feature_note(extract_parameter(&wikitext, &["60 fps notes"]));

    let one_twenty_fps = clean_feature_status(extract_parameter(&wikitext, &["120 fps"]));

    let one_twenty_fps_notes = clean_feature_note(extract_parameter(&wikitext, &["120 fps notes"]));

    let hdr = clean_feature_status(extract_parameter(&wikitext, &["hdr"]));

    let hdr_notes = clean_feature_note(extract_parameter(&wikitext, &["hdr notes"]));

    let ray_tracing = clean_feature_status(extract_parameter(&wikitext, &["ray tracing"]));

    let ray_tracing_notes =
        clean_feature_note(extract_parameter(&wikitext, &["ray tracing notes"]));

    let color_blind = clean_feature_status(extract_parameter(&wikitext, &["color blind"]));

    let color_blind_notes =
        clean_feature_note(extract_parameter(&wikitext, &["color blind notes"]));

    // ============================================================
    // GENERAL CONTROLLER
    // ============================================================

    let controller_support = extract_parameter(&wikitext, &["controller support", "controller"]);

    // ============================================================
    // TECHNICAL
    // ============================================================

    let graphics_api = extract_graphics_api(&wikitext);

    let config_location = extract_game_data_location(&wikitext, "game data/config");

    let save_location = extract_game_data_location(&wikitext, "game data/saves");

    // ============================================================
    // XBOX
    // ============================================================

    let xbox_controller_support = extract_parameter(
        &wikitext,
        &["xinput controllers", "xinput controller", "xinput"],
    );

    let xbox_controller_models = extract_parameter(
        &wikitext,
        &["xinput controller models", "xbox controller models"],
    );

    // ============================================================
    // PLAYSTATION
    // ============================================================

    let playstation_controller_support = extract_parameter(
        &wikitext,
        &["playstation controllers", "playstation controller"],
    );

    let playstation_controller_models =
        extract_parameter(&wikitext, &["playstation controller models"]);

    let playstation_prompts =
        extract_parameter(&wikitext, &["playstation prompts", "dualshock prompts"]);

    let playstation_connection_modes = extract_parameter(
        &wikitext,
        &["playstation connection modes", "dualshock 4 modes"],
    );

    let playstation_motion_sensors = extract_parameter(&wikitext, &["playstation motion sensors"]);

    let playstation_light_bar = extract_parameter(&wikitext, &["light bar support"]);

    // ============================================================
    // DUALSENSE
    // ============================================================

    let dualsense_adaptive_triggers =
        extract_parameter(&wikitext, &["dualsense adaptive trigger support"]);

    let dualsense_adaptive_trigger_modes =
        extract_parameter(&wikitext, &["dualsense adaptive trigger support modes"]);

    let dualsense_haptics = extract_parameter(&wikitext, &["dualsense haptics support"]);

    // ============================================================
    // NINTENDO
    // ============================================================

    let nintendo_controller_support =
        extract_parameter(&wikitext, &["nintendo controllers", "nintendo controller"]);

    let nintendo_controller_models = extract_parameter(&wikitext, &["nintendo controller models"]);

    let controller_hotplug = extract_parameter(
        &wikitext,
        &["controller hotplug", "controller hot plugging"],
    );

    println!("[PCGW VIDEO] Color Blind: {:?}", color_blind);

    println!("[PCGW VIDEO] Color Blind Notes: {:?}", color_blind_notes);

    PcgwGameData {
        found: true,

        page_name: Some(page_name.clone()),

        page_url: Some(make_page_url(&page_name)),

        /*
         * Resolved later by get_pcgw_game_data() after the
         * infobox cover filename has been extracted.
         */
        cover_image_url: None,

        developer,
        publisher,
        engine,
        release_date,

        essential_improvements_html: None,

        wsgf_link,

        widescreen_wsgf_award,
        multimonitor_wsgf_award,
        ultrawidescreen_wsgf_award,
        four_k_ultra_hd_wsgf_award,

        widescreen_resolution,
        widescreen_resolution_notes,

        multimonitor,
        multimonitor_notes,

        ultrawidescreen,
        ultrawidescreen_notes,

        four_k_ultra_hd,
        four_k_ultra_hd_notes,

        fov,
        fov_notes,

        windowed,
        windowed_notes,

        borderless_windowed,
        borderless_windowed_notes,

        anisotropic,
        anisotropic_notes,

        antialiasing,
        antialiasing_notes,

        upscaling,
        upscaling_tech,
        upscaling_notes,

        frame_generation,
        frame_generation_tech,
        frame_generation_notes,

        vsync,
        vsync_notes,

        sixty_fps,
        sixty_fps_notes,

        one_twenty_fps,
        one_twenty_fps_notes,

        hdr,
        hdr_notes,

        ray_tracing,
        ray_tracing_notes,

        color_blind,
        color_blind_notes,

        controller_support,

        graphics_api,
        config_location,
        save_location,

        xbox_controller_support,
        xbox_controller_models,

        playstation_controller_support,
        playstation_controller_models,
        playstation_prompts,
        playstation_connection_modes,
        playstation_motion_sensors,
        playstation_light_bar,

        dualsense_adaptive_triggers,
        dualsense_adaptive_trigger_modes,
        dualsense_haptics,

        nintendo_controller_support,
        nintendo_controller_models,

        controller_hotplug,

        raw_wikitext_available: true,
    }
}

// ================================================================
// RESOLVE PCGW PAGE
// ================================================================

async fn resolve_page_name(
    client: &Client,
    name: &str,
    store: &str,
    launcher_id: Option<&str>,
) -> Result<Option<String>, String> {
    let normalized_store = store.trim().to_lowercase();

    if normalized_store == "steam" {
        if let Some(app_id) = launcher_id {
            if !app_id.trim().is_empty() {
                match lookup_by_steam_id(client, app_id.trim()).await {
                    Ok(Some(page)) => {
                        return Ok(Some(page));
                    }

                    Ok(None) => {}

                    Err(error) => {
                        println!("[PCGW] Steam exact lookup failed: {}", error);
                    }
                }
            }
        }
    }

    if normalized_store == "gog" || normalized_store == "gog galaxy" {
        if let Some(gog_id) = launcher_id {
            if !gog_id.trim().is_empty() {
                match lookup_by_gog_id(client, gog_id.trim()).await {
                    Ok(Some(page)) => {
                        return Ok(Some(page));
                    }

                    Ok(None) => {}

                    Err(error) => {
                        println!("[PCGW] GOG exact lookup failed: {}", error);
                    }
                }
            }
        }
    }

    lookup_by_name(client, name).await
}

// ================================================================
// TAURI COMMAND
// ================================================================

#[tauri::command]
pub async fn get_pcgw_game_data(
    name: String,
    store: String,
    launcher_id: Option<String>,
) -> Result<PcgwGameData, String> {
    println!("");
    println!("[PCGW] ==========================================");

    println!("[PCGW] Original installed title: {:?}", name);

    println!(
        "[PCGW] Sanitized title: {:?}",
        clean_storefront_game_name(&name)
    );

    println!("[PCGW] Store: {}", store);

    let client =
        Client::builder()
            .user_agent(
                "GameManager/0.3.0 (https://github.com/GreatDanish1026/GameManager) PCGamingWiki integration"
            )
            .redirect(
                reqwest::redirect::Policy::limited(
                    10
                )
            )
            .build()
            .map_err(
                |error| {
                    format!(
                        "Failed to create HTTP client: {}",
                        error
                    )
                }
            )?;

    let page_name = resolve_page_name(&client, &name, &store, launcher_id.as_deref()).await?;

    let Some(page_name) = page_name else {
        println!("[PCGW] No matching page found");

        return Ok(empty_result());
    };

    println!("[PCGW] Resolved page: {}", page_name);

    let page_data = get_page_data(&client, &page_name).await?;

    let Some((resolved_page_name, wikitext, essential_section_index)) = page_data else {
        return Ok(empty_result());
    };

    /*
     * Extract the raw cover filename before wikitext is moved into
     * parse_game_data(). The display name remains untouched.
     */
    let cover_filename = extract_parameter(&wikitext, &["cover"]);

    println!("[PCGW] Cover filename: {:?}", cover_filename);

    let mut result = parse_game_data(resolved_page_name.clone(), wikitext);

    if let Some(cover_filename) = cover_filename {
        match get_cover_image_url(&client, &cover_filename).await {
            Ok(url) => {
                result.cover_image_url = url;
            }

            Err(error) => {
                /*
                 * A missing/broken cover must never break the rest
                 * of the PCGamingWiki lookup.
                 */
                println!("[PCGW] Cover lookup failed: {}", error);
            }
        }
    }

    println!("[PCGW] Cover image URL: {:?}", result.cover_image_url);

    if let Some(section_index) = essential_section_index {
        match get_section_html(&client, &resolved_page_name, &section_index).await {
            Ok(html) => {
                result.essential_improvements_html = html;
            }

            Err(error) => {
                println!("[PCGW] Essential improvements lookup failed: {}", error);
            }
        }
    }

    println!(
        "[PCGW] Essential improvements present: {}",
        result.essential_improvements_html.is_some()
    );

    println!("[PCGW] ==========================================");

    println!("");

    Ok(result)
}
