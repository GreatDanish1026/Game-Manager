use serde::Serialize;
use std::{
    collections::HashMap,
    fs,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{Duration, Instant, UNIX_EPOCH},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenoDxReadinessFile {
    pub name: String,
    pub path: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenoDxReadinessInfo {
    pub supported: bool,
    pub support_name: Option<String>,
    pub support_status: String,
    pub install_path: Option<String>,
    pub executable_path: Option<String>,
    pub binary_directory: Option<String>,
    pub architecture: String,
    pub graphics_api: Option<String>,
    pub reshade_state: String,
    pub reshade_loader: Option<String>,
    pub reshade_ini: Option<String>,
    pub reshade_log: Option<String>,
    pub addon_support_state: String,
    pub renodx_state: String,
    pub renodx_files: Vec<RenoDxReadinessFile>,
    pub other_addon_files: Vec<RenoDxReadinessFile>,
    pub conflicts: Vec<RenoDxReadinessFile>,
    pub readiness: String,
    pub next_action: String,
}

fn normalize_existing_path(value: Option<String>) -> Option<PathBuf> {
    value.map(PathBuf::from).filter(|path| path.exists())
}

fn detect_pe_architecture(path: &Path) -> String {
    let Ok(mut file) = fs::File::open(path) else {
        return "unknown".to_string();
    };

    let mut dos = [0u8; 64];

    if file.read_exact(&mut dos).is_err() || dos[0] != b'M' || dos[1] != b'Z' {
        return "unknown".to_string();
    }

    let pe_offset = u32::from_le_bytes([dos[60], dos[61], dos[62], dos[63]]) as u64;

    if file.seek(SeekFrom::Start(pe_offset)).is_err() {
        return "unknown".to_string();
    }

    let mut header = [0u8; 6];

    if file.read_exact(&mut header).is_err() || &header[0..4] != b"PE\0\0" {
        return "unknown".to_string();
    }

    match u16::from_le_bytes([header[4], header[5]]) {
        0x8664 | 0xAA64 => "64-bit".to_string(),
        0x014c => "32-bit".to_string(),
        _ => "unknown".to_string(),
    }
}

fn is_executable(path: &Path) -> bool {
    path.is_file()
        && path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("exe"))
            .unwrap_or(false)
}

fn looks_like_auxiliary_exe(path: &Path) -> bool {
    let name = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    [
        "setup",
        "install",
        "installer",
        "unins",
        "uninstall",
        "crash",
        "report",
        "launcher",
        "benchmark",
        "config",
        "configuration",
        "redist",
        "prereq",
        "support",
        "eac",
        "easyanticheat",
        "anticheat",
    ]
    .iter()
    .any(|needle| name.contains(needle))
}

fn collect_root_executables(root: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(root) else {
        return Vec::new();
    };

    entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| is_executable(path))
        .collect()
}

fn collect_executables(root: &Path, depth: usize, output: &mut Vec<PathBuf>, visited: &mut usize) {
    if depth > 4 || *visited > 8000 {
        return;
    }

    let Ok(entries) = fs::read_dir(root) else {
        return;
    };

    for entry in entries.flatten() {
        *visited += 1;

        if *visited > 8000 {
            return;
        }

        let path = entry.path();

        if path.is_dir() {
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();

            if matches!(
                name.as_str(),
                "redist"
                    | "_commonredist"
                    | "support"
                    | "installer"
                    | "installers"
                    | "redistributables"
            ) {
                continue;
            }

            collect_executables(&path, depth + 1, output, visited);

            continue;
        }

        if is_executable(&path) {
            output.push(path);
        }
    }
}

fn exe_size(path: &Path) -> u64 {
    fs::metadata(path)
        .map(|metadata| metadata.len())
        .unwrap_or(0)
}

