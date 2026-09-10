use serde::Serialize;

#[cfg(target_os = "windows")]
use std::{
    collections::BTreeMap,
    sync::OnceLock,
    time::Instant,
};

#[cfg(target_os = "windows")]
use winreg::{
    enums::HKEY_LOCAL_MACHINE,
    RegKey,
};


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


#[cfg(target_os = "windows")]
fn cpu_name_from_registry() -> Option<String> {
    let hklm =
        RegKey::predef(
            HKEY_LOCAL_MACHINE
        );

    let key =
        hklm
            .open_subkey(
                r"HARDWARE\DESCRIPTION\System\CentralProcessor\0"
            )
            .ok()?;

    let value:
        String =
        key
            .get_value(
                "ProcessorNameString"
            )
            .ok()?;

    let trimmed =
        value.trim();

    if trimmed.is_empty() {
        None
    } else {
        Some(
            trimmed.to_string()
        )
    }
}


#[cfg(target_os = "windows")]
fn os_from_registry() -> (
    Option<String>,
    Option<String>,
) {
    let hklm =
        RegKey::predef(
            HKEY_LOCAL_MACHINE
        );

    let Ok(key) =
        hklm.open_subkey(
            r"SOFTWARE\Microsoft\Windows NT\CurrentVersion"
        )
    else {
        return (
            None,
            None,
        );
    };

    let mut product_name =
        key
            .get_value::<String, _>(
                "ProductName"
            )
            .ok();

    let display_version =
        key
            .get_value::<String, _>(
                "DisplayVersion"
            )
            .ok()
            .or_else(
                || {
                    key
                        .get_value::<String, _>(
                            "ReleaseId"
                        )
                        .ok()
                }
            );

    let build =
        key
            .get_value::<String, _>(
                "CurrentBuildNumber"
            )
            .ok();

    let ubr =
        key
            .get_value::<u32, _>(
                "UBR"
            )
            .ok();

    if let (
        Some(name),
        Some(build_number),
    ) = (
        product_name.as_mut(),
        build
            .as_deref()
            .and_then(
                |value| {
                    value.parse::<u32>()
                        .ok()
                }
            ),
    ) {
        if build_number >= 22000
            && name.contains(
                "Windows 10"
            )
        {
            *name =
                name.replace(
                    "Windows 10",
                    "Windows 11",
                );
        }
    }

    let build_text =
        match (
            build.as_deref(),
            ubr,
        ) {
            (
                Some(build),
                Some(ubr),
            ) =>
                Some(
                    format!(
                        "{}.{}",
                        build,
                        ubr
                    )
                ),

            (
                Some(build),
                None,
            ) =>
                Some(
                    build.to_string()
                ),

            _ =>
                None,
        };

    let version =
        match (
            display_version,
            build_text,
        ) {
            (
                Some(display),
                Some(build),
            ) =>
                Some(
                    format!(
                        "{} (Build {})",
                        display,
                        build
                    )
                ),

            (
                Some(display),
                None,
            ) =>
                Some(
                    display
                ),

            (
                None,
                Some(build),
            ) =>
                Some(
                    format!(
                        "Build {}",
                        build
                    )
                ),

            _ =>
                None,
        };

    (
        product_name,
        version,
    )
}


#[cfg(target_os = "windows")]
#[repr(C)]
struct MemoryStatusEx {
    length: u32,
    memory_load: u32,
    total_phys: u64,
    avail_phys: u64,
    total_page_file: u64,
    avail_page_file: u64,
    total_virtual: u64,
    avail_virtual: u64,
    avail_extended_virtual: u64,
}


#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn GlobalMemoryStatusEx(
        buffer: *mut MemoryStatusEx,
    ) -> i32;
}


#[cfg(target_os = "windows")]
fn total_ram_bytes() -> Option<u64> {
    let mut status =
        MemoryStatusEx {
            length:
                std::mem::size_of::<MemoryStatusEx>()
                    as u32,
            memory_load:
                0,
            total_phys:
                0,
            avail_phys:
                0,
            total_page_file:
                0,
            avail_page_file:
                0,
            total_virtual:
                0,
            avail_virtual:
                0,
            avail_extended_virtual:
                0,
        };

    let success =
        unsafe {
            GlobalMemoryStatusEx(
                &mut status
            )
        };

    if success == 0 {
        None
    } else {
        Some(
            status.total_phys
        )
    }
}


#[cfg(target_os = "windows")]
fn raw_registry_memory_bytes(
    key: &RegKey,
) -> Option<u64> {
    for value_name in [
        "HardwareInformation.qwMemorySize",
        "HardwareInformation.MemorySize",
    ] {
        let Ok(raw) =
            key.get_raw_value(
                value_name
            )
        else {
            continue;
        };

        if raw.bytes.len() >= 8 {
            let bytes:
                [u8; 8] =
                raw.bytes[0..8]
                    .try_into()
                    .ok()?;

            return Some(
                u64::from_le_bytes(
                    bytes
                )
            );
        }

        if raw.bytes.len() >= 4 {
            let bytes:
                [u8; 4] =
                raw.bytes[0..4]
                    .try_into()
                    .ok()?;

            return Some(
                u32::from_le_bytes(
                    bytes
                ) as u64
            );
        }
    }

    None
}


