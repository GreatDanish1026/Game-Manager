use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    env, fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtonTroubleshootingCheck {
    pub id: String,
    pub title: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtonLogInfo {
    pub path: String,
    pub exists: bool,
    pub size_bytes: u64,
    pub modified_unix: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastKnownWorkingRuntime {
    pub name: String,
    pub path: Option<String>,
    pub launcher: String,
    pub saved_unix: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtonTroubleshootingInfo {
    pub overall_status: String,
    pub summary: String,
    pub checks: Vec<ProtonTroubleshootingCheck>,
    pub proton_log: Option<ProtonLogInfo>,
    pub last_known_working_runtime: Option<LastKnownWorkingRuntime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct RuntimeHistoryFile {
    games: BTreeMap<String, RuntimeHistoryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RuntimeHistoryEntry {
    name: String,
    path: Option<String>,
    launcher: String,
    saved_unix: u64,
}

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "HOME is not available.".to_string())
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0)
}

fn modified_unix(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|value| value.as_secs())
}

fn history_path() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".local/share/GameAtlas/proton-runtime-history.json"))
}

fn read_history() -> RuntimeHistoryFile {
    let Ok(path) = history_path() else {
        return RuntimeHistoryFile::default();
    };

    let Ok(text) = fs::read_to_string(path) else {
        return RuntimeHistoryFile::default();
    };

    serde_json::from_str(&text).unwrap_or_default()
}

fn write_history(history: &RuntimeHistoryFile) -> Result<(), String> {
    let path = history_path()?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {}", parent.display(), error))?;
    }

    let text = serde_json::to_string_pretty(history).map_err(|error| error.to_string())?;

    fs::write(&path, format!("{}\n", text))
        .map_err(|error| format!("Failed to write {}: {}", path.display(), error))
}

fn launcher_name(store: &str, source: &str) -> String {
    let combined = format!("{} {}", store, source).to_ascii_lowercase();

    if combined.contains("steam") {
        "Steam".to_string()
    } else if combined.contains("heroic") {
        "Heroic".to_string()
    } else if combined.contains("lutris") {
        "Lutris".to_string()
    } else if !store.trim().is_empty() {
        store.trim().to_string()
    } else {
        "Unknown".to_string()
    }
}

fn find_proton_log(app_id: &str) -> Option<ProtonLogInfo> {
    if app_id.trim().is_empty() {
        return None;
    }

    let home = home_dir().ok()?;

    let candidates = [
        home.join(format!("steam-{}.log", app_id)),
        home.join(format!("Steam-{}.log", app_id)),
        home.join(".local/share/Steam")
            .join(format!("steam-{}.log", app_id)),
    ];

    candidates.into_iter().find_map(|path| {
        if !path.exists() {
            return None;
        }

        let metadata = fs::metadata(&path).ok()?;

        Some(ProtonLogInfo {
            path: path.to_string_lossy().to_string(),
            exists: true,
            size_bytes: metadata.len(),
            modified_unix: modified_unix(&path),
        })
    })
}

fn push_check(
    checks: &mut Vec<ProtonTroubleshootingCheck>,
    id: &str,
    title: &str,
    status: &str,
    message: impl Into<String>,
) {
    checks.push(ProtonTroubleshootingCheck {
        id: id.to_string(),
        title: title.to_string(),
        status: status.to_string(),
        message: message.into(),
    });
}

