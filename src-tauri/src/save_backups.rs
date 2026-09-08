use std::{
    env,
    fs,
    path::{
        Path,
        PathBuf,
    },
    process::Command,
    time::{
        SystemTime,
        UNIX_EPOCH,
    },
};

use serde::Serialize;

use crate::local_paths::resolve_game_path;


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupEntry {
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_unix: u64,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupStatus {
    pub save_path: String,
    pub backup_directory: String,
    pub backup_count: usize,
    pub backups: Vec<SaveBackupEntry>,
}


fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(
            UNIX_EPOCH
        )
        .map(
            |duration| {
                duration.as_secs()
            }
        )
        .unwrap_or(0)
}


fn sanitize_component(
    value: &str,
) -> String {
    let mut output =
        String::with_capacity(
            value.len()
        );

    for character in
        value.chars()
    {
        if character.is_ascii_alphanumeric()
            || character == '-'
            || character == '_'
            || character == ' '
        {
            output.push(
                character
            );
        } else {
            output.push(
                '_'
            );
        }
    }

    let cleaned =
        output
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .trim()
            .trim_matches('.')
            .to_string();

    if cleaned.is_empty() {
        "Unknown Game"
            .to_string()
    } else {
        cleaned
    }
}


fn backup_root() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let base =
            env::var(
                "LOCALAPPDATA"
            )
            .map_err(
                |_| {
                    "LOCALAPPDATA is not available."
                        .to_string()
                }
            )?;

        return Ok(
            PathBuf::from(
                base
            )
            .join(
                "GameManager"
            )
            .join(
                "Backups"
            )
        );
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home =
            env::var(
                "HOME"
            )
            .map_err(
                |_| {
                    "HOME is not available."
                        .to_string()
                }
            )?;

        Ok(
            PathBuf::from(
                home
            )
            .join(
                ".local"
            )
            .join(
                "share"
            )
            .join(
                "GameManager"
            )
            .join(
                "Backups"
            )
        )
    }
}


fn game_backup_directory(
    game_name: &str,
    game_id: Option<&str>,
) -> Result<PathBuf, String> {
    let name =
        sanitize_component(
            game_name
        );

    let key =
        game_id
            .map(
                sanitize_component
            )
            .filter(
                |value| {
                    !value.is_empty()
                }
            );

    let folder_name =
        match key {
            Some(key) =>
                format!(
                    "{} [{}]",
                    name,
                    key
                ),

            None =>
                name,
        };

    Ok(
        backup_root()?
            .join(
                folder_name
            )
    )
}


fn path_string(
    path: &Path,
) -> String {
    path
        .to_string_lossy()
        .to_string()
}


fn list_backups(
    directory: &Path,
) -> Result<Vec<SaveBackupEntry>, String> {
    if !directory.exists() {
        return Ok(
            Vec::new()
        );
    }

    let mut entries =
        Vec::new();

    let read_dir =
        fs::read_dir(
            directory
        )
        .map_err(
            |error| {
                format!(
                    "Failed to read backup directory: {}",
                    error
                )
            }
        )?;

    for entry in
        read_dir
    {
        let entry =
            entry
                .map_err(
                    |error| {
                        format!(
                            "Failed to read a backup entry: {}",
                            error
                        )
                    }
                )?;

        let path =
            entry.path();

        let is_zip =
            path
                .extension()
                .and_then(
                    |value| {
                        value.to_str()
                    }
                )
                .map(
                    |value| {
                        value
                            .eq_ignore_ascii_case(
                                "zip"
                            )
                    }
                )
                .unwrap_or(
                    false
                );

        if !is_zip {
            continue;
        }

        let metadata =
            entry
                .metadata()
                .map_err(
                    |error| {
                        format!(
                            "Failed to read backup metadata: {}",
                            error
                        )
                    }
                )?;

        let modified_unix =
            metadata
                .modified()
                .ok()
                .and_then(
                    |time| {
                        time
                            .duration_since(
                                UNIX_EPOCH
                            )
                            .ok()
                    }
                )
                .map(
                    |duration| {
                        duration.as_secs()
                    }
                )
                .unwrap_or(0);

        entries.push(
            SaveBackupEntry {
                file_name:
                    entry
                        .file_name()
                        .to_string_lossy()
                        .to_string(),

                path:
                    path_string(
                        &path
                    ),

                size_bytes:
                    metadata.len(),

                modified_unix,
            }
        );
    }

    entries.sort_by(
        |left, right| {
            right
                .modified_unix
                .cmp(
                    &left
                        .modified_unix
                )
        }
    );

    Ok(
        entries
    )
}


