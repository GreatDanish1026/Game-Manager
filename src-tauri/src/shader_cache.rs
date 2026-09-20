use serde::{Deserialize, Serialize};

#[cfg(any(target_os = "windows", target_os = "linux"))]
use std::{
    collections::BTreeSet,
    env, fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShaderCacheTarget {
    pub id: String,
    pub name: String,
    pub path: String,
    pub open_path: String,
    pub scope: String,
    pub vendor: Option<String>,
    pub exists: bool,
    pub size_bytes: u64,
    pub file_count: u64,
    pub selected_by_default: bool,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShaderCacheReport {
    pub supported: bool,
    pub targets: Vec<ShaderCacheTarget>,
    pub total_size_bytes: u64,
    pub total_file_count: u64,
    pub warning: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShaderCacheSelection {
    pub ids: Vec<String>,
    pub install_path: Option<String>,
    pub launcher_id: Option<String>,
    pub steam_library_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShaderCacheClearResult {
    pub success: bool,
    pub cleared_targets: Vec<String>,
    pub failed_targets: Vec<String>,
    pub bytes_reclaimed: u64,
    pub message: String,
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn directory_stats(path: &Path) -> (u64, u64) {
    if !path.exists() {
        return (0, 0);
    }

    if path.is_file() {
        return fs::metadata(path)
            .map(|metadata| (metadata.len(), 1))
            .unwrap_or((0, 0));
    }

    let mut bytes = 0_u64;

    let mut files = 0_u64;

    let mut stack = vec![path.to_path_buf()];

    while let Some(current) = stack.pop() {
        let Ok(entries) = fs::read_dir(&current) else {
            continue;
        };

        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };

            if file_type.is_symlink() {
                continue;
            }

            let Ok(metadata) = entry.metadata() else {
                continue;
            };

            if metadata.is_dir() {
                stack.push(entry.path());
            } else if metadata.is_file() {
                files = files.saturating_add(1);

                bytes = bytes.saturating_add(metadata.len());
            }
        }
    }

    (bytes, files)
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn normalize_path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn make_target(
    id: impl Into<String>,
    name: impl Into<String>,
    path: PathBuf,
    scope: impl Into<String>,
    vendor: Option<&str>,
    selected_by_default: bool,
    note: impl Into<String>,
) -> ShaderCacheTarget {
    let (size_bytes, file_count) = directory_stats(&path);
    let open_path = if path.is_file() {
        path.parent().unwrap_or(&path)
    } else {
        &path
    };

    ShaderCacheTarget {
        id: id.into(),

        name: name.into(),

        path: normalize_path_string(&path),

        open_path: normalize_path_string(open_path),

        scope: scope.into(),

        vendor: vendor.map(str::to_string),

        exists: path.exists(),

        size_bytes,

        file_count,

        selected_by_default,

        note: note.into(),
    }
}

#[cfg(target_os = "windows")]
fn global_targets() -> Vec<ShaderCacheTarget> {
    let Some(local_app_data) = env::var_os("LOCALAPPDATA").map(PathBuf::from) else {
        return Vec::new();
    };

    vec![
        make_target(
            "windows-d3ds-cache",
            "DirectX Shader Cache",
            local_app_data.join("D3DSCache"),
            "System",
            Some("Windows"),
            false,
            "Windows Direct3D shader cache. Clearing it affects more than one game.",
        ),
        make_target(
            "nvidia-dx-cache",
            "NVIDIA DXCache",
            local_app_data.join("NVIDIA").join("DXCache"),
            "System",
            Some("NVIDIA"),
            false,
            "NVIDIA DirectX shader cache shared across games.",
        ),
        make_target(
            "nvidia-gl-cache",
            "NVIDIA GLCache",
            local_app_data.join("NVIDIA").join("GLCache"),
            "System",
            Some("NVIDIA"),
            false,
            "NVIDIA OpenGL shader cache shared across games.",
        ),
        make_target(
            "nvidia-nv-cache",
            "NVIDIA NV_Cache",
            local_app_data.join("NVIDIA Corporation").join("NV_Cache"),
            "System",
            Some("NVIDIA"),
            false,
            "Legacy/shared NVIDIA shader-cache location.",
        ),
        make_target(
            "amd-dx-cache",
            "AMD DxCache",
            local_app_data.join("AMD").join("DxCache"),
            "System",
            Some("AMD"),
            false,
            "AMD DirectX shader cache shared across games.",
        ),
        make_target(
            "amd-vk-cache",
            "AMD VkCache",
            local_app_data.join("AMD").join("VkCache"),
            "System",
            Some("AMD"),
            false,
            "AMD Vulkan shader cache shared across games.",
        ),
    ]
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn looks_like_shader_cache_name(name: &str) -> bool {
    let normalized = name.trim().to_ascii_lowercase();

    matches!(
        normalized.as_str(),
        "shadercache"
            | "shader_cache"
            | "shader-cache"
            | "shadercaches"
            | "shaderscache"
            | "pipelinecache"
            | "pipeline_cache"
            | "pipeline-cache"
            | "psocache"
            | "pso_cache"
            | "deriveddatacache"
    )
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn game_local_targets(install_path: Option<&str>) -> Vec<ShaderCacheTarget> {
    let Some(install_path) = install_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Vec::new();
    };

    let root = PathBuf::from(install_path);

    if !root.exists() || !root.is_dir() {
        return Vec::new();
    }

    let root = root.canonicalize().unwrap_or(root);

    let mut found = Vec::new();

    let mut seen = BTreeSet::new();

    let mut queue = vec![(root.clone(), 0_u8)];

    while let Some((current, depth)) = queue.pop() {
        if depth > 3 {
            continue;
        }

        let Ok(entries) = fs::read_dir(&current) else {
            continue;
        };

        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };

            if file_type.is_symlink() {
                continue;
            }

            let Ok(metadata) = entry.metadata() else {
                continue;
            };

            if !metadata.is_dir() {
                continue;
            }

            let path = entry.path();

            let file_name = entry.file_name().to_string_lossy().to_string();

            if looks_like_shader_cache_name(&file_name) {
                let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());

                if !canonical.starts_with(&root) {
                    continue;
                }

                let key = canonical.to_string_lossy().to_ascii_lowercase();

                if seen.insert(key) {
                    let id = format!("game-local:{}", canonical.to_string_lossy());

                    found.push(
                        make_target(
                            id,
                            format!(
                                "Game-local {}",
                                file_name
                            ),
                            canonical,
                            "Game",
                            None,
                            true,
                            "Clearly named shader/pipeline cache inside the game install. Selected by default because it is game-local.",
                        )
                    );
                }

                continue;
            }

            if depth < 3 {
                queue.push((path, depth + 1));
            }
        }
    }

    found
}

#[cfg(target_os = "windows")]
fn resolve_targets(install_path: Option<&str>) -> Vec<ShaderCacheTarget> {
    let mut targets = global_targets();

    targets.extend(game_local_targets(install_path));

    targets.into_iter().filter(|target| target.exists).collect()
}

#[cfg(target_os = "linux")]
fn cache_home() -> Option<PathBuf> {
    env::var_os("XDG_CACHE_HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .or_else(|| {
            env::var_os("HOME")
                .map(PathBuf::from)
                .map(|home| home.join(".cache"))
        })
}

#[cfg(target_os = "linux")]
fn linux_global_targets() -> Vec<ShaderCacheTarget> {
    let Some(cache) = cache_home() else {
        return Vec::new();
    };

    vec![
        make_target(
            "mesa-shader-cache",
            "Mesa Shader Cache",
            cache.join("mesa_shader_cache"),
            "System",
            Some("Mesa"),
            false,
            "Shared Mesa shader cache used by AMD, Intel, and other Mesa drivers.",
        ),
        make_target(
            "mesa-shader-cache-sf",
            "Mesa Single-file Shader Cache",
            cache.join("mesa_shader_cache_sf"),
            "System",
            Some("Mesa"),
            false,
            "Shared Mesa single-file shader cache. Clearing it affects more than one game.",
        ),
        make_target(
            "mesa-shader-cache-db",
            "Mesa Database Shader Cache",
            cache.join("mesa_shader_cache_db"),
            "System",
            Some("Mesa"),
            false,
            "Shared Mesa database shader cache. Clearing it affects more than one game.",
        ),
        make_target(
            "nvidia-gl-cache",
            "NVIDIA GLCache",
            cache.join("nvidia").join("GLCache"),
            "System",
            Some("NVIDIA"),
            false,
            "Shared NVIDIA OpenGL and Vulkan shader cache.",
        ),
        make_target(
            "nvidia-compute-cache",
            "NVIDIA Compute Cache",
            cache.join("nvidia").join("ComputeCache"),
            "System",
            Some("NVIDIA"),
            false,
            "Shared NVIDIA compiled-kernel cache. Clear only while troubleshooting a driver or cache problem.",
        ),
        make_target(
            "amd-vk-cache",
            "AMD Vulkan Cache",
            cache.join("AMD").join("VkCache"),
            "System",
            Some("AMDVLK"),
            false,
            "Shared AMDVLK shader cache. Mesa RADV normally uses the Mesa cache instead.",
        ),
    ]
}

#[cfg(target_os = "linux")]
fn steamapps_path(install_path: Option<&str>, steam_library_path: Option<&str>) -> Option<PathBuf> {
    if let Some(library) = steam_library_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
    {
        if library.file_name().and_then(|name| name.to_str()) == Some("steamapps")
            && library.is_dir()
        {
            return Some(library);
        }

        let steamapps = library.join("steamapps");

        if steamapps.is_dir() {
            return Some(steamapps);
        }
    }

    let install = install_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)?;

    install.ancestors().find_map(|ancestor| {
        (ancestor.file_name().and_then(|name| name.to_str()) == Some("common"))
            .then(|| ancestor.parent())
            .flatten()
            .filter(|parent| parent.file_name().and_then(|name| name.to_str()) == Some("steamapps"))
            .map(Path::to_path_buf)
    })
}

