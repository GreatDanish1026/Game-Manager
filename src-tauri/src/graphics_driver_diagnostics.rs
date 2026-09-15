use serde::Serialize;

#[cfg(target_os = "windows")]
use std::{collections::BTreeSet, os::windows::process::CommandExt, process::Command};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsDriverAdapter {
    pub name: String,
    pub vendor: String,
    pub driver_version: Option<String>,
    pub driver_date: Option<String>,
    pub driver_age_days: Option<u64>,
    pub pnp_device_id: Option<String>,
    pub status: Option<String>,
    pub nvidia_smi_version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsDriverFinding {
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsDriverReport {
    pub supported: bool,
    pub adapters: Vec<GraphicsDriverAdapter>,
    pub findings: Vec<GraphicsDriverFinding>,
    pub display_driver_packages: Vec<String>,
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
fn vendor_from_name(name: &str) -> String {
    let lower = name.to_ascii_lowercase();

    if lower.contains("nvidia") || lower.contains("geforce") {
        "NVIDIA".to_string()
    } else if lower.contains("amd") || lower.contains("radeon") {
        "AMD".to_string()
    } else if lower.contains("intel") || lower.contains("arc") {
        "Intel".to_string()
    } else {
        "Unknown".to_string()
    }
}

#[cfg(target_os = "windows")]
fn nvidia_versions() -> Vec<(String, String)> {
    let Some(output) = command_text(
        "nvidia-smi.exe",
        &["--query-gpu=name,driver_version", "--format=csv,noheader"],
    ) else {
        return Vec::new();
    };

    output
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(2, ',');

            let name = parts.next()?.trim().to_string();

            let version = parts.next()?.trim().to_string();

            if name.is_empty() || version.is_empty() {
                None
            } else {
                Some((name, version))
            }
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn adapters() -> Vec<GraphicsDriverAdapter> {
    let script = r#"
$ErrorActionPreference = 'SilentlyContinue'

Get-CimInstance Win32_VideoController |
    Where-Object {
        $_.Name
    } |
    ForEach-Object {
        $driverDate = $null
        $driverAgeDays = $null

        if ($_.DriverDate) {
            try {
                $dateValue = [datetime]$_.DriverDate
                $driverDate = $dateValue.ToString('yyyy-MM-dd')
                $driverAgeDays = [Math]::Max(
                    0,
                    [Math]::Floor(
                        ((Get-Date) - $dateValue).TotalDays
                    )
                )
            } catch {
                $driverDate = $null
                $driverAgeDays = $null
            }
        }

        [PSCustomObject]@{
            Name = $_.Name
            DriverVersion = $_.DriverVersion
            DriverDate = $driverDate
            DriverAgeDays = $driverAgeDays
            PNPDeviceID = $_.PNPDeviceID
            Status = $_.Status
        }
    } |
    ConvertTo-Json -Compress
"#;

    let Some(output) = powershell_text(script) else {
        return Vec::new();
    };

    let parsed: serde_json::Value = match serde_json::from_str(&output) {
        Ok(value) => value,

        Err(_) => return Vec::new(),
    };

    let values = match parsed {
        serde_json::Value::Array(values) => values,

        serde_json::Value::Object(_) => vec![parsed],

        _ => Vec::new(),
    };

    let nvidia = nvidia_versions();

    let mut result = Vec::new();

    for item in values {
        let Some(name) = item
            .get("Name")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            continue;
        };

        let vendor = vendor_from_name(name);

        let driver_version = item
            .get("DriverVersion")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);

        let driver_date = item
            .get("DriverDate")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);

        let driver_age_days = item.get("DriverAgeDays").and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_f64().map(|number| number.max(0.0) as u64))
        });

        let nvidia_smi_version = if vendor == "NVIDIA" {
            nvidia
                .iter()
                .find_map(|(gpu_name, version)| {
                    let left = name.to_ascii_lowercase();

                    let right = gpu_name.to_ascii_lowercase();

                    (left.contains(&right) || right.contains(&left)).then_some(version.clone())
                })
                .or_else(|| {
                    if nvidia.len() == 1 {
                        Some(nvidia[0].1.clone())
                    } else {
                        None
                    }
                })
        } else {
            None
        };

        result.push(GraphicsDriverAdapter {
            name: name.to_string(),

            vendor,

            driver_version,

            driver_date,

            driver_age_days,

            pnp_device_id: item
                .get("PNPDeviceID")
                .and_then(|value| value.as_str())
                .map(str::to_string),

            status: item
                .get("Status")
                .and_then(|value| value.as_str())
                .map(str::to_string),

            nvidia_smi_version,
        });
    }

    result
}

