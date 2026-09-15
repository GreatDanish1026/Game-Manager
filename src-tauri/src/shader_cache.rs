use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
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

#[cfg(target_os = "windows")]
fn directory_stats(path: &Path) -> (u64, u64) {
    if !path.exists() {
        return (0, 0);
    }

    let mut bytes = 0_u64;

    let mut files = 0_u64;

    let mut stack = vec![path.to_path_buf()];

    while let Some(current) = stack.pop() {
        let Ok(entries) = fs::read_dir(&current) else {
            continue;
        };

        for entry in entries.flatten() {
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

#[cfg(target_os = "windows")]
fn normalize_path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

#[cfg(target_os = "windows")]
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

    ShaderCacheTarget {
        id: id.into(),

        name: name.into(),

        path: normalize_path_string(&path),

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

#[cfg(target_os = "windows")]
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

#[cfg(target_os = "windows")]
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

                let key = canonical.to_string_lossy().to_ascii_lowercase();

                if seen.insert(key) {
                    let id = format!("game-local-{}", found.len());

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

#[cfg(target_os = "windows")]
fn clear_directory_contents(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(path).map_err(|error| format!("{}: {}", path.display(), error))?;

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;

        let entry_path = entry.path();

        let metadata = entry.metadata().map_err(|error| error.to_string())?;

        let result = if metadata.is_dir() {
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

fn build_shader_cache_report(install_path: Option<String>) -> ShaderCacheReport {
    #[cfg(target_os = "windows")]
    {
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

    #[cfg(not(target_os = "windows"))]
    {
        let _ = install_path;

        ShaderCacheReport {
            supported: false,

            targets: Vec::new(),

            total_size_bytes: 0,

            total_file_count: 0,

            warning: "Shader Cache Management is currently available on Windows.".to_string(),
        }
    }
}

#[tauri::command]
pub async fn get_shader_cache_report(
    install_path: Option<String>,
) -> Result<ShaderCacheReport, String> {
    tauri::async_runtime::spawn_blocking(move || build_shader_cache_report(install_path))
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

            match clear_directory_contents(&path) {
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

    #[cfg(not(target_os = "windows"))]
    {
        let _ = selection;

        ShaderCacheClearResult {
            success: false,

            cleared_targets: Vec::new(),

            failed_targets: vec![
                "Shader Cache Management is currently available only on Windows.".to_string(),
            ],

            bytes_reclaimed: 0,

            message: "Shader caches were not changed.".to_string(),
        }
    }
}
