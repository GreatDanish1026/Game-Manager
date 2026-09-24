use serde::Deserialize;
use std::time::Duration;

#[derive(Deserialize)]
struct SearchResponse {
    items: Option<Vec<SearchItem>>,
}

#[derive(Deserialize)]
struct SearchItem {
    #[serde(rename = "type")]
    item_type: String,
    name: String,
    id: u64,
}

fn normalized_title(title: &str) -> String {
    title
        .chars()
        .filter(|character| !matches!(character, '™' | '®' | '©'))
        .flat_map(|character| character.to_lowercase())
        .map(|character| if character.is_alphanumeric() { character } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[tauri::command]
pub async fn find_steam_app_id_for_artwork(title: String) -> Result<Option<u64>, String> {
    let title = title.trim();
    if title.len() < 3 || title.len() > 160 || normalized_title(title).is_empty() {
        return Ok(None);
    }

    let client = reqwest::Client::builder()
        .user_agent("GameAtlas/2.5 (artwork lookup)")
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get("https://store.steampowered.com/api/storesearch/")
        .query(&[("term", title), ("l", "english"), ("cc", "US")])
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    let results: SearchResponse = response.json().await.map_err(|error| error.to_string())?;
    let expected = normalized_title(title);
    let matches: Vec<u64> = results
        .items
        .unwrap_or_default()
        .into_iter()
        .filter(|item| item.item_type == "app" && normalized_title(&item.name) == expected)
        .map(|item| item.id)
        .collect();

    // Ambiguous titles are safer as letter tiles than as the wrong game's artwork.
    Ok(if matches.len() == 1 { matches.first().copied() } else { None })
}

#[cfg(test)]
mod tests {
    use super::normalized_title;

    #[test]
    fn title_normalization_handles_store_punctuation() {
        assert_eq!(normalized_title("Amnesia: The Bunker™"), "amnesia the bunker");
        assert_ne!(normalized_title("Game: Remastered"), normalized_title("Game"));
    }
}
