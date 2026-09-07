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

    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub engine: Option<String>,
    pub release_date: Option<String>,

    pub hdr: Option<String>,
    pub ultrawide: Option<String>,
    pub controller_support: Option<String>,
    pub ray_tracing: Option<String>,
    pub frame_generation: Option<String>,
    pub upscaling: Option<String>,

    // Technical Information
    pub graphics_api: Option<String>,
    pub config_location: Option<String>,
    pub save_location: Option<String>,

    // Xbox / XInput
    pub xbox_controller_support: Option<String>,
    pub xbox_controller_models: Option<String>,

    // PlayStation
    pub playstation_controller_support: Option<String>,
    pub playstation_controller_models: Option<String>,
    pub playstation_prompts: Option<String>,
    pub playstation_connection_modes: Option<String>,
    pub playstation_motion_sensors: Option<String>,
    pub playstation_light_bar: Option<String>,

    // DualSense
    pub dualsense_adaptive_triggers: Option<String>,
    pub dualsense_adaptive_trigger_modes: Option<String>,
    pub dualsense_haptics: Option<String>,

    // Nintendo
    pub nintendo_controller_support: Option<String>,
    pub nintendo_controller_models: Option<String>,

    pub controller_hotplug: Option<String>,

    pub raw_wikitext_available: bool,
}

#[derive(Debug, Deserialize)]
struct ParseApiResponse {
    parse: Option<ParseResult>,
}

#[derive(Debug, Deserialize)]
struct ParseResult {
    title: String,
    wikitext: WikitextResult,
}

#[derive(Debug, Deserialize)]
struct WikitextResult {
    #[serde(rename = "*")]
    content: String,
}

fn empty_result() -> PcgwGameData {
    PcgwGameData {
        found: false,

        page_name: None,
        page_url: None,

        developer: None,
        publisher: None,
        engine: None,
        release_date: None,

        hdr: None,
        ultrawide: None,
        controller_support: None,
        ray_tracing: None,
        frame_generation: None,
        upscaling: None,

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

        let Some(relative_end) =
            output[start + 4..].find("-->")
        else {
            break;
        };

        let end =
            start + 4 + relative_end + 3;

        output.replace_range(
            start..end,
            "",
        );
    }

    output
}

fn strip_refs(input: &str) -> String {
    let mut output =
        input.to_string();

    loop {
        let lower =
            output.to_lowercase();

        let Some(start) =
            lower.find("<ref")
        else {
            break;
        };

        let remaining =
            &lower[start..];

        if let Some(end) =
            remaining.find("/>")
        {
            output.replace_range(
                start..start + end + 2,
                "",
            );

            continue;
        }

        let Some(open_end) =
            remaining.find('>')
        else {
            break;
        };

        let after_open =
            start + open_end + 1;

        let lower_after =
            output[after_open..]
                .to_lowercase();

        if let Some(close_relative) =
            lower_after.find("</ref>")
        {
            let close_end =
                after_open
                    + close_relative
                    + "</ref>".len();

            output.replace_range(
                start..close_end,
                "",
            );
        } else {
            break;
        }
    }

    output
}

fn strip_wiki_links(input: &str) -> String {
    let mut result =
        input.to_string();

    loop {
        let Some(start) =
            result.find("[[")
        else {
            break;
        };

        let Some(relative_end) =
            result[start + 2..]
                .find("]]")
        else {
            break;
        };

        let end =
            start + 2 + relative_end;

        let link_contents =
            result[start + 2..end]
                .to_string();

        let replacement =
            if let Some(pipe_position) =
                link_contents.rfind('|')
            {
                link_contents[
                    pipe_position + 1..
                ]
                .trim()
                .to_string()
            } else {
                link_contents
                    .trim()
                    .to_string()
            };

        result.replace_range(
            start..end + 2,
            &replacement,
        );
    }

    result
}

