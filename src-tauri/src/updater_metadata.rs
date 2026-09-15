use reqwest::Client;
use semver::Version;
use serde::{Deserialize, Serialize};
use std::{cmp::Ordering, collections::HashMap, time::Duration};

const UPDATER_ENDPOINT: &str =
    "https://github.com/GreatDanish1026/Game-Manager/releases/latest/download/latest.json";

#[derive(Debug, Deserialize)]
struct UpdaterManifest {
    version: String,
    notes: Option<String>,
    pub_date: Option<String>,
    #[serde(default)]
    platforms: HashMap<String, UpdaterPlatform>,
}

#[derive(Debug, Deserialize)]
struct UpdaterPlatform {
    signature: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdaterVersionStatus {
    current_version: String,
    latest_version: String,
    relation: String,
    notes: Option<String>,
    pub_date: Option<String>,
    target: String,
    platform_available: bool,
}

fn updater_target() -> &'static str {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        return "windows-x86_64";
    }

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        return "linux-x86_64";
    }

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        return "darwin-x86_64";
    }

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        return "darwin-aarch64";
    }

    #[allow(unreachable_code)]
    "unsupported"
}

fn parse_manifest(bytes: &[u8]) -> Result<UpdaterManifest, String> {
    let text = std::str::from_utf8(bytes)
        .map_err(|error| format!("Updater metadata is not valid UTF-8: {error}"))?;

    // Some manually generated GitHub release manifests include a UTF-8 BOM.
    // serde_json intentionally rejects it, so remove it before parsing.
    let normalized = text.trim_start_matches('\u{feff}');

    serde_json::from_str(normalized)
        .map_err(|error| format!("Updater metadata is not valid release JSON: {error}"))
}

#[tauri::command]
pub async fn get_updater_version_status(
    app: tauri::AppHandle,
) -> Result<UpdaterVersionStatus, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("GameAtlas-Updater/2")
        .build()
        .map_err(|error| format!("Could not create the updater client: {error}"))?;

    let response = client
        .get(UPDATER_ENDPOINT)
        .send()
        .await
        .map_err(|error| format!("Could not reach the GameAtlas update service: {error}"))?
        .error_for_status()
        .map_err(|error| format!("The GameAtlas update service returned an error: {error}"))?;

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Could not read the updater metadata: {error}"))?;

    let manifest = parse_manifest(&bytes)?;
    let latest_version_text = manifest.version.trim().trim_start_matches('v');
    let latest_version = Version::parse(latest_version_text).map_err(|error| {
        format!(
            "Updater metadata contains an invalid version '{}': {error}",
            manifest.version
        )
    })?;
    let current_version = app.package_info().version.clone();
    let relation = match latest_version.cmp(&current_version) {
        Ordering::Greater => "update_available",
        Ordering::Equal => "current",
        Ordering::Less => "ahead",
    };
    let target = updater_target();
    let platform_available = manifest.platforms.get(target).is_some_and(|platform| {
        platform
            .signature
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
            && platform
                .url
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
    });

    Ok(UpdaterVersionStatus {
        current_version: current_version.to_string(),
        latest_version: latest_version.to_string(),
        relation: relation.to_string(),
        notes: manifest.notes,
        pub_date: manifest.pub_date,
        target: target.to_string(),
        platform_available,
    })
}

#[cfg(test)]
mod tests {
    use super::parse_manifest;

    #[test]
    fn accepts_manifest_with_utf8_bom() {
        let manifest = parse_manifest(b"\xef\xbb\xbf{\"version\":\"2.2.0\",\"platforms\":{}}")
            .expect("manifest with BOM should parse");

        assert_eq!(manifest.version, "2.2.0");
    }

    #[test]
    fn accepts_manifest_without_utf8_bom() {
        let manifest = parse_manifest(b"{\"version\":\"2.3.0\",\"platforms\":{}}")
            .expect("plain manifest should parse");

        assert_eq!(manifest.version, "2.3.0");
    }
}
