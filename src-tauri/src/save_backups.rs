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

use crate::logging;

use crate::local_paths::{
    resolve_game_path_with_context,
};


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupEntry {
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_unix: u64,
    pub modified_unix: u64,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupStatus {
    pub save_path: String,
    pub backup_directory: String,
    pub backup_count: usize,
    pub total_size_bytes: u64,
    pub backups: Vec<SaveBackupEntry>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupStorageSummary {
    pub backup_root: String,
    pub game_directory_count: usize,
    pub backup_count: usize,
    pub total_size_bytes: u64,
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


fn valid_backup_file_name(
    backup_file_name: &str,
) -> Result<&str, String> {
    let requested_name =
        Path::new(
            backup_file_name
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

    if !requested_name
        .to_ascii_lowercase()
        .ends_with(
            ".zip"
        )
    {
        return Err(
            "Invalid backup file type."
                .to_string()
        );
    }

    Ok(
        requested_name
    )
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
                        value.eq_ignore_ascii_case(
                            "zip"
                        )
                    }
                )
                .unwrap_or(false);

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

        let created_unix =
            metadata
                .created()
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
                .unwrap_or(
                    modified_unix
                );

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

                created_unix,

                modified_unix,
            }
        );
    }

    entries.sort_by(
        |left, right| {
            right
                .created_unix
                .cmp(
                    &left
                        .created_unix
                )
                .then_with(
                    || {
                        right
                            .modified_unix
                            .cmp(
                                &left
                                    .modified_unix
                            )
                    }
                )
        }
    );

    Ok(
        entries
    )
}


fn total_backup_size(
    backups: &[SaveBackupEntry],
) -> u64 {
    backups
        .iter()
        .map(
            |backup| {
                backup.size_bytes
            }
        )
        .sum()
}


