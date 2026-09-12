use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::Serialize;

const MAX_DIRECTORY_DEPTH: usize = 5;

const MAX_DIRECTORIES_VISITED: usize = 5000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameUtilityDirectories {
    pub log_directory: Option<String>,
    pub crash_directory: Option<String>,
    pub shader_cache_directory: Option<String>,
    pub directories_visited: usize,
    pub scan_truncated: bool,
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn normalized_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase()
}

fn is_log_directory(name: &str) -> bool {
    matches!(name, "log" | "logs" | "logging")
}

fn is_crash_directory(name: &str) -> bool {
    matches!(
        name,
        "crash"
            | "crashes"
            | "crashdump"
            | "crashdumps"
            | "crash_reports"
            | "crashreports"
            | "reports"
    )
}

fn is_shader_cache_directory(name: &str) -> bool {
    matches!(
        name,
        "shadercache"
            | "shader_cache"
            | "shaderscache"
            | "shaders_cache"
            | "pipelinecache"
            | "pipeline_cache"
            | "cache"
    )
}

#[tauri::command]
pub fn inspect_game_utility_directories(
    install_path: String,
) -> Result<GameUtilityDirectories, String> {
    let root = PathBuf::from(install_path.trim().trim_matches('"'));

    if !root.exists() {
        return Err(format!(
            "The install path does not exist: {}",
            root.display()
        ));
    }

    if !root.is_dir() {
        return Err("The install path is not a directory.".to_string());
    }

    let mut stack = vec![(root.clone(), 0usize)];

    let mut visited = 0usize;

    let mut truncated = false;

    let mut log_directory: Option<PathBuf> = None;

    let mut crash_directory: Option<PathBuf> = None;

    let mut shader_cache_directory: Option<PathBuf> = None;

    while let Some((directory, depth)) = stack.pop() {
        if depth > MAX_DIRECTORY_DEPTH {
            continue;
        }

        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,

            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,

                Err(_) => continue,
            };

            if !file_type.is_dir() {
                continue;
            }

            visited += 1;

            if visited >= MAX_DIRECTORIES_VISITED {
                truncated = true;

                break;
            }

            let path = entry.path();

            let name = normalized_name(&path);

            if log_directory.is_none() && is_log_directory(&name) {
                log_directory = Some(path.clone());
            }

            if crash_directory.is_none() && is_crash_directory(&name) {
                crash_directory = Some(path.clone());
            }

            if shader_cache_directory.is_none() && is_shader_cache_directory(&name) {
                shader_cache_directory = Some(path.clone());
            }

            if depth < MAX_DIRECTORY_DEPTH {
                stack.push((path, depth + 1));
            }

            if log_directory.is_some()
                && crash_directory.is_some()
                && shader_cache_directory.is_some()
            {
                break;
            }
        }

        if truncated
            || (log_directory.is_some()
                && crash_directory.is_some()
                && shader_cache_directory.is_some())
        {
            break;
        }
    }

    Ok(GameUtilityDirectories {
        log_directory: log_directory.as_deref().map(path_string),

        crash_directory: crash_directory.as_deref().map(path_string),

        shader_cache_directory: shader_cache_directory.as_deref().map(path_string),

        directories_visited: visited,

        scan_truncated: truncated,
    })
}