#[cfg(target_os = "linux")]
fn steam_game_target(
    install_path: Option<&str>,
    launcher_id: Option<&str>,
    steam_library_path: Option<&str>,
) -> Option<ShaderCacheTarget> {
    let app_id = launcher_id.map(str::trim).filter(|value| {
        !value.is_empty() && value.chars().all(|character| character.is_ascii_digit())
    })?;
    let steamapps = steamapps_path(install_path, steam_library_path)?;
    let path = steamapps.join("shadercache").join(app_id);

    path.is_dir().then(|| {
        make_target(
            format!("steam-game-{app_id}"),
            "Steam per-game shader cache",
            path,
            "Game",
            Some("Steam"),
            true,
            "Steam's shader pre-cache and pipeline data for this game. Steam may download or rebuild it again.",
        )
    })
}

#[cfg(target_os = "linux")]
fn dxvk_state_cache_targets(install_path: Option<&str>) -> Vec<ShaderCacheTarget> {
    let Some(root) = install_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
    else {
        return Vec::new();
    };
    let root = root.canonicalize().unwrap_or(root);
    let mut found = Vec::new();
    let mut queue = vec![(root.clone(), 0_u8)];

    while let Some((current, depth)) = queue.pop() {
        let Ok(entries) = fs::read_dir(&current) else {
            continue;
        };

        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };

            if file_type.is_symlink() {
                continue;
            }

            let path = entry.path();

            if file_type.is_dir() && depth < 2 {
                queue.push((path, depth + 1));
                continue;
            }

            if !file_type.is_file() {
                continue;
            }

            let is_dxvk_cache = entry
                .file_name()
                .to_string_lossy()
                .to_ascii_lowercase()
                .ends_with(".dxvk-cache");

            if !is_dxvk_cache {
                continue;
            }

            let canonical = path.canonicalize().unwrap_or(path);

            if !canonical.starts_with(&root) {
                continue;
            }

            found.push(make_target(
                format!("game-dxvk:{}", canonical.to_string_lossy()),
                format!(
                    "DXVK state cache — {}",
                    canonical
                        .file_name()
                        .map(|name| name.to_string_lossy())
                        .unwrap_or_default()
                ),
                canonical,
                "Game",
                Some("DXVK"),
                true,
                "Game-local DXVK state cache. It will be recreated as pipelines are encountered.",
            ));
        }
    }

    found
}