#[tauri::command]
pub fn get_proton_troubleshooting_info(
    game_key: String,
    store: Option<String>,
    source: Option<String>,
    steam_app_id: Option<String>,
    prefix_path: Option<String>,
    runtime_name: Option<String>,
    runtime_path: Option<String>,
    runtime_source: Option<String>,
) -> Result<ProtonTroubleshootingInfo, String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (
            game_key,
            store,
            source,
            steam_app_id,
            prefix_path,
            runtime_name,
            runtime_path,
            runtime_source,
        );

        return Err("Proton troubleshooting is available on Linux.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let mut checks = Vec::new();

        match prefix_path.as_deref().map(Path::new) {
            None => push_check(
                &mut checks,
                "prefix",
                "Compatibility prefix",
                "warning",
                "No Proton/Wine prefix is currently detected for this game.",
            ),
            Some(path) if !path.exists() => push_check(
                &mut checks,
                "prefix",
                "Compatibility prefix",
                "error",
                format!("The detected prefix does not exist: {}", path.display()),
            ),
            Some(path) => {
                let drive_c = path.join("drive_c");
                let system_reg = path.join("system.reg");
                let user_reg = path.join("user.reg");

                if drive_c.is_dir() && system_reg.is_file() && user_reg.is_file() {
                    push_check(
                        &mut checks,
                        "prefix",
                        "Compatibility prefix",
                        "ok",
                        "The detected prefix contains drive_c and core Wine registry files.",
                    );
                } else {
                    let mut missing = Vec::new();

                    if !drive_c.is_dir() {
                        missing.push("drive_c");
                    }

                    if !system_reg.is_file() {
                        missing.push("system.reg");
                    }

                    if !user_reg.is_file() {
                        missing.push("user.reg");
                    }

                    push_check(
                        &mut checks,
                        "prefix",
                        "Compatibility prefix",
                        "error",
                        format!(
                            "The prefix appears incomplete. Missing: {}.",
                            missing.join(", ")
                        ),
                    );
                }
            }
        }

        let runtime_name = runtime_name.unwrap_or_default();
        let runtime_path = runtime_path.unwrap_or_default();

        if runtime_name.trim().is_empty() {
            push_check(
                &mut checks,
                "runtime",
                "Compatibility runtime",
                "warning",
                "GameAtlas could not determine the active Proton/Wine runtime.",
            );
        } else if runtime_name == "Steam automatic/default" {
            push_check(
                &mut checks,
                "runtime",
                "Compatibility runtime",
                "ok",
                "Steam is using automatic/default compatibility selection.",
            );
        } else if runtime_path.trim().is_empty() {
            push_check(
                &mut checks,
                "runtime",
                "Compatibility runtime",
                "warning",
                format!(
                    "{} is selected, but GameAtlas does not have a filesystem path for it.",
                    runtime_name
                ),
            );
        } else {
            let path = Path::new(runtime_path.trim());

            if path.exists() {
                push_check(
                    &mut checks,
                    "runtime",
                    "Compatibility runtime",
                    "ok",
                    format!("{} is present on disk.", runtime_name),
                );
            } else {
                push_check(
                    &mut checks,
                    "runtime",
                    "Compatibility runtime",
                    "error",
                    format!(
                        "{} points to a runtime path that no longer exists: {}",
                        runtime_name,
                        path.display()
                    ),
                );
            }
        }

        if let Some(source_name) = runtime_source.as_deref() {
            let source_lower = source_name.to_ascii_lowercase();

            if source_lower.contains("override")
                || source_lower.contains("compattoolmapping")
                || source_lower.contains("game settings")
                || source_lower.contains("lutris")
            {
                if !runtime_name.is_empty()
                    && !runtime_path.is_empty()
                    && !Path::new(&runtime_path).exists()
                {
                    push_check(
                        &mut checks,
                        "override",
                        "Runtime override",
                        "error",
                        "The game has an explicit compatibility selection that points to a missing runtime. Clear or replace the override.",
                    );
                } else {
                    push_check(
                        &mut checks,
                        "override",
                        "Runtime override",
                        "ok",
                        "An explicit per-game runtime selection is present and does not appear stale.",
                    );
                }
            }
        }

        let steam_app_id = steam_app_id.unwrap_or_default();
        let proton_log = find_proton_log(&steam_app_id);

        if proton_log.is_some() {
            push_check(
                &mut checks,
                "log",
                "Proton log",
                "ok",
                "A Proton log was found and can be opened for troubleshooting.",
            );
        } else if !steam_app_id.is_empty() {
            push_check(
                &mut checks,
                "log",
                "Proton log",
                "info",
                "No Proton log is currently present. Proton logs normally appear only when Proton logging is enabled for the launch.",
            );
        }

        let history = read_history();

        let last_known_working_runtime =
            history
                .games
                .get(&game_key)
                .map(|entry| LastKnownWorkingRuntime {
                    name: entry.name.clone(),
                    path: entry.path.clone(),
                    launcher: entry.launcher.clone(),
                    saved_unix: entry.saved_unix,
                });

        if let Some(last) = &last_known_working_runtime {
            if last.name == runtime_name {
                push_check(
                    &mut checks,
                    "last-known-working",
                    "Last known working runtime",
                    "ok",
                    format!(
                        "The active runtime matches the saved working runtime: {}.",
                        last.name
                    ),
                );
            } else {
                push_check(
                    &mut checks,
                    "last-known-working",
                    "Last known working runtime",
                    "info",
                    format!(
                        "Saved working runtime: {}. Current runtime: {}.",
                        last.name,
                        if runtime_name.is_empty() {
                            "Unknown"
                        } else {
                            &runtime_name
                        }
                    ),
                );
            }
        }

        let has_error = checks.iter().any(|check| check.status == "error");

        let has_warning = checks.iter().any(|check| check.status == "warning");

        let overall_status = if has_error {
            "needs-attention"
        } else if has_warning {
            "warning"
        } else {
            "healthy"
        }
        .to_string();

        let summary = match overall_status.as_str() {
            "needs-attention" => "One or more Proton configuration problems need attention.",
            "warning" => {
                "No critical Proton problem was found, but some information is incomplete."
            }
            _ => "No obvious Proton configuration problem was detected.",
        }
        .to_string();

        Ok(ProtonTroubleshootingInfo {
            overall_status,
            summary,
            checks,
            proton_log,
            last_known_working_runtime,
        })
    }
}

#[tauri::command]
pub fn save_last_known_working_runtime(
    game_key: String,
    store: Option<String>,
    source: Option<String>,
    runtime_name: String,
    runtime_path: Option<String>,
) -> Result<LastKnownWorkingRuntime, String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (game_key, store, source, runtime_name, runtime_path);

        return Err("Proton troubleshooting is available on Linux.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        if runtime_name.trim().is_empty() || runtime_name.trim() == "Steam automatic/default" {
            return Err(
                "Select a concrete Proton/Wine runtime before saving it as known working."
                    .to_string(),
            );
        }

        let launcher = launcher_name(
            store.as_deref().unwrap_or_default(),
            source.as_deref().unwrap_or_default(),
        );

        let saved_unix = now_unix();

        let mut history = read_history();

        history.games.insert(
            game_key,
            RuntimeHistoryEntry {
                name: runtime_name.trim().to_string(),
                path: runtime_path.clone(),
                launcher: launcher.clone(),
                saved_unix,
            },
        );

        write_history(&history)?;

        Ok(LastKnownWorkingRuntime {
            name: runtime_name.trim().to_string(),
            path: runtime_path,
            launcher,
            saved_unix,
        })
    }
}
