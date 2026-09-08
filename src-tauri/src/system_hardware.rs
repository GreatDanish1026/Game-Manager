use std::{
    process::Command,
};

use serde::{
    Deserialize,
    Serialize,
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub name: String,
    pub vendor: String,
    pub dedicated_memory_bytes: Option<u64>,
    pub nvidia_rtx: bool,
    pub nvidia_frame_generation_capable: bool,
    pub amd_ray_tracing_class: bool,
    pub intel_arc: bool,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemHardwareInfo {
    pub cpu_name: Option<String>,
    pub ram_bytes: Option<u64>,
    pub os_name: Option<String>,
    pub os_version: Option<String>,
    pub gpus: Vec<GpuInfo>,
}


#[derive(Debug, Deserialize)]
struct PowerShellGpu {
    #[serde(rename = "Name")]
    name: Option<String>,

    #[serde(rename = "AdapterRAM")]
    adapter_ram: Option<u64>,
}


#[derive(Debug, Deserialize)]
struct PowerShellCpu {
    #[serde(rename = "Name")]
    name: Option<String>,
}


#[derive(Debug, Deserialize)]
struct PowerShellOs {
    #[serde(rename = "Caption")]
    caption: Option<String>,

    #[serde(rename = "Version")]
    version: Option<String>,

    #[serde(rename = "TotalVisibleMemorySize")]
    total_visible_memory_size: Option<u64>,
}


fn normalized_vendor(
    name: &str,
) -> String {
    let lower =
        name.to_ascii_lowercase();

    if lower.contains(
        "nvidia"
    ) {
        "NVIDIA"
            .to_string()
    } else if lower.contains(
        "amd"
    )
        || lower.contains(
            "radeon"
        )
    {
        "AMD"
            .to_string()
    } else if lower.contains(
        "intel"
    ) {
        "Intel"
            .to_string()
    } else {
        "Unknown"
            .to_string()
    }
}


fn extract_nvidia_series(
    name: &str,
) -> Option<u32> {
    let upper =
        name.to_ascii_uppercase();

    let rtx_index =
        upper.find(
            "RTX"
        )?;

    let tail =
        &upper[
            rtx_index + 3..
        ];

    let digits =
        tail
            .chars()
            .skip_while(
                |character| {
                    !character
                        .is_ascii_digit()
                }
            )
            .take_while(
                |character| {
                    character
                        .is_ascii_digit()
                }
            )
            .collect::<String>();

    if digits.len()
        < 4
    {
        return None;
    }

    digits[0..2]
        .parse::<u32>()
        .ok()
}


fn nvidia_rtx(
    name: &str,
) -> bool {
    name
        .to_ascii_uppercase()
        .contains(
            "RTX"
        )
}


fn nvidia_frame_generation_capable(
    name: &str,
) -> bool {
    extract_nvidia_series(
        name
    )
    .map(
        |series| {
            series >= 40
        }
    )
    .unwrap_or(
        false
    )
}


fn amd_ray_tracing_class(
    name: &str,
) -> bool {
    let upper =
        name.to_ascii_uppercase();

    if !upper.contains(
        "RADEON"
    ) {
        return false;
    }

    /*
     * Conservative family check:
     * RX 6000 / 7000 / 9000-class desktop/mobile Radeon GPUs
     * are treated as hardware ray-tracing-capable families.
     */
    for marker in [
        "RX 6",
        "RX 7",
        "RX 8",
        "RX 9",
    ] {
        if upper.contains(
            marker
        ) {
            return true;
        }
    }

    false
}


fn intel_arc(
    name: &str,
) -> bool {
    name
        .to_ascii_uppercase()
        .contains(
            "ARC"
        )
}


fn parse_json_output<T>(
    script: &str,
) -> Result<T, String>
where
    T:
        for<'de>
            Deserialize<'de>,
{
    let output =
        Command::new(
            "powershell.exe"
        )
        .creation_flags(
            CREATE_NO_WINDOW
        )
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            script,
        ])
        .output()
        .map_err(
            |error| {
                format!(
                    "Failed to run PowerShell hardware query: {}",
                    error
                )
            }
        )?;

    if !output.status.success() {
        return Err(
            format!(
                "PowerShell hardware query failed with exit code {:?}.",
                output.status.code()
            )
        );
    }

    let text =
        String::from_utf8_lossy(
            &output.stdout
        )
        .trim()
        .to_string();

    serde_json::from_str(
        &text
    )
    .map_err(
        |error| {
            format!(
                "Failed to parse hardware query result: {}",
                error
            )
        }
    )
}


#[cfg(target_os = "windows")]
fn query_gpus() -> Result<Vec<PowerShellGpu>, String> {
    let value:
        serde_json::Value =
        parse_json_output(
            "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress"
        )?;

    if value.is_array() {
        serde_json::from_value(
            value
        )
        .map_err(
            |error| {
                error.to_string()
            }
        )
    } else {
        let single:
            PowerShellGpu =
            serde_json::from_value(
                value
            )
            .map_err(
                |error| {
                    error.to_string()
                }
            )?;

        Ok(
            vec![
                single,
            ]
        )
    }
}


#[cfg(target_os = "windows")]
fn query_cpu() -> Result<PowerShellCpu, String> {
    parse_json_output(
        "Get-CimInstance Win32_Processor | Select-Object -First 1 Name | ConvertTo-Json -Compress"
    )
}


#[cfg(target_os = "windows")]
fn query_os() -> Result<PowerShellOs, String> {
    parse_json_output(
        "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,TotalVisibleMemorySize | ConvertTo-Json -Compress"
    )
}


#[cfg(target_os = "windows")]
#[tauri::command]
pub fn get_system_hardware() -> Result<SystemHardwareInfo, String> {
    let gpu_rows =
        query_gpus()?;

    let cpu =
        query_cpu()
            .ok();

    let os =
        query_os()
            .ok();

    let gpus =
        gpu_rows
            .into_iter()
            .filter_map(
                |row| {
                    let name =
                        row.name?
                            .trim()
                            .to_string();

                    if name.is_empty() {
                        return None;
                    }

                    Some(
                        GpuInfo {
                            vendor:
                                normalized_vendor(
                                    &name
                                ),

                            nvidia_rtx:
                                nvidia_rtx(
                                    &name
                                ),

                            nvidia_frame_generation_capable:
                                nvidia_frame_generation_capable(
                                    &name
                                ),

                            amd_ray_tracing_class:
                                amd_ray_tracing_class(
                                    &name
                                ),

                            intel_arc:
                                intel_arc(
                                    &name
                                ),

                            dedicated_memory_bytes:
                                row.adapter_ram,

                            name,
                        }
                    )
                }
            )
            .collect::<Vec<_>>();

    let ram_bytes =
        os.as_ref()
            .and_then(
                |value| {
                    value
                        .total_visible_memory_size
                }
            )
            .map(
                |kilobytes| {
                    kilobytes
                        .saturating_mul(
                            1024
                        )
                }
            );

    Ok(
        SystemHardwareInfo {
            cpu_name:
                cpu
                    .and_then(
                        |value| {
                            value.name
                        }
                    ),

            ram_bytes,

            os_name:
                os.as_ref()
                    .and_then(
                        |value| {
                            value.caption
                                .clone()
                        }
                    ),

            os_version:
                os.and_then(
                    |value| {
                        value.version
                    }
                ),

            gpus,
        }
    )
}


#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn get_system_hardware() -> Result<SystemHardwareInfo, String> {
    Err(
        "System hardware detection is currently implemented for Windows."
            .to_string()
    )
}
