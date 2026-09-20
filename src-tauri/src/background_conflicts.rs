use serde::Serialize;

#[cfg(target_os = "windows")]
use std::{collections::BTreeSet, os::windows::process::CommandExt, process::Command};

#[cfg(target_os = "linux")]
use std::{collections::BTreeSet, fs, path::Path};

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
    pub platform: String,
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

#[cfg(target_os = "linux")]
#[derive(Debug, Default)]
struct LinuxProcessSnapshot {
    processes: Vec<LinuxProcessInfo>,
    mango_hud_loaded: bool,
    vk_basalt_loaded: bool,
}

#[cfg(target_os = "linux")]
#[derive(Debug)]
struct LinuxProcessInfo {
    aliases: BTreeSet<String>,
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
fn linux_process_snapshot() -> LinuxProcessSnapshot {
    let mut snapshot = LinuxProcessSnapshot::default();

    let Ok(entries) = fs::read_dir("/proc") else {
        return snapshot;
    };

    for entry in entries.flatten() {
        let file_name = entry.file_name();

        if !file_name
            .to_string_lossy()
            .chars()
            .all(|character| character.is_ascii_digit())
        {
            continue;
        }

        let process_root = entry.path();
        let mut aliases = BTreeSet::new();

        if let Ok(comm) = fs::read_to_string(process_root.join("comm")) {
            if let Some(name) = normalized_process_name(&comm) {
                aliases.insert(name);
            }
        }

        if let Ok(executable) = fs::read_link(process_root.join("exe")) {
            if let Some(name) = normalized_process_name(&executable.to_string_lossy()) {
                aliases.insert(name);
            }
        }

        if let Ok(command_line) = fs::read(process_root.join("cmdline")) {
            for argument in command_line.split(|byte| *byte == 0).take(1) {
                if argument.is_empty() {
                    continue;
                }

                if let Some(name) = normalized_process_name(&String::from_utf8_lossy(argument)) {
                    aliases.insert(name);
                }
            }
        }

        if !snapshot.mango_hud_loaded || !snapshot.vk_basalt_loaded {
            if let Ok(maps) = fs::read_to_string(process_root.join("maps")) {
                let maps = maps.to_ascii_lowercase();

                snapshot.mango_hud_loaded |= maps.contains("libmangohud");
                snapshot.vk_basalt_loaded |= maps.contains("libvkbasalt");
            }
        }

        if aliases.is_empty() {
            continue;
        }

        snapshot.processes.push(LinuxProcessInfo { aliases });
    }

    snapshot
}

#[cfg(target_os = "linux")]
fn linux_running_process(processes: &[LinuxProcessInfo], candidates: &[&str]) -> Option<String> {
    let candidates = candidates
        .iter()
        .map(|candidate| candidate.to_ascii_lowercase())
        .collect::<Vec<_>>();

    processes.iter().find_map(|process| {
        process.aliases.iter().find_map(|alias| {
            candidates
                .iter()
                .any(|candidate| alias == candidate)
                .then(|| alias.clone())
        })
    })
}

#[cfg(target_os = "linux")]
fn linux_detect_apps(snapshot: &LinuxProcessSnapshot) -> Vec<BackgroundAppInfo> {
    struct Definition {
        name: &'static str,
        processes: &'static [&'static str],
        category: &'static str,
        impact: &'static str,
        note: &'static str,
    }