fn apply_retention(
    directory: &Path,
    retention_count: Option<usize>,
) -> Result<usize, String> {
    let keep =
        match retention_count {
            Some(value)
                if value > 0 =>
            {
                value
            }

            _ =>
                return Ok(0),
        };

    let backups =
        list_backups(
            directory
        )?;

    if backups.len()
        <= keep
    {
        return Ok(0);
    }

    let mut removed =
        0usize;

    for backup in
        backups
            .iter()
            .skip(
                keep
            )
    {
        fs::remove_file(
            &backup.path
        )
        .map_err(
            |error| {
                format!(
                    "Failed to remove old backup {}: {}",
                    backup.file_name,
                    error
                )
            }
        )?;

        removed += 1;
    }

    Ok(
        removed
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
    source: &Path,
    destination: &Path,
) -> Result<(), String> {
    use std::fs::File;
    use std::io::{
        Read,
        Write,
    };

    use zip::write::FileOptions;
    use zip::{
        CompressionMethod,
        ZipWriter,
    };

    fn add_path(
        writer: &mut ZipWriter<File>,
        path: &Path,
        archive_name: &Path,
    ) -> Result<(), String> {
        let options =
            FileOptions::default()
                .compression_method(
                    CompressionMethod::Deflated
                )
                .unix_permissions(
                    0o644
                );

        if path.is_dir() {
            let mut directory_name =
                archive_name
                    .to_string_lossy()
                    .replace(
                        '\\',
                        "/"
                    );

            if !directory_name.ends_with(
                '/'
            ) {
                directory_name.push(
                    '/'
                );
            }

            writer
                .add_directory(
                    directory_name,
                    FileOptions::default()
                        .unix_permissions(
                            0o755
                        ),
                )
                .map_err(
                    |error| {
                        format!(
                            "Failed to add directory to save backup: {}",
                            error
                        )
                    }
                )?;

            for entry in
                fs::read_dir(
                    path
                )
                .map_err(
                    |error| {
                        format!(
                            "Failed to read save directory while creating backup: {}",
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
                                    "Failed to read save entry while creating backup: {}",
                                    error
                                )
                            }
                        )?;

                add_path(
                    writer,
                    &entry.path(),
                    &archive_name.join(
                        entry.file_name()
                    ),
                )?;
            }

            return Ok(());
        }

        if !path.is_file() {
            /*
             * Do not follow unusual filesystem nodes such as sockets
             * or device files into a save archive.
             */
            return Ok(());
        }

        let archive_name =
            archive_name
                .to_string_lossy()
                .replace(
                    '\\',
                    "/"
                );

        writer
            .start_file(
                archive_name,
                options,
            )
            .map_err(
                |error| {
                    format!(
                        "Failed to add file to save backup: {}",
                        error
                    )
                }
            )?;

        let mut input =
            File::open(
                path
            )
            .map_err(
                |error| {
                    format!(
                        "Failed to open save file while creating backup: {}",
                        error
                    )
                }
            )?;

        let mut buffer =
            [0u8; 64 * 1024];

        loop {
            let count =
                input
                    .read(
                        &mut buffer
                    )
                    .map_err(
                        |error| {
                            format!(
                                "Failed to read save file while creating backup: {}",
                                error
                            )
                        }
                    )?;

            if count == 0 {
                break;
            }

            writer
                .write_all(
                    &buffer[..count]
                )
                .map_err(
                    |error| {
                        format!(
                            "Failed to write save file into backup: {}",
                            error
                        )
                    }
                )?;
        }

        Ok(())
    }

    let source_name =
        source
            .file_name()
            .ok_or_else(
                || {
                    "Save path does not have a file or folder name."
                        .to_string()
                }
            )?;

    if let Some(parent) =
        destination.parent()
    {
        fs::create_dir_all(
            parent
        )
        .map_err(
            |error| {
                format!(
                    "Failed to create save backup directory: {}",
                    error
                )
            }
        )?;
    }

    let file =
        File::create(
            destination
        )
        .map_err(
            |error| {
                format!(
                    "Failed to create save backup archive: {}",
                    error
                )
            }
        )?;

    let mut writer =
        ZipWriter::new(
            file
        );

    add_path(
        &mut writer,
        source,
        Path::new(
            source_name
        ),
    )?;

    writer
        .finish()
        .map_err(
            |error| {
                format!(
                    "Failed to finalize save backup archive: {}",
                    error
                )
            }
        )?;

    Ok(())
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
    archive: &Path,
    destination: &Path,
) -> Result<(), String> {
    use std::fs::File;
    use std::io;

    use zip::ZipArchive;

    let file =
        File::open(
            archive
        )
        .map_err(
            |error| {
                format!(
                    "Failed to open save backup archive: {}",
                    error
                )
            }
        )?;

    let mut zip =
        ZipArchive::new(
            file
        )
        .map_err(
            |error| {
                format!(
                    "Failed to read save backup archive: {}",
                    error
                )
            }
        )?;

    for index in
        0..zip.len()
    {
        let mut entry =
            zip
                .by_index(
                    index
                )
                .map_err(
                    |error| {
                        format!(
                            "Failed to read save backup entry: {}",
                            error
                        )
                    }
                )?;

        /*
         * enclosed_name() rejects paths that could escape the restore
         * directory through absolute paths or '..' traversal.
         */
        let relative =
            entry
                .enclosed_name()
                .ok_or_else(
                    || {
                        format!(
                            "Save backup contains an unsafe path: {}",
                            entry.name()
                        )
                    }
                )?
                .to_owned();

        let output =
            destination.join(
                relative
            );

        if entry.is_dir() {
            fs::create_dir_all(
                &output
            )
            .map_err(
                |error| {
                    format!(
                        "Failed to create extracted save directory: {}",
                        error
                    )
                }
            )?;

            continue;
        }

        if let Some(parent) =
            output.parent()
        {
            fs::create_dir_all(
                parent
            )
            .map_err(
                |error| {
                    format!(
                        "Failed to create extracted save parent directory: {}",
                        error
                    )
                }
            )?;
        }

        let mut output_file =
            File::create(
                &output
            )
            .map_err(
                |error| {
                    format!(
                        "Failed to create extracted save file: {}",
                        error
                    )
                }
            )?;

        io::copy(
            &mut entry,
            &mut output_file,
        )
        .map_err(
            |error| {
                format!(
                    "Failed to extract save file: {}",
                    error
                )
            }
        )?;

        #[cfg(unix)]
        if let Some(mode) =
            entry.unix_mode()
        {
            use std::os::unix::fs::PermissionsExt;

            let _ =
                fs::set_permissions(
                    &output,
                    fs::Permissions::from_mode(
                        mode
                    ),
                );
        }
    }

    Ok(())
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
    proton_prefix: Option<&str>,
    prefix: &str,
    retention_count: Option<usize>,
) -> Result<PathBuf, String> {
    let resolved =
        resolve_game_path_with_context(
            save_path,
            install_path,
            proton_prefix,
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

    let removed =
        apply_retention(
            &directory,
            retention_count,
        )?;

    if removed > 0 {
        logging::dev_log(
            &format!(
                "[SAVE BACKUP] Retention removed {} old backup(s).",
                removed
            )
        );
    }

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
    proton_prefix: Option<String>,
) -> Result<SaveBackupStatus, String> {
    let resolved =
        resolve_game_path_with_context(
            &save_path,
            install_path
                .as_deref(),
            proton_prefix
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

    let total_size_bytes =
        total_backup_size(
            &backups
        );

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

            total_size_bytes,

            backups,
        }
    )
}


