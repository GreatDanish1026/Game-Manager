use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
use std::{
    collections::{BTreeMap, BTreeSet},
    os::windows::process::CommandExt,
    path::PathBuf,
    process::Command,
    sync::{Mutex, OnceLock},
};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanLaunchCandidate {
    pub id: String,
    pub name: String,
    pub category: String,
    pub impact: String,
    pub running: bool,
    pub selected_by_default: bool,
    pub process_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanLaunchStatus {
    pub supported: bool,
    pub candidates: Vec<CleanLaunchCandidate>,
    pub restorable_count: usize,
    pub session_active: bool,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanLaunchSelection {
    pub ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanLaunchActionResult {
    pub success: bool,
    pub stopped_apps: Vec<String>,
    pub restored_apps: Vec<String>,
    pub failures: Vec<String>,
    pub message: String,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
struct RestorableProcess {
    app_id: String,
    app_name: String,
    executable_path: PathBuf,
}

#[cfg(target_os = "windows")]
fn restore_state() -> &'static Mutex<Vec<RestorableProcess>> {
    static STATE: OnceLock<Mutex<Vec<RestorableProcess>>> = OnceLock::new();

    STATE.get_or_init(|| Mutex::new(Vec::new()))
}

#[cfg(target_os = "windows")]
fn hidden_command(program: &str) -> Command {
    let mut command = Command::new(program);

    command.creation_flags(CREATE_NO_WINDOW);

    command
}

#[cfg(target_os = "windows")]
fn command_text(program: &str, args: &[&str]) -> Option<String> {
    let output = hidden_command(program).args(args).output().ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

#[cfg(target_os = "windows")]
fn powershell_text(script: &str) -> Option<String> {
    command_text(
        "powershell.exe",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ],
    )
}

#[cfg(target_os = "windows")]
#[derive(Clone, Copy)]
struct Definition {
    id: &'static str,
    name: &'static str,
    processes: &'static [&'static str],
    category: &'static str,
    impact: &'static str,
    selected_by_default: bool,
}

#[cfg(target_os = "windows")]
fn definitions() -> &'static [Definition] {
    &[
        Definition {
            id: "rtss",
            name: "RivaTuner Statistics Server",
            processes: &["RTSS.exe", "RTSSHooksLoader64.exe"],
            category: "Overlay / monitoring",
            impact: "hook-capable",
            selected_by_default: true,
        },
        Definition {
            id: "msi-afterburner",
            name: "MSI Afterburner",
            processes: &["MSIAfterburner.exe"],
            category: "Monitoring / tuning",
            impact: "monitoring",
            selected_by_default: false,
        },
        Definition {
            id: "discord",
            name: "Discord",
            processes: &[
                "Discord.exe",
                "DiscordPTB.exe",
                "DiscordCanary.exe",
                "DiscordDevelopment.exe",
            ],
            category: "Overlay / communication",
            impact: "hook-capable",
            selected_by_default: true,
        },
        Definition {
            id: "nvidia-overlay",
            name: "NVIDIA Overlay",
            processes: &["NVIDIA Overlay.exe", "NVIDIA Share.exe"],
            category: "Overlay / capture",
            impact: "hook-capable",
            selected_by_default: true,
        },
        Definition {
            id: "obs",
            name: "OBS Studio",
            processes: &["obs64.exe", "obs32.exe"],
            category: "Capture / streaming",
            impact: "hook-capable",
            selected_by_default: true,
        },
        Definition {
            id: "overwolf",
            name: "Overwolf",
            processes: &["Overwolf.exe", "OverwolfBrowser.exe"],
            category: "Overlay platform",
            impact: "hook-capable",
            selected_by_default: true,
        },
        Definition {
            id: "medal",
            name: "Medal",
            processes: &["Medal.exe"],
            category: "Capture / clipping",
            impact: "hook-capable",
            selected_by_default: true,
        },
        Definition {
            id: "steelseries",
            name: "SteelSeries GG",
            processes: &["SteelSeriesGG.exe", "SteelSeriesEngine.exe"],
            category: "Device / capture",
            impact: "background",
            selected_by_default: false,
        },
        Definition {
            id: "icue",
            name: "Corsair iCUE",
            processes: &["iCUE.exe", "iCUEDevicePluginHost.exe"],
            category: "RGB / device control",
            impact: "background",
            selected_by_default: false,
        },
        Definition {
            id: "razer",
            name: "Razer Synapse",
            processes: &["Razer Synapse 3.exe", "RazerAppEngine.exe"],
            category: "RGB / device control",
            impact: "background",
            selected_by_default: false,
        },
        Definition {
            id: "logitech-ghub",
            name: "Logitech G HUB",
            processes: &["lghub.exe", "lghub_agent.exe"],
            category: "Device control",
            impact: "background",
            selected_by_default: false,
        },
        Definition {
            id: "armoury-crate",
            name: "ASUS Armoury Crate",
            processes: &["ArmouryCrate.UserSessionHelper.exe"],
            category: "System / RGB control",
            impact: "background",
            selected_by_default: false,
        },
        Definition {
            id: "nzxt-cam",
            name: "NZXT CAM",
            processes: &["NZXT CAM.exe"],
            category: "Monitoring / RGB",
            impact: "monitoring",
            selected_by_default: false,
        },
        Definition {
            id: "signalrgb",
            name: "SignalRGB",
            processes: &["SignalRgb.exe"],
            category: "RGB control",
            impact: "background",
            selected_by_default: false,
        },
        Definition {
            id: "openrgb",
            name: "OpenRGB",
            processes: &["OpenRGB.exe"],
            category: "RGB control",
            impact: "background",
            selected_by_default: false,
        },
        Definition {
            id: "wallpaper-engine",
            name: "Wallpaper Engine",
            processes: &["wallpaper64.exe", "wallpaper32.exe"],
            category: "Desktop background",
            impact: "background",
            selected_by_default: false,
        },
    ]
}

#[cfg(target_os = "windows")]
fn running_process_names() -> BTreeSet<String> {
    let output = hidden_command("tasklist.exe")
        .args(["/FO", "CSV", "/NH"])
        .output();

    let Ok(output) = output else {
        return BTreeSet::new();
    };

    if !output.status.success() {
        return BTreeSet::new();
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let first = line
                .trim()
                .trim_start_matches('"')
                .split("\",\"")
                .next()?
                .trim_matches('"')
                .trim()
                .to_ascii_lowercase();

            if first.is_empty() {
                None
            } else {
                Some(first)
            }
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn process_paths() -> BTreeMap<String, Vec<PathBuf>> {
    let script = r#"
$ErrorActionPreference = 'SilentlyContinue'

Get-CimInstance Win32_Process |
    Where-Object {
        $_.Name -and
        $_.ExecutablePath
    } |
    ForEach-Object {
        [PSCustomObject]@{
            Name = $_.Name
            ExecutablePath = $_.ExecutablePath
        }
    } |
    ConvertTo-Json -Compress
"#;

    let Some(output) = powershell_text(script) else {
        return BTreeMap::new();
    };

    let parsed: serde_json::Value = match serde_json::from_str(&output) {
        Ok(value) => value,

        Err(_) => return BTreeMap::new(),
    };

    let values = match parsed {
        serde_json::Value::Array(values) => values,

        serde_json::Value::Object(_) => vec![parsed],

        _ => Vec::new(),
    };

    let mut result: BTreeMap<String, Vec<PathBuf>> = BTreeMap::new();

    for value in values {
        let Some(name) = value.get("Name").and_then(|value| value.as_str()) else {
            continue;
        };

        let Some(path) = value.get("ExecutablePath").and_then(|value| value.as_str()) else {
            continue;
        };

        let path = path.trim();

        if path.is_empty() {
            continue;
        }

        result
            .entry(name.to_ascii_lowercase())
            .or_default()
            .push(PathBuf::from(path));
    }

    for paths in result.values_mut() {
        paths.sort();
        paths.dedup();
    }

    result
}

#[cfg(target_os = "windows")]
fn candidate_from_definition(
    definition: Definition,
    running: &BTreeSet<String>,
) -> CleanLaunchCandidate {
    let process_names = definition
        .processes
        .iter()
        .map(|value| (*value).to_string())
        .collect::<Vec<_>>();

    let is_running = definition
        .processes
        .iter()
        .any(|value| running.contains(&value.to_ascii_lowercase()));

    CleanLaunchCandidate {
        id: definition.id.to_string(),

        name: definition.name.to_string(),

        category: definition.category.to_string(),

        impact: definition.impact.to_string(),

        running: is_running,

        selected_by_default: definition.selected_by_default && is_running,

        process_names,
    }
}

#[tauri::command]
pub fn get_clean_launch_status() -> CleanLaunchStatus {
    #[cfg(target_os = "windows")]
    {
        let running = running_process_names();

        let candidates = definitions()
            .iter()
            .copied()
            .map(|definition| candidate_from_definition(definition, &running))
            .filter(|candidate| candidate.running)
            .collect::<Vec<_>>();

        let restorable_count = restore_state().lock().map(|state| state.len()).unwrap_or(0);

        return CleanLaunchStatus {
            supported: true,

            candidates,

            restorable_count,

            session_active: restorable_count > 0,

            message: if restorable_count > 0 {
                "A Clean Launch session has apps available to restore.".to_string()
            } else {
                "Select recognized running apps to close before launching.".to_string()
            },
        };
    }

    #[cfg(not(target_os = "windows"))]
    {
        CleanLaunchStatus {
            supported: false,

            candidates: Vec::new(),

            restorable_count: 0,

            session_active: false,

            message: "Clean Launch is currently available on Windows.".to_string(),
        }
    }
}

#[tauri::command]
pub fn prepare_clean_launch(selection: CleanLaunchSelection) -> CleanLaunchActionResult {
    #[cfg(target_os = "windows")]
    {
        let selected = selection.ids.into_iter().collect::<BTreeSet<_>>();

        if selected.is_empty() {
            return CleanLaunchActionResult {
                success: true,

                stopped_apps: Vec::new(),

                restored_apps: Vec::new(),

                failures: Vec::new(),

                message: "No background applications were selected.".to_string(),
            };
        }

        let running = running_process_names();

        let paths = process_paths();

        let mut stopped_apps = Vec::new();

        let mut failures = Vec::new();

        let mut restorable = Vec::new();

        for definition in definitions().iter().copied() {
            if !selected.contains(definition.id) {
                continue;
            }

            let active_processes = definition
                .processes
                .iter()
                .filter(|process| running.contains(&process.to_ascii_lowercase()))
                .copied()
                .collect::<Vec<_>>();

            if active_processes.is_empty() {
                continue;
            }

            let mut captured_path: Option<PathBuf> = None;

            for process in &active_processes {
                if captured_path.is_none() {
                    captured_path = paths
                        .get(&process.to_ascii_lowercase())
                        .and_then(|values| values.first())
                        .cloned();
                }

                let output = hidden_command("taskkill.exe")
                    .args(["/IM", process, "/F"])
                    .output();

                match output {
                    Ok(result) if result.status.success() => {}

                    Ok(result) => {
                        let detail = String::from_utf8_lossy(&result.stderr).trim().to_string();

                        failures.push(if detail.is_empty() {
                            format!("{} could not be closed.", process)
                        } else {
                            format!("{}: {}", process, detail)
                        });
                    }

                    Err(error) => {
                        failures.push(format!("{}: {}", process, error));
                    }
                }
            }

            if let Some(executable_path) = captured_path {
                restorable.push(RestorableProcess {
                    app_id: definition.id.to_string(),

                    app_name: definition.name.to_string(),

                    executable_path,
                });
            }

            stopped_apps.push(definition.name.to_string());
        }

        if let Ok(mut state) = restore_state().lock() {
            *state = restorable;
        }

        let success = failures.is_empty();

        CleanLaunchActionResult {
            success,

            stopped_apps: stopped_apps.clone(),

            restored_apps: Vec::new(),

            failures,

            message: if stopped_apps.is_empty() {
                "None of the selected applications were running.".to_string()
            } else {
                format!(
                    "Closed {} application{} for Clean Launch.",
                    stopped_apps.len(),
                    if stopped_apps.len() == 1 { "" } else { "s" }
                )
            },
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = selection;

        CleanLaunchActionResult {
            success: false,

            stopped_apps: Vec::new(),

            restored_apps: Vec::new(),

            failures: vec!["Clean Launch is currently available only on Windows.".to_string()],

            message: "Clean Launch is unavailable.".to_string(),
        }
    }
}

#[tauri::command]
pub fn restore_clean_launch_apps() -> CleanLaunchActionResult {
    #[cfg(target_os = "windows")]
    {
        let processes = match restore_state().lock() {
            Ok(mut state) => std::mem::take(&mut *state),

            Err(_) => {
                return CleanLaunchActionResult {
                    success: false,

                    stopped_apps: Vec::new(),

                    restored_apps: Vec::new(),

                    failures: vec!["Clean Launch restore state could not be accessed.".to_string()],

                    message: "Apps could not be restored.".to_string(),
                };
            }
        };

        let mut restored_apps = Vec::new();

        let mut failures = Vec::new();

        let mut seen_apps = BTreeSet::new();

        for process in processes {
            if !process.executable_path.exists() {
                failures.push(format!(
                    "{} executable no longer exists: {}",
                    process.app_name,
                    process.executable_path.display()
                ));

                continue;
            }

            if seen_apps.contains(&process.app_id) {
                continue;
            }

            match Command::new(&process.executable_path).spawn() {
                Ok(_) => {
                    restored_apps.push(process.app_name.clone());

                    seen_apps.insert(process.app_id);
                }

                Err(error) => {
                    failures.push(format!("{}: {}", process.app_name, error));
                }
            }
        }

        let success = failures.is_empty();

        CleanLaunchActionResult {
            success,

            stopped_apps: Vec::new(),

            restored_apps: restored_apps.clone(),

            failures,

            message: if restored_apps.is_empty() {
                "No Clean Launch applications needed restoring.".to_string()
            } else {
                format!(
                    "Restored {} application{}.",
                    restored_apps.len(),
                    if restored_apps.len() == 1 { "" } else { "s" }
                )
            },
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        CleanLaunchActionResult {
            success: false,

            stopped_apps: Vec::new(),

            restored_apps: Vec::new(),

            failures: vec!["Clean Launch is currently available only on Windows.".to_string()],

            message: "Apps could not be restored.".to_string(),
        }
    }
}