    let definitions = [
        Definition {
            name: "OBS Studio",
            processes: &["obs", "obs-studio"],
            category: "Capture / streaming",
            impact: "capture",
            note: "Active capture or streaming can add GPU, encoder, compositor, and memory-copy work.",
        },
        Definition {
            name: "GPU Screen Recorder",
            processes: &[
                "gpu-screen-recorder",
                "gpu-screen-recorder-gtk",
                "gpu-screen-recorder-ui",
                "gsr-ui",
            ],
            category: "Capture / clipping",
            impact: "capture",
            note: "GPU capture or replay recording can interact with the graphics and encoder paths.",
        },
        Definition {
            name: "Sunshine",
            processes: &["sunshine"],
            category: "Game streaming",
            impact: "capture",
            note: "Game streaming can add capture, encoding, and network work while a game is running.",
        },
        Definition {
            name: "ReplaySorcery",
            processes: &["replay-sorcery", "replaysorcery"],
            category: "Capture / clipping",
            impact: "capture",
            note: "Background replay capture continuously uses part of the graphics or encoding pipeline.",
        },
        Definition {
            name: "Kooha",
            processes: &["kooha"],
            category: "Screen capture",
            impact: "capture",
            note: "A desktop capture session may add compositor and encoder overhead.",
        },
        Definition {
            name: "SimpleScreenRecorder",
            processes: &["simplescreenrecorder"],
            category: "Screen capture",
            impact: "capture",
            note: "A desktop capture session may add graphics, copy, and encoder overhead.",
        },
        Definition {
            name: "wf-recorder",
            processes: &["wf-recorder"],
            category: "Screen capture",
            impact: "capture",
            note: "Wayland screen recording can add compositor and encoder overhead.",
        },
        Definition {
            name: "Discord",
            processes: &["discord", "discordcanary", "discordptb", "vesktop", "webcord"],
            category: "Communication / streaming",
            impact: "background",
            note: "Voice, video, screen sharing, and hardware acceleration can consume resources while gaming.",
        },
        Definition {
            name: "CoreCtrl",
            processes: &["corectrl"],
            category: "GPU monitoring / tuning",
            impact: "monitoring",
            note: "GPU monitoring and tuning profiles can affect clocks, power limits, and fan behavior.",
        },
        Definition {
            name: "LACT",
            processes: &["lact", "lact-daemon"],
            category: "GPU monitoring / tuning",
            impact: "monitoring",
            note: "GPU monitoring and tuning settings can affect clocks, power limits, and fan behavior.",
        },
        Definition {
            name: "Mission Center",
            processes: &["missioncenter", "io.missioncenter.missioncenter"],
            category: "System monitoring",
            impact: "monitoring",
            note: "Frequent system and GPU polling is worth isolating when diagnosing intermittent stutter.",
        },
        Definition {
            name: "Resources",
            processes: &["resources", "net.nokyan.resources"],
            category: "System monitoring",
            impact: "monitoring",
            note: "Frequent process and hardware polling is worth isolating when diagnosing intermittent stutter.",
        },
        Definition {
            name: "nvtop",
            processes: &["nvtop"],
            category: "GPU monitoring",
            impact: "monitoring",
            note: "GPU polling is normally harmless but can be removed as a variable during troubleshooting.",
        },
        Definition {
            name: "OpenRGB",
            processes: &["openrgb"],
            category: "RGB / device control",
            impact: "background",
            note: "RGB and device-control polling can remain active while gaming.",
        },
        Definition {
            name: "Input Remapper",
            processes: &[
                "input-remapper",
                "input-remapper-gtk",
                "input-remapper-service",
            ],
            category: "Input remapping",
            impact: "input",
            note: "Input remapping can overlap with Steam Input or a game's own controller handling.",
        },
        Definition {
            name: "AntiMicroX",
            processes: &["antimicrox"],
            category: "Input remapping",
            impact: "input",
            note: "Controller-to-keyboard mapping can overlap with Steam Input or native controller support.",
        },
        Definition {
            name: "SC Controller",
            processes: &["sc-controller", "scc-daemon", "scc-osd-daemon"],
            category: "Input remapping",
            impact: "input",
            note: "An additional controller remapping layer can cause duplicated or unexpected input.",
        },
        Definition {
            name: "Linux Wallpaper Engine",
            processes: &["linux-wallpaperengine", "linux-wallpaper-engine"],
            category: "Animated desktop background",
            impact: "background",
            note: "Animated wallpapers can consume GPU resources if they do not pause while gaming.",
        },
        Definition {
            name: "mpvpaper",
            processes: &["mpvpaper"],
            category: "Animated desktop background",
            impact: "background",
            note: "Video wallpapers can consume decode and GPU resources if they continue while gaming.",
        },
    ];

    let mut found = definitions
        .into_iter()
        .filter_map(|definition| {
            let process_name = linux_running_process(&snapshot.processes, definition.processes)?;

            Some(BackgroundAppInfo {
                name: definition.name.to_string(),
                process_name,
                category: definition.category.to_string(),
                impact: definition.impact.to_string(),
                running: true,
                note: definition.note.to_string(),
            })
        })
        .collect::<Vec<_>>();

    if snapshot.mango_hud_loaded {
        found.push(BackgroundAppInfo {
            name: "MangoHud".to_string(),
            process_name: "libMangoHud graphics layer".to_string(),
            category: "Overlay / monitoring".to_string(),
            impact: "hook-capable".to_string(),
            running: true,
            note: "The MangoHud graphics layer is loaded into a running process.".to_string(),
        });
    }

    if snapshot.vk_basalt_loaded {
        found.push(BackgroundAppInfo {
            name: "vkBasalt".to_string(),
            process_name: "libvkbasalt graphics layer".to_string(),
            category: "Post-processing layer".to_string(),
            impact: "hook-capable".to_string(),
            running: true,
            note: "The vkBasalt Vulkan post-processing layer is loaded into a running process."
                .to_string(),
        });
    }

    found.sort_by(|left, right| {
        left.category
            .cmp(&right.category)
            .then_with(|| left.name.cmp(&right.name))
    });

    found
}