fn choose_best_root_executable(install_path: &Path) -> Option<PathBuf> {
    let mut candidates = collect_root_executables(install_path);

    if candidates.is_empty() {
        return None;
    }

    // Root-level game executables are normally the correct ReShade injection
    // target when present. Prefer non-helper executables, then the largest
    // remaining executable as a practical game-binary heuristic.
    candidates.sort_by_key(|path| {
        (
            looks_like_auxiliary_exe(path),
            std::cmp::Reverse(exe_size(path)),
        )
    });

    let preferred = candidates
        .iter()
        .find(|path| !looks_like_auxiliary_exe(path))
        .cloned();

    preferred.or_else(|| candidates.into_iter().next())
}

fn choose_fallback_executable(install_path: &Path) -> Option<PathBuf> {
    let mut executables = Vec::new();
    let mut visited = 0usize;

    collect_executables(install_path, 0, &mut executables, &mut visited);

    executables.sort_by_key(|path| {
        let relative_depth = path
            .strip_prefix(install_path)
            .ok()
            .map(|relative| relative.components().count())
            .unwrap_or(99);

        (
            looks_like_auxiliary_exe(path),
            relative_depth,
            std::cmp::Reverse(exe_size(path)),
        )
    });

    executables.into_iter().next()
}

fn choose_executable(
    install_path: Option<&Path>,
    supplied_executable: Option<PathBuf>,
) -> Option<PathBuf> {
    let install_path = install_path;

    /*
     * GAMEATLAS_PREFER_SUPPLIED_EXECUTABLE_PHASE2
     *
     * Trust the executable already selected by the general local inspector.
     * This avoids repeating executable discovery when the RenoDX card mounts.
     */
    if let Some(path) = supplied_executable.as_ref() {
        if is_executable(path) {
            return supplied_executable;
        }
    }

    // Important RenoDX/ReShade rule:
    //
    // If the game has a credible executable directly in the Steam/Heroic/
    // Lutris install root, that is a stronger injection target than an
    // automatically discovered helper executable in a nested folder.
    //
    // God of War is an example:
    //   .../GodOfWar/GoW.exe        <- correct
    //   .../GodOfWar/exec/*.exe     <- not the injection target
    if let Some(root) = install_path {
        if root.is_dir() {
            if let Some(root_exe) = choose_best_root_executable(root) {
                return Some(root_exe);
            }
        }
    }

    install_path.and_then(choose_fallback_executable)
}

fn lower_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn read_small_text(path: &Path) -> String {
    let Ok(metadata) = fs::metadata(path) else {
        return String::new();
    };

    if metadata.len() > 8 * 1024 * 1024 {
        return String::new();
    }

    fs::read_to_string(path).unwrap_or_default()
}

fn file_record(path: &Path, kind: &str) -> RenoDxReadinessFile {
    RenoDxReadinessFile {
        name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Unknown")
            .to_string(),
        path: path.to_string_lossy().to_string(),
        kind: kind.to_string(),
    }
}


/*
 * GAMEATLAS_LOCAL_INSPECTION_CACHE_PHASE2
 *
 * Cache local RenoDX/ReShade readiness. Filesystem fingerprints are part of
 * the key so add/remove/update operations invalidate cached results.
 */
static RENODX_READINESS_CACHE:
    OnceLock<
        Mutex<
            HashMap<
                String,
                (
                    Instant,
                    RenoDxReadinessInfo,
                ),
            >,
        >,
    > =
    OnceLock::new();

const RENODX_READINESS_CACHE_TTL:
    Duration =
    Duration::from_secs(300);


fn modified_stamp(
    path: &Path,
) -> u128 {
    fs::metadata(path)
        .ok()
        .and_then(|metadata| {
            metadata.modified().ok()
        })
        .and_then(|modified| {
            modified
                .duration_since(UNIX_EPOCH)
                .ok()
        })
        .map(|duration| {
            duration.as_millis()
        })
        .unwrap_or(0)
}


fn metadata_size(
    path: &Path,
) -> u64 {
    fs::metadata(path)
        .map(|metadata| {
            metadata.len()
        })
        .unwrap_or(0)
}


