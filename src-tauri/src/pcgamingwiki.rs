use reqwest::{redirect::Policy, Client};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

const PCGW_API: &str = "https://www.pcgamingwiki.com/w/api.php";

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

    pub raw_wikitext_available: bool,
}

impl PcgwGameData {
    fn not_found() -> Self {
        Self {
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

            raw_wikitext_available: false,
        }
    }
}

#[tauri::command]
pub async fn get_pcgw_game_data(
    name: String,
    store: String,
    launcher_id: Option<String>,
) -> Result<PcgwGameData, String> {
    println!("========================================");
    println!("[PCGW] Looking up game");
    println!("[PCGW] Name: {}", name);
    println!("[PCGW] Store: {}", store);

    if let Some(id) = &launcher_id {
        println!("[PCGW] Launcher ID: {}", id);
    }

    let client = build_client()?;

    let page_name = match store.to_lowercase().as_str() {
        "steam" => {
            if let Some(id) = launcher_id.as_deref() {
                match resolve_steam_app_id(&client, id).await {
                    Some(page) => Some(page),
                    None => {
                        println!("[PCGW] Steam ID lookup failed. Falling back to title search.");

                        search_page_by_name(&client, &name).await?
                    }
                }
            } else {
                search_page_by_name(&client, &name).await?
            }
        }

        "gog" => {
            if let Some(id) = launcher_id.as_deref() {
                match resolve_gog_id(&client, id).await {
                    Some(page) => Some(page),
                    None => {
                        println!("[PCGW] GOG ID lookup failed. Falling back to title search.");

                        search_page_by_name(&client, &name).await?
                    }
                }
            } else {
                search_page_by_name(&client, &name).await?
            }
        }

        _ => search_page_by_name(&client, &name).await?,
    };

    let Some(page_name) = page_name else {
        println!("[PCGW] No matching PCGamingWiki page found.");

        return Ok(PcgwGameData::not_found());
    };

    println!("[PCGW] Matched page: {}", page_name);

    let wikitext = fetch_wikitext(&client, &page_name).await?;

    let Some(wikitext) = wikitext else {
        println!("[PCGW] Page was found but wikitext could not be retrieved.");

        let mut result = PcgwGameData::not_found();

        result.found = true;

        result.page_url = Some(page_url(&page_name));

        result.page_name = Some(page_name);

        return Ok(result);
    };

    println!("[PCGW] Wikitext retrieved: {} bytes", wikitext.len());

    let developer = extract_row_value(&wikitext, "Infobox game/row/developer", 1);

    let publisher = extract_row_value(&wikitext, "Infobox game/row/publisher", 1);

    let engine = extract_row_value(&wikitext, "Infobox game/row/engine", 1);

    let release_date = extract_windows_release_date(&wikitext);

    let hdr = extract_template_parameter(&wikitext, "Video", "hdr");

    let ultrawide = extract_template_parameter(&wikitext, "Video", "ultrawidescreen");

    let ray_tracing = extract_template_parameter(&wikitext, "Video", "ray tracing");

    let frame_generation = extract_template_parameter(&wikitext, "Video", "framegen");

    let upscaling = extract_template_parameter(&wikitext, "Video", "upscaling");

    let controller_support = extract_template_parameter(&wikitext, "Input", "controller support");

    println!("[PCGW] Developer: {:?}", developer);

    println!("[PCGW] HDR: {:?}", hdr);

    println!("[PCGW] Ultrawide: {:?}", ultrawide);

    Ok(PcgwGameData {
        found: true,

        page_url: Some(page_url(&page_name)),

        page_name: Some(page_name),

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

        raw_wikitext_available: true,
    })
}

fn build_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("GameManager/0.1 PC game library manager")
        .redirect(Policy::limited(10))
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))
}

// ============================================================
// Steam / GOG ID matching
// ============================================================

async fn resolve_steam_app_id(client: &Client, app_id: &str) -> Option<String> {
    let url = format!(
        "https://www.pcgamingwiki.com/api/appid.php?appid={}",
        urlencoding::encode(app_id)
    );

    resolve_redirect_page(client, &url).await
}

async fn resolve_gog_id(client: &Client, gog_id: &str) -> Option<String> {
    let url = format!(
        "https://www.pcgamingwiki.com/api/gog.php?page={}",
        urlencoding::encode(gog_id)
    );

    resolve_redirect_page(client, &url).await
}

async fn resolve_redirect_page(client: &Client, url: &str) -> Option<String> {
    println!("[PCGW] Resolving ID using {}", url);

    let response = client.get(url).send().await.ok()?;

    if !response.status().is_success() {
        println!("[PCGW] ID resolver HTTP status: {}", response.status());

        return None;
    }

    let final_url = response.url().clone();

    println!("[PCGW] Redirect result: {}", final_url);

    let path = final_url.path();

    let wiki_prefix = "/wiki/";

    let index = path.find(wiki_prefix)?;

    let encoded_title = &path[index + wiki_prefix.len()..];

    if encoded_title.is_empty() {
        return None;
    }

    let decoded = urlencoding::decode(encoded_title).ok()?.replace('_', " ");

    Some(decoded)
}

// ============================================================
// Search fallback
// ============================================================