#[cfg(target_os = "linux")]
fn resolve_linux_targets(
    install_path: Option<&str>,
    launcher_id: Option<&str>,
    steam_library_path: Option<&str>,
) -> Vec<ShaderCacheTarget> {
    let mut targets = linux_global_targets();

    if let Some(target) = steam_game_target(install_path, launcher_id, steam_library_path) {
        targets.push(target);
    }

    targets.extend(game_local_targets(install_path));
    targets.extend(dxvk_state_cache_targets(install_path));
    targets.retain(|target| {
        target.exists
            && !fs::symlink_metadata(&target.path)
                .map(|metadata| metadata.file_type().is_symlink())
                .unwrap_or(true)
    });
    targets
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn clear_directory_contents(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(path).map_err(|error| format!("{}: {}", path.display(), error))?;

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;

        let entry_path = entry.path();

        let file_type = entry.file_type().map_err(|error| error.to_string())?;

        let result = if file_type.is_symlink() {
            fs::remove_file(&entry_path)
        } else if file_type.is_dir() {
            fs::remove_dir_all(&entry_path)
        } else {
            fs::remove_file(&entry_path)
        };

        if let Err(error) = result {
            return Err(format!("{}: {}", entry_path.display(), error));
        }
    }

    Ok(())
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn clear_target(path: &Path) -> Result<(), String> {
    if fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Err(format!(
            "{} became a symbolic link and was left untouched",
            path.display()
        ));
    }

    if path.is_file() {
        return fs::remove_file(path).map_err(|error| format!("{}: {error}", path.display()));
    }

    clear_directory_contents(path)
}

