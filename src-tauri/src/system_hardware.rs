use serde::Serialize;

#[cfg(target_os = "windows")]
use std::{collections::BTreeMap, sync::OnceLock, time::Instant};

#[cfg(target_os = "windows")]
use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};

#[cfg(target_os = "linux")]
use std::{collections::BTreeSet, fs, process::Command};

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

fn normalized_vendor(name: &str) -> String {
    let lower = name.to_ascii_lowercase();

    if lower.contains("nvidia") {
        "NVIDIA".to_string()
    } else if lower.contains("amd")
        || lower.contains("radeon")
        || lower.contains("advanced micro devices")
    {
        "AMD".to_string()
    } else if lower.contains("intel") {
        "Intel".to_string()
    } else {
        "Unknown".to_string()
    }
}

fn extract_nvidia_series(name: &str) -> Option<u32> {
    let upper = name.to_ascii_uppercase();

    let rtx_index = upper.find("RTX")?;

    let tail = &upper[rtx_index + 3..];

    let digits = tail
        .chars()
        .skip_while(|character| !character.is_ascii_digit())
        .take_while(|character| character.is_ascii_digit())
        .collect::<String>();

    if digits.len() < 4 {
        return None;
    }

    digits[0..2].parse::<u32>().ok()
}

fn nvidia_rtx(name: &str) -> bool {
    name.to_ascii_uppercase().contains("RTX")
}

fn nvidia_frame_generation_capable(name: &str) -> bool {
    extract_nvidia_series(name)
        .map(|series| series >= 40)
        .unwrap_or(false)
}

fn amd_ray_tracing_class(name: &str) -> bool {
    let upper = name.to_ascii_uppercase();

    if !upper.contains("RADEON") {
        return false;
    }

    for marker in ["RX 6", "RX 7", "RX 8", "RX 9"] {
        if upper.contains(marker) {
            return true;
        }
    }

    false
}

fn intel_arc(name: &str) -> bool {
    name.to_ascii_uppercase().contains("ARC")
}

// ============================================================
// Windows
// ============================================================

#[cfg(target_os = "windows")]
fn windows_cpu_name() -> Option<String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = Command::new("powershell.exe")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            "(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name)",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

#[cfg(target_os = "windows")]
fn windows_ram_bytes() -> Option<u64> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = Command::new("powershell.exe")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<u64>()
        .ok()
}

#[cfg(target_os = "windows")]
fn windows_os_info() -> (Option<String>, Option<String>) {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

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
            "$o=Get-CimInstance Win32_OperatingSystem; Write-Output $o.Caption; Write-Output $o.Version",
        ])
        .output();

    let Ok(output) = output else {
        return (None, None);
    };

    if !output.status.success() {
        return (None, None);
    }

    let lines = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();

    (lines.get(0).cloned(), lines.get(1).cloned())
}

#[cfg(target_os = "windows")]
fn windows_gpus() -> Vec<GpuInfo> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

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
            "Get-CimInstance Win32_VideoController | ForEach-Object { \"$($_.Name)|$($_.AdapterRAM)\" }",
        ])
        .output();

    let Ok(output) = output else {
        return Vec::new();
    };

    if !output.status.success() {
        return Vec::new();
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let line = line.trim();

            if line.is_empty() {
                return None;
            }

            let mut parts = line.splitn(2, '|');

            let name = parts.next()?.trim().to_string();

            if name.is_empty() {
                return None;
            }

            let dedicated_memory_bytes = parts
                .next()
                .and_then(|value| value.trim().parse::<u64>().ok());

            Some(GpuInfo {
                vendor: normalized_vendor(&name),

                dedicated_memory_bytes,

                nvidia_rtx: nvidia_rtx(&name),

                nvidia_frame_generation_capable: nvidia_frame_generation_capable(&name),

                amd_ray_tracing_class: amd_ray_tracing_class(&name),

                intel_arc: intel_arc(&name),

                name,
            })
        })
        .collect()
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn get_system_hardware() -> Result<SystemHardwareInfo, String> {
    let (os_name, os_version) = windows_os_info();

    Ok(SystemHardwareInfo {
        cpu_name: windows_cpu_name(),

        ram_bytes: windows_ram_bytes(),

        os_name,

        os_version,

        gpus: windows_gpus(),
    })
}

// ============================================================
// Linux
// ============================================================

