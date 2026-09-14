use serde::Serialize;

#[cfg(target_os = "windows")]
use std::{os::windows::process::CommandExt, process::Command};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerSoftwareInfo {
    pub name: String,
    pub detected: bool,
    pub running: bool,
    pub evidence: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerDeviceInfo {
    pub name: String,
    pub status: Option<String>,
    pub instance_id: Option<String>,
    pub virtual_device: bool,
    pub playstation_family: bool,
    pub xbox_family: bool,
    pub connected: bool,
    pub connection: Option<String>,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerConflictFinding {
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerConflictReport {
    pub supported: bool,
    pub software: Vec<ControllerSoftwareInfo>,
    pub devices: Vec<ControllerDeviceInfo>,
    pub findings: Vec<ControllerConflictFinding>,
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

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if stdout.is_empty() {
        None
    } else {
        Some(stdout)
    }
}

#[cfg(target_os = "windows")]
fn running_process_names() -> Vec<String> {
    let Some(output) = command_text("tasklist.exe", &["/FO", "CSV", "/NH"]) else {
        return Vec::new();
    };

    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();

            if line.is_empty() {
                return None;
            }

            let first = line
                .trim_start_matches('"')
                .split("\",\"")
                .next()?
                .trim_matches('"')
                .trim()
                .to_ascii_lowercase();

            (!first.is_empty()).then_some(first)
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn process_running(process_names: &[String], targets: &[&str]) -> bool {
    process_names.iter().any(|process| {
        targets
            .iter()
            .any(|target| process.eq_ignore_ascii_case(target))
    })
}

#[cfg(target_os = "windows")]
fn service_exists(service_names: &[&str]) -> Option<String> {
    for service in service_names {
        let output = hidden_command("sc.exe").args(["query", service]).output();

        let Ok(output) = output else {
            continue;
        };

        if output.status.success() {
            return Some((*service).to_string());
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn registry_key_exists(paths: &[&str]) -> Option<String> {
    for path in paths {
        let output = hidden_command("reg.exe").args(["query", path]).output();

        let Ok(output) = output else {
            continue;
        };

        if output.status.success() {
            return Some((*path).to_string());
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn detect_software(processes: &[String]) -> Vec<ControllerSoftwareInfo> {
    let ds4_running = process_running(processes, &["ds4windows.exe"]);

    let ds4_registry =
        registry_key_exists(&[r"HKCU\Software\DS4Windows", r"HKLM\SOFTWARE\DS4Windows"]);

    let rewasd_running = process_running(
        processes,
        &["rewasd.exe", "rewasdservice.exe", "rewasdengine.exe"],
    );

    let rewasd_service = service_exists(&["reWASDService", "reWASDEngine"]);

    let hidhide_service = service_exists(&["HidHide", "HidHideService"]);

    let vigem_service = service_exists(&["ViGEmBus"]);

    let steam_running = process_running(processes, &["steam.exe", "steamwebhelper.exe"]);

    vec![
        ControllerSoftwareInfo {
            name: "DS4Windows".to_string(),

            detected: ds4_running || ds4_registry.is_some(),

            running: ds4_running,

            evidence: if ds4_running {
                Some("DS4Windows.exe is running.".to_string())
            } else {
                ds4_registry.map(|value| format!("Registry evidence: {}", value))
            },
        },
        ControllerSoftwareInfo {
            name: "reWASD".to_string(),

            detected: rewasd_running || rewasd_service.is_some(),

            running: rewasd_running,

            evidence: if rewasd_running {
                Some("A reWASD process is running.".to_string())
            } else {
                rewasd_service.map(|value| format!("Service detected: {}", value))
            },
        },
        ControllerSoftwareInfo {
            name: "HidHide".to_string(),

            detected: hidhide_service.is_some(),

            running: hidhide_service.is_some(),

            evidence: hidhide_service.map(|value| format!("Driver/service detected: {}", value)),
        },
        ControllerSoftwareInfo {
            name: "ViGEmBus".to_string(),

            detected: vigem_service.is_some(),

            running: vigem_service.is_some(),

            evidence: vigem_service.map(|value| format!("Virtual gamepad bus detected: {}", value)),
        },
        ControllerSoftwareInfo {
            name: "Steam".to_string(),

            detected: steam_running,

            running: steam_running,

            evidence: steam_running.then_some(
                "Steam is running. Steam Input state is not inferred automatically.".to_string(),
            ),
        },
    ]
}

#[cfg(target_os = "windows")]
fn powershell_controller_devices() -> Vec<ControllerDeviceInfo> {
    let script = r#"
$ErrorActionPreference = 'SilentlyContinue'

Get-PnpDevice -PresentOnly |
    Where-Object {
        $name = [string]$_.FriendlyName

        $name -match '(?i)(gamepad|dualsense|dualshock|wireless[ ]controller|xbox|xinput|vigem|nefarius|virtual[ ]gamepad|steam[ ]controller|nintendo|switch[ ]pro|joy-con|gamesir|8bitdo)'
    } |
    ForEach-Object {
        [PSCustomObject]@{
            FriendlyName = $_.FriendlyName
            Status = $_.Status
            InstanceId = $_.InstanceId
        }
    } |
    ConvertTo-Json -Compress
"#;

    let Some(output) = command_text(
        "powershell.exe",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ],
    ) else {
        return Vec::new();
    };

    let parsed: serde_json::Value = match serde_json::from_str(&output) {
        Ok(value) => value,

        Err(_) => {
            return Vec::new();
        }
    };

    let items = match parsed {
        serde_json::Value::Array(values) => values,

        serde_json::Value::Object(_) => vec![parsed],

        _ => Vec::new(),
    };

    let mut devices = items
        .into_iter()
        .filter_map(|item| {
            let name = item.get("FriendlyName")?.as_str()?.trim().to_string();

            if name.is_empty() {
                return None;
            }

            let lower = name.to_ascii_lowercase();

            let instance_id = item
                .get("InstanceId")
                .and_then(|value| value.as_str())
                .map(str::to_string);

            let instance_lower = instance_id.as_deref().unwrap_or("").to_ascii_lowercase();

            let virtual_device = lower.contains("virtual")
                || lower.contains("vigem")
                || lower.contains("nefarius")
                || instance_lower.contains("vigem")
                || (instance_lower.contains("root\\")
                    && (lower.contains("xbox") || lower.contains("gamepad")));

            let playstation_family = lower.contains("dualsense")
                || lower.contains("dualshock")
                || lower.contains("wireless controller");

            let xbox_family = lower.contains("xbox") || lower.contains("xinput");

            let status = item
                .get("Status")
                .and_then(|value| value.as_str())
                .map(str::to_string);

            let connected = status
                .as_deref()
                .map(|value| value.eq_ignore_ascii_case("OK"))
                .unwrap_or(true);

            let connection = if virtual_device {
                Some("Virtual".to_string())
            } else if instance_lower.contains("bth") || instance_lower.contains("bluetooth") {
                Some("Bluetooth".to_string())
            } else if instance_lower.contains("usb") || instance_lower.contains("hid") {
                Some("USB / HID".to_string())
            } else {
                Some("Physical / system".to_string())
            };

            let display_name = if lower.contains("dualsense") {
                "DualSense Controller".to_string()
            } else if lower.contains("dualshock") {
                "DualShock Controller".to_string()
            } else if lower.contains("wireless controller") && playstation_family {
                "PlayStation Wireless Controller".to_string()
            } else if lower.contains("xbox") {
                if virtual_device {
                    "Virtual Xbox Controller".to_string()
                } else {
                    "Xbox Controller".to_string()
                }
            } else if lower.contains("gamesir") {
                name.clone()
            } else if lower.contains("8bitdo") {
                name.clone()
            } else if lower.contains("switch pro") {
                "Nintendo Switch Pro Controller".to_string()
            } else if lower.contains("joy-con") {
                name.clone()
            } else if lower.contains("steam controller") {
                "Steam Controller".to_string()
            } else {
                name.clone()
            };

            Some(ControllerDeviceInfo {
                name,

                status,

                instance_id,

                virtual_device,

                playstation_family,

                xbox_family,

                connected,

                connection,

                display_name,
            })
        })
        .collect::<Vec<_>>();

    devices.sort_by(|left, right| left.name.cmp(&right.name));

    devices.dedup_by(|left, right| {
        left.name.eq_ignore_ascii_case(&right.name) && left.instance_id == right.instance_id
    });

    devices
}

#[cfg(target_os = "windows")]
fn build_findings(
    software: &[ControllerSoftwareInfo],
    devices: &[ControllerDeviceInfo],
) -> Vec<ControllerConflictFinding> {
    let mut findings = Vec::new();

    let running = |name: &str| {
        software
            .iter()
            .find(|item| item.name.eq_ignore_ascii_case(name))
            .map(|item| item.running)
            .unwrap_or(false)
    };

    let detected = |name: &str| {
        software
            .iter()
            .find(|item| item.name.eq_ignore_ascii_case(name))
            .map(|item| item.detected)
            .unwrap_or(false)
    };

    let remappers_running = ["DS4Windows", "reWASD"]
        .into_iter()
        .filter(|name| running(name))
        .collect::<Vec<_>>();

    if remappers_running.len() > 1 {
        findings.push(
            ControllerConflictFinding {
                severity:
                    "warning"
                        .to_string(),

                title:
                    "Multiple controller remappers are running"
                        .to_string(),

                detail:
                    format!(
                        "{} are active at the same time. Overlapping remappers can expose duplicate virtual controllers or apply competing mappings.",
                        remappers_running
                            .join(" and ")
                    ),

                suggestion:
                    Some(
                        "For troubleshooting, run only one controller remapping layer at a time."
                            .to_string(),
                    ),
            },
        );
    }

    let playstation_visible = devices
        .iter()
        .any(|device| device.playstation_family && !device.virtual_device);

    let virtual_xbox_visible = devices
        .iter()
        .any(|device| device.virtual_device && device.xbox_family);

    let remapper_active = running("DS4Windows") || running("reWASD");

    if playstation_visible && virtual_xbox_visible && remapper_active {
        findings.push(
            ControllerConflictFinding {
                severity:
                    "warning"
                        .to_string(),

                title:
                    "Possible double-input configuration"
                        .to_string(),

                detail:
                    "A physical PlayStation-family controller and a virtual Xbox-family controller are both visible while a remapping tool is running."
                        .to_string(),

                suggestion:
                    Some(
                        "If a game receives duplicate inputs, use HidHide or disable one input/remapping layer so the game sees only the intended controller."
                            .to_string(),
                    ),
            },
        );
    }

    if remapper_active && running("Steam") {
        findings.push(
            ControllerConflictFinding {
                severity:
                    "info"
                        .to_string(),

                title:
                    "Steam and a controller remapper are both active"
                        .to_string(),

                detail:
                    "Steam is running alongside DS4Windows or reWASD. This is not automatically a problem, but Steam Input can overlap with external remapping software when enabled for a game."
                        .to_string(),

                suggestion:
                    Some(
                        "If controls are duplicated or remapped unexpectedly, compare the game's Steam Input setting with the active external remapper."
                            .to_string(),
                    ),
            },
        );
    }

    if remapper_active && detected("HidHide") {
        findings.push(
            ControllerConflictFinding {
                severity:
                    "good"
                        .to_string(),

                title:
                    "HidHide is available"
                        .to_string(),

                detail:
                    "A controller remapper is active and HidHide is installed, which can help prevent the physical controller from being exposed alongside its virtual replacement."
                        .to_string(),

                suggestion:
                    None,
            },
        );
    }

    if detected("ViGEmBus") && !remapper_active && virtual_xbox_visible {
        findings.push(
            ControllerConflictFinding {
                severity:
                    "info"
                        .to_string(),

                title:
                    "Virtual controller device detected"
                        .to_string(),

                detail:
                    "A virtual Xbox-family controller is visible through ViGEmBus, but GameAtlas did not detect DS4Windows or reWASD running."
                        .to_string(),

                suggestion:
                    Some(
                        "This may be expected. If controller behavior is unusual, check for another application that is creating the virtual device."
                            .to_string(),
                    ),
            },
        );
    }

    if findings.is_empty() {
        findings.push(
            ControllerConflictFinding {
                severity:
                    "good"
                        .to_string(),

                title:
                    "No obvious controller conflicts detected"
                        .to_string(),

                detail:
                    "GameAtlas did not find a common overlapping-remapper or likely double-input pattern in the current Windows controller environment."
                        .to_string(),

                suggestion:
                    None,
            },
        );
    }

    findings
}

#[tauri::command]
pub fn get_controller_conflict_report() -> ControllerConflictReport {
    #[cfg(target_os = "windows")]
    {
        let processes = running_process_names();

        let software = detect_software(&processes);

        let devices = powershell_controller_devices();

        let findings = build_findings(&software, &devices);

        let warning_count = findings
            .iter()
            .filter(|finding| finding.severity == "warning")
            .count();

        let summary = if warning_count > 0 {
            format!(
                "{} potential controller conflict{} detected.",
                warning_count,
                if warning_count == 1 { "" } else { "s" }
            )
        } else {
            "No obvious controller conflicts detected.".to_string()
        };

        return ControllerConflictReport {
            supported: true,

            software,
            devices,
            findings,
            summary,
        };
    }

    #[cfg(not(target_os = "windows"))]
    {
        ControllerConflictReport {
            supported: false,

            software: Vec::new(),

            devices: Vec::new(),

            findings: Vec::new(),

            summary: "Controller conflict detection is currently available on Windows.".to_string(),
        }
    }
}