#[cfg(target_os = "linux")]
fn linux_findings(apps: &[BackgroundAppInfo]) -> Vec<BackgroundConflictFinding> {
    let mut findings = build_findings(apps);

    let capture_apps = apps
        .iter()
        .filter(|app| app.impact == "capture")
        .collect::<Vec<_>>();

    if capture_apps.len() >= 2 {
        findings.insert(
            0,
            BackgroundConflictFinding {
                severity: "warning".to_string(),
                title: "Multiple capture or streaming tools are active".to_string(),
                detail: format!(
                    "Running capture tools: {}.",
                    capture_apps
                        .iter()
                        .map(|app| app.name.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
                suggestion: Some(
                    "Stop optional capture, replay, or streaming sessions one at a time when comparing performance or investigating presentation problems."
                        .to_string(),
                ),
            },
        );
    }

    let input_apps = apps
        .iter()
        .filter(|app| app.impact == "input")
        .collect::<Vec<_>>();

    if input_apps.len() >= 2 {
        findings.insert(
            0,
            BackgroundConflictFinding {
                severity: "warning".to_string(),
                title: "Multiple input remappers are active".to_string(),
                detail: format!(
                    "Running input tools: {}.",
                    input_apps
                        .iter()
                        .map(|app| app.name.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
                suggestion: Some(
                    "Use only the remapping layer required by the game and check whether Steam Input is also translating the same controller."
                        .to_string(),
                ),
            },
        );
    }

    if findings.iter().any(|finding| finding.severity == "warning") {
        findings.retain(|finding| finding.severity != "good");
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

            platform: "windows".to_string(),

            running_apps,

            findings,

            hook_capable_count,

            summary,
        };
    }

    #[cfg(target_os = "linux")]
    {
        let snapshot = linux_process_snapshot();
        let running_apps = linux_detect_apps(&snapshot);
        let hook_capable_count = running_apps
            .iter()
            .filter(|app| app.impact == "hook-capable")
            .count();
        let findings = linux_findings(&running_apps);
        let warning_count = findings
            .iter()
            .filter(|finding| finding.severity == "warning")
            .count();

        let summary = if warning_count > 0 {
            format!(
                "{} potential Linux background conflict{} detected.",
                warning_count,
                if warning_count == 1 { "" } else { "s" }
            )
        } else if running_apps.is_empty() {
            "No recognized Linux overlay or background conflict tools are running.".to_string()
        } else {
            format!(
                "{} recognized Linux background application{} running; no high-confidence conflict pattern detected.",
                running_apps.len(),
                if running_apps.len() == 1 { " is" } else { "s are" }
            )
        };

        return BackgroundConflictReport {
            supported: true,
            platform: "linux".to_string(),
            running_apps,
            findings,
            hook_capable_count,
            summary,
        };
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        BackgroundConflictReport {
            supported: false,

            platform: std::env::consts::OS.to_string(),

            running_apps: Vec::new(),

            findings: Vec::new(),

            hook_capable_count: 0,

            summary: "Overlay/background conflict detection is available on Windows and Linux."
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

#[cfg(all(test, target_os = "linux"))]
mod linux_tests {
    use super::{
        linux_detect_apps, linux_findings, linux_running_process, normalized_process_name,
        LinuxProcessInfo, LinuxProcessSnapshot,
    };
    use std::collections::BTreeSet;

    fn process(aliases: &[&str]) -> LinuxProcessInfo {
        LinuxProcessInfo {
            aliases: aliases
                .iter()
                .map(|alias| alias.to_string())
                .collect::<BTreeSet<_>>(),
        }
    }

    #[test]
    fn normalizes_executable_paths_and_case() {
        assert_eq!(
            normalized_process_name("/usr/bin/OBS\n").as_deref(),
            Some("obs")
        );
        assert_eq!(normalized_process_name("\0\n"), None);
    }

    #[test]
    fn matches_an_untruncated_process_alias() {
        let processes = vec![process(&["gpu-screen-reco", "gpu-screen-recorder"])];

        assert_eq!(
            linux_running_process(&processes, &["gpu-screen-recorder"]).as_deref(),
            Some("gpu-screen-recorder")
        );
    }

    #[test]
    fn reports_loaded_graphics_layers_as_active_tools() {
        let snapshot = LinuxProcessSnapshot {
            processes: Vec::new(),
            mango_hud_loaded: true,
            vk_basalt_loaded: true,
        };

        let apps = linux_detect_apps(&snapshot);

        assert!(apps.iter().any(|app| app.name == "MangoHud"));
        assert!(apps.iter().any(|app| app.name == "vkBasalt"));
    }

    #[test]
    fn multiple_capture_tools_produce_a_warning_without_a_good_finding() {
        let snapshot = LinuxProcessSnapshot {
            processes: vec![process(&["obs"]), process(&["sunshine"])],
            mango_hud_loaded: false,
            vk_basalt_loaded: false,
        };

        let apps = linux_detect_apps(&snapshot);
        let findings = linux_findings(&apps);

        assert!(findings.iter().any(|finding| finding.severity == "warning"));
        assert!(!findings.iter().any(|finding| finding.severity == "good"));
    }
}