fn readiness_cache_key(
    install: Option<&Path>,
    executable: Option<&Path>,
    graphics_api: Option<&str>,
    renodx_supported: bool,
    renodx_match_name: Option<&str>,
    renodx_provider_status: Option<&str>,
) -> String {
    let binary_directory =
        executable
            .and_then(|path| path.parent())
            .or(install);

    format!(
        "{}|{}|{}|{}|{}|{}|{}|{}|{}",
        install
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_default(),
        executable
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_default(),
        graphics_api.unwrap_or(""),
        renodx_supported,
        renodx_match_name.unwrap_or(""),
        renodx_provider_status.unwrap_or(""),
        binary_directory.map(modified_stamp).unwrap_or(0),
        executable.map(modified_stamp).unwrap_or(0),
        executable.map(metadata_size).unwrap_or(0),
    )
}


fn get_cached_readiness(
    key: &str,
) -> Option<RenoDxReadinessInfo> {
    let cache =
        RENODX_READINESS_CACHE
            .get_or_init(|| {
                Mutex::new(HashMap::new())
            });

    let guard =
        cache.lock().ok()?;

    let (
        cached_at,
        cached_value,
    ) =
        guard.get(key)?;

    if cached_at.elapsed()
        >= RENODX_READINESS_CACHE_TTL
    {
        return None;
    }

    Some(cached_value.clone())
}


fn store_cached_readiness(
    key: String,
    value: &RenoDxReadinessInfo,
) {
    let cache =
        RENODX_READINESS_CACHE
            .get_or_init(|| {
                Mutex::new(HashMap::new())
            });

    if let Ok(mut guard) =
        cache.lock()
    {
        guard.insert(
            key,
            (
                Instant::now(),
                value.clone(),
            ),
        );

        if guard.len() > 128 {
            guard.retain(
                |_,
                 (
                    cached_at,
                    _,
                 )| {
                    cached_at.elapsed()
                        < RENODX_READINESS_CACHE_TTL
                },
            );
        }
    }
}


