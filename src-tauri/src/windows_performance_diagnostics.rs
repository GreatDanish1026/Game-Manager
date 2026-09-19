use serde::Serialize;

#[cfg(target_os = "windows")]
use std::{collections::BTreeSet, os::windows::process::CommandExt, path::Path, process::Command};

#[cfg(target_os = "linux")]
use std::{collections::BTreeSet, env, fs, path::Path, process::Command};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceDiagnosticCheck {
    pub key: String,
    pub label: String,
    pub state: String,
    pub detail: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsPerformanceDiagnosticReport {
    pub supported: bool,
    pub platform: String,
    pub contributor_count: usize,
    pub checks: Vec<PerformanceDiagnosticCheck>,
    pub summary: String,
}

#[cfg(target_os = "linux")]
fn linux_command_text(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok().or_else(|| {
        Path::new("/usr/bin/distrobox-host-exec")
            .is_file()
            .then(|| {
                Command::new("/usr/bin/distrobox-host-exec")
                    .arg(program)
                    .args(args)
                    .output()
                    .ok()
            })
            .flatten()
    })?;
    output
        .status
        .success()
        .then(|| {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if stdout.is_empty() {
                String::from_utf8_lossy(&output.stderr).trim().to_string()
            } else {
                stdout
            }
        })
        .filter(|text| !text.is_empty())
}

#[cfg(target_os = "linux")]
fn linux_process_names() -> BTreeSet<String> {
    fs::read_dir("/proc")
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| entry.file_name().to_string_lossy().parse::<u32>().ok())
        .filter_map(|pid| fs::read_to_string(format!("/proc/{pid}/comm")).ok())
        .map(|name| name.trim().to_ascii_lowercase())
        .filter(|name| !name.is_empty())
        .collect()
}

#[cfg(target_os = "linux")]
fn linux_memory_check() -> PerformanceDiagnosticCheck {
    let values = fs::read_to_string("/proc/meminfo")
        .unwrap_or_default()
        .lines()
        .filter_map(|line| {
            let (key, value) = line.split_once(':')?;
            let kib = value.split_whitespace().next()?.parse::<u64>().ok()?;
            Some((key.to_string(), kib))
        })
        .collect::<std::collections::HashMap<_, _>>();
    let available = values.get("MemAvailable").copied();
    let total = values.get("MemTotal").copied();
    let (Some(available), Some(total)) = (available, total) else {
        return PerformanceDiagnosticCheck {
            key: "memory".to_string(),
            label: "Available system memory".to_string(),
            state: "info".to_string(),
            detail: "Linux memory availability could not be read.".to_string(),
            suggestion: None,
        };
    };
    let free_gib = available as f64 / 1024.0 / 1024.0;
    let total_gib = total as f64 / 1024.0 / 1024.0;
    let percent = available as f64 / total.max(1) as f64 * 100.0;
    let warning = free_gib < 4.0 || percent < 8.0;
    PerformanceDiagnosticCheck {
        key: "memory".to_string(), label: "Available system memory".to_string(),
        state: if warning { "warn" } else { "pass" }.to_string(),
        detail: format!("{free_gib:.1} GB available of {total_gib:.1} GB visible to Linux ({percent:.0}% available)."),
        suggestion: warning.then_some("Close memory-heavy background applications before troubleshooting stutter.".to_string()),
    }
}

#[cfg(target_os = "linux")]
fn linux_storage_check(install_path: Option<&str>) -> PerformanceDiagnosticCheck {
    let Some(path) = install_path.filter(|value| !value.trim().is_empty()) else {
        return PerformanceDiagnosticCheck {
            key: "storage".to_string(),
            label: "Game-filesystem free space".to_string(),
            state: "info".to_string(),
            detail: "No local install path is available for a filesystem-space check.".to_string(),
            suggestion: None,
        };
    };
    let Some(output) = linux_command_text("df", &["-Pk", path]) else {
        return PerformanceDiagnosticCheck {
            key: "storage".to_string(),
            label: "Game-filesystem free space".to_string(),
            state: "info".to_string(),
            detail: "Free space could not be read for the game filesystem.".to_string(),
            suggestion: None,
        };
    };
    let fields = output
        .lines()
        .last()
        .unwrap_or_default()
        .split_whitespace()
        .collect::<Vec<_>>();
    let available = fields.get(3).and_then(|value| value.parse::<u64>().ok());
    let total = fields.get(1).and_then(|value| value.parse::<u64>().ok());
    let percent_free = fields
        .get(4)
        .and_then(|value| value.trim_end_matches('%').parse::<f64>().ok())
        .map(|used| 100.0 - used);
    let Some(available) = available else {
        return PerformanceDiagnosticCheck {
            key: "storage".to_string(),
            label: "Game-filesystem free space".to_string(),
            state: "info".to_string(),
            detail: "Linux returned incomplete filesystem-space information.".to_string(),
            suggestion: None,
        };
    };
    let free_gib = available as f64 / 1024.0 / 1024.0;
    let total_gib = total.map(|value| value as f64 / 1024.0 / 1024.0);
    let warning = free_gib < 20.0 || percent_free.is_some_and(|value| value < 8.0);
    PerformanceDiagnosticCheck {
        key: "storage".to_string(), label: "Game-filesystem free space".to_string(), state: if warning { "warn" } else { "pass" }.to_string(),
        detail: match (total_gib, percent_free) { (Some(total), Some(percent)) => format!("{free_gib:.1} GB free of {total:.1} GB ({percent:.0}% free)."), _ => format!("{free_gib:.1} GB free on the game filesystem.") },
        suggestion: warning.then_some("Free additional space on the game filesystem. Low space can affect updates, shader caches, swap, and asset streaming.".to_string()),
    }
}

#[cfg(target_os = "linux")]
fn linux_gpu_entries() -> Vec<String> {
    let mut entries = fs::read_dir("/sys/class/drm")
        .into_iter()
        .flatten()
        .flatten()
        .filter(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            name.strip_prefix("card").is_some_and(|suffix| {
                !suffix.is_empty() && suffix.chars().all(|character| character.is_ascii_digit())
            })
        })
        .filter_map(|entry| {
            let device = entry.path().join("device");
            let vendor = fs::read_to_string(device.join("vendor"))
                .ok()?
                .trim()
                .to_ascii_lowercase();
            let model = fs::read_to_string(device.join("device")).unwrap_or_default();
            let driver = fs::read_link(device.join("driver"))
                .ok()
                .and_then(|path| {
                    path.file_name()
                        .map(|value| value.to_string_lossy().to_string())
                })
                .unwrap_or_else(|| "unknown driver".to_string());
            let vendor_name = match vendor.as_str() {
                "0x10de" => "NVIDIA",
                "0x1002" | "0x1022" => "AMD",
                "0x8086" => "Intel",
                _ => vendor.as_str(),
            };
            Some(format!("{vendor_name} {} using {driver}", model.trim()))
        })
        .collect::<Vec<_>>();
    entries.sort();
    entries.dedup();
    entries
}

#[cfg(target_os = "linux")]
fn linux_gpu_check(gpus: &[String]) -> PerformanceDiagnosticCheck {
    PerformanceDiagnosticCheck {
        key: "gpu-driver".to_string(),
        label: "Linux GPU driver".to_string(),
        state: if gpus.is_empty() { "info" } else { "pass" }.to_string(),
        detail: if gpus.is_empty() {
            "DRM did not expose a GPU and kernel-driver mapping.".to_string()
        } else {
            gpus.join(" • ")
        },
        suggestion: None,
    }
}

#[cfg(target_os = "linux")]
fn linux_multi_gpu_check(gpus: &[String]) -> PerformanceDiagnosticCheck {
    PerformanceDiagnosticCheck {
        key: "multi-gpu".to_string(), label: "GPU selection environment".to_string(), state: if gpus.len() > 1 { "info" } else { "pass" }.to_string(),
        detail: if gpus.len() > 1 { format!("Linux exposes {} DRM graphics devices. Hybrid systems may require explicit GPU selection.", gpus.len()) } else { "One DRM graphics device was detected.".to_string() },
        suggestion: (gpus.len() > 1).then_some("Confirm the game uses the intended GPU through the launcher, switcheroo-control, or the vendor's PRIME variables.".to_string()),
    }
}

#[cfg(target_os = "linux")]
fn linux_power_check() -> PerformanceDiagnosticCheck {
    let profile = linux_command_text("powerprofilesctl", &["get"]).or_else(|| {
        fs::read_to_string("/sys/firmware/acpi/platform_profile")
            .ok()
            .map(|value| value.trim().to_string())
    });
    let governors = fs::read_dir("/sys/devices/system/cpu")
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| fs::read_to_string(entry.path().join("cpufreq/scaling_governor")).ok())
        .map(|value| value.trim().to_string())
        .collect::<BTreeSet<_>>();
    let detail = match (&profile, governors.is_empty()) {
        (Some(profile), false) => format!(
            "Power profile: {profile}. CPU governor: {}.",
            governors.into_iter().collect::<Vec<_>>().join(", ")
        ),
        (Some(profile), true) => format!("Power profile: {profile}."),
        (None, false) => format!(
            "CPU governor: {}.",
            governors.into_iter().collect::<Vec<_>>().join(", ")
        ),
        (None, true) => "The active power profile and CPU governor could not be read.".to_string(),
    };
    let warning = profile
        .as_deref()
        .is_some_and(|value| value.to_ascii_lowercase().contains("power-saver"));
    PerformanceDiagnosticCheck { key: "power-profile".to_string(), label: "Linux power profile".to_string(), state: if warning { "warn" } else if profile.is_some() || !detail.starts_with("The active") { "pass" } else { "info" }.to_string(), detail, suggestion: warning.then_some("Use Balanced or Performance while evaluating game performance, especially when connected to AC power.".to_string()) }
}

#[cfg(target_os = "linux")]
fn linux_gamemode_check(processes: &BTreeSet<String>) -> PerformanceDiagnosticCheck {
    let running = processes.iter().any(|name| name.contains("gamemoded"));
    let available = running
        || env::var_os("PATH").is_some_and(|path| {
            env::split_paths(&path).any(|directory| directory.join("gamemoded").is_file())
        })
        || Path::new("/usr/bin/gamemoded").is_file();
    PerformanceDiagnosticCheck {
        key: "game-mode".to_string(),
        label: "Feral GameMode".to_string(),
        state: if running { "pass" } else { "info" }.to_string(),
        detail: if running {
            "The GameMode service is running.".to_string()
        } else if available {
            "GameMode is available but is not currently active.".to_string()
        } else {
            "GameMode availability could not be confirmed.".to_string()
        },
        suggestion: None,
    }
}

#[cfg(target_os = "linux")]
fn linux_session_check() -> PerformanceDiagnosticCheck {
    let session = env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "unknown".to_string());
    let desktop = env::var("XDG_CURRENT_DESKTOP").unwrap_or_else(|_| "unknown desktop".to_string());
    PerformanceDiagnosticCheck { key: "session".to_string(), label: "Display session".to_string(), state: "info".to_string(), detail: format!("Session: {session}; desktop/compositor: {desktop}."), suggestion: Some("Treat Wayland, X11, Gamescope, and compositor settings as troubleshooting variables when frame pacing differs between sessions.".to_string()) }
}

#[cfg(target_os = "linux")]
fn linux_overlay_check(processes: &BTreeSet<String>) -> PerformanceDiagnosticCheck {
    let known = [
        ("obs", "OBS Studio"),
        ("discord", "Discord"),
        ("mangohud", "MangoHud"),
        ("gamescope", "Gamescope"),
        ("gpu-screen-recorder", "GPU Screen Recorder"),
        ("vkbasalt", "vkBasalt"),
    ];
    let tools = known
        .into_iter()
        .filter_map(|(needle, label)| {
            processes
                .iter()
                .any(|name| name.contains(needle))
                .then_some(label)
        })
        .collect::<Vec<_>>();
    PerformanceDiagnosticCheck { key: "overlays".to_string(), label: "Overlay / capture tools".to_string(), state: if tools.is_empty() { "pass" } else { "warn" }.to_string(), detail: if tools.is_empty() { "No common Linux overlay or capture processes were detected.".to_string() } else { format!("Running: {}.", tools.join(", ")) }, suggestion: (!tools.is_empty()).then_some("These tools are not automatically a problem. If frametimes are inconsistent, disable optional overlays or capture hooks one at a time and retest.".to_string()) }
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
fn process_names() -> BTreeSet<String> {
    let Some(output) = command_text("tasklist.exe", &["/FO", "CSV", "/NH"]) else {
        return BTreeSet::new();
    };

    output
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
fn running_overlay_tools(processes: &BTreeSet<String>) -> Vec<&'static str> {
    let known = [
        ("rtss.exe", "RivaTuner Statistics Server"),
        ("msiafterburner.exe", "MSI Afterburner"),
        ("discord.exe", "Discord"),
        ("obs64.exe", "OBS Studio"),
        ("gamebar.exe", "Xbox Game Bar"),
        ("gamebarftserver.exe", "Xbox Game Bar"),
        ("overwolf.exe", "Overwolf"),
        ("medal.exe", "Medal"),
        ("steelseriesgg.exe", "SteelSeries GG"),
    ];

    let mut results = Vec::new();

    for (process, label) in known {
        if processes.contains(process) && !results.contains(&label) {
            results.push(label);
        }
    }

    results
}

#[cfg(target_os = "windows")]
fn memory_check() -> PerformanceDiagnosticCheck {
    let script =
        "$o=Get-CimInstance Win32_OperatingSystem; Write-Output \"$($o.FreePhysicalMemory)|$($o.TotalVisibleMemorySize)\"";

    let Some(output) = powershell_text(script) else {
        return PerformanceDiagnosticCheck {
            key: "memory".to_string(),

            label: "Available system memory".to_string(),

            state: "info".to_string(),

            detail: "Windows memory availability could not be read.".to_string(),

            suggestion: None,
        };
    };

    let mut parts = output.splitn(2, '|');

    let free_kib = parts
        .next()
        .and_then(|value| value.trim().parse::<u64>().ok());

    let total_kib = parts
        .next()
        .and_then(|value| value.trim().parse::<u64>().ok());

    let Some(free_kib) = free_kib else {
        return PerformanceDiagnosticCheck {
            key: "memory".to_string(),

            label: "Available system memory".to_string(),

            state: "info".to_string(),

            detail: "Windows returned incomplete memory information.".to_string(),

            suggestion: None,
        };
    };

    let free_gib = free_kib as f64 / 1024.0 / 1024.0;

    let total_gib = total_kib.map(|value| value as f64 / 1024.0 / 1024.0);

    let percent_free = total_kib
        .filter(|value| *value > 0)
        .map(|total| (free_kib as f64 / total as f64) * 100.0);

    let warning = free_gib < 4.0 || percent_free.map(|value| value < 8.0).unwrap_or(false);

    PerformanceDiagnosticCheck {
        key: "memory".to_string(),

        label: "Available system memory".to_string(),

        state: if warning { "warn" } else { "pass" }.to_string(),

        detail: match total_gib {
            Some(total) => {
                format!(
                    "{:.1} GB free of {:.1} GB visible to Windows.",
                    free_gib, total
                )
            }

            None => {
                format!("{:.1} GB of system memory is currently free.", free_gib)
            }
        },

        suggestion: warning.then_some(
            "Close memory-heavy background applications before troubleshooting stutter."
                .to_string(),
        ),
    }
}

#[cfg(target_os = "windows")]
fn install_drive_check(install_path: Option<&str>) -> PerformanceDiagnosticCheck {
    let Some(install_path) = install_path.filter(|value| !value.trim().is_empty()) else {
        return PerformanceDiagnosticCheck {
            key: "storage".to_string(),

            label: "Game-drive free space".to_string(),

            state: "info".to_string(),

            detail: "No local install path is available for a drive-space check.".to_string(),

            suggestion: None,
        };
    };

    let path = Path::new(install_path);

    let Some(prefix) = path.components().next() else {
        return PerformanceDiagnosticCheck {
            key: "storage".to_string(),

            label: "Game-drive free space".to_string(),

            state: "info".to_string(),

            detail: "The game drive could not be determined.".to_string(),

            suggestion: None,
        };
    };

    let drive = prefix
        .as_os_str()
        .to_string_lossy()
        .trim_end_matches('\\')
        .to_string();

    let script =
        format!(
            "$d=Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='{}'\"; if($d){{Write-Output \"$($d.FreeSpace)|$($d.Size)\"}}",
            drive.replace(
                '\'',
                "''"
            )
        );

    let Some(output) = powershell_text(&script) else {
        return PerformanceDiagnosticCheck {
            key: "storage".to_string(),

            label: "Game-drive free space".to_string(),

            state: "info".to_string(),

            detail: format!("Free space could not be read for {}.", drive),

            suggestion: None,
        };
    };

    let mut parts = output.splitn(2, '|');

    let free = parts
        .next()
        .and_then(|value| value.trim().parse::<u64>().ok());

    let total = parts
        .next()
        .and_then(|value| value.trim().parse::<u64>().ok());

    let Some(free) = free else {
        return PerformanceDiagnosticCheck {
            key: "storage".to_string(),

            label: "Game-drive free space".to_string(),

            state: "info".to_string(),

            detail: "Windows returned incomplete drive-space information.".to_string(),

            suggestion: None,
        };
    };

    let free_gib = free as f64 / 1024.0 / 1024.0 / 1024.0;

    let percent_free = total
        .filter(|value| *value > 0)
        .map(|value| (free as f64 / value as f64) * 100.0);

    let warning = free_gib < 20.0 || percent_free.map(|value| value < 8.0).unwrap_or(false);

    PerformanceDiagnosticCheck {
        key:
            "storage"
                .to_string(),

        label:
            "Game-drive free space"
                .to_string(),

        state:
            if warning {
                "warn"
            } else {
                "pass"
            }
            .to_string(),

        detail:
            match percent_free {
                Some(
                    percent
                ) => {
                    format!(
                        "{:.1} GB free on {} ({:.0}% free).",
                        free_gib,
                        drive,
                        percent
                    )
                }

                None => {
                    format!(
                        "{:.1} GB free on {}.",
                        free_gib,
                        drive
                    )
                }
            },

        suggestion:
            warning
                .then_some(
                    "Free additional space on the game drive. Very low free space can worsen updates, shader-cache writes, paging, and asset streaming."
                        .to_string()
                ),
    }
}

#[cfg(target_os = "windows")]
fn power_plan_check() -> PerformanceDiagnosticCheck {
    let text = command_text("powercfg.exe", &["/getactivescheme"]);

    let Some(text) = text else {
        return PerformanceDiagnosticCheck {
            key: "power-plan".to_string(),

            label: "Windows power plan".to_string(),

            state: "info".to_string(),

            detail: "The active Windows power plan could not be read.".to_string(),

            suggestion: None,
        };
    };

    let lower = text.to_ascii_lowercase();

    let power_saver = lower.contains("power saver") || lower.contains("battery saver");

    PerformanceDiagnosticCheck {
        key: "power-plan".to_string(),

        label: "Windows power plan".to_string(),

        state: if power_saver { "warn" } else { "pass" }.to_string(),

        detail: text,

        suggestion: power_saver.then_some(
            "Use Balanced, AMD Ryzen Balanced, or a performance-oriented plan while gaming."
                .to_string(),
        ),
    }
}

#[cfg(target_os = "windows")]
fn hags_check() -> PerformanceDiagnosticCheck {
    let output = command_text(
        "reg.exe",
        &[
            "query",
            r"HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers",
            "/v",
            "HwSchMode",
        ],
    );

    let detail =
        match output
            .as_deref()
    {
        Some(
            value
        ) if value
            .contains(
                "0x2"
            ) => {
                "Hardware-accelerated GPU scheduling is enabled."
                    .to_string()
            }

        Some(
            value
        ) if value
            .contains(
                "0x1"
            ) => {
                "Hardware-accelerated GPU scheduling is disabled."
                    .to_string()
            }

        Some(
            _
        ) => {
                "Hardware-accelerated GPU scheduling uses the Windows default state."
                    .to_string()
            }

        None => {
                "Hardware-accelerated GPU scheduling is not explicitly configured; Windows defaults apply."
                    .to_string()
            }
    };

    PerformanceDiagnosticCheck {
        key:
            "hags"
                .to_string(),

        label:
            "Hardware-accelerated GPU scheduling"
                .to_string(),

        state:
            "info"
                .to_string(),

        detail,

        suggestion:
            Some(
                "Treat HAGS as a troubleshooting variable rather than universally better or worse; some game/driver combinations behave differently with it toggled."
                    .to_string()
            ),
    }
}

#[cfg(target_os = "windows")]
fn game_mode_check() -> PerformanceDiagnosticCheck {
    let output =
        command_text("reg.exe", &["query", r"HKCU\Software\Microsoft\GameBar"]).unwrap_or_default();

    let lower = output.to_ascii_lowercase();

    let explicitly_disabled = lower.contains("autogamemodeenabled") && lower.contains("0x0");

    PerformanceDiagnosticCheck {
        key:
            "game-mode"
                .to_string(),

        label:
            "Windows Game Mode"
                .to_string(),

        state:
            if explicitly_disabled {
                "info"
            } else {
                "pass"
            }
            .to_string(),

        detail:
            if explicitly_disabled {
                "Windows Game Mode appears to be explicitly disabled."
                    .to_string()
            } else {
                "Windows Game Mode is enabled or using its default configuration."
                    .to_string()
            },

        suggestion:
            explicitly_disabled
                .then_some(
                    "If troubleshooting scheduling or background-process interference, consider testing with Windows Game Mode enabled."
                        .to_string()
                ),
    }
}

#[cfg(target_os = "windows")]
fn overlay_check(processes: &BTreeSet<String>) -> PerformanceDiagnosticCheck {
    let tools = running_overlay_tools(processes);

    if tools.is_empty() {
        return PerformanceDiagnosticCheck {
            key: "overlays".to_string(),

            label: "Overlay / capture tools".to_string(),

            state: "pass".to_string(),

            detail: "No common third-party overlay or capture processes were detected.".to_string(),

            suggestion: None,
        };
    }

    PerformanceDiagnosticCheck {
        key:
            "overlays"
                .to_string(),

        label:
            "Overlay / capture tools"
                .to_string(),

        state:
            "warn"
                .to_string(),

        detail:
            format!(
                "Running: {}.",
                tools.join(
                    ", "
                )
            ),

        suggestion:
            Some(
                "These tools are not automatically a problem. If frametimes are inconsistent, temporarily disable overlays/capture hooks one at a time and retest."
                    .to_string()
            ),
    }
}

#[cfg(target_os = "windows")]
fn gpu_driver_check() -> PerformanceDiagnosticCheck {
    let script =
        "Get-CimInstance Win32_VideoController | ForEach-Object { \"$($_.Name)|$($_.DriverVersion)\" }";

    let Some(output) = powershell_text(script) else {
        return PerformanceDiagnosticCheck {
            key: "gpu-driver".to_string(),

            label: "GPU driver".to_string(),

            state: "info".to_string(),

            detail: "GPU driver information could not be read.".to_string(),

            suggestion: None,
        };
    };

    let lines = output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect::<Vec<_>>();

    PerformanceDiagnosticCheck {
        key: "gpu-driver".to_string(),

        label: "GPU driver".to_string(),

        state: "pass".to_string(),

        detail: lines.join(" • "),

        suggestion: None,
    }
}

#[cfg(target_os = "windows")]
fn multi_gpu_check() -> PerformanceDiagnosticCheck {
    let script = "(Get-CimInstance Win32_VideoController | Where-Object {$_.Name}).Name";

    let Some(output) = powershell_text(script) else {
        return PerformanceDiagnosticCheck {
            key: "multi-gpu".to_string(),

            label: "GPU selection environment".to_string(),

            state: "info".to_string(),

            detail: "Installed display adapters could not be enumerated.".to_string(),

            suggestion: None,
        };
    };

    let names = output
        .lines()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();

    if names.len() <= 1 {
        return PerformanceDiagnosticCheck {
            key: "multi-gpu".to_string(),

            label: "GPU selection environment".to_string(),

            state: "pass".to_string(),

            detail: names
                .first()
                .map(|name| format!("One display adapter was detected: {}.", name))
                .unwrap_or_else(|| "No additional display adapter was detected.".to_string()),

            suggestion: None,
        };
    }

    PerformanceDiagnosticCheck {
        key:
            "multi-gpu"
                .to_string(),

        label:
            "GPU selection environment"
                .to_string(),

        state:
            "info"
                .to_string(),

        detail:
            format!(
                "Multiple display adapters are installed: {}.",
                names.join(
                    ", "
                )
            ),

        suggestion:
            Some(
                "On a multi-GPU system, verify that Windows Graphics settings and the game are assigned to the intended high-performance GPU if performance is unexpectedly low."
                    .to_string()
            ),
    }
}

fn build_windows_performance_diagnostics(
    install_path: Option<String>,
) -> WindowsPerformanceDiagnosticReport {
    #[cfg(target_os = "windows")]
    {
        let processes = process_names();

        let checks = vec![
            memory_check(),
            install_drive_check(install_path.as_deref()),
            gpu_driver_check(),
            multi_gpu_check(),
            power_plan_check(),
            game_mode_check(),
            hags_check(),
            overlay_check(&processes),
        ];

        let contributor_count = checks.iter().filter(|check| check.state == "warn").count();

        let summary = if contributor_count == 0 {
            "No obvious Windows performance contributors were detected.".to_string()
        } else {
            format!(
                "{} possible performance contributor{} detected.",
                contributor_count,
                if contributor_count == 1 { "" } else { "s" }
            )
        };

        return WindowsPerformanceDiagnosticReport {
            supported: true,

            platform: "windows".to_string(),

            contributor_count,

            checks,

            summary,
        };
    }

    #[cfg(target_os = "linux")]
    {
        let processes = linux_process_names();
        let gpus = linux_gpu_entries();

        let checks = vec![
            linux_memory_check(),
            linux_storage_check(install_path.as_deref()),
            linux_gpu_check(&gpus),
            linux_multi_gpu_check(&gpus),
            linux_power_check(),
            linux_gamemode_check(&processes),
            linux_session_check(),
            linux_overlay_check(&processes),
        ];

        let contributor_count = checks.iter().filter(|check| check.state == "warn").count();

        let summary = if contributor_count == 0 {
            "No obvious Linux performance contributors were detected.".to_string()
        } else {
            format!(
                "{} possible performance contributor{} detected.",
                contributor_count,
                if contributor_count == 1 { "" } else { "s" }
            )
        };

        return WindowsPerformanceDiagnosticReport {
            supported: true,
            platform: "linux".to_string(),
            contributor_count,
            checks,
            summary,
        };
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = install_path;

        WindowsPerformanceDiagnosticReport {
            supported: false,

            platform: std::env::consts::OS.to_string(),

            contributor_count: 0,

            checks: Vec::new(),

            summary: "System performance diagnostics are available on Windows and Linux."
                .to_string(),
        }
    }
}

#[tauri::command]
pub async fn get_windows_performance_diagnostics(
    install_path: Option<String>,
) -> Result<WindowsPerformanceDiagnosticReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        build_windows_performance_diagnostics(install_path)
    })
    .await
    .map_err(|error| format!("System performance diagnostics worker failed: {error}"))
}
