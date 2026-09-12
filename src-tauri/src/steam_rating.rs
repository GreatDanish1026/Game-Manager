use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamCommunityRating {
    pub positive: u64,
    pub negative: u64,
    pub total: u64,
    pub review_score_percent: f64,
    pub rating: f64,
}

fn steamdb_style_rating(positive: u64, negative: u64) -> f64 {
    let total = positive + negative;

    if total == 0 {
        return 50.0;
    }

    let total_f = total as f64;
    let review_score = positive as f64 / total_f;

    let score = review_score - (review_score - 0.5) * 2_f64.powf(-(total_f + 1.0).log10());

    score * 100.0
}

#[tauri::command]
pub async fn get_steam_community_rating(
    app_id: String,
) -> Result<Option<SteamCommunityRating>, String> {
    if app_id.is_empty() || !app_id.chars().all(|character| character.is_ascii_digit()) {
        return Ok(None);
    }

    let url =
        format!(
            "https://store.steampowered.com/appreviews/{}?json=1&language=all&purchase_type=all&num_per_page=0",
            app_id
        );

    let client = reqwest::Client::builder()
        .user_agent("GameAtlas/1.6")
        .build()
        .map_err(|error| error.to_string())?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Steam reviews returned HTTP {}.",
            response.status()
        ));
    }

    let payload: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;

    let summary = payload
        .get("query_summary")
        .ok_or_else(|| "Steam review response did not contain query_summary.".to_string())?;

    let positive = summary
        .get("total_positive")
        .and_then(|value| value.as_u64())
        .unwrap_or(0);

    let negative = summary
        .get("total_negative")
        .and_then(|value| value.as_u64())
        .unwrap_or(0);

    let total = summary
        .get("total_reviews")
        .and_then(|value| value.as_u64())
        .unwrap_or(positive + negative);

    if total == 0 {
        return Ok(None);
    }

    let review_score_percent = positive as f64 / total as f64 * 100.0;

    Ok(Some(SteamCommunityRating {
        positive,
        negative,
        total,
        review_score_percent,
        rating: steamdb_style_rating(positive, negative),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rating_stays_in_valid_range() {
        for (positive, negative) in [(1, 0), (0, 1), (90, 10), (10, 90), (50000, 5000)] {
            let value = steamdb_style_rating(positive, negative);

            assert!(value >= 0.0 && value <= 100.0);
        }
    }
}
