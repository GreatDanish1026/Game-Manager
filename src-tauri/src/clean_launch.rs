use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
use std::{
    collections::{BTreeMap, BTreeSet},
    os::windows::process::CommandExt,
    path::PathBuf,
    process::Command,
    sync::{Mutex, OnceLock},
};

#[cfg(target_os = "linux")]
use std::{
    collections::{BTreeSet, HashMap},
    fs,
    os::unix::fs::MetadataExt,
    path::{Path, PathBuf},
    process::Command,
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
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
    pub platform: String,
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

#[cfg(target_os = "linux")]
#[derive(Debug, Clone)]
enum LinuxRestoreCommand {
    Native(PathBuf),
    Flatpak(String),
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone)]
struct RestorableProcess {
    app_id: String,
    app_name: String,
    command: LinuxRestoreCommand,
}

#[cfg(target_os = "windows")]
fn restore_state() -> &'static Mutex<Vec<RestorableProcess>> {
    static STATE: OnceLock<Mutex<Vec<RestorableProcess>>> = OnceLock::new();

    STATE.get_or_init(|| Mutex::new(Vec::new()))
}

#[cfg(target_os = "linux")]
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

#[cfg(target_os = "linux")]
#[derive(Clone, Copy)]
struct Definition {
    id: &'static str,
    name: &'static str,
    processes: &'static [&'static str],
    category: &'static str,
    impact: &'static str,
    selected_by_default: bool,
    restore_processes: &'static [&'static str],
}

#[cfg(target_os = "linux")]
fn definitions() -> &'static [Definition] {
    &[
        Definition {
            id: "obs",
            name: "OBS Studio",
            processes: &["obs", "obs-studio"],
            category: "Capture / streaming",
            impact: "hook-capable",
            selected_by_default: true,
            restore_processes: &["obs", "obs-studio"],
        },
        Definition {
            id: "gpu-screen-recorder",
            name: "GPU Screen Recorder",
            processes: &[
                "gpu-screen-recorder",
                "gpu-screen-recorder-gtk",
                "gpu-screen-recorder-ui",
                "gsr-ui",
            ],
            category: "Capture / clipping",
            impact: "hook-capable",
            selected_by_default: true,
            restore_processes: &[
                "gpu-screen-recorder-gtk",
                "gpu-screen-recorder-ui",
                "gsr-ui",
            ],
        },
        Definition {
            id: "replay-sorcery",
            name: "ReplaySorcery",
            processes: &["replay-sorcery", "replaysorcery"],
            category: "Capture / clipping",
            impact: "hook-capable",
            selected_by_default: true,
            restore_processes: &[],
        },
        Definition {
            id: "kooha",
            name: "Kooha",
            processes: &["kooha"],
            category: "Screen capture",
            impact: "hook-capable",
            selected_by_default: true,
            restore_processes: &["kooha"],
        },
        Definition {
            id: "simple-screen-recorder",
            name: "SimpleScreenRecorder",
            processes: &["simplescreenrecorder"],
            category: "Screen capture",
            impact: "hook-capable",
            selected_by_default: true,
            restore_processes: &["simplescreenrecorder"],
        },
        Definition {
            id: "wf-recorder",
            name: "wf-recorder",
            processes: &["wf-recorder"],
            category: "Screen capture",
            impact: "hook-capable",
            selected_by_default: true,
            restore_processes: &[],
        },
        Definition {
            id: "discord",
            name: "Discord",
            processes: &[
                "discord",
                "discordcanary",
                "discordptb",
                "vesktop",
                "webcord",
            ],
            category: "Communication / streaming",
            impact: "background",
            selected_by_default: false,
            restore_processes: &[
                "discord",
                "discordcanary",
                "discordptb",
                "vesktop",
                "webcord",
            ],
        },
        Definition {
            id: "corectrl",
            name: "CoreCtrl",
            processes: &["corectrl"],
            category: "GPU monitoring / tuning",
            impact: "monitoring",
            selected_by_default: false,
            restore_processes: &["corectrl"],
        },
        Definition {
            id: "lact",
            name: "LACT",
            processes: &["lact"],
            category: "GPU monitoring / tuning",
            impact: "monitoring",
            selected_by_default: false,
            restore_processes: &[],
        },
        Definition {
            id: "mission-center",
            name: "Mission Center",
            processes: &["missioncenter", "io.missioncenter.missioncenter"],
            category: "System monitoring",
            impact: "monitoring",
            selected_by_default: false,
            restore_processes: &["missioncenter", "io.missioncenter.missioncenter"],
        },
        Definition {
            id: "resources",
            name: "Resources",
            processes: &["resources", "net.nokyan.resources"],
            category: "System monitoring",
            impact: "monitoring",
            selected_by_default: false,
            restore_processes: &["resources", "net.nokyan.resources"],
        },
        Definition {
            id: "openrgb",
            name: "OpenRGB",
            processes: &["openrgb"],
            category: "RGB / device control",
            impact: "background",
            selected_by_default: false,
            restore_processes: &["openrgb"],
        },
        Definition {
            id: "input-remapper",
            name: "Input Remapper",
            processes: &["input-remapper-gtk"],
            category: "Input remapping",
            impact: "background",
            selected_by_default: false,
            restore_processes: &["input-remapper-gtk"],
        },
        Definition {
            id: "antimicrox",
            name: "AntiMicroX",
            processes: &["antimicrox"],
            category: "Input remapping",
            impact: "background",
            selected_by_default: false,
            restore_processes: &["antimicrox"],
        },
        Definition {
            id: "linux-wallpaper-engine",
            name: "Linux Wallpaper Engine",
            processes: &["linux-wallpaperengine", "linux-wallpaper-engine"],
            category: "Animated desktop background",
            impact: "background",
            selected_by_default: false,
            restore_processes: &[],
        },
        Definition {
            id: "mpvpaper",
            name: "mpvpaper",
            processes: &["mpvpaper"],
            category: "Animated desktop background",
            impact: "background",
            selected_by_default: false,
            restore_processes: &[],
        },
    ]
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone)]
struct LinuxProcess {
    pid: u32,
    start_time: u64,
    aliases: BTreeSet<String>,
    executable_path: Option<PathBuf>,
    flatpak_app_id: Option<String>,
}