#[cfg(target_os = "linux")]
fn linux_command_candidates(program: &str) -> Vec<std::path::PathBuf> {
    let mut candidates = Vec::new();

    for prefix in ["/usr/bin", "/usr/sbin", "/bin", "/sbin"] {
        let path = std::path::Path::new(prefix).join(program);

        if path.exists() {
            candidates.push(path);
        }
    }

    // Keep the PATH-based lookup as a final fallback.
    candidates.push(std::path::PathBuf::from(program));

    candidates
}

#[cfg(target_os = "linux")]
fn linux_command_output(program: &str, args: &[&str]) -> Option<String> {
    for candidate in linux_command_candidates(program) {
        let output = Command::new(&candidate).args(args).output();

        let Ok(output) = output else {
            continue;
        };

        if !output.status.success() {
            continue;
        }

        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();

        if !value.is_empty() {
            return Some(value);
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn linux_cpu_name() -> Option<String> {
    let text = fs::read_to_string("/proc/cpuinfo").ok()?;

    for line in text.lines() {
        if let Some(value) = line.strip_prefix("model name") {
            let value = value.trim_start_matches(':').trim();

            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn linux_ram_bytes() -> Option<u64> {
    let text = fs::read_to_string("/proc/meminfo").ok()?;

    for line in text.lines() {
        if !line.starts_with("MemTotal:") {
            continue;
        }

        let kilobytes = line.split_whitespace().nth(1)?.parse::<u64>().ok()?;

        return Some(kilobytes.saturating_mul(1024));
    }

    None
}

#[cfg(target_os = "linux")]
fn os_release_value(key: &str) -> Option<String> {
    let text = fs::read_to_string("/etc/os-release").ok()?;

    for line in text.lines() {
        let Some((current_key, raw_value)) = line.split_once('=') else {
            continue;
        };

        if current_key != key {
            continue;
        }

        let value = raw_value.trim().trim_matches('"').to_string();

        if value.is_empty() {
            return None;
        }

        return Some(value);
    }

    None
}

#[cfg(target_os = "linux")]
fn gpu_from_name(name: String, dedicated_memory_bytes: Option<u64>) -> GpuInfo {
    GpuInfo {
        vendor: normalized_vendor(&name),

        dedicated_memory_bytes,

        nvidia_rtx: nvidia_rtx(&name),

        nvidia_frame_generation_capable: nvidia_frame_generation_capable(&name),

        amd_ray_tracing_class: amd_ray_tracing_class(&name),

        intel_arc: intel_arc(&name),

        name,
    }
}

#[cfg(target_os = "linux")]
fn linux_nvidia_proc_gpus() -> Vec<GpuInfo> {
    let mut results = Vec::new();

    let root = std::path::Path::new("/proc/driver/nvidia/gpus");

    let Ok(entries) = fs::read_dir(root) else {
        return results;
    };

    for entry in entries.flatten() {
        let information = entry.path().join("information");

        let Ok(text) = fs::read_to_string(information) else {
            continue;
        };

        let model = text.lines().find_map(|line| {
            let (key, value) = line.split_once(':')?;

            if key.trim() != "Model" {
                return None;
            }

            let value = value.trim();

            if value.is_empty() {
                None
            } else {
                Some(value.to_string())
            }
        });

        if let Some(model) = model {
            results.push(gpu_from_name(model, None));
        }
    }

    results
}

#[cfg(target_os = "linux")]
fn linux_nvidia_gpus() -> Vec<GpuInfo> {
    let Some(text) = linux_command_output(
        "nvidia-smi",
        &[
            "--query-gpu=name,memory.total",
            "--format=csv,noheader,nounits",
        ],
    ) else {
        return Vec::new();
    };

    text.lines()
        .filter_map(|line| {
            let mut parts = line.splitn(2, ',');

            let name = parts.next()?.trim().to_string();

            if name.is_empty() {
                return None;
            }

            let memory_mib = parts
                .next()
                .and_then(|value| value.trim().parse::<u64>().ok());

            let memory_bytes =
                memory_mib.map(|value| value.saturating_mul(1024).saturating_mul(1024));

            Some(gpu_from_name(name, memory_bytes))
        })
        .collect()
}

#[cfg(target_os = "linux")]
fn linux_lspci_gpus() -> Vec<GpuInfo> {
    let Some(text) = linux_command_output("lspci", &["-nn"]) else {
        return Vec::new();
    };

    let mut results = Vec::new();

    for line in text.lines() {
        let lower = line.to_ascii_lowercase();

        if !lower.contains("vga compatible controller")
            && !lower.contains("3d controller")
            && !lower.contains("display controller")
        {
            continue;
        }

        let name = line
            .split_once(": ")
            .map(|(_, value)| value.trim().to_string())
            .unwrap_or_else(|| line.trim().to_string());

        if name.is_empty() {
            continue;
        }

        results.push(gpu_from_name(name, None));
    }

    results
}

#[cfg(target_os = "linux")]
fn linux_sysfs_gpus() -> Vec<GpuInfo> {
    let mut results = Vec::new();

    let Ok(entries) = fs::read_dir("/sys/class/drm") else {
        return results;
    };

    let mut seen_devices = BTreeSet::new();

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        // card0, card1, ... only. Skip renderD* and connector entries.
        if !name.starts_with("card")
            || name[4..]
                .chars()
                .any(|character| !character.is_ascii_digit())
        {
            continue;
        }

        let device = entry.path().join("device");

        let canonical = fs::canonicalize(&device).ok();

        if let Some(canonical) = canonical.as_ref() {
            if !seen_devices.insert(canonical.clone()) {
                continue;
            }
        }

        let vendor_id = fs::read_to_string(device.join("vendor"))
            .ok()
            .map(|value| value.trim().to_ascii_lowercase());

        let device_id = fs::read_to_string(device.join("device"))
            .ok()
            .map(|value| value.trim().to_ascii_lowercase());

        let driver_name = fs::read_link(device.join("driver")).ok().and_then(|path| {
            path.file_name()
                .map(|value| value.to_string_lossy().to_string())
        });

        let mut display_name = match vendor_id.as_deref() {
            Some("0x10de") => "NVIDIA GPU".to_string(),

            Some("0x1002") => "AMD Radeon GPU".to_string(),

            Some("0x8086") => "Intel GPU".to_string(),

            _ => "GPU".to_string(),
        };

        if let Some(device_id) = device_id {
            display_name.push_str(&format!(" ({})", device_id));
        }

        if let Some(driver) = driver_name {
            display_name.push_str(&format!(" [{}]", driver));
        }

        results.push(gpu_from_name(display_name, None));
    }

    results
}

#[cfg(target_os = "linux")]
fn linux_gpus() -> Vec<GpuInfo> {
    let mut results = linux_nvidia_proc_gpus();

    let smi_gpus = linux_nvidia_gpus();

    if !smi_gpus.is_empty() {
        results.retain(|gpu| gpu.vendor != "NVIDIA");

        results.extend(smi_gpus);
    }

    let mut seen = results
        .iter()
        .map(|gpu| gpu.name.to_ascii_lowercase())
        .collect::<BTreeSet<_>>();

    for gpu in linux_lspci_gpus() {
        if gpu.vendor == "NVIDIA" && results.iter().any(|existing| existing.vendor == "NVIDIA") {
            continue;
        }

        let lower = gpu.name.to_ascii_lowercase();

        if seen.insert(lower) {
            results.push(gpu);
        }
    }

    for gpu in linux_sysfs_gpus() {
        if gpu.vendor == "NVIDIA" && results.iter().any(|existing| existing.vendor == "NVIDIA") {
            continue;
        }

        let lower = gpu.name.to_ascii_lowercase();

        if seen.insert(lower) {
            results.push(gpu);
        }
    }

    results
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn get_system_hardware() -> Result<SystemHardwareInfo, String> {
    Ok(SystemHardwareInfo {
        cpu_name: linux_cpu_name(),

        ram_bytes: linux_ram_bytes(),

        os_name: os_release_value("PRETTY_NAME").or_else(|| os_release_value("NAME")),

        os_version: os_release_value("VERSION_ID"),

        gpus: linux_gpus(),
    })
}

// ============================================================
// Other platforms
// ============================================================

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
#[tauri::command]
pub fn get_system_hardware() -> Result<SystemHardwareInfo, String> {
    Ok(SystemHardwareInfo {
        cpu_name: None,

        ram_bytes: None,

        os_name: Some(std::env::consts::OS.to_string()),

        os_version: None,

        gpus: Vec::new(),
    })
}
