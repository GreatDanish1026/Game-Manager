use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameVersionSnapshot {
    pub checked_at: String,

    pub source: String,

    pub product_version: Option<String>,

    pub file_version: Option<String>,

    pub steam_build_id: Option<String>,

    pub executable_path: Option<String>,

    pub executable_modified_at: Option<String>,

    pub executable_size: Option<u64>,
}

fn now_iso_like() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    seconds.to_string()
}

fn clean(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

fn path_string(value: &Option<String>) -> Option<PathBuf> {
    clean(value.clone()).map(PathBuf::from)
}

fn find_executable(install_path: &Option<String>, explicit: &Option<String>) -> Option<PathBuf> {
    if let Some(path) = path_string(explicit) {
        if path.is_file() {
            return Some(path);
        }
    }

    let root = path_string(install_path)?;

    if !root.is_dir() {
        return None;
    }

    let mut best: Option<(u64, PathBuf)> = None;

    let entries = fs::read_dir(&root).ok()?;

    for entry in entries.flatten() {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let is_exe = path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("exe"))
            .unwrap_or(false);

        if !is_exe {
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();

        if file_name.contains("unins")
            || file_name.contains("crash")
            || file_name.contains("report")
            || file_name.contains("launcher")
        {
            continue;
        }

        let size = entry.metadata().map(|metadata| metadata.len()).unwrap_or(0);

        if best
            .as_ref()
            .map(|(current_size, _)| size > *current_size)
            .unwrap_or(true)
        {
            best = Some((size, path));
        }
    }

    best.map(|(_, path)| path)
}

#[cfg(target_os = "windows")]
fn windows_version_info(path: &Path) -> (Option<String>, Option<String>) {
    let escaped = path.to_string_lossy().replace('\'', "''");

    let script =
        format!(
            "$v=(Get-Item -LiteralPath '{}').VersionInfo; Write-Output ($v.ProductVersion); Write-Output ($v.FileVersion)",
            escaped
        );

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output();

    let Ok(output) = output else {
        return (None, None);
    };

    if !output.status.success() {
        return (None, None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    let mut lines = stdout.lines().map(|line| line.trim().to_string());

    let product = lines.next().filter(|value| !value.is_empty());

    let file = lines.next().filter(|value| !value.is_empty());

    (product, file)
}

#[cfg(not(target_os = "windows"))]
fn windows_version_info(_path: &Path) -> (Option<String>, Option<String>) {
    (None, None)
}

fn modified_seconds(path: &Path) -> Option<String> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;

    let seconds = modified.duration_since(UNIX_EPOCH).ok()?.as_secs();

    Some(seconds.to_string())
}

fn find_steam_manifest(
    install_path: &Option<String>,
    launcher_id: &Option<String>,
) -> Option<PathBuf> {
    let app_id = clean(launcher_id.clone())?;

    if !app_id.chars().all(|value| value.is_ascii_digit()) {
        return None;
    }

    let install = path_string(install_path)?;

    let file_name = format!("appmanifest_{}.acf", app_id);

    for ancestor in install.ancestors() {
        let candidate = ancestor.join(&file_name);

        if candidate.is_file() {
            return Some(candidate);
        }

        let candidate = ancestor.join("steamapps").join(&file_name);

        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

fn parse_steam_build_id(manifest: &Path) -> Option<String> {
    let text = fs::read_to_string(manifest).ok()?;

    for line in text.lines() {
        let trimmed = line.trim();

        if !trimmed.to_ascii_lowercase().starts_with("\"buildid\"") {
            continue;
        }

        let quoted: Vec<&str> = trimmed.split('"').filter(|part| !part.is_empty()).collect();

        if quoted.len() >= 2 {
            let value = quoted[quoted.len() - 1].trim();

            if !value.is_empty() {
                return Some(value.to_string());
            }
        }

        let digits: String = trimmed
            .chars()
            .filter(|value| value.is_ascii_digit())
            .collect();

        if !digits.is_empty() {
            return Some(digits);
        }
    }

    None
}

#[tauri::command]
pub async fn inspect_game_version(
    store: Option<String>,
    launcher_id: Option<String>,
    install_path: Option<String>,
    executable_path: Option<String>,
) -> Result<GameVersionSnapshot, String> {
    let normalized_store = clean(store).unwrap_or_default().to_ascii_lowercase();

    let executable = find_executable(&install_path, &executable_path);

    let (product_version, file_version, executable_modified_at, executable_size, executable_path) =
        if let Some(executable) = executable {
            let (product, file) = windows_version_info(&executable);

            let modified = modified_seconds(&executable);

            let size = fs::metadata(&executable)
                .map(|metadata| metadata.len())
                .ok();

            (
                product,
                file,
                modified,
                size,
                Some(executable.to_string_lossy().to_string()),
            )
        } else {
            (None, None, None, None, None)
        };

    let steam_build_id = if normalized_store == "steam" {
        find_steam_manifest(&install_path, &launcher_id)
            .and_then(|manifest| parse_steam_build_id(&manifest))
    } else {
        None
    };

    let source =
        if steam_build_id.is_some() && (product_version.is_some() || file_version.is_some()) {
            "Steam + executable".to_string()
        } else if steam_build_id.is_some() {
            "Steam build ID".to_string()
        } else if product_version.is_some() || file_version.is_some() {
            "Executable metadata".to_string()
        } else if executable_path.is_some() {
            "Executable fingerprint".to_string()
        } else {
            "No automatic version signal".to_string()
        };

    Ok(GameVersionSnapshot {
        checked_at: now_iso_like(),

        source,

        product_version,

        file_version,

        steam_build_id,

        executable_path,

        executable_modified_at,

        executable_size,
    })
}