#[cfg(all(test, target_os = "linux"))]
mod linux_tests {
    use super::{looks_like_shader_cache_name, steamapps_path};
    use std::path::PathBuf;

    #[test]
    fn derives_steamapps_from_a_standard_game_install_path() {
        let path = steamapps_path(
            Some("/games/SteamLibrary/steamapps/common/Example Game"),
            None,
        );

        assert_eq!(path, Some(PathBuf::from("/games/SteamLibrary/steamapps")));
    }

    #[test]
    fn recognizes_only_explicit_shader_cache_directory_names() {
        assert!(looks_like_shader_cache_name("PipelineCache"));
        assert!(looks_like_shader_cache_name("shader_cache"));
        assert!(!looks_like_shader_cache_name("Cache"));
        assert!(!looks_like_shader_cache_name("Saved"));
    }
}

fn build_shader_cache_report(
    install_path: Option<String>,
    launcher_id: Option<String>,
    steam_library_path: Option<String>,
) -> ShaderCacheReport {
    #[cfg(target_os = "windows")]
    {
        let _ = (&launcher_id, &steam_library_path);
        let targets = resolve_targets(install_path.as_deref());

        let total_size_bytes = targets.iter().map(|target| target.size_bytes).sum();

        let total_file_count = targets.iter().map(|target| target.file_count).sum();

        return ShaderCacheReport {
            supported:
                true,

            targets,

            total_size_bytes,

            total_file_count,

            warning:
                "Clearing shader caches can temporarily increase stutter on the next launch while shaders are rebuilt."
                    .to_string(),
        };
    }

    #[cfg(target_os = "linux")]
    {
        let targets = resolve_linux_targets(
            install_path.as_deref(),
            launcher_id.as_deref(),
            steam_library_path.as_deref(),
        );
        let total_size_bytes = targets.iter().map(|target| target.size_bytes).sum();
        let total_file_count = targets.iter().map(|target| target.file_count).sum();

        return ShaderCacheReport {
            supported: true,
            targets,
            total_size_bytes,
            total_file_count,
            warning: "Fully exit the game before clearing its caches. The next launch may stutter while pipelines are rebuilt, and Steam may download shader data again."
                .to_string(),
        };
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = (install_path, launcher_id, steam_library_path);

        ShaderCacheReport {
            supported: false,

            targets: Vec::new(),

            total_size_bytes: 0,

            total_file_count: 0,

            warning: "Shader Cache Management is currently available on Windows and Linux."
                .to_string(),
        }
    }
}

