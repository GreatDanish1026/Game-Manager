
#[cfg(target_os = "linux")]
fn linux_cpu_name() -> Option<String> {
    let text =
        std::fs::read_to_string(
            "/proc/cpuinfo"
        )
        .ok()?;

    for line in text.lines() {
        let Some(
            (
                key,
                value,
            )
        ) =
            line.split_once(':')
        else {
            continue;
        };

        let key =
            key.trim()
                .to_ascii_lowercase();

        if key == "model name"
            || key == "hardware"
        {
            let value =
                value.trim();

            if !value.is_empty() {
                return Some(
                    value.to_string()
                );
            }
        }
    }

    None
}


#[cfg(target_os = "linux")]
fn linux_ram_bytes() -> Option<u64> {
    let text =
        std::fs::read_to_string(
            "/proc/meminfo"
        )
        .ok()?;

    for line in text.lines() {
        if !line.starts_with(
            "MemTotal:"
        ) {
            continue;
        }

        let kilobytes =
            line
                .split_whitespace()
                .nth(
                    1
                )?
                .parse::<u64>()
                .ok()?;

        return Some(
            kilobytes
                .saturating_mul(
                    1024
                )
        );
    }

    None
}


#[cfg(target_os = "linux")]
fn linux_os_release_value(
    key: &str,
) -> Option<String> {
    let text =
        std::fs::read_to_string(
            "/etc/os-release"
        )
        .ok()?;

    for line in text.lines() {
        let Some(
            (
                candidate_key,
                value,
            )
        ) =
            line.split_once('=')
        else {
            continue;
        };

        if candidate_key.trim()
            != key
        {
            continue;
        }

        let value =
            value
                .trim()
                .trim_matches('"')
                .to_string();

        if !value.is_empty() {
            return Some(
                value
            );
        }
    }

    None
}


#[cfg(target_os = "linux")]
fn linux_os_info() -> (
    Option<String>,
    Option<String>,
) {
    (
        linux_os_release_value(
            "PRETTY_NAME"
        )
        .or_else(
            || {
                linux_os_release_value(
                    "NAME"
                )
            }
        ),

        linux_os_release_value(
            "VERSION_ID"
        ),
    )
}


#[cfg(target_os = "linux")]
fn linux_nvidia_gpus() -> Vec<GpuInfo> {
    let output =
        std::process::Command::new(
            "nvidia-smi"
        )
        .args([
            "--query-gpu=name,memory.total",
            "--format=csv,noheader,nounits",
        ])
        .output();

    let Ok(
        output
    ) =
        output
    else {
        return Vec::new();
    };

    if !output.status.success() {
        return Vec::new();
    }

    String::from_utf8_lossy(
        &output.stdout
    )
    .lines()
    .filter_map(
        |line| {
            let (
                name,
                memory
            ) =
                line.split_once(
                    ','
                )?;

            let name =
                name.trim()
                    .to_string();

            if name.is_empty() {
                return None;
            }

            let dedicated_memory_bytes =
                memory
                    .trim()
                    .parse::<u64>()
                    .ok()
                    .map(
                        |mebibytes| {
                            mebibytes
                                .saturating_mul(
                                    1024
                                )
                                .saturating_mul(
                                    1024
                                )
                        }
                    );

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

                    dedicated_memory_bytes,

                    name,
                }
            )
        }
    )
    .collect()
}


#[cfg(target_os = "linux")]
fn linux_lspci_gpus() -> Vec<GpuInfo> {
    let output =
        std::process::Command::new(
            "lspci"
        )
        .output();

    let Ok(
        output
    ) =
        output
    else {
        return Vec::new();
    };

    if !output.status.success() {
        return Vec::new();
    }

    String::from_utf8_lossy(
        &output.stdout
    )
    .lines()
    .filter(
        |line| {
            let lower =
                line.to_ascii_lowercase();

            lower.contains(
                "vga compatible controller"
            )
                || lower.contains(
                    "3d controller"
                )
                || lower.contains(
                    "display controller"
                )
        }
    )
    .filter_map(
        |line| {
            let name =
                line
                    .split_once(
                        ": "
                    )
                    .map(
                        |(
                            _,
                            value,
                        )| {
                            value
                        }
                    )
                    .unwrap_or(
                        line
                    )
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
                        None,

                    name,
                }
            )
        }
    )
    .collect()
}


#[cfg(target_os = "linux")]
fn linux_gpus() -> Vec<GpuInfo> {
    let nvidia =
        linux_nvidia_gpus();

    if !nvidia.is_empty() {
        return nvidia;
    }

    linux_lspci_gpus()
}


#[cfg(target_os = "linux")]
fn detect_linux_system_hardware() -> SystemHardwareInfo {
    let (
        os_name,
        os_version,
    ) =
        linux_os_info();

    SystemHardwareInfo {
        cpu_name:
            linux_cpu_name(),

        ram_bytes:
            linux_ram_bytes(),

        os_name,

        os_version,

        gpus:
            linux_gpus(),
    }
}


#[cfg(target_os = "linux")]
static LINUX_HARDWARE_CACHE:
    std::sync::OnceLock<SystemHardwareInfo> =
    std::sync::OnceLock::new();


#[cfg(target_os = "linux")]
#[tauri::command]
pub fn get_system_hardware() -> Result<SystemHardwareInfo, String> {
    let cached =
        LINUX_HARDWARE_CACHE
            .get_or_init(
                detect_linux_system_hardware
            );

    Ok(
        cached.clone()
    )
}


#[cfg(not(any(
    target_os = "windows",
    target_os = "linux"
)))]
#[tauri::command]
pub fn get_system_hardware() -> Result<SystemHardwareInfo, String> {
    Err(
        "System hardware detection is currently implemented for Windows and Linux."
            .to_string()
    )
}