#[cfg(target_os = "windows")]
fn create_zip_archive(
    source: &Path,
    destination: &Path,
) -> Result<(), String> {
    let parent =
        source
            .parent()
            .ok_or_else(
                || {
                    "Save path does not have a parent directory."
                        .to_string()
                }
            )?;

    let name =
        source
            .file_name()
            .ok_or_else(
                || {
                    "Save path does not have a file or folder name."
                        .to_string()
                }
            )?;

    let status =
        Command::new(
            "tar.exe"
        )
        .arg(
            "-a"
        )
        .arg(
            "-c"
        )
        .arg(
            "-f"
        )
        .arg(
            destination
        )
        .arg(
            "-C"
        )
        .arg(
            parent
        )
        .arg(
            name
        )
        .status()
        .map_err(
            |error| {
                format!(
                    "Failed to start tar.exe: {}",
                    error
                )
            }
        )?;

    if !status.success() {
        return Err(
            format!(
                "tar.exe failed while creating the save backup (exit code {:?}).",
                status.code()
            )
        );
    }

    Ok(())
}


#[cfg(not(target_os = "windows"))]
fn create_zip_archive(
    _source: &Path,
    _destination: &Path,
) -> Result<(), String> {
    Err(
        "ZIP save backups are currently implemented for Windows."
            .to_string()
    )
}


#[cfg(target_os = "windows")]
fn extract_zip_archive(
    archive: &Path,
    destination: &Path,
) -> Result<(), String> {
    let status =
        Command::new(
            "tar.exe"
        )
        .arg(
            "-x"
        )
        .arg(
            "-f"
        )
        .arg(
            archive
        )
        .arg(
            "-C"
        )
        .arg(
            destination
        )
        .status()
        .map_err(
            |error| {
                format!(
                    "Failed to start tar.exe: {}",
                    error
                )
            }
        )?;

    if !status.success() {
        return Err(
            format!(
                "tar.exe failed while extracting the save backup (exit code {:?}).",
                status.code()
            )
        );
    }

    Ok(())
}


#[cfg(not(target_os = "windows"))]
fn extract_zip_archive(
    _archive: &Path,
    _destination: &Path,
) -> Result<(), String> {
    Err(
        "ZIP save restore is currently implemented for Windows."
            .to_string()
    )
}


fn copy_path_recursive(
    source: &Path,
    destination: &Path,
) -> Result<(), String> {
    if source.is_file() {
        if let Some(parent) =
            destination.parent()
        {
            fs::create_dir_all(
                parent
            )
            .map_err(
                |error| {
                    format!(
                        "Failed to create restore directory: {}",
                        error
                    )
                }
            )?;
        }

        fs::copy(
            source,
            destination,
        )
        .map_err(
            |error| {
                format!(
                    "Failed to restore save file: {}",
                    error
                )
            }
        )?;

        return Ok(());
    }

    fs::create_dir_all(
        destination
    )
    .map_err(
        |error| {
            format!(
                "Failed to create restore directory: {}",
                error
            )
        }
    )?;

    for entry in
        fs::read_dir(
            source
        )
        .map_err(
            |error| {
                format!(
                    "Failed to read extracted backup: {}",
                    error
                )
            }
        )?
    {
        let entry =
            entry
                .map_err(
                    |error| {
                        format!(
                            "Failed to read extracted backup entry: {}",
                            error
                        )
                    }
                )?;

        let child_source =
            entry.path();

        let child_destination =
            destination.join(
                entry.file_name()
            );

        copy_path_recursive(
            &child_source,
            &child_destination,
        )?;
    }

    Ok(())
}


fn remove_existing_path(
    path: &Path,
) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    if path.is_dir() {
        fs::remove_dir_all(
            path
        )
        .map_err(
            |error| {
                format!(
                    "Failed to clear the current save directory: {}",
                    error
                )
            }
        )?;
    } else {
        fs::remove_file(
            path
        )
        .map_err(
            |error| {
                format!(
                    "Failed to remove the current save file: {}",
                    error
                )
            }
        )?;
    }

    Ok(())
}


fn temporary_restore_directory() -> PathBuf {
    env::temp_dir()
        .join(
            format!(
                "GameManager-Restore-{}",
                unix_now()
            )
        )
}


fn create_backup_internal(
    game_name: &str,
    game_id: Option<&str>,
    save_path: &str,
    install_path: Option<&str>,
    prefix: &str,
) -> Result<PathBuf, String> {
    let resolved =
        resolve_game_path(
            save_path,
            install_path,
        )?;

    if !resolved.exists() {
        return Err(
            format!(
                "The save path does not exist: {}",
                resolved.display()
            )
        );
    }

    let directory =
        game_backup_directory(
            game_name,
            game_id,
        )?;

    fs::create_dir_all(
        &directory
    )
    .map_err(
        |error| {
            format!(
                "Failed to create backup directory: {}",
                error
            )
        }
    )?;

    let file_name =
        format!(
            "{}_{}.zip",
            prefix,
            unix_now()
        );

    let destination =
        directory.join(
            file_name
        );

    create_zip_archive(
        &resolved,
        &destination,
    )?;

    Ok(
        destination
    )
}


