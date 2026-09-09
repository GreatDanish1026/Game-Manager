use std::{
    env,
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


fn preferred_export_directory()
    -> Result<PathBuf, String>
{
    #[cfg(target_os = "windows")]
    {
        let profile =
            env::var(
                "USERPROFILE"
            )
            .map_err(
                |_| {
                    "USERPROFILE is not available."
                        .to_string()
                }
            )?;

        let root =
            PathBuf::from(
                profile
            );

        for candidate in [
            root.join(
                "Downloads"
            ),
            root.join(
                "Desktop"
            ),
            root.clone(),
        ] {
            if candidate.exists()
                && candidate.is_dir()
            {
                return Ok(
                    candidate
                );
            }
        }

        return Ok(
            root
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

        let root =
            PathBuf::from(
                home
            );

        let downloads =
            root.join(
                "Downloads"
            );

        if downloads.exists()
            && downloads.is_dir()
        {
            Ok(
                downloads
            )
        } else {
            Ok(
                root
            )
        }
    }
}


fn write_text(
    path: &Path,
    content: &str,
) -> Result<(), String> {
    fs::write(
        path,
        content
            .as_bytes(),
    )
    .map_err(
        |error| {
            format!(
                "Failed to write diagnostics file: {}",
                error
            )
        }
    )
}


#[tauri::command]
pub fn export_diagnostics_text(
    content: String,
) -> Result<String, String> {
    if content
        .trim()
        .is_empty()
    {
        return Err(
            "Diagnostics content is empty."
                .to_string()
        );
    }

    let directory =
        preferred_export_directory()?;

    fs::create_dir_all(
        &directory
    )
    .map_err(
        |error| {
            format!(
                "Failed to create diagnostics export directory: {}",
                error
            )
        }
    )?;

    let path =
        directory.join(
            format!(
                "GameAtlas-Diagnostics-{}.txt",
                unix_now()
            )
        );

    write_text(
        &path,
        &content,
    )?;

    Ok(
        path
            .to_string_lossy()
            .to_string()
    )
}