async fn search_page_by_name(client: &Client, game_name: &str) -> Result<Option<String>, String> {
    println!("[PCGW] Searching by name: {}", game_name);

    let response = client
        .get(PCGW_API)
        .query(&[
            ("action", "opensearch"),
            ("search", game_name),
            ("limit", "5"),
            ("namespace", "0"),
            ("redirects", "resolve"),
            ("format", "json"),
        ])
        .send()
        .await
        .map_err(|error| format!("PCGamingWiki search failed: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "PCGamingWiki search returned HTTP {}",
            response.status()
        ));
    }

    let json: Value = response
        .json()
        .await
        .map_err(|error| format!("Invalid PCGamingWiki search response: {}", error))?;

    let titles = json.get(1).and_then(Value::as_array);

    let Some(titles) = titles else {
        return Ok(None);
    };

    if titles.is_empty() {
        return Ok(None);
    }

    // Prefer an exact case-insensitive title match.
    for title in titles {
        if let Some(title) = title.as_str() {
            if normalize_name(title) == normalize_name(game_name) {
                println!("[PCGW] Exact title match: {}", title);

                return Ok(Some(title.to_string()));
            }
        }
    }

    // Otherwise use the first result.
    let first = titles.first().and_then(Value::as_str).map(String::from);

    if let Some(title) = &first {
        println!("[PCGW] Search fallback match: {}", title);
    }

    Ok(first)
}

fn normalize_name(value: &str) -> String {
    value
        .to_lowercase()
        .replace('™', "")
        .replace('®', "")
        .replace(':', "")
        .replace('-', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

// ============================================================
// Retrieve MediaWiki source
// ============================================================

async fn fetch_wikitext(client: &Client, page_name: &str) -> Result<Option<String>, String> {
    println!("[PCGW] Fetching wikitext for {}", page_name);

    let response = client
        .get(PCGW_API)
        .query(&[
            ("action", "parse"),
            ("page", page_name),
            ("redirects", "1"),
            ("prop", "wikitext"),
            ("format", "json"),
            ("formatversion", "2"),
        ])
        .send()
        .await
        .map_err(|error| format!("Failed to retrieve PCGamingWiki page: {}", error))?;

    if !response.status().is_success() {
        return Err(format!("PCGamingWiki returned HTTP {}", response.status()));
    }

    let json: Value = response
        .json()
        .await
        .map_err(|error| format!("Invalid PCGamingWiki response: {}", error))?;

    let wikitext = json
        .get("parse")
        .and_then(|value| value.get("wikitext"))
        .and_then(Value::as_str)
        .map(String::from);

    Ok(wikitext)
}

// ============================================================
// Infobox parsing
// ============================================================

fn extract_row_value(text: &str, template_name: &str, argument_index: usize) -> Option<String> {
    let search = format!("{{{{{}|", template_name);

    let lower_text = text.to_lowercase();

    let lower_search = search.to_lowercase();

    let start = lower_text.find(&lower_search)?;

    let remainder = &text[start + search.len()..];

    let end = remainder.find("}}")?;

    let inside = &remainder[..end];

    let args: Vec<&str> = inside.split('|').collect();

    let value = args.get(argument_index - 1)?;

    clean_wiki_value(value)
}

fn extract_windows_release_date(text: &str) -> Option<String> {
    let search = "{{Infobox game/row/date|";

    let lower = text.to_lowercase();

    let lower_search = search.to_lowercase();

    let mut offset = 0;

    while let Some(relative) = lower[offset..].find(&lower_search) {
        let start = offset + relative;

        let remainder = &text[start + search.len()..];

        let Some(end) = remainder.find("}}") else {
            break;
        };

        let inside = &remainder[..end];

        let args: Vec<&str> = inside.split('|').collect();

        if args.len() >= 2 {
            let platform = args[0].trim().to_lowercase();

            if platform == "windows" {
                return clean_wiki_value(args[1]);
            }
        }

        offset = start + search.len();
    }

    None
}

// ============================================================
// Template parameter parsing
// ============================================================

fn extract_template_parameter(text: &str, template_name: &str, parameter: &str) -> Option<String> {
    let template_start = format!("{{{{{}", template_name);

    let lower_text = text.to_lowercase();

    let start = lower_text.find(&template_start.to_lowercase())?;

    let template_text = &text[start..];

    // These templates are normally line-oriented.
    // Stop at the first standalone closing template.
    let mut collected = String::new();

    for line in template_text.lines() {
        let trimmed = line.trim();

        collected.push_str(line);
        collected.push('\n');

        if trimmed == "}}" {
            break;
        }
    }

    for line in collected.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };

        let key = key.trim().trim_start_matches('|').trim();

        if key.eq_ignore_ascii_case(parameter) {
            return clean_wiki_value(value);
        }
    }

    None
}

// ============================================================
// Cleanup helpers
// ============================================================

fn clean_wiki_value(input: &str) -> Option<String> {
    let mut value = input.trim().to_string();

    if value.is_empty() {
        return None;
    }

    value = value.replace("<!--", "");

    if let Some(index) = value.find("-->") {
        value = value[index + 3..].to_string();
    }

    value = strip_wiki_links(&value);

    value = value.trim().to_string();

    if value.is_empty() {
        None
    } else {
        Some(value)
    }
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

        let contents = &result[start + 2..end];

        let replacement = if let Some((_, label)) = contents.rsplit_once('|') {
            label.to_string()
        } else {
            contents.to_string()
        };

        result.replace_range(start..end + 2, &replacement);
    }

    result
}

fn page_url(page_name: &str) -> String {
    format!(
        "https://www.pcgamingwiki.com/wiki/{}",
        urlencoding::encode(&page_name.replace(' ', "_"))
    )
}