#[cfg(target_os = "windows")]
fn display_driver_packages() -> Vec<String> {
    let script = r#"
$ErrorActionPreference = 'SilentlyContinue'

Get-CimInstance Win32_PnPSignedDriver |
    Where-Object {
        $_.DeviceClass -eq 'DISPLAY'
    } |
    ForEach-Object {
        "$($_.Manufacturer)|$($_.DriverProviderName)|$($_.DriverVersion)|$($_.InfName)"
    }
"#;

    let Some(output) = powershell_text(script) else {
        return Vec::new();
    };

    let mut packages = output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();

    packages.sort();
    packages.dedup();

    packages
}

#[cfg(target_os = "windows")]
fn build_findings(
    adapters: &[GraphicsDriverAdapter],
    packages: &[String],
) -> Vec<GraphicsDriverFinding> {
    let mut findings = Vec::new();

    if adapters.is_empty() {
        findings.push(GraphicsDriverFinding {
            severity: "warning".to_string(),

            title: "No display adapters were detected".to_string(),

            detail: "Windows did not return any Win32_VideoController entries.".to_string(),

            suggestion: Some(
                "Check Device Manager and confirm the display driver is installed correctly."
                    .to_string(),
            ),
        });

        return findings;
    }

    let vendors = adapters
        .iter()
        .map(|adapter| adapter.vendor.clone())
        .filter(|vendor| vendor != "Unknown")
        .collect::<BTreeSet<_>>();

    if vendors.len() > 1 {
        findings.push(
            GraphicsDriverFinding {
                severity:
                    "info"
                        .to_string(),

                title:
                    "Multiple GPU vendors are installed"
                        .to_string(),

                detail:
                    format!(
                        "Detected display adapters from: {}.",
                        vendors
                            .iter()
                            .cloned()
                            .collect::<Vec<_>>()
                            .join(
                                ", "
                            )
                    ),

                suggestion:
                    Some(
                        "This can be completely normal on multi-GPU systems. If troubleshooting a game, verify that Windows and the game are using the intended GPU."
                            .to_string()
                    ),
            }
        );
    }

    for adapter in adapters {
        if adapter
            .status
            .as_deref()
            .map(|status| !status.eq_ignore_ascii_case("OK"))
            .unwrap_or(false)
        {
            findings.push(
                GraphicsDriverFinding {
                    severity:
                        "warning"
                            .to_string(),

                    title:
                        format!(
                            "{} reports a non-OK device status",
                            adapter.name
                        ),

                    detail:
                        format!(
                            "Windows reports status: {}.",
                            adapter.status
                                .as_deref()
                                .unwrap_or(
                                    "Unknown"
                                )
                        ),

                    suggestion:
                        Some(
                            "Check Device Manager for this adapter before troubleshooting game-specific issues."
                                .to_string()
                        ),
                }
            );
        }

        if let Some(days) = adapter.driver_age_days {
            if days > 730 {
                findings.push(
                    GraphicsDriverFinding {
                        severity:
                            "warning"
                                .to_string(),

                        title:
                            format!(
                                "{} driver is over two years old",
                                adapter.name
                            ),

                        detail:
                            format!(
                                "The reported driver date is approximately {} days old.",
                                days
                            ),

                        suggestion:
                            Some(
                                "Consider checking the GPU vendor for a newer supported driver if the system is having game compatibility or performance problems."
                                    .to_string()
                            ),
                    }
                );
            } else if days > 365 {
                findings.push(
                    GraphicsDriverFinding {
                        severity:
                            "info"
                                .to_string(),

                        title:
                            format!(
                                "{} driver is over one year old",
                                adapter.name
                            ),

                        detail:
                            format!(
                                "The reported driver date is approximately {} days old.",
                                days
                            ),

                        suggestion:
                            Some(
                                "A newer driver may exist, but GameAtlas does not assume that newer is always better for every game."
                                    .to_string()
                            ),
                    }
                );
            }
        }

        if adapter.vendor == "NVIDIA" {
            if let (Some(cim), Some(smi)) = (
                adapter.driver_version.as_deref(),
                adapter.nvidia_smi_version.as_deref(),
            ) {
                if !cim.contains(smi) && !smi.contains(cim) {
                    findings.push(
                        GraphicsDriverFinding {
                            severity:
                                "info"
                                    .to_string(),

                            title:
                                "NVIDIA version formats differ between Windows and nvidia-smi"
                                    .to_string(),

                            detail:
                                format!(
                                    "{} reports Windows driver version {} and nvidia-smi version {}.",
                                    adapter.name,
                                    cim,
                                    smi
                                ),

                            suggestion:
                                Some(
                                    "This can be normal because Windows and NVIDIA expose driver versions in different formats. Treat it as informational unless other driver problems are present."
                                        .to_string()
                                ),
                        }
                    );
                }
            }
        }
    }

    let package_vendors = packages
        .iter()
        .filter_map(|line| {
            let lower = line.to_ascii_lowercase();

            if lower.contains("nvidia") {
                Some("NVIDIA")
            } else if lower.contains("advanced micro devices")
                || lower.contains("|amd|")
                || lower.contains("radeon")
            {
                Some("AMD")
            } else if lower.contains("intel") {
                Some("Intel")
            } else {
                None
            }
        })
        .collect::<BTreeSet<_>>();

    if package_vendors.len() > 1 && vendors.len() <= 1 {
        findings.push(
            GraphicsDriverFinding {
                severity:
                    "info"
                        .to_string(),

                title:
                    "Display-driver packages from multiple vendors are present"
                        .to_string(),

                detail:
                    format!(
                        "Driver-store display entries reference: {}.",
                        package_vendors
                            .iter()
                            .copied()
                            .collect::<Vec<_>>()
                            .join(
                                ", "
                            )
                    ),

                suggestion:
                    Some(
                        "This is not automatically a problem. It can reflect old hardware, integrated graphics, or retained packages. If diagnosing driver corruption, review Device Manager and installed driver packages before using a cleanup tool."
                            .to_string()
                    ),
            }
        );
    }

    if findings.is_empty() {
        findings.push(
            GraphicsDriverFinding {
                severity:
                    "good"
                        .to_string(),

                title:
                    "No obvious graphics-driver health issue detected"
                        .to_string(),

                detail:
                    "Detected display adapters report usable driver information and no high-value inconsistency was found."
                        .to_string(),

                suggestion:
                    None,
            }
        );
    }

    findings
}