#[tauri::command]
pub fn get_save_backup_status(
    game_name: String,
    game_id: Option<String>,
    save_path: String,
    install_path: Option<String>,
) -> Result<SaveBackupStatus, String> {
    let resolved =
        resolve_game_path(
            &save_path,
            install_path
                .as_deref(),
        )?;

    let backup_directory =
        game_backup_directory(
            &game_name,
            game_id
                .as_deref(),
        )?;

    let backups =
        list_backups(
            &backup_directory
        )?;

    Ok(
        SaveBackupStatus {
            save_path:
                path_string(
                    &resolved
                ),

            backup_directory:
                path_string(
                    &backup_directory
                ),

            backup_count:
                backups.len(),

            backups,
        }
    )
}


#[tauri::command]
pub fn create_save_backup(
    game_name: String,
    game_id: Option<String>,
    save_path: String,
    install_path: Option<String>,
) -> Result<SaveBackupStatus, String> {
    let created =
        create_backup_internal(
            &game_name,
            game_id
                .as_deref(),
            &save_path,
            install_path
                .as_deref(),
            "backup",
        )?;

    println!(
        "[SAVE BACKUP] Created: {}",
        created.display()
    );

    get_save_backup_status(
        game_name,
        game_id,
        save_path,
        install_path,
    )
}


#[tauri::command]
pub fn restore_save_backup(
    game_name: String,
    game_id: Option<String>,
    save_path: String,
    install_path: Option<String>,
    backup_file_name: String,
) -> Result<SaveBackupStatus, String> {
    let resolved_save =
        resolve_game_path(
            &save_path,
            install_path
                .as_deref(),
        )?;

    let backup_directory =
        game_backup_directory(
            &game_name,
            game_id
                .as_deref(),
        )?;

    let requested_name =
        Path::new(
            &backup_file_name
        )
        .file_name()
        .and_then(
            |value| {
                value.to_str()
            }
        )
        .ok_or_else(
            || {
                "Invalid backup file name."
                    .to_string()
            }
        )?;

    if requested_name
        != backup_file_name
    {
        return Err(
            "Invalid backup file name."
                .to_string()
        );
    }

    let archive =
        backup_directory
            .join(
                requested_name
            );

    if !archive.exists() {
        return Err(
            "The selected backup no longer exists."
                .to_string()
        );
    }

    /*
     * Safety first: always create a backup of the current save
     * before overwriting it, when the current save still exists.
     */
    if resolved_save.exists() {
        let safety =
            create_backup_internal(
                &game_name,
                game_id
                    .as_deref(),
                &save_path,
                install_path
                    .as_deref(),
                "pre_restore",
            )?;

        println!(
            "[SAVE BACKUP] Safety backup: {}",
            safety.display()
        );
    }

    let temp =
        temporary_restore_directory();

    if temp.exists() {
        fs::remove_dir_all(
            &temp
        )
        .map_err(
            |error| {
                format!(
                    "Failed to clear temporary restore directory: {}",
                    error
                )
            }
        )?;
    }

    fs::create_dir_all(
        &temp
    )
    .map_err(
        |error| {
            format!(
                "Failed to create temporary restore directory: {}",
                error
            )
        }
    )?;

    extract_zip_archive(
        &archive,
        &temp,
    )?;

    let source_name =
        resolved_save
            .file_name()
            .ok_or_else(
                || {
                    "The save path does not have a final component."
                        .to_string()
                }
            )?;

    let extracted =
        temp.join(
            source_name
        );

    if !extracted.exists() {
        let _ =
            fs::remove_dir_all(
                &temp
            );

        return Err(
            format!(
                "The backup does not contain the expected save folder or file: {}",
                source_name
                    .to_string_lossy()
            )
        );
    }

    remove_existing_path(
        &resolved_save
    )?;

    if let Some(parent) =
        resolved_save.parent()
    {
        fs::create_dir_all(
            parent
        )
        .map_err(
            |error| {
                format!(
                    "Failed to recreate the save parent directory: {}",
                    error
                )
            }
        )?;
    }

    copy_path_recursive(
        &extracted,
        &resolved_save,
    )?;

    let _ =
        fs::remove_dir_all(
            &temp
        );

    println!(
        "[SAVE BACKUP] Restored: {}",
        archive.display()
    );

    get_save_backup_status(
        game_name,
        game_id,
        save_path,
        install_path,
    )
}