fn strip_external_links(input: &str) -> String {
    let mut result =
        input.to_string();

    let mut search_from =
        0;

    while search_from < result.len() {
        let Some(relative_start) =
            result[search_from..]
                .find('[')
        else {
            break;
        };

        let start =
            search_from
                + relative_start;

        if result[start..]
            .starts_with("[[")
        {
            search_from =
                start + 2;

            continue;
        }

        let Some(relative_end) =
            result[start..].find(']')
        else {
            break;
        };

        let end =
            start + relative_end;

        let contents =
            result[start + 1..end]
                .to_string();

        if contents.starts_with("http://")
            || contents.starts_with("https://")
        {
            let replacement =
                if let Some(space) =
                    contents.find(' ')
                {
                    contents[
                        space + 1..
                    ]
                    .trim()
                    .to_string()
                } else {
                    String::new()
                };

            result.replace_range(
                start..end + 1,
                &replacement,
            );

            search_from =
                start
                    + replacement.len();
        } else {
            search_from =
                end + 1;
        }
    }

    result
}

fn simplify_pcgw_row_templates(
    input: &str,
) -> String {
    let mut output =
        input.to_string();

    loop {
        let lower =
            output.to_lowercase();

        let Some(start) =
            lower.find(
                "{{infobox game/row/"
            )
        else {
            break;
        };

        let Some(relative_end) =
            output[start..]
                .find("}}")
        else {
            break;
        };

        let end =
            start + relative_end + 2;

        let template =
            output[start..end]
                .to_string();

        let inner =
            template
                .trim_start_matches("{{")
                .trim_end_matches("}}");

        let parts: Vec<&str> =
            inner
                .split('|')
                .collect();

        let replacement =
            if parts.len() >= 2 {
                parts[1..]
                    .iter()
                    .map(|part| {
                        part.trim()
                    })
                    .filter(|part| {
                        !part.is_empty()
                    })
                    .collect::<Vec<_>>()
                    .join(", ")
            } else {
                String::new()
            };

        output.replace_range(
            start..end,
            &replacement,
        );
    }

    output
}

fn simplify_templates(
    input: &str,
) -> String {
    let mut output =
        input.to_string();

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
        output =
            output.replace(
                wrapper,
                "",
            );
    }

    output =
        output.replace(
            "<br />",
            ", ",
        );

    output =
        output.replace(
            "<br/>",
            ", ",
        );

    output =
        output.replace(
            "<br>",
            ", ",
        );

    let lines: Vec<String> =
        output
            .lines()
            .map(|line| {
                line
                    .trim()
                    .trim_start_matches('*')
                    .trim_start_matches('#')
                    .trim()
                    .to_string()
            })
            .filter(|line| {
                !line.is_empty()
            })
            .collect();

    output =
        lines.join(", ");

    while output
        .trim_end()
        .ends_with("}}")
    {
        let trimmed =
            output.trim_end();

        output =
            trimmed[
                ..trimmed.len() - 2
            ]
            .trim()
            .to_string();
    }

    output
}