fn build_graphics_driver_diagnostics() -> GraphicsDriverReport {
    #[cfg(target_os = "windows")]
    {
        let adapters = adapters();

        let display_driver_packages = display_driver_packages();

        let findings = build_findings(&adapters, &display_driver_packages);

        let warning_count = findings
            .iter()
            .filter(|finding| finding.severity == "warning")
            .count();

        let summary = if warning_count > 0 {
            format!(
                "{} possible graphics-driver issue{} detected.",
                warning_count,
                if warning_count == 1 { "" } else { "s" }
            )
        } else {
            "No obvious graphics-driver health issue detected.".to_string()
        };

        return GraphicsDriverReport {
            supported: true,

            adapters,

            findings,

            display_driver_packages,

            summary,
        };
    }

    #[cfg(not(target_os = "windows"))]
    {
        GraphicsDriverReport {
            supported: false,

            adapters: Vec::new(),

            findings: Vec::new(),

            display_driver_packages: Vec::new(),

            summary: "Graphics Driver Diagnostics is currently available on Windows.".to_string(),
        }
    }
}

#[tauri::command]
pub async fn get_graphics_driver_diagnostics() -> Result<GraphicsDriverReport, String> {
    tauri::async_runtime::spawn_blocking(build_graphics_driver_diagnostics)
        .await
        .map_err(|error| format!("Graphics driver diagnostics worker failed: {error}"))
}
