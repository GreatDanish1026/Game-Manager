use serde::Serialize;
use std::{
    env, fs, io,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "linux")]
use std::os::unix::fs as unix_fs;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrefixHealth {
    pub supported: bool,
    pub prefix_path: String,
    pub exists: bool,
    pub drive_c_exists: bool,
    pub user_registry_exists: bool,
    pub system_registry_exists: bool,
    pub userdef_registry_exists: bool,
    pub size_bytes: u64,
    pub modified_unix: Option<u64>,
    pub architecture: Option<String>,
    pub health: String,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrefixBackup {
    pub id: String,
    pub path: String,
    pub created_unix: Option<u64>,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrefixMaintenanceInfo {
    pub health: PrefixHealth,
    pub backups: Vec<PrefixBackup>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrefixActionResult {
    pub action: String,
    pub message: String,
    pub backup_path: Option<String>,
    pub safety_backup_path: Option<String>,
}

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "HOME is not available.".to_string())
}

fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0)
}

fn safe_name(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();

    if cleaned.is_empty() {
        "game".to_string()
    } else {
        cleaned
    }
}

fn backup_root(game_key: &str) -> Result<PathBuf, String> {
    Ok(home_dir()?
        .join(".local/share/GameAtlas/prefix-backups")
        .join(safe_name(game_key)))
}

fn metadata_modified_unix(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_secs())
}

fn directory_size(path: &Path) -> u64 {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return 0;
    };

    if metadata.file_type().is_symlink() {
        return 0;
    }

    if metadata.is_file() {
        return metadata.len();
    }

    if !metadata.is_dir() {
        return 0;
    }

    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };

    entries
        .flatten()
        .map(|entry| directory_size(&entry.path()))
        .sum()
}

fn detect_architecture(prefix: &Path) -> Option<String> {
    let system32 = prefix.join("drive_c/windows/system32");
    let syswow64 = prefix.join("drive_c/windows/syswow64");

    if syswow64.exists() {
        Some("win64".to_string())
    } else if system32.exists() {
        Some("win32".to_string())
    } else {
        None
    }
}

fn inspect_prefix(prefix_path: &str) -> PrefixHealth {
    let prefix = Path::new(prefix_path);
    let exists = prefix.exists();

    let drive_c_exists = prefix.join("drive_c").is_dir();
    let user_registry_exists = prefix.join("user.reg").is_file();
    let system_registry_exists = prefix.join("system.reg").is_file();
    let userdef_registry_exists = prefix.join("userdef.reg").is_file();

    let mut issues = Vec::new();

    if !exists {
        issues.push("Prefix directory does not exist.".to_string());
    } else {
        if !drive_c_exists {
            issues.push("drive_c is missing.".to_string());
        }

        if !user_registry_exists {
            issues.push("user.reg is missing.".to_string());
        }

        if !system_registry_exists {
            issues.push("system.reg is missing.".to_string());
        }

        if !userdef_registry_exists {
            issues.push("userdef.reg is missing.".to_string());
        }
    }

    let health = if !exists {
        "missing"
    } else if issues.is_empty() {
        "healthy"
    } else if drive_c_exists && system_registry_exists {
        "warning"
    } else {
        "damaged"
    }
    .to_string();

    PrefixHealth {
        supported: cfg!(target_os = "linux"),
        prefix_path: prefix_path.to_string(),
        exists,
        drive_c_exists,
        user_registry_exists,
        system_registry_exists,
        userdef_registry_exists,
        size_bytes: if exists { directory_size(prefix) } else { 0 },
        modified_unix: metadata_modified_unix(prefix),
        architecture: detect_architecture(prefix),
        health,
        issues,
    }
}

fn copy_symlink(source: &Path, destination: &Path) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let target = fs::read_link(source)
            .map_err(|error| format!("Failed to read symlink {}: {}", source.display(), error))?;

        unix_fs::symlink(&target, destination).map_err(|error| {
            format!(
                "Failed to copy symlink {} -> {}: {}",
                destination.display(),
                target.display(),
                error
            )
        })?;

        Ok(())
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (source, destination);

        Err("Prefix backups are supported on Linux.".to_string())
    }
}

fn copy_tree(source: &Path, destination: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(source)
        .map_err(|error| format!("Failed to inspect {}: {}", source.display(), error))?;

    if metadata.file_type().is_symlink() {
        return copy_symlink(source, destination);
    }

    if metadata.is_file() {
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create {}: {}", parent.display(), error))?;
        }

        fs::copy(source, destination).map_err(|error| {
            format!(
                "Failed to copy {} to {}: {}",
                source.display(),
                destination.display(),
                error
            )
        })?;

        return Ok(());
    }

    if metadata.is_dir() {
        fs::create_dir_all(destination)
            .map_err(|error| format!("Failed to create {}: {}", destination.display(), error))?;

        for entry in fs::read_dir(source)
            .map_err(|error| format!("Failed to read {}: {}", source.display(), error))?
        {
            let entry = entry.map_err(|error| error.to_string())?;

            copy_tree(&entry.path(), &destination.join(entry.file_name()))?;
        }

        return Ok(());
    }

    Err(format!(
        "Unsupported filesystem object: {}",
        source.display()
    ))
}

