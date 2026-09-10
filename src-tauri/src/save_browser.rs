use std::{
    fs,
    path::{
        Path,
        PathBuf,
    },
    time::{
        SystemTime,
        UNIX_EPOCH,
    },
};

use serde::Serialize;

use crate::local_paths::resolve_game_path_with_context;


const MAX_SAVE_FILES: usize =
    50000;

const MAX_SAVE_DEPTH: usize =
    12;

const MAX_RECENT_FILES: usize =
    25;


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBrowserEntry {
    pub file_name: String,
    pub path: String,
    pub relative_path: String,
    pub parent_path: String,
    pub size_bytes: u64,
    pub modified_unix: u64,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBrowserInfo {
    pub found: bool,
    pub resolved_path: String,
    pub file_count: usize,
    pub total_size_bytes: u64,
    pub newest_file: Option<SaveBrowserEntry>,
    pub oldest_file: Option<SaveBrowserEntry>,
    pub recent_files: Vec<SaveBrowserEntry>,
    pub scan_truncated: bool,
}


fn path_string(
    path: &Path,
) -> String {
    path
        .to_string_lossy()
        .to_string()
}


fn unix_seconds(
    value: Result<SystemTime, std::io::Error>,
) -> u64 {
    value
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
        .unwrap_or(0)
}


fn make_entry(
    root: &Path,
    path: &Path,
    metadata: &fs::Metadata,
) -> SaveBrowserEntry {
    let relative =
        path
            .strip_prefix(
                root
            )
            .unwrap_or(
                path
            );

    SaveBrowserEntry {
        file_name:
            path
                .file_name()
                .map(
                    |value| {
                        value
                            .to_string_lossy()
                            .to_string()
                    }
                )
                .unwrap_or_else(
                    || {
                        path_string(
                            path
                        )
                    }
                ),

        path:
            path_string(
                path
            ),

        relative_path:
            path_string(
                relative
            ),

        parent_path:
            path
                .parent()
                .map(
                    path_string
                )
                .unwrap_or_else(
                    || {
                        path_string(
                            root
                        )
                    }
                ),

        size_bytes:
            metadata.len(),

        modified_unix:
            unix_seconds(
                metadata.modified()
            ),
    }
}


fn scan_save_directory(
    root: &Path,
) -> Result<
    (
        Vec<SaveBrowserEntry>,
        bool,
    ),
    String,
> {
    if !root.exists() {
        return Ok(
            (
                Vec::new(),
                false,
            )
        );
    }

    if root.is_file() {
        let metadata =
            fs::metadata(
                root
            )
            .map_err(
                |error| {
                    format!(
                        "Failed to inspect save file: {}",
                        error
                    )
                }
            )?;

        let base =
            root
                .parent()
                .unwrap_or(
                    root
                );

        return Ok(
            (
                vec![
                    make_entry(
                        base,
                        root,
                        &metadata,
                    ),
                ],
                false,
            )
        );
    }

    let mut files =
        Vec::new();

    let mut stack =
        vec![
            (
                root.to_path_buf(),
                0usize,
            ),
        ];

    let mut truncated =
        false;

    while let Some(
        (
            directory,
            depth,
        )
    ) = stack.pop()
    {
        if depth
            > MAX_SAVE_DEPTH
        {
            continue;
        }

        let entries =
            match fs::read_dir(
                &directory
            ) {
                Ok(entries) =>
                    entries,

                Err(_) =>
                    continue,
            };

        for entry in
            entries.flatten()
        {
            if files.len()
                >= MAX_SAVE_FILES
            {
                truncated =
                    true;

                break;
            }

            let path =
                entry.path();

            let metadata =
                match entry.metadata() {
                    Ok(metadata) =>
                        metadata,

                    Err(_) =>
                        continue,
                };

            if metadata.is_dir() {
                if depth
                    < MAX_SAVE_DEPTH
                {
                    stack.push(
                        (
                            path,
                            depth + 1,
                        )
                    );
                }

                continue;
            }

            if metadata.is_file() {
                files.push(
                    make_entry(
                        root,
                        &path,
                        &metadata,
                    )
                );
            }
        }

        if truncated {
            break;
        }
    }

    Ok(
        (
            files,
            truncated,
        )
    )
}


#[tauri::command]
pub fn inspect_save_browser(
    save_path: String,
    install_path: Option<String>,
    proton_prefix: Option<String>,
) -> Result<SaveBrowserInfo, String> {
    let resolved =
        resolve_game_path_with_context(
            &save_path,
            install_path
                .as_deref(),
            proton_prefix
                .as_deref(),
        )?;

    let (
        mut files,
        scan_truncated,
    ) =
        scan_save_directory(
            &resolved
        )?;

    let total_size_bytes =
        files
            .iter()
            .map(
                |entry| {
                    entry.size_bytes
                }
            )
            .sum();

    let oldest_file =
        files
            .iter()
            .min_by_key(
                |entry| {
                    entry.modified_unix
                }
            )
            .cloned();

    files.sort_by(
        |left, right| {
            right
                .modified_unix
                .cmp(
                    &left
                        .modified_unix
                )
        }
    );

    let newest_file =
        files
            .first()
            .cloned();

    let file_count =
        files.len();

    let recent_files =
        files
            .into_iter()
            .take(
                MAX_RECENT_FILES
            )
            .collect();

    Ok(
        SaveBrowserInfo {
            found:
                file_count > 0,

            resolved_path:
                path_string(
                    &resolved
                ),

            file_count,
            total_size_bytes,
            newest_file,
            oldest_file,
            recent_files,
            scan_truncated,
        }
    )
}
