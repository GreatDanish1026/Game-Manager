use serde::Serialize;

#[cfg(target_os = "windows")]
use std::{collections::BTreeSet, os::windows::process::CommandExt, process::Command};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundAppInfo {
    pub name: String,
    pub process_name: String,
    pub category: String,
    pub impact: String,
    pub running: bool,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundConflictFinding {
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundConflictReport {
    pub supported: bool,
    pub running_apps: Vec<BackgroundAppInfo>,
    pub findings: Vec<BackgroundConflictFinding>,
    pub hook_capable_count: usize,
    pub summary: String,
}

#[cfg(target_os = "windows")]
fn hidden_command(program: &str) -> Command {
    let mut command = Command::new(program);

    command.creation_flags(CREATE_NO_WINDOW);

    command
}

#[cfg(target_os = "windows")]
fn process_names() -> BTreeSet<String> {
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
fn any_running(processes: &BTreeSet<String>, candidates: &[&str]) -> Option<String> {
    candidates.iter().find_map(|candidate| {
        let lower = candidate.to_ascii_lowercase();

        processes.contains(&lower).then_some(lower)
    })
}

#[cfg(target_os = "windows")]
fn detect_apps(processes: &BTreeSet<String>) -> Vec<BackgroundAppInfo> {
    struct Definition {
        name: &'static str,

        processes: &'static [&'static str],

        category: &'static str,

        impact: &'static str,

        note: &'static str,
    }

    let definitions = [
        Definition {
            name: "RivaTuner Statistics Server",

            processes: &["RTSS.exe", "RTSSHooksLoader64.exe"],

            category: "Overlay / monitoring",

            impact: "hook-capable",

            note: "Can inject an overlay and frame limiter into games.",
        },
        Definition {
            name: "MSI Afterburner",

            processes: &["MSIAfterburner.exe"],

            category: "Monitoring / tuning",

            impact: "monitoring",

            note: "Hardware monitoring and tuning tool commonly paired with RTSS.",
        },
        Definition {
            name: "Discord",

            processes: &[
                "Discord.exe",
                "DiscordPTB.exe",
                "DiscordCanary.exe",
                "DiscordDevelopment.exe",
            ],

            category: "Overlay / communication",

            impact: "hook-capable",

            note: "Discord can inject its in-game overlay when enabled.",
        },
        Definition {
            name: "NVIDIA Overlay",

            processes: &["NVIDIA Overlay.exe", "NVIDIA Share.exe"],

            category: "Overlay / capture",

            impact: "hook-capable",

            note: "NVIDIA's overlay/capture components can hook supported games.",
        },
        Definition {
            name: "Xbox Game Bar",

            processes: &["GameBar.exe", "GameBarFTServer.exe"],

            category: "Overlay / capture",

            impact: "hook-capable",

            note: "Windows gaming overlay and capture components are active.",
        },
        Definition {
            name: "OBS Studio",

            processes: &["obs64.exe", "obs32.exe"],

            category: "Capture / streaming",

            impact: "hook-capable",

            note: "Game Capture can hook the game's rendering path while OBS is running.",
        },
        Definition {
            name: "Overwolf",

            processes: &["Overwolf.exe", "OverwolfBrowser.exe"],

            category: "Overlay platform",

            impact: "hook-capable",

            note: "Hosts third-party game overlays and companion apps.",
        },
        Definition {
            name: "Medal",

            processes: &["Medal.exe"],

            category: "Capture / clipping",

            impact: "hook-capable",

            note: "Background clipping/capture software can hook games.",
        },
        Definition {
            name: "SteelSeries GG",

            processes: &["SteelSeriesGG.exe", "SteelSeriesEngine.exe"],

            category: "Device / capture",

            impact: "background",

            note: "Device software that may also run Moments capture features.",
        },
        Definition {
            name: "Corsair iCUE",

            processes: &["iCUE.exe", "iCUEDevicePluginHost.exe"],

            category: "RGB / device control",

            impact: "background",

            note: "Peripheral and RGB management software.",
        },
        Definition {
            name: "Razer Synapse",

            processes: &[
                "Razer Synapse 3.exe",
                "Razer Synapse Service.exe",
                "RazerAppEngine.exe",
            ],

            category: "RGB / device control",

            impact: "background",

            note: "Peripheral, macro, and RGB management software.",
        },
        Definition {
            name: "Logitech G HUB",

            processes: &["lghub.exe", "lghub_agent.exe"],

            category: "Device control",

            impact: "background",

            note: "Peripheral and profile management software.",
        },
        Definition {
            name: "ASUS Armoury Crate",

            processes: &[
                "ArmouryCrate.UserSessionHelper.exe",
                "ArmouryCrate.Service.exe",
            ],

            category: "System / RGB control",

            impact: "background",

            note: "System, device, and RGB control software.",
        },
        Definition {
            name: "NZXT CAM",

            processes: &["NZXT CAM.exe"],

            category: "Monitoring / RGB",

            impact: "monitoring",

            note: "Hardware monitoring and device-control software.",
        },
        Definition {
            name: "SignalRGB",

            processes: &["SignalRgb.exe"],

            category: "RGB control",

            impact: "background",

            note: "RGB/device-control software that can remain active while gaming.",
        },
        Definition {
            name: "OpenRGB",

            processes: &["OpenRGB.exe"],

            category: "RGB control",

            impact: "background",

            note: "RGB/device-control software.",
        },
        Definition {
            name: "MSI Center",

            processes: &["MSI.CentralServer.exe", "MSI_Center.exe"],

            category: "System control",

            impact: "background",

            note: "Motherboard/system-management software.",
        },
        Definition {
            name: "Gigabyte Control Center",

            processes: &["GCC.exe", "GigabyteUpdateService.exe"],

            category: "System control",

            impact: "background",

            note: "Motherboard/system-management software.",
        },
        Definition {
            name: "Wallpaper Engine",

            processes: &["wallpaper64.exe", "wallpaper32.exe"],

            category: "Desktop background",

            impact: "background",

            note: "Animated wallpapers can consume GPU resources if not paused for games.",
        },
    ];

    let mut found = Vec::new();

    for definition in definitions {
        let Some(process_name) = any_running(processes, definition.processes) else {
            continue;
        };

        found.push(BackgroundAppInfo {
            name: definition.name.to_string(),

            process_name,

            category: definition.category.to_string(),

            impact: definition.impact.to_string(),

            running: true,

            note: definition.note.to_string(),
        });
    }

    found.sort_by(|left, right| {
        left.category
            .cmp(&right.category)
            .then_with(|| left.name.cmp(&right.name))
    });

    found
}

#[cfg(target_os = "windows")]
fn build_findings(apps: &[BackgroundAppInfo]) -> Vec<BackgroundConflictFinding> {
    let mut findings = Vec::new();

    let hook_apps = apps
        .iter()
        .filter(|app| app.impact == "hook-capable")
        .collect::<Vec<_>>();

    let monitoring_apps = apps
        .iter()
        .filter(|app| app.impact == "monitoring")
        .collect::<Vec<_>>();

    let background_apps = apps
        .iter()
        .filter(|app| app.impact == "background")
        .collect::<Vec<_>>();

    if hook_apps.len() >= 3 {
        findings.push(
            BackgroundConflictFinding {
                severity:
                    "warning"
                        .to_string(),

                title:
                    "Multiple game-hooking overlays are active"
                        .to_string(),

                detail:
                    format!(
                        "{} hook-capable applications are running: {}.",
                        hook_apps.len(),
                        hook_apps
                            .iter()
                            .map(
                                |app| {
                                    app.name
                                        .as_str()
                                }
                            )
                            .collect::<Vec<_>>()
                            .join(
                                ", "
                            )
                    ),

                suggestion:
                    Some(
                        "If a game stutters, crashes, or has presentation issues, temporarily disable overlays one at a time and retest."
                            .to_string()
                    ),
            }
        );
    } else if hook_apps.len() == 2 {
        findings.push(
            BackgroundConflictFinding {
                severity:
                    "info"
                        .to_string(),

                title:
                    "Two hook-capable applications are active"
                        .to_string(),

                detail:
                    format!(
                        "{} and {} are both running.",
                        hook_apps[0]
                            .name,
                        hook_apps[1]
                            .name
                    ),

                suggestion:
                    Some(
                        "This is often fine. If troubleshooting inconsistent frametimes or crashes, compare behavior with one overlay disabled."
                            .to_string()
                    ),
            }
        );
    }

    let rtss = apps
        .iter()
        .any(|app| app.name == "RivaTuner Statistics Server");

    let obs = apps.iter().any(|app| app.name == "OBS Studio");

    if rtss && obs {
        findings.push(
            BackgroundConflictFinding {
                severity:
                    "info"
                        .to_string(),

                title:
                    "RTSS and OBS are both active"
                        .to_string(),

                detail:
                    "Both applications can interact with a game's presentation/rendering path."
                        .to_string(),

                suggestion:
                    Some(
                        "If capture or frametime behavior is unusual, test the game with RTSS disabled or with OBS Game Capture changed temporarily."
                            .to_string()
                    ),
            }
        );
    }

    if monitoring_apps.len() >= 2 {
        findings.push(
            BackgroundConflictFinding {
                severity:
                    "info"
                        .to_string(),

                title:
                    "Multiple hardware-monitoring tools are running"
                        .to_string(),

                detail:
                    format!(
                        "Active monitoring/tuning tools: {}.",
                        monitoring_apps
                            .iter()
                            .map(
                                |app| {
                                    app.name
                                        .as_str()
                                }
                            )
                            .collect::<Vec<_>>()
                            .join(
                                ", "
                            )
                    ),

                suggestion:
                    Some(
                        "Multiple polling tools are usually harmless, but they are worth simplifying while diagnosing intermittent stutter."
                            .to_string()
                    ),
            }
        );
    }

    if background_apps.len() >= 4 {
        findings.push(
            BackgroundConflictFinding {
                severity:
                    "info"
                        .to_string(),

                title:
                    "Several device/system utilities are active"
                        .to_string(),

                detail:
                    format!(
                        "{} background device, RGB, or system-control utilities were detected.",
                        background_apps.len()
                    ),

                suggestion:
                    Some(
                        "These are not automatically problematic. A future Clean Launch can temporarily suppress selected utilities during troubleshooting."
                            .to_string()
                    ),
            }
        );
    }

    if apps.is_empty() {
        findings.push(
            BackgroundConflictFinding {
                severity:
                    "good"
                        .to_string(),

                title:
                    "No common overlay or background conflict tools detected"
                        .to_string(),

                detail:
                    "GameAtlas did not find any of the currently recognized overlay, capture, monitoring, RGB, or system-control applications running."
                        .to_string(),

                suggestion:
                    None,
            }
        );
    } else if findings.is_empty() {
        findings.push(
            BackgroundConflictFinding {
                severity:
                    "good"
                        .to_string(),

                title:
                    "No obvious overlapping background-app conflict detected"
                        .to_string(),

                detail:
                    "Recognized background applications are running, but GameAtlas did not find a high-value overlap pattern."
                        .to_string(),

                suggestion:
                    None,
            }
        );
    }

    findings
}

fn build_background_conflict_report() -> BackgroundConflictReport {
    #[cfg(target_os = "windows")]
    {
        let processes = process_names();

        let running_apps = detect_apps(&processes);

        let hook_capable_count = running_apps
            .iter()
            .filter(|app| app.impact == "hook-capable")
            .count();

        let findings = build_findings(&running_apps);

        let warning_count = findings
            .iter()
            .filter(|finding| finding.severity == "warning")
            .count();

        let summary = if warning_count > 0 {
            format!(
                "{} potential overlay/background conflict{} detected.",
                warning_count,
                if warning_count == 1 { "" } else { "s" }
            )
        } else if running_apps.is_empty() {
            "No recognized overlay or background conflict tools are running.".to_string()
        } else {
            format!(
                    "{} recognized background application{} running; no high-confidence conflict pattern detected.",
                    running_apps.len(),
                    if running_apps.len() == 1 {
                        " is"
                    } else {
                        "s are"
                    }
                )
        };

        return BackgroundConflictReport {
            supported: true,

            running_apps,

            findings,

            hook_capable_count,

            summary,
        };
    }

    #[cfg(not(target_os = "windows"))]
    {
        BackgroundConflictReport {
            supported: false,

            running_apps: Vec::new(),

            findings: Vec::new(),

            hook_capable_count: 0,

            summary: "Overlay/background conflict detection is currently available on Windows."
                .to_string(),
        }
    }
}

#[tauri::command]
pub async fn get_background_conflict_report() -> Result<BackgroundConflictReport, String> {
    tauri::async_runtime::spawn_blocking(build_background_conflict_report)
        .await
        .map_err(|error| format!("Background conflict worker failed: {error}"))
}