#[tauri::command]
pub async fn get_shader_cache_report(
    install_path: Option<String>,
    launcher_id: Option<String>,
    steam_library_path: Option<String>,
) -> Result<ShaderCacheReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        build_shader_cache_report(install_path, launcher_id, steam_library_path)
    })
    .await
    .map_err(|error| format!("Shader cache worker failed: {error}"))
}

#[tauri::command]
pub fn clear_shader_cache_targets(selection: ShaderCacheSelection) -> ShaderCacheClearResult {
    #[cfg(target_os = "windows")]
    {
        let allowed = resolve_targets(selection.install_path.as_deref());

        let selected = selection.ids.into_iter().collect::<BTreeSet<_>>();

        let mut cleared_targets = Vec::new();

        let mut failed_targets = Vec::new();

        let mut bytes_reclaimed = 0_u64;

        for target in allowed {
            if !selected.contains(&target.id) {
                continue;
            }

            let path = PathBuf::from(&target.path);

            match clear_target(&path) {
                Ok(()) => {
                    cleared_targets.push(target.name.clone());

                    bytes_reclaimed = bytes_reclaimed.saturating_add(target.size_bytes);
                }

                Err(error) => {
                    failed_targets.push(format!("{} — {}", target.name, error));
                }
            }
        }

        let success = failed_targets.is_empty();

        let message = if cleared_targets.is_empty() && failed_targets.is_empty() {
            "No shader-cache targets were selected.".to_string()
        } else if failed_targets.is_empty() {
            format!(
                "Cleared {} shader-cache target{}.",
                cleared_targets.len(),
                if cleared_targets.len() == 1 { "" } else { "s" }
            )
        } else {
            format!(
                "Cleared {} target{}; {} target{} could not be fully cleared.",
                cleared_targets.len(),
                if cleared_targets.len() == 1 { "" } else { "s" },
                failed_targets.len(),
                if failed_targets.len() == 1 { "" } else { "s" }
            )
        };

        return ShaderCacheClearResult {
            success,

            cleared_targets,

            failed_targets,

            bytes_reclaimed,

            message,
        };
    }

    #[cfg(target_os = "linux")]
    {
        let allowed = resolve_linux_targets(
            selection.install_path.as_deref(),
            selection.launcher_id.as_deref(),
            selection.steam_library_path.as_deref(),
        );
        let selected = selection.ids.into_iter().collect::<BTreeSet<_>>();
        let mut cleared_targets = Vec::new();
        let mut failed_targets = Vec::new();
        let mut bytes_reclaimed = 0_u64;

        for target in allowed {
            if !selected.contains(&target.id) {
                continue;
            }

            let path = PathBuf::from(&target.path);

            match clear_target(&path) {
                Ok(()) => {
                    cleared_targets.push(target.name);
                    bytes_reclaimed = bytes_reclaimed.saturating_add(target.size_bytes);
                }
                Err(error) => {
                    failed_targets.push(format!("{} — {error}", target.name));
                }
            }
        }

        let success = failed_targets.is_empty();
        let message = if cleared_targets.is_empty() && failed_targets.is_empty() {
            "No shader-cache targets were selected.".to_string()
        } else if failed_targets.is_empty() {
            format!(
                "Cleared {} shader-cache target{}.",
                cleared_targets.len(),
                if cleared_targets.len() == 1 { "" } else { "s" }
            )
        } else {
            format!(
                "Cleared {} target{}; {} target{} could not be fully cleared.",
                cleared_targets.len(),
                if cleared_targets.len() == 1 { "" } else { "s" },
                failed_targets.len(),
                if failed_targets.len() == 1 { "" } else { "s" }
            )
        };

        return ShaderCacheClearResult {
            success,
            cleared_targets,
            failed_targets,
            bytes_reclaimed,
            message,
        };
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = selection;

        ShaderCacheClearResult {
            success: false,

            cleared_targets: Vec::new(),

            failed_targets: vec![
                "Shader Cache Management is currently available only on Windows and Linux."
                    .to_string(),
            ],

            bytes_reclaimed: 0,

            message: "Shader caches were not changed.".to_string(),
        }
    }
}