fn clean_value(
    value: &str,
) -> Option<String> {
    let mut cleaned =
        simplify_pcgw_row_templates(
            value
        );

    cleaned =
        strip_html_comments(
            &cleaned
        );

    cleaned =
        strip_refs(
            &cleaned
        );

    cleaned =
        strip_wiki_links(
            &cleaned
        );

    cleaned =
        strip_external_links(
            &cleaned
        );

    cleaned =
        simplify_templates(
            &cleaned
        );

    cleaned = cleaned
        .replace("'''", "")
        .replace("''", "")
        .replace("&nbsp;", " ")
        .replace("&ndash;", "–")
        .replace("&mdash;", "—");

    let cleaned =
        cleaned
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

fn extract_parameter(
    wikitext: &str,
    parameter_names: &[&str],
) -> Option<String> {
    let normalized_names: Vec<String> =
        parameter_names
            .iter()
            .map(|name| {
                normalize_key(name)
            })
            .collect();

    let lines: Vec<&str> =
        wikitext
            .lines()
            .collect();

    let mut index =
        0;

    while index < lines.len() {
        let line =
            lines[index];

        let trimmed =
            line.trim_start();

        if !trimmed.starts_with('|') {
            index += 1;
            continue;
        }

        let without_pipe =
            trimmed[1..]
                .trim_start();

        let Some(equals_position) =
            without_pipe.find('=')
        else {
            index += 1;
            continue;
        };

        let key =
            normalize_key(
                &without_pipe[
                    ..equals_position
                ]
            );

        if !normalized_names
            .iter()
            .any(|name| {
                name == &key
            })
        {
            index += 1;
            continue;
        }

        let mut value =
            without_pipe[
                equals_position + 1..
            ]
            .trim()
            .to_string();

        let mut next_index =
            index + 1;

        while next_index < lines.len() {
            let next_line =
                lines[next_index];

            let next_trimmed =
                next_line.trim_start();

            if next_trimmed
                .starts_with('|')
            {
                let next_without_pipe =
                    next_trimmed[1..]
                        .trim_start();

                if let Some(next_equals) =
                    next_without_pipe
                        .find('=')
                {
                    let possible_key =
                        next_without_pipe[
                            ..next_equals
                        ]
                        .trim();

                    if !possible_key
                        .is_empty()
                    {
                        break;
                    }
                }
            }

            if !value.is_empty() {
                value.push('\n');
            }

            value.push_str(
                next_line.trim()
            );

            next_index += 1;
        }

        if let Some(cleaned) =
            clean_value(
                &value
            )
        {
            return Some(cleaned);
        }

        index =
            next_index;
    }

    None
}

/*
 * ============================================================
 * GRAPHICS API
 * ============================================================
 */

fn meaningful_api_value(
    value: Option<String>,
) -> Option<String> {
    let value =
        value?;

    let normalized =
        value
            .trim()
            .to_lowercase();

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

fn graphics_api_entry(
    label: &str,
    value: Option<String>,
) -> Option<String> {
    let value =
        meaningful_api_value(
            value
        )?;

    if value
        .eq_ignore_ascii_case("true")
    {
        return Some(
            label.to_string()
        );
    }

    Some(
        format!(
            "{} {}",
            label,
            value
        )
    )
}

fn extract_graphics_api(
    wikitext: &str,
) -> Option<String> {
    let mut entries: Vec<String> =
        Vec::new();

    if let Some(value) =
        graphics_api_entry(
            "Direct3D",
            extract_parameter(
                wikitext,
                &[
                    "direct3d versions",
                ],
            ),
        )
    {
        entries.push(value);
    }

    if let Some(value) =
        graphics_api_entry(
            "Vulkan",
            extract_parameter(
                wikitext,
                &[
                    "vulkan versions",
                ],
            ),
        )
    {
        entries.push(value);
    }

    if let Some(value) =
        graphics_api_entry(
            "OpenGL",
            extract_parameter(
                wikitext,
                &[
                    "opengl versions",
                ],
            ),
        )
    {
        entries.push(value);
    }

    if let Some(value) =
        graphics_api_entry(
            "Metal",
            extract_parameter(
                wikitext,
                &[
                    "metal support",
                ],
            ),
        )
    {
        entries.push(value);
    }

    if let Some(value) =
        graphics_api_entry(
            "Mantle",
            extract_parameter(
                wikitext,
                &[
                    "mantle support",
                ],
            ),
        )
    {
        entries.push(value);
    }

    if let Some(value) =
        graphics_api_entry(
            "Glide",
            extract_parameter(
                wikitext,
                &[
                    "glide versions",
                ],
            ),
        )
    {
        entries.push(value);
    }

    if entries.is_empty() {
        None
    } else {
        Some(
            entries.join(", ")
        )
    }
}

/*
 * ============================================================
 * GAME DATA / CONFIG / SAVE PATHS
 * ============================================================
 */

fn find_complete_template(
    input: &str,
    start: usize,
) -> Option<(String, usize)> {
    let bytes =
        input.as_bytes();

    let mut index =
        start;

    let mut depth: i32 =
        0;

    while index + 1 < bytes.len() {
        if bytes[index] == b'{'
            && bytes[index + 1] == b'{'
        {
            depth += 1;
            index += 2;
            continue;
        }

        if bytes[index] == b'}'
            && bytes[index + 1] == b'}'
        {
            depth -= 1;
            index += 2;

            if depth == 0 {
                return Some((
                    input[start..index]
                        .to_string(),
                    index,
                ));
            }

            continue;
        }

        index += 1;
    }

    None
}

fn find_templates(
    wikitext: &str,
    template_name: &str,
) -> Vec<String> {
    let lower =
        wikitext.to_lowercase();

    let marker =
        format!(
            "{{{{{}|",
            template_name.to_lowercase()
        );

    let mut templates =
        Vec::new();

    let mut search_from =
        0;

    while search_from < lower.len() {
        let Some(relative_start) =
            lower[search_from..]
                .find(&marker)
        else {
            break;
        };

        let start =
            search_from
                + relative_start;

        if let Some((
            template,
            end,
        )) = find_complete_template(
            wikitext,
            start,
        ) {
            templates.push(
                template
            );

            search_from =
                end;
        } else {
            break;
        }
    }

    templates
}

fn split_template_arguments(
    template: &str,
) -> Vec<String> {
    if template.len() < 4 {
        return Vec::new();
    }

    let inner =
        template
            .trim()
            .trim_start_matches("{{")
            .trim_end_matches("}}");

    let bytes =
        inner.as_bytes();

    let mut parts =
        Vec::new();

    let mut start =
        0;

    let mut index =
        0;

    let mut template_depth: i32 =
        0;

    let mut link_depth: i32 =
        0;

    while index < bytes.len() {
        if index + 1 < bytes.len()
            && bytes[index] == b'{'
            && bytes[index + 1] == b'{'
        {
            template_depth += 1;
            index += 2;
            continue;
        }

        if index + 1 < bytes.len()
            && bytes[index] == b'}'
            && bytes[index + 1] == b'}'
        {
            if template_depth > 0 {
                template_depth -= 1;
            }

            index += 2;
            continue;
        }

        if index + 1 < bytes.len()
            && bytes[index] == b'['
            && bytes[index + 1] == b'['
        {
            link_depth += 1;
            index += 2;
            continue;
        }

        if index + 1 < bytes.len()
            && bytes[index] == b']'
            && bytes[index + 1] == b']'
        {
            if link_depth > 0 {
                link_depth -= 1;
            }

            index += 2;
            continue;
        }

        if bytes[index] == b'|'
            && template_depth == 0
            && link_depth == 0
        {
            parts.push(
                inner[start..index]
                    .trim()
                    .to_string()
            );

            start =
                index + 1;
        }

        index += 1;
    }

    parts.push(
        inner[start..]
            .trim()
            .to_string()
    );

    parts
}

fn simplify_path_templates(
    input: &str,
) -> String {
    let mut output =
        input.to_string();

    loop {
        let lower =
            output.to_lowercase();

        let Some(start) =
            lower.find("{{p|")
        else {
            break;
        };

        let Some(relative_end) =
            output[start..]
                .find("}}")
        else {
            break;
        };

        let end =
            start
                + relative_end
                + 2;

        let template =
            output[start..end]
                .to_string();

        let inner =
            template
                .trim_start_matches("{{")
                .trim_end_matches("}}");

        let parts: Vec<&str> =
            inner
                .split('|')
                .collect();

        let key =
            parts
                .get(1)
                .map(|value| {
                    value
                        .trim()
                        .to_lowercase()
                })
                .unwrap_or_default();

        let replacement =
            match key.as_str() {
                "userprofile" =>
                    "%USERPROFILE%".to_string(),

                "appdata" =>
                    "%APPDATA%".to_string(),

                "localappdata" =>
                    "%LOCALAPPDATA%".to_string(),

                "programdata" =>
                    "%PROGRAMDATA%".to_string(),

                "documents" =>
                    "%USERPROFILE%\\Documents".to_string(),

                "savedgames" |
                "saved games" =>
                    "%USERPROFILE%\\Saved Games".to_string(),

                "game" =>
                    "<game>".to_string(),

                "steam" =>
                    "<Steam>".to_string(),

                "uid" =>
                    "<user-id>".to_string(),

                "username" =>
                    "<username>".to_string(),

                "" =>
                    String::new(),

                _ =>
                    format!(
                        "<{}>",
                        key
                    ),
            };

        output.replace_range(
            start..end,
            &replacement,
        );
    }

    output
}

fn clean_game_data_path(
    path: &str,
) -> Option<String> {
    let mut cleaned =
        simplify_path_templates(
            path
        );

    cleaned =
        strip_html_comments(
            &cleaned
        );

    cleaned =
        strip_refs(
            &cleaned
        );

    cleaned =
        strip_wiki_links(
            &cleaned
        );

    cleaned =
        strip_external_links(
            &cleaned
        );

    cleaned = cleaned
        .replace("'''", "")
        .replace("''", "")
        .replace("&nbsp;", " ");

    let cleaned =
        cleaned
            .trim()
            .to_string();

    if cleaned.is_empty()
        || cleaned.eq_ignore_ascii_case(
            "unknown"
        )
    {
        None
    } else {
        Some(cleaned)
    }
}

fn extract_game_data_location(
    wikitext: &str,
    template_name: &str,
) -> Option<String> {
    let templates =
        find_templates(
            wikitext,
            template_name,
        );

    let mut windows_paths =
        Vec::new();

    let mut fallback_paths =
        Vec::new();

    for template in templates {
        let parts =
            split_template_arguments(
                &template
            );

        /*
         * parts:
         *
         * 0 = Game data/config
         * 1 = Windows
         * 2 = first path
         * 3 = optional second path
         * ...
         */
        if parts.len() < 3 {
            continue;
        }

        let platform =
            parts[1]
                .trim();

        let mut paths =
            Vec::new();

        for raw_path in
            parts.iter().skip(2)
        {
            if let Some(path) =
                clean_game_data_path(
                    raw_path
                )
            {
                if !paths.contains(
                    &path
                ) {
                    paths.push(path);
                }
            }
        }

        if paths.is_empty() {
            continue;
        }

        if platform
            .eq_ignore_ascii_case(
                "windows"
            )
        {
            windows_paths.extend(
                paths
            );
        } else if fallback_paths
            .is_empty()
        {
            fallback_paths =
                paths;
        }
    }

    let mut selected =
        if !windows_paths.is_empty() {
            windows_paths
        } else {
            fallback_paths
        };

    selected.sort();
    selected.dedup();

    if selected.is_empty() {
        None
    } else {
        Some(
            selected.join(" | ")
        )
    }
}

fn make_page_url(
    page_name: &str,
) -> String {
    let page =
        page_name
            .replace(
                ' ',
                "_",
            );

    format!(
        "{}/wiki/{}",
        PCGW_BASE_URL,
        urlencoding::encode(
            &page
        )
    )
}

fn page_name_from_url(
    url: &str,
) -> Option<String> {
    let marker =
        "/wiki/";

    let position =
        url.find(marker)?;

    let encoded_title =
        &url[
            position + marker.len()..
        ];

    if encoded_title
        .is_empty()
    {
        return None;
    }

    let decoded =
        urlencoding::decode(
            encoded_title
        )
        .ok()?;

    Some(
        decoded.replace(
            '_',
            " ",
        )
    )
}

async fn lookup_by_steam_id(
    client: &Client,
    app_id: &str,
) -> Result<Option<String>, String> {
    let url =
        format!(
            "{}/api/appid.php?appid={}",
            PCGW_BASE_URL,
            urlencoding::encode(
                app_id
            )
        );

    println!(
        "[PCGW] Steam AppID lookup: {}",
        app_id
    );

    let response =
        client
            .get(&url)
            .send()
            .await
            .map_err(|error| {
                format!(
                    "Failed to query PCGamingWiki Steam redirect API: {}",
                    error
                )
            })?;

    if !response
        .status()
        .is_success()
    {
        println!(
            "[PCGW] Steam lookup HTTP {}",
            response.status()
        );

        return Ok(None);
    }

    let final_url =
        response
            .url()
            .to_string();

    println!(
        "[PCGW] Steam redirect: {}",
        final_url
    );

    Ok(
        page_name_from_url(
            &final_url
        )
    )
}

async fn lookup_by_gog_id(
    client: &Client,
    gog_id: &str,
) -> Result<Option<String>, String> {
    let url =
        format!(
            "{}/api/gog.php?page={}",
            PCGW_BASE_URL,
            urlencoding::encode(
                gog_id
            )
        );

    println!(
        "[PCGW] GOG lookup: {}",
        gog_id
    );

    let response =
        client
            .get(&url)
            .send()
            .await
            .map_err(|error| {
                format!(
                    "Failed to query PCGamingWiki GOG redirect API: {}",
                    error
                )
            })?;

    if !response
        .status()
        .is_success()
    {
        println!(
            "[PCGW] GOG lookup HTTP {}",
            response.status()
        );

        return Ok(None);
    }

    let final_url =
        response
            .url()
            .to_string();

    println!(
        "[PCGW] GOG redirect: {}",
        final_url
    );

    Ok(
        page_name_from_url(
            &final_url
        )
    )
}

async fn lookup_by_name(
    client: &Client,
    name: &str,
) -> Result<Option<String>, String> {
    println!(
        "[PCGW] Name search: {}",
        name
    );

    let response =
        client
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
            .map_err(|error| {
                format!(
                    "Failed to search PCGamingWiki: {}",
                    error
                )
            })?;

    if !response
        .status()
        .is_success()
    {
        return Err(
            format!(
                "PCGamingWiki search returned HTTP {}",
                response.status()
            )
        );
    }

    let json: serde_json::Value =
        response
            .json()
            .await
            .map_err(|error| {
                format!(
                    "Failed to parse PCGamingWiki search response: {}",
                    error
                )
            })?;

    let Some(results) =
        json
            .get(1)
            .and_then(|value| {
                value.as_array()
            })
    else {
        return Ok(None);
    };

    if results.is_empty() {
        println!(
            "[PCGW] No name results"
        );

        return Ok(None);
    }

    if let Some(exact_match) =
        results
            .iter()
            .filter_map(|value| {
                value.as_str()
            })
            .find(|result| {
                result
                    .eq_ignore_ascii_case(
                        name
                    )
            })
    {
        return Ok(
            Some(
                exact_match
                    .to_string()
            )
        );
    }

    Ok(
        results
            .first()
            .and_then(|value| {
                value.as_str()
            })
            .map(|value| {
                value.to_string()
            })
    )
}

async fn get_wikitext(
    client: &Client,
    page_name: &str,
) -> Result<Option<(String, String)>, String> {
    println!(
        "[PCGW] Fetching wikitext for: {}",
        page_name
    );

    let response =
        client
            .get(PCGW_API_URL)
            .query(&[
                ("action", "parse"),
                ("page", page_name),
                ("redirects", "1"),
                ("prop", "wikitext"),
                ("format", "json"),
            ])
            .send()
            .await
            .map_err(|error| {
                format!(
                    "Failed to retrieve PCGamingWiki page: {}",
                    error
                )
            })?;

    if !response
        .status()
        .is_success()
    {
        return Err(
            format!(
                "PCGamingWiki parse request returned HTTP {}",
                response.status()
            )
        );
    }

    let parsed: ParseApiResponse =
        response
            .json()
            .await
            .map_err(|error| {
                format!(
                    "Failed to parse PCGamingWiki page response: {}",
                    error
                )
            })?;

    let Some(parse) =
        parsed.parse
    else {
        return Ok(None);
    };

    Ok(
        Some((
            parse.title,
            parse.wikitext.content,
        ))
    )
}

fn parse_game_data(
    page_name: String,
    wikitext: String,
) -> PcgwGameData {
    /*
     * ============================================================
     * OVERVIEW
     * ============================================================
     */

    let developer =
        extract_parameter(
            &wikitext,
            &[
                "developer",
                "developers",
            ],
        );

    let publisher =
        extract_parameter(
            &wikitext,
            &[
                "publisher",
                "publishers",
            ],
        );

    let engine =
        extract_parameter(
            &wikitext,
            &[
                "engine",
            ],
        );

    let release_date =
        extract_parameter(
            &wikitext,
            &[
                "release date",
                "release dates",
                "released",
            ],
        );

    /*
     * ============================================================
     * PC FEATURES
     * ============================================================
     */

    let hdr =
        extract_parameter(
            &wikitext,
            &[
                "hdr",
                "hdr output",
            ],
        );

    let ultrawide =
        extract_parameter(
            &wikitext,
            &[
                "ultrawidescreen",
                "ultrawide",
                "ultra widescreen",
            ],
        );

    let controller_support =
        extract_parameter(
            &wikitext,
            &[
                "controller support",
                "controller",
            ],
        );

    let ray_tracing =
        extract_parameter(
            &wikitext,
            &[
                "ray tracing",
                "raytracing",
            ],
        );

    let frame_generation =
        extract_parameter(
            &wikitext,
            &[
                "framegen",
                "frame generation",
                "frame generation support",
            ],
        );

    let upscaling =
        extract_parameter(
            &wikitext,
            &[
                "upscaling",
                "upscaling support",
                "temporal upscaling",
            ],
        );

    /*
     * ============================================================
     * TECHNICAL INFORMATION
     * ============================================================
     */

    let graphics_api =
        extract_graphics_api(
            &wikitext
        );

    let config_location =
        extract_game_data_location(
            &wikitext,
            "game data/config",
        );

    let save_location =
        extract_game_data_location(
            &wikitext,
            "game data/saves",
        );

    /*
     * ============================================================
     * CONTROLLERS
     * ============================================================
     */

    let xbox_controller_support =
        extract_parameter(
            &wikitext,
            &[
                "xinput controllers",
                "xinput controller",
                "xinput",
            ],
        );

    let xbox_controller_models =
        extract_parameter(
            &wikitext,
            &[
                "xinput controller models",
                "xbox controller models",
            ],
        );

    let playstation_controller_support =
        extract_parameter(
            &wikitext,
            &[
                "playstation controllers",
                "playstation controller",
            ],
        );

    let playstation_controller_models =
        extract_parameter(
            &wikitext,
            &[
                "playstation controller models",
            ],
        );

    let playstation_prompts =
        extract_parameter(
            &wikitext,
            &[
                "playstation prompts",
                "dualshock prompts",
            ],
        );

    let playstation_connection_modes =
        extract_parameter(
            &wikitext,
            &[
                "playstation connection modes",
                "dualshock 4 modes",
            ],
        );

    let playstation_motion_sensors =
        extract_parameter(
            &wikitext,
            &[
                "playstation motion sensors",
            ],
        );

    let playstation_light_bar =
        extract_parameter(
            &wikitext,
            &[
                "light bar support",
            ],
        );

    let dualsense_adaptive_triggers =
        extract_parameter(
            &wikitext,
            &[
                "dualsense adaptive trigger support",
            ],
        );

    let dualsense_adaptive_trigger_modes =
        extract_parameter(
            &wikitext,
            &[
                "dualsense adaptive trigger support modes",
            ],
        );

    let dualsense_haptics =
        extract_parameter(
            &wikitext,
            &[
                "dualsense haptics support",
            ],
        );

    let nintendo_controller_support =
        extract_parameter(
            &wikitext,
            &[
                "nintendo controllers",
                "nintendo controller",
            ],
        );

    let nintendo_controller_models =
        extract_parameter(
            &wikitext,
            &[
                "nintendo controller models",
            ],
        );

    let controller_hotplug =
        extract_parameter(
            &wikitext,
            &[
                "controller hotplug",
                "controller hot plugging",
            ],
        );

    /*
     * ============================================================
     * DEBUG
     * ============================================================
     */

    println!("");
    println!(
        "[PCGW DEBUG] ===== TECHNICAL INFORMATION ====="
    );

    println!(
        "[PCGW DEBUG] Engine: {:?}",
        engine
    );

    println!(
        "[PCGW DEBUG] Graphics API: {:?}",
        graphics_api
    );

    println!(
        "[PCGW DEBUG] Config Location: {:?}",
        config_location
    );

    println!(
        "[PCGW DEBUG] Save Location: {:?}",
        save_location
    );

    println!(
        "[PCGW DEBUG] =================================="
    );
    println!("");

    PcgwGameData {
        found: true,

        page_name:
            Some(
                page_name.clone()
            ),

        page_url:
            Some(
                make_page_url(
                    &page_name
                )
            ),

        developer,
        publisher,
        engine,
        release_date,

        hdr,
        ultrawide,
        controller_support,
        ray_tracing,
        frame_generation,
        upscaling,

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

async fn resolve_page_name(
    client: &Client,
    name: &str,
    store: &str,
    launcher_id: Option<&str>,
) -> Result<Option<String>, String> {
    let normalized_store =
        store
            .trim()
            .to_lowercase();

    if normalized_store == "steam" {
        if let Some(app_id) =
            launcher_id
        {
            if !app_id
                .trim()
                .is_empty()
            {
                match lookup_by_steam_id(
                    client,
                    app_id.trim(),
                )
                .await
                {
                    Ok(Some(page_name)) => {
                        return Ok(
                            Some(page_name)
                        );
                    }

                    Ok(None) => {}

                    Err(error) => {
                        println!(
                            "[PCGW] Steam lookup failed: {}",
                            error
                        );
                    }
                }
            }
        }
    }

    if normalized_store == "gog"
        || normalized_store == "gog galaxy"
    {
        if let Some(gog_id) =
            launcher_id
        {
            if !gog_id
                .trim()
                .is_empty()
            {
                match lookup_by_gog_id(
                    client,
                    gog_id.trim(),
                )
                .await
                {
                    Ok(Some(page_name)) => {
                        return Ok(
                            Some(page_name)
                        );
                    }

                    Ok(None) => {}

                    Err(error) => {
                        println!(
                            "[PCGW] GOG lookup failed: {}",
                            error
                        );
                    }
                }
            }
        }
    }

    lookup_by_name(
        client,
        name,
    )
    .await
}

#[tauri::command]
pub async fn get_pcgw_game_data(
    name: String,
    store: String,
    launcher_id: Option<String>,
) -> Result<PcgwGameData, String> {
    println!("");
    println!(
        "[PCGW] =========================================="
    );

    println!(
        "[PCGW] Name: {}",
        name
    );

    println!(
        "[PCGW] Store: {}",
        store
    );

    println!(
        "[PCGW] Launcher ID: {:?}",
        launcher_id
    );

    let client =
        Client::builder()
            .user_agent(
                "GameManager/0.2.0 PCGamingWiki integration"
            )
            .redirect(
                reqwest::redirect::Policy::limited(
                    10
                )
            )
            .build()
            .map_err(|error| {
                format!(
                    "Failed to create PCGamingWiki HTTP client: {}",
                    error
                )
            })?;

    let page_name =
        resolve_page_name(
            &client,
            &name,
            &store,
            launcher_id.as_deref(),
        )
        .await?;

    let Some(page_name) =
        page_name
    else {
        println!(
            "[PCGW] No matching PCGamingWiki page found"
        );

        return Ok(
            empty_result()
        );
    };

    println!(
        "[PCGW] Resolved page: {}",
        page_name
    );

    let parsed_page =
        get_wikitext(
            &client,
            &page_name,
        )
        .await?;

    let Some((
        resolved_page_name,
        wikitext,
    )) = parsed_page
    else {
        return Ok(
            empty_result()
        );
    };

    println!(
        "[PCGW] Wikitext received: {} characters",
        wikitext.len()
    );

    Ok(
        parse_game_data(
            resolved_page_name,
            wikitext,
        )
    )
}