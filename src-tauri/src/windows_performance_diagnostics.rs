use serde::Serialize;

#[cfg(target_os = "windows")]
use std::{collections::BTreeSet, os::windows::process::CommandExt, path::Path, process::Command};

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
    pub contributor_count: usize,
    pub checks: Vec<PerformanceDiagnosticCheck>,
    pub summary: String,
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

#[tauri::command]
pub fn get_windows_performance_diagnostics(
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

            contributor_count,

            checks,

            summary,
        };
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = install_path;

        WindowsPerformanceDiagnosticReport {
            supported: false,

            contributor_count: 0,

            checks: Vec::new(),

            summary: "Windows performance diagnostics are available only on Windows.".to_string(),
        }
    }
}
