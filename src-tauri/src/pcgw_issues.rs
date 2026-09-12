use reqwest::Client;
use serde::{Deserialize, Serialize};

const PCGW_API_URL: &str = "https://www.pcgamingwiki.com/w/api.php";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PcgwKnownIssues {
    pub unresolved_html: Option<String>,
    pub fixed_html: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SectionsResponse {
    parse: Option<SectionsParse>,
}

#[derive(Debug, Deserialize)]
struct SectionsParse {
    sections: Vec<Section>,
}

#[derive(Debug, Deserialize)]
struct Section {
    index: String,
    line: String,
}

#[derive(Debug, Deserialize)]
struct TextResponse {
    parse: Option<TextParse>,
}

#[derive(Debug, Deserialize)]
struct TextParse {
    text: TextValue,
}

#[derive(Debug, Deserialize)]
struct TextValue {
    #[serde(rename = "*")]
    content: String,
}

fn heading_matches(line: &str, candidates: &[&str]) -> bool {
    let line = line.trim().to_ascii_lowercase();

    candidates
        .iter()
        .any(|candidate| line == candidate.to_ascii_lowercase())
}

async fn get_sections(client: &Client, page_name: &str) -> Result<Vec<Section>, String> {
    let response = client
        .get(PCGW_API_URL)
        .query(&[
            ("action", "parse"),
            ("page", page_name),
            ("redirects", "1"),
            ("prop", "sections"),
            ("format", "json"),
        ])
        .send()
        .await
        .map_err(|error| format!("Failed to retrieve PCGamingWiki sections: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "PCGamingWiki sections request returned HTTP {}",
            response.status()
        ));
    }

    let parsed: SectionsResponse = response
        .json()
        .await
        .map_err(|error| format!("Failed to parse PCGamingWiki sections: {}", error))?;

    Ok(parsed.parse.map(|parse| parse.sections).unwrap_or_default())
}

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
        .map_err(|error| format!("Failed to retrieve PCGamingWiki issue section: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "PCGamingWiki issue request returned HTTP {}",
            response.status()
        ));
    }

    let parsed: TextResponse = response
        .json()
        .await
        .map_err(|error| format!("Failed to parse PCGamingWiki issue section: {}", error))?;

    let html = parsed
        .parse
        .map(|parse| parse.text.content)
        .unwrap_or_default()
        .trim()
        .to_string();

    if html.is_empty() {
        Ok(None)
    } else {
        Ok(Some(html))
    }
}

#[tauri::command]
pub async fn get_pcgw_known_issues(page_name: String) -> Result<PcgwKnownIssues, String> {
    let page_name = page_name.trim();

    if page_name.is_empty() {
        return Ok(PcgwKnownIssues {
            unresolved_html: None,
            fixed_html: None,
        });
    }

    let client =
        Client::builder()
            .user_agent(
                "GameManager/0.6.0 (https://github.com/GreatDanish1026/GameManager) PCGamingWiki integration"
            )
            .redirect(
                reqwest::redirect::Policy::limited(10)
            )
            .build()
            .map_err(|error| {
                format!(
                    "Failed to create PCGamingWiki HTTP client: {}",
                    error
                )
            })?;

    let sections = get_sections(&client, page_name).await?;

    let unresolved = sections
        .iter()
        .find(|section| heading_matches(&section.line, &["Issues unresolved", "Unresolved issues"]))
        .map(|section| section.index.clone());

    let fixed = sections
        .iter()
        .find(|section| heading_matches(&section.line, &["Issues fixed", "Fixed issues"]))
        .map(|section| section.index.clone());

    let unresolved_html = match unresolved {
        Some(index) => get_section_html(&client, page_name, &index).await?,
        None => None,
    };

    let fixed_html = match fixed {
        Some(index) => get_section_html(&client, page_name, &index).await?,
        None => None,
    };

    Ok(PcgwKnownIssues {
        unresolved_html,
        fixed_html,
    })
}
