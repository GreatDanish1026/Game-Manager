use std::{
    path::{
        Path,
        PathBuf,
    },
    process::Command,
};

use serde::Serialize;


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileLaunchResult {
    pub launched: bool,
    pub method: String,
    pub message: String,
}


fn clean_path(
    value: &str,
) -> PathBuf {
    PathBuf::from(
        value
            .trim()
            .trim_matches('"')
    )
}


fn validate_executable(
    path: &Path,
) -> Result<(), String> {
    if !path.exists() {
        return Err(
            format!(
                "The selected executable does not exist: {}",
                path.display()
            )
        );
    }

    if !path.is_file() {
        return Err(
            format!(
                "The selected executable path is not a file: {}",
                path.display()
            )
        );
    }

    let extension =
        path
            .extension()
            .and_then(
                |value| {
                    value.to_str()
                }
            )
            .unwrap_or("")
            .to_ascii_lowercase();

    if !matches!(
        extension.as_str(),
        "exe"
            | "bat"
            | "cmd"
    ) {
        return Err(
            "Launch Profiles currently support .exe, .bat, and .cmd targets."
                .to_string()
        );
    }

    Ok(())
}


fn resolved_working_directory(
    executable: &Path,
    requested: Option<&str>,
) -> Result<PathBuf, String> {
    if let Some(
        value
    ) = requested
    {
        let trimmed =
            value
                .trim()
                .trim_matches('"');

        if !trimmed.is_empty() {
            let path =
                PathBuf::from(
                    trimmed
                );

            if !path.exists() {
                return Err(
                    format!(
                        "The working directory does not exist: {}",
                        path.display()
                    )
                );
            }

            if !path.is_dir() {
                return Err(
                    format!(
                        "The working directory is not a folder: {}",
                        path.display()
                    )
                );
            }

            return Ok(
                path
            );
        }
    }

    executable
        .parent()
        .map(
            Path::to_path_buf
        )
        .ok_or_else(
            || {
                "Could not determine the executable's working directory."
                    .to_string()
            }
        )
}


#[cfg(target_os = "windows")]
fn launch_target(
    executable: &Path,
    arguments: &[String],
    working_directory: &Path,
) -> Result<(), String> {
    let extension =
        executable
            .extension()
            .and_then(
                |value| {
                    value.to_str()
                }
            )
            .unwrap_or("")
            .to_ascii_lowercase();

    if matches!(
        extension.as_str(),
        "bat"
            | "cmd"
    ) {
        let mut command =
            Command::new(
                "cmd.exe"
            );

        command
            .arg(
                "/C"
            )
            .arg(
                executable
            )
            .args(
                arguments
            )
            .current_dir(
                working_directory
            );

        command
            .spawn()
            .map_err(
                |error| {
                    format!(
                        "Failed to launch the profile script: {}",
                        error
                    )
                }
            )?;

        return Ok(());
    }

    Command::new(
        executable
    )
    .args(
        arguments
    )
    .current_dir(
        working_directory
    )
    .spawn()
    .map_err(
        |error| {
            format!(
                "Failed to launch the profile executable: {}",
                error
            )
        }
    )?;

    Ok(())
}


#[cfg(not(target_os = "windows"))]
fn launch_target(
    executable: &Path,
    arguments: &[String],
    working_directory: &Path,
) -> Result<(), String> {
    Command::new(
        executable
    )
    .args(
        arguments
    )
    .current_dir(
        working_directory
    )
    .spawn()
    .map_err(
        |error| {
            format!(
                "Failed to launch the profile executable: {}",
                error
            )
        }
    )?;

    Ok(())
}


#[tauri::command]
pub fn launch_profile_executable(
    executable_path: String,
    arguments: Vec<String>,
    working_directory: Option<String>,
) -> Result<ProfileLaunchResult, String> {
    let executable =
        clean_path(
            &executable_path
        );

    validate_executable(
        &executable
    )?;

    let working =
        resolved_working_directory(
            &executable,
            working_directory
                .as_deref(),
        )?;

    println!(
        "[LAUNCH PROFILE] Executable: {}",
        executable.display()
    );

    if !arguments.is_empty() {
        println!(
            "[LAUNCH PROFILE] Arguments: {:?}",
            arguments
        );
    }

    launch_target(
        &executable,
        &arguments,
        &working,
    )?;

    Ok(
        ProfileLaunchResult {
            launched:
                true,

            method:
                "direct_executable"
                    .to_string(),

            message:
                "Launch profile started successfully."
                    .to_string(),
        }
    )
}