#[tauri::command]
pub fn get_renodx_readiness(
    install_path: Option<String>,
    executable_path: Option<String>,
    graphics_api: Option<String>,
    renodx_supported: bool,
    renodx_match_name: Option<String>,
    renodx_provider_status: Option<String>,
) -> Result<RenoDxReadinessInfo, String> {
    let install = normalize_existing_path(install_path);

    let supplied_executable = normalize_existing_path(executable_path);

    let executable =
        choose_executable(
            install.as_deref(),
            supplied_executable,
        );

    let cache_key =
        readiness_cache_key(
            install.as_deref(),
            executable.as_deref(),
            graphics_api.as_deref(),
            renodx_supported,
            renodx_match_name.as_deref(),
            renodx_provider_status.as_deref(),
        );

    if let Some(cached) =
        get_cached_readiness(
            &cache_key
        )
    {
        return Ok(cached);
    }

    let binary_directory = executable
        .as_ref()
        .and_then(|path| path.parent())
        .map(Path::to_path_buf)
        .or_else(|| install.clone());

    let architecture = executable
        .as_deref()
        .map(detect_pe_architecture)
        .unwrap_or_else(|| "unknown".to_string());

    let mut reshade_loader = None;
    let mut reshade_ini = None;
    let mut reshade_log = None;
    let mut renodx_files = Vec::new();
    let mut other_addon_files = Vec::new();
    let mut conflicts = Vec::new();

    let proxy_names = [
        "dxgi.dll",
        "d3d11.dll",
        "d3d12.dll",
        "d3d9.dll",
        "opengl32.dll",
        "dinput8.dll",
    ];

    if let Some(directory) = binary_directory.as_deref() {
        let ini = directory.join("ReShade.ini");

        if ini.is_file() {
            reshade_ini = Some(ini.to_string_lossy().to_string());
        }

        let log = directory.join("ReShade.log");

        if log.is_file() {
            reshade_log = Some(log.to_string_lossy().to_string());
        }

        for proxy_name in proxy_names {
            let proxy = directory.join(proxy_name);

            if !proxy.is_file() {
                continue;
            }

            if reshade_loader.is_none()
                && (reshade_ini.is_some()
                    || reshade_log.is_some()
                    || directory.join("reshade-shaders").exists())
            {
                reshade_loader = Some(proxy.to_string_lossy().to_string());
            } else if reshade_loader.is_none() {
                conflicts.push(file_record(&proxy, "proxy-dll"));
            }
        }

        if let Ok(entries) = fs::read_dir(directory) {
            for entry in entries.flatten() {
                let path = entry.path();

                if !path.is_file() {
                    continue;
                }

                let name = lower_file_name(&path);

                let addon = name.ends_with(".addon64")
                    || name.ends_with(".addon32")
                    || name.ends_with(".addon");

                if !addon {
                    continue;
                }

                if name.contains("renodx") || name.contains("reno_dx") || name.contains("reno-dx") {
                    renodx_files.push(file_record(&path, "renodx-addon"));
                } else {
                    other_addon_files.push(file_record(&path, "reshade-addon"));
                }
            }
        }
    }

    let reshade_state =
        if reshade_loader.is_some() && (reshade_ini.is_some() || reshade_log.is_some()) {
            "installed".to_string()
        } else if reshade_ini.is_some() || reshade_log.is_some() {
            "partial".to_string()
        } else {
            "not-installed".to_string()
        };

    let addon_support_state = if reshade_state == "not-installed" {
        "not-installed".to_string()
    } else {
        let has_addon_files =
            !other_addon_files.is_empty()
            || !renodx_files.is_empty();

        let confirms_addons =
            if has_addon_files {
                true
            } else {
                let log_text =
                    reshade_log
                        .as_deref()
                        .map(Path::new)
                        .map(read_small_text)
                        .unwrap_or_default()
                        .to_ascii_lowercase();

                log_text.contains("add-on")
                    || log_text.contains("addon")
            };

        if confirms_addons {
            "confirmed".to_string()
        } else {
            "unknown".to_string()
        }
    };

    let renodx_state = if !renodx_files.is_empty() {
        "installed".to_string()
    } else {
        "not-installed".to_string()
    };

    let support_status = renodx_provider_status.unwrap_or_else(|| {
        if renodx_supported {
            "supported".to_string()
        } else {
            "not-supported".to_string()
        }
    });

    let (readiness, next_action) = if !renodx_supported {
        (
            "unsupported",
            "No RenoDX package is currently reported for this game.",
        )
    } else if binary_directory.is_none() {
        (
            "needs-game-path",
            "Resolve the Windows game executable before installing ReShade or RenoDX.",
        )
    } else if reshade_state == "not-installed" {
        (
            "needs-reshade",
            "Install ReShade with add-on support first.",
        )
    } else if reshade_state == "partial" {
        (
            "reshade-needs-attention",
            "Review the existing ReShade files before continuing.",
        )
    } else if addon_support_state != "confirmed" {
        (
                "verify-addon-support",
                "ReShade is installed. Add-on support will be confirmed when an add-on is present or ReShade.log reports add-on loading.",
            )
    } else if renodx_state == "installed" {
        ("installed", "RenoDX is detected.")
    } else {
        (
            "ready-for-renodx",
            "ReShade is ready. RenoDX can be installed next.",
        )
    };

    let result =
        RenoDxReadinessInfo {
        supported: renodx_supported,
        support_name: renodx_match_name,
        support_status,
        install_path: install.map(|path| path.to_string_lossy().to_string()),
        executable_path: executable
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        binary_directory: binary_directory.map(|path| path.to_string_lossy().to_string()),
        architecture,
        graphics_api,
        reshade_state,
        reshade_loader,
        reshade_ini,
        reshade_log,
        addon_support_state,
        renodx_state,
        renodx_files,
        other_addon_files,
        conflicts,
        readiness: readiness.to_string(),
        next_action: next_action.to_string(),
    };

    store_cached_readiness(
        cache_key,
        &result,
    );

    Ok(result)
}