#[tauri::command]
pub fn get_backup_storage_summary()
    -> Result<BackupStorageSummary, String>
{
    let root =
        backup_root()?;

    if !root.exists() {
        return Ok(
            BackupStorageSummary {
                backup_root:
                    path_string(
                        &root
                    ),

                game_directory_count:
                    0,

                backup_count:
                    0,

                total_size_bytes:
                    0,
            }
        );
    }

    let mut game_directory_count =
        0usize;

    let mut backup_count =
        0usize;

    let mut total_size_bytes =
        0u64;

    for entry in
        fs::read_dir(
            &root
        )
        .map_err(
            |error| {
                format!(
                    "Failed to read backup root: {}",
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
                            "Failed to read backup root entry: {}",
                            error
                        )
                    }
                )?;

        let path =
            entry.path();

        if !path.is_dir() {
            continue;
        }

        game_directory_count +=
            1;

        let backups =
            list_backups(
                &path
            )?;

        backup_count +=
            backups.len();

        total_size_bytes +=
            total_backup_size(
                &backups
            );
    }

    Ok(
        BackupStorageSummary {
            backup_root:
                path_string(
                    &root
                ),

            game_directory_count,

            backup_count,

            total_size_bytes,
        }
    )
}


#[tauri::command]
pub fn create_save_backup(
    game_name: String,
    game_id: Option<String>,
    save_path: String,
    install_path: Option<String>,
    proton_prefix: Option<String>,
    retention_count: Option<usize>,
    backup_type: Option<String>,
) -> Result<SaveBackupStatus, String> {
    let prefix =
        match backup_type
            .as_deref()
        {
            Some("pre_launch") =>
                "pre_launch",

            Some("pre_restore") =>
                "pre_restore",

            _ =>
                "backup",
        };

    let created =
        create_backup_internal(
            &game_name,
            game_id
                .as_deref(),
            &save_path,
            install_path
                .as_deref(),
            proton_prefix
                .as_deref(),
            prefix,
            retention_count,
        )?;

    logging::dev_log(
        &format!(
            "[SAVE BACKUP] Created: {}",
            created.display()
        )
    );

    get_save_backup_status(
        game_name,
        game_id,
        save_path,
        install_path,
        proton_prefix,
    )
}


#[tauri::command]
pub fn delete_save_backup(
    game_name: String,
    game_id: Option<String>,
    save_path: String,
    install_path: Option<String>,
    proton_prefix: Option<String>,
    backup_file_name: String,
) -> Result<SaveBackupStatus, String> {
    let directory =
        game_backup_directory(
            &game_name,
            game_id
                .as_deref(),
        )?;

    let requested_name =
        valid_backup_file_name(
            &backup_file_name
        )?;

    let archive =
        directory.join(
            requested_name
        );

    if !archive.exists() {
        return Err(
            "The selected backup no longer exists."
                .to_string()
        );
    }

    fs::remove_file(
        &archive
    )
    .map_err(
        |error| {
            format!(
                "Failed to delete backup: {}",
                error
            )
        }
    )?;

    logging::dev_log(
        &format!(
            "[SAVE BACKUP] Deleted: {}",
            archive.display()
        )
    );

    get_save_backup_status(
        game_name,
        game_id,
        save_path,
        install_path,
        proton_prefix,
    )
}


#[tauri::command]
pub fn restore_save_backup(
    game_name: String,
    game_id: Option<String>,
    save_path: String,
    install_path: Option<String>,
    proton_prefix: Option<String>,
    backup_file_name: String,
    retention_count: Option<usize>,
) -> Result<SaveBackupStatus, String> {
    let resolved_save =
        resolve_game_path_with_context(
            &save_path,
            install_path
                .as_deref(),
            proton_prefix
                .as_deref(),
        )?;

    let backup_directory =
        game_backup_directory(
            &game_name,
            game_id
                .as_deref(),
        )?;

    let requested_name =
        valid_backup_file_name(
            &backup_file_name
        )?;

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

    if resolved_save.exists() {
        let safety =
            create_backup_internal(
                &game_name,
                game_id
                    .as_deref(),
                &save_path,
                install_path
                    .as_deref(),
                proton_prefix
                    .as_deref(),
                "pre_restore",
                retention_count,
            )?;

        logging::dev_log(
            &format!(
                "[SAVE BACKUP] Safety backup: {}",
                safety.display()
            )
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

    logging::dev_log(
        &format!(
            "[SAVE BACKUP] Restored: {}",
            archive.display()
        )
    );

    get_save_backup_status(
        game_name,
        game_id,
        save_path,
        install_path,
        proton_prefix,
    )
}