#[cfg(target_os = "linux")]
fn normalized_process_name(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_matches('\0');

    if trimmed.is_empty() {
        return None;
    }

    let file_name = Path::new(trimmed)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| trimmed.to_string());
    let normalized = file_name.trim().to_ascii_lowercase();

    (!normalized.is_empty()).then_some(normalized)
}

#[cfg(target_os = "linux")]
fn parse_start_time(stat: &str) -> Option<u64> {
    let close = stat.rfind(") ")?;
    stat.get(close + 2..)?
        .split_whitespace()
        .nth(19)?
        .parse()
        .ok()
}

#[cfg(target_os = "linux")]
fn flatpak_app_id(contents: &str) -> Option<String> {
    let mut in_application = false;

    for line in contents.lines() {
        let line = line.trim();

        if line.starts_with('[') && line.ends_with(']') {
            in_application = line == "[Application]";
            continue;
        }

        if in_application {
            if let Some(value) = line.strip_prefix("name=") {
                let value = value.trim();
                return (!value.is_empty()).then(|| value.to_string());
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn linux_processes() -> Vec<LinuxProcess> {
    let Ok(own_uid) = fs::metadata("/proc/self").map(|metadata| metadata.uid()) else {
        return Vec::new();
    };
    let Ok(entries) = fs::read_dir("/proc") else {
        return Vec::new();
    };
    let mut processes = Vec::new();

    for entry in entries.flatten() {
        let Ok(pid) = entry.file_name().to_string_lossy().parse::<u32>() else {
            continue;
        };
        let root = entry.path();

        if fs::metadata(&root).map(|metadata| metadata.uid()).ok() != Some(own_uid) {
            continue;
        }

        let Some(start_time) = fs::read_to_string(root.join("stat"))
            .ok()
            .and_then(|stat| parse_start_time(&stat))
        else {
            continue;
        };
        let mut aliases = BTreeSet::new();

        if let Ok(comm) = fs::read_to_string(root.join("comm")) {
            if let Some(name) = normalized_process_name(&comm) {
                aliases.insert(name);
            }
        }

        let executable_path = fs::read_link(root.join("exe")).ok();

        if let Some(path) = executable_path.as_ref() {
            if let Some(name) = normalized_process_name(&path.to_string_lossy()) {
                aliases.insert(name);
            }
        }

        if let Ok(command_line) = fs::read(root.join("cmdline")) {
            if let Some(argument) = command_line.split(|byte| *byte == 0).next() {
                if let Some(name) = normalized_process_name(&String::from_utf8_lossy(argument)) {
                    aliases.insert(name);
                }
            }
        }

        if aliases.is_empty() {
            continue;
        }

        let flatpak_app_id = fs::read_to_string(root.join("root/.flatpak-info"))
            .ok()
            .and_then(|contents| flatpak_app_id(&contents));

        processes.push(LinuxProcess {
            pid,
            start_time,
            aliases,
            executable_path,
            flatpak_app_id,
        });
    }

    processes
}

#[cfg(target_os = "linux")]
fn matches_definition(process: &LinuxProcess, definition: Definition) -> bool {
    definition
        .processes
        .iter()
        .any(|candidate| process.aliases.contains(&candidate.to_ascii_lowercase()))
}

#[cfg(target_os = "linux")]
fn candidate_from_definition(
    definition: Definition,
    processes: &[LinuxProcess],
) -> CleanLaunchCandidate {
    let running = processes
        .iter()
        .any(|process| matches_definition(process, definition));

    CleanLaunchCandidate {
        id: definition.id.to_string(),
        name: definition.name.to_string(),
        category: definition.category.to_string(),
        impact: definition.impact.to_string(),
        running,
        selected_by_default: definition.selected_by_default && running,
        process_names: definition
            .processes
            .iter()
            .map(|value| (*value).to_string())
            .collect(),
    }
}

#[cfg(target_os = "linux")]
fn process_is_same(process: &LinuxProcess) -> bool {
    fs::read_to_string(format!("/proc/{}/stat", process.pid))
        .ok()
        .and_then(|stat| parse_start_time(&stat))
        == Some(process.start_time)
}

#[cfg(target_os = "linux")]
fn restore_command_for(
    definition: Definition,
    processes: &[LinuxProcess],
) -> Option<LinuxRestoreCommand> {
    if definition.restore_processes.is_empty() {
        return None;
    }

    if let Some(app_id) = processes
        .iter()
        .find_map(|process| process.flatpak_app_id.clone())
    {
        return Some(LinuxRestoreCommand::Flatpak(app_id));
    }

    processes.iter().find_map(|process| {
        let path = process.executable_path.as_ref()?;
        let alias = normalized_process_name(&path.to_string_lossy())?;

        definition
            .restore_processes
            .iter()
            .any(|candidate| alias == candidate.to_ascii_lowercase())
            .then(|| LinuxRestoreCommand::Native(path.clone()))
    })
}

#[cfg(target_os = "linux")]
fn terminate_process(process: &LinuxProcess) -> Result<(), String> {
    if !process_is_same(process) {
        return Err(format!(
            "PID {} changed before it could be closed; it was left untouched.",
            process.pid
        ));
    }

    let output = Command::new("kill")
        .args(["-TERM", "--", &process.pid.to_string()])
        .output()
        .map_err(|error| format!("PID {}: {error}", process.pid))?;

    if output.status.success() {
        Ok(())
    } else {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if detail.is_empty() {
            format!("PID {} could not be closed.", process.pid)
        } else {
            format!("PID {}: {detail}", process.pid)
        })
    }
}

fn build_clean_launch_status() -> CleanLaunchStatus {
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
            platform: "windows".to_string(),

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

    #[cfg(target_os = "linux")]
    {
        let processes = linux_processes();
        let candidates = definitions()
            .iter()
            .copied()
            .map(|definition| candidate_from_definition(definition, &processes))
            .filter(|candidate| candidate.running)
            .collect::<Vec<_>>();
        let restorable_count = restore_state().lock().map(|state| state.len()).unwrap_or(0);

        return CleanLaunchStatus {
            supported: true,
            platform: "linux".to_string(),
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

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        CleanLaunchStatus {
            supported: false,
            platform: std::env::consts::OS.to_string(),

            candidates: Vec::new(),

            restorable_count: 0,

            session_active: false,

            message: "Clean Launch is currently available on Windows and Linux.".to_string(),
        }
    }
}

#[cfg(all(test, target_os = "linux"))]
mod linux_tests {
    use super::{flatpak_app_id, normalized_process_name, parse_start_time};

    #[test]
    fn parses_proc_start_time_when_process_name_contains_spaces() {
        let stat = "42 (a process name) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 98765 20";

        assert_eq!(parse_start_time(stat), Some(98765));
    }

    #[test]
    fn extracts_flatpak_application_id_only_from_application_section() {
        let info = "[Instance]\nname=wrong.value\n[Application]\nname=com.obsproject.Studio\nruntime=org.freedesktop.Platform\n";

        assert_eq!(
            flatpak_app_id(info).as_deref(),
            Some("com.obsproject.Studio")
        );
    }

    #[test]
    fn normalizes_executable_paths_to_lowercase_file_names() {
        assert_eq!(
            normalized_process_name("/usr/bin/OpenRGB\n").as_deref(),
            Some("openrgb")
        );
    }
}

#[tauri::command]
pub async fn get_clean_launch_status() -> Result<CleanLaunchStatus, String> {
    tauri::async_runtime::spawn_blocking(build_clean_launch_status)
        .await
        .map_err(|error| format!("Clean Launch status worker failed: {error}"))
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

    #[cfg(target_os = "linux")]
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

        let processes = linux_processes();
        let mut selected_processes: HashMap<&str, Vec<LinuxProcess>> = HashMap::new();

        for definition in definitions().iter().copied() {
            if !selected.contains(definition.id) {
                continue;
            }

            let matching = processes
                .iter()
                .filter(|process| matches_definition(process, definition))
                .cloned()
                .collect::<Vec<_>>();

            if !matching.is_empty() {
                selected_processes.insert(definition.id, matching);
            }
        }

        let mut failures = Vec::new();
        let mut signaled = BTreeSet::new();

        for definition in definitions().iter().copied() {
            let Some(matching) = selected_processes.get(definition.id) else {
                continue;
            };

            for process in matching {
                match terminate_process(process) {
                    Ok(()) => {
                        signaled.insert(process.pid);
                    }
                    Err(error) => failures.push(format!("{}: {error}", definition.name)),
                }
            }
        }

        let deadline = Instant::now() + Duration::from_secs(2);

        while Instant::now() < deadline
            && selected_processes
                .values()
                .flatten()
                .any(|process| signaled.contains(&process.pid) && process_is_same(process))
        {
            thread::sleep(Duration::from_millis(50));
        }

        // Re-scan instead of checking only the original PIDs. Some desktop apps have a
        // supervisor that may immediately replace a terminated process with a new one.
        let current_processes = linux_processes();
        let mut stopped_apps = Vec::new();
        let mut restorable = Vec::new();

        for definition in definitions().iter().copied() {
            let Some(matching) = selected_processes.get(definition.id) else {
                continue;
            };
            let remaining = current_processes
                .iter()
                .filter(|process| matches_definition(process, definition))
                .count();

            if remaining > 0 {
                failures.push(format!(
                    "{} still has {} process{} running after a graceful close request.",
                    definition.name,
                    remaining,
                    if remaining == 1 { "" } else { "es" }
                ));
                continue;
            }

            stopped_apps.push(definition.name.to_string());

            if let Some(command) = restore_command_for(definition, matching) {
                restorable.push(RestorableProcess {
                    app_id: definition.id.to_string(),
                    app_name: definition.name.to_string(),
                    command,
                });
            }
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
                "None of the selected applications were closed.".to_string()
            } else {
                format!(
                    "Closed {} application{} for Clean Launch.",
                    stopped_apps.len(),
                    if stopped_apps.len() == 1 { "" } else { "s" }
                )
            },
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = selection;

        CleanLaunchActionResult {
            success: false,

            stopped_apps: Vec::new(),

            restored_apps: Vec::new(),

            failures: vec![
                "Clean Launch is currently available only on Windows and Linux.".to_string(),
            ],

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

    #[cfg(target_os = "linux")]
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
            if !seen_apps.insert(process.app_id.clone()) {
                continue;
            }

            let result = match &process.command {
                LinuxRestoreCommand::Native(path) => {
                    if !path.is_file() {
                        Err(format!("executable no longer exists: {}", path.display()))
                    } else {
                        Command::new(path)
                            .spawn()
                            .map(|_| ())
                            .map_err(|error| error.to_string())
                    }
                }
                LinuxRestoreCommand::Flatpak(app_id) => Command::new("flatpak")
                    .args(["run", app_id])
                    .spawn()
                    .map(|_| ())
                    .map_err(|error| error.to_string()),
            };

            match result {
                Ok(()) => restored_apps.push(process.app_name),
                Err(error) => failures.push(format!("{}: {error}", process.app_name)),
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

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
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