fn remove_path(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Failed to inspect {}: {}", path.display(), error))?;

    if metadata.file_type().is_symlink() || metadata.is_file() {
        fs::remove_file(path)
            .map_err(|error| format!("Failed to remove {}: {}", path.display(), error))
    } else if metadata.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|error| format!("Failed to remove {}: {}", path.display(), error))
    } else {
        Err(format!("Unsupported path type: {}", path.display()))
    }
}

fn create_backup_internal(
    prefix_path: &str,
    game_key: &str,
    label: &str,
) -> Result<PathBuf, String> {
    let prefix = Path::new(prefix_path);

    if !prefix.is_dir() {
        return Err(format!(
            "Prefix directory does not exist: {}",
            prefix.display()
        ));
    }

    let root = backup_root(game_key)?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create {}: {}", root.display(), error))?;

    let id = format!("{}-{}", timestamp(), safe_name(label));

    let destination = root.join(&id);

    copy_tree(prefix, &destination)?;

    Ok(destination)
}

fn list_backups(game_key: &str) -> Vec<PrefixBackup> {
    let Ok(root) = backup_root(game_key) else {
        return Vec::new();
    };

    let Ok(entries) = fs::read_dir(root) else {
        return Vec::new();
    };

    let mut backups = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();

            if !path.is_dir() {
                return None;
            }

            Some(PrefixBackup {
                id: entry.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                created_unix: metadata_modified_unix(&path),
                size_bytes: directory_size(&path),
            })
        })
        .collect::<Vec<_>>();

    backups.sort_by(|left, right| {
        right
            .created_unix
            .cmp(&left.created_unix)
            .then_with(|| right.id.cmp(&left.id))
    });

    backups
}

fn ensure_confirmation(actual: &str, expected: &str) -> Result<(), String> {
    if actual.trim() == expected {
        Ok(())
    } else {
        Err(format!("Confirmation text must be exactly '{}'.", expected))
    }
}

#[tauri::command]
pub fn get_prefix_maintenance_info(
    prefix_path: String,
    game_key: String,
) -> Result<PrefixMaintenanceInfo, String> {
    if !cfg!(target_os = "linux") {
        return Err("Prefix maintenance is available on Linux.".to_string());
    }

    Ok(PrefixMaintenanceInfo {
        health: inspect_prefix(&prefix_path),
        backups: list_backups(&game_key),
    })
}

#[tauri::command]
pub fn create_prefix_backup(
    prefix_path: String,
    game_key: String,
) -> Result<PrefixActionResult, String> {
    if !cfg!(target_os = "linux") {
        return Err("Prefix maintenance is available on Linux.".to_string());
    }

    let backup = create_backup_internal(&prefix_path, &game_key, "manual")?;

    Ok(PrefixActionResult {
        action: "backup".to_string(),
        message: "Prefix backup completed.".to_string(),
        backup_path: Some(backup.to_string_lossy().to_string()),
        safety_backup_path: None,
    })
}

#[tauri::command]
pub fn restore_prefix_backup(
    prefix_path: String,
    game_key: String,
    backup_path: String,
    confirmation: String,
) -> Result<PrefixActionResult, String> {
    if !cfg!(target_os = "linux") {
        return Err("Prefix maintenance is available on Linux.".to_string());
    }

    ensure_confirmation(&confirmation, "RESTORE")?;

    let prefix = Path::new(&prefix_path);
    let source = Path::new(&backup_path);
    let root = backup_root(&game_key)?;

    let canonical_root = fs::canonicalize(&root)
        .map_err(|error| format!("Failed to resolve backup root: {}", error))?;

    let canonical_source =
        fs::canonicalize(source).map_err(|error| format!("Backup does not exist: {}", error))?;

    if !canonical_source.starts_with(&canonical_root) {
        return Err("Selected backup is outside GameAtlas's backup directory.".to_string());
    }

    let safety = if prefix.exists() {
        Some(create_backup_internal(
            &prefix_path,
            &game_key,
            "pre-restore-safety",
        )?)
    } else {
        None
    };

    remove_path(prefix)?;

    if let Some(parent) = prefix.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {}", parent.display(), error))?;
    }

    copy_tree(&canonical_source, prefix)?;

    Ok(PrefixActionResult {
        action: "restore".to_string(),
        message: "Prefix restored. Fully restart the game launcher before testing.".to_string(),
        backup_path: Some(canonical_source.to_string_lossy().to_string()),
        safety_backup_path: safety.map(|path| path.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub fn reset_prefix(
    prefix_path: String,
    game_key: String,
    confirmation: String,
) -> Result<PrefixActionResult, String> {
    if !cfg!(target_os = "linux") {
        return Err("Prefix maintenance is available on Linux.".to_string());
    }

    ensure_confirmation(&confirmation, "RESET")?;

    let prefix = Path::new(&prefix_path);

    if !prefix.exists() {
        return Err(format!("Prefix does not exist: {}", prefix.display()));
    }

    let safety = create_backup_internal(&prefix_path, &game_key, "pre-reset-safety")?;

    remove_path(prefix)?;

    fs::create_dir_all(prefix).map_err(|error| {
        format!(
            "Failed to recreate empty prefix directory {}: {}",
            prefix.display(),
            error
        )
    })?;

    Ok(PrefixActionResult {
        action: "reset".to_string(),
        message:
            "Prefix reset completed. A safety backup was created first. The launcher will rebuild the prefix when the game is launched."
                .to_string(),
        backup_path: None,
        safety_backup_path:
            Some(safety.to_string_lossy().to_string()),
    })
}