#[cfg(target_os = "windows")]
fn add_gpu_registry_entry(
    key: &RegKey,
    found: &mut BTreeMap<String, (
        String,
        Option<u64>,
    )>,
) {
    let name =
        key
            .get_value::<String, _>(
                "DriverDesc"
            )
            .ok()
            .or_else(
                || {
                    key
                        .get_value::<String, _>(
                            "Device Description"
                        )
                        .ok()
                }
            );

    let Some(name) =
        name
            .map(
                |value| {
                    value.trim()
                        .to_string()
                }
            )
            .filter(
                |value| {
                    !value.is_empty()
                }
            )
    else {
        return;
    };

    let lower =
        name.to_ascii_lowercase();

    if lower.contains(
        "microsoft basic"
    )
        || lower.contains(
            "remote display"
        )
    {
        return;
    }

    let memory =
        raw_registry_memory_bytes(
            key
        );

    let dedupe_key =
        lower;

    match found.get_mut(
        &dedupe_key
    ) {
        Some((
            _,
            existing_memory,
        )) => {
            if memory.unwrap_or(0)
                > existing_memory
                    .unwrap_or(0)
            {
                *existing_memory =
                    memory;
            }
        }

        None => {
            found.insert(
                dedupe_key,
                (
                    name,
                    memory,
                ),
            );
        }
    }
}


#[cfg(target_os = "windows")]
fn query_gpus_from_class_registry(
    found: &mut BTreeMap<String, (
        String,
        Option<u64>,
    )>,
) {
    let hklm =
        RegKey::predef(
            HKEY_LOCAL_MACHINE
        );

    let Ok(class_key) =
        hklm.open_subkey(
            r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
        )
    else {
        return;
    };

    for subkey_name in
        class_key.enum_keys()
            .flatten()
    {
        if !subkey_name
            .chars()
            .all(
                |character| {
                    character.is_ascii_digit()
                }
            )
        {
            continue;
        }

        if let Ok(key) =
            class_key.open_subkey(
                &subkey_name
            )
        {
            add_gpu_registry_entry(
                &key,
                found,
            );
        }
    }
}


#[cfg(target_os = "windows")]
fn query_gpus_from_video_registry(
    found: &mut BTreeMap<String, (
        String,
        Option<u64>,
    )>,
) {
    let hklm =
        RegKey::predef(
            HKEY_LOCAL_MACHINE
        );

    let Ok(video_key) =
        hklm.open_subkey(
            r"SYSTEM\CurrentControlSet\Control\Video"
        )
    else {
        return;
    };

    for adapter_key_name in
        video_key.enum_keys()
            .flatten()
    {
        let Ok(adapter_key) =
            video_key.open_subkey(
                &adapter_key_name
            )
        else {
            continue;
        };

        for child_name in
            adapter_key.enum_keys()
                .flatten()
        {
            let Ok(child_key) =
                adapter_key.open_subkey(
                    &child_name
                )
            else {
                continue;
            };

            add_gpu_registry_entry(
                &child_key,
                found,
            );
        }
    }
}


#[cfg(target_os = "windows")]
fn query_gpus() -> Vec<GpuInfo> {
    let mut found:
        BTreeMap<String, (
            String,
            Option<u64>,
        )> =
        BTreeMap::new();

    query_gpus_from_class_registry(
        &mut found
    );

    query_gpus_from_video_registry(
        &mut found
    );

    found
        .into_values()
        .map(
            |(
                name,
                dedicated_memory_bytes,
            )| {
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
            }
        )
        .collect()
}


#[cfg(target_os = "windows")]
fn detect_system_hardware() -> SystemHardwareInfo {
    let started =
        Instant::now();

    let cpu_name =
        cpu_name_from_registry();

    let ram_bytes =
        total_ram_bytes();

    let (
        os_name,
        os_version,
    ) =
        os_from_registry();

    let gpus =
        query_gpus();

    println!(
        "[PERFORMANCE] Hardware detection: {} ms",
        started.elapsed().as_millis()
    );

    SystemHardwareInfo {
        cpu_name,
        ram_bytes,
        os_name,
        os_version,
        gpus,
    }
}


#[cfg(target_os = "windows")]
static HARDWARE_CACHE:
    OnceLock<SystemHardwareInfo> =
    OnceLock::new();


#[cfg(target_os = "windows")]
#[tauri::command]
pub fn get_system_hardware() -> Result<SystemHardwareInfo, String> {
    let cached =
        HARDWARE_CACHE
            .get_or_init(
                detect_system_hardware
            );

    Ok(
        cached.clone()
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
