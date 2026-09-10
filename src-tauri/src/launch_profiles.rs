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
pub struct ProtonToolInfo {
    pub name: String,
    pub path: String,
    pub source: String,
}


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

    #[cfg(target_os = "windows")]
    {
        if !matches!(
            extension.as_str(),
            "exe"
                | "bat"
                | "cmd"
        ) {
            return Err(
                "Launch Profiles currently support .exe, .bat, and .cmd targets on Windows."
                    .to_string()
            );
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if matches!(
            extension.as_str(),
            "bat"
                | "cmd"
        ) {
            return Err(
                "Windows .bat and .cmd launch profiles are not supported on Linux. Use a native executable/script, a Windows .exe through Proton, or Standard Launcher mode."
                    .to_string()
            );
        }

        if extension != "exe" {
            use std::os::unix::fs::PermissionsExt;

            let metadata =
                std::fs::metadata(
                    path
                )
                .map_err(
                    |error| {
                        format!(
                            "Failed to inspect the selected Linux executable: {}",
                            error
                        )
                    }
                )?;

            if metadata
                .permissions()
                .mode()
                & 0o111
                == 0
            {
                return Err(
                    format!(
                        "The selected Linux target is not marked executable: {}",
                        path.display()
                    )
                );
            }
        }
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
fn executable_in_path(
    name: &str,
) -> Option<PathBuf> {
    let path =
        std::env::var_os(
            "PATH"
        )?;

    for directory in
        std::env::split_paths(
            &path
        )
    {
        let candidate =
            directory.join(
                name
            );

        if candidate.is_file() {
            return Some(
                candidate
            );
        }
    }

    None
}


#[cfg(not(target_os = "windows"))]
fn normalized_tool_key(
    value: &str,
) -> String {
    value
        .chars()
        .filter(
            |character| {
                character
                    .is_ascii_alphanumeric()
            }
        )
        .flat_map(
            |character| {
                character
                    .to_lowercase()
            }
        )
        .collect()
}


#[cfg(not(target_os = "windows"))]
fn find_tool_directory(
    root: &Path,
    requested: &str,
) -> Option<PathBuf> {
    let requested_key =
        normalized_tool_key(
            requested
        );

    for entry in
        std::fs::read_dir(
            root
        )
        .ok()?
        .flatten()
    {
        let path =
            entry.path();

        if !path.is_dir() {
            continue;
        }

        let Some(
            name
        ) =
            path
                .file_name()
                .and_then(
                    |value| {
                        value.to_str()
                    }
                )
        else {
            continue;
        };

        if normalized_tool_key(
            name
        ) == requested_key
        {
            return Some(
                path
            );
        }
    }

    None
}


#[cfg(not(target_os = "windows"))]
fn steam_library_root_from_prefix(
    proton_prefix: &Path,
) -> Option<PathBuf> {
    for ancestor in
        proton_prefix.ancestors()
    {
        if ancestor
            .file_name()
            .and_then(
                |value| {
                    value.to_str()
                }
            )
            .map(
                |value| {
                    value
                        .eq_ignore_ascii_case(
                            "steamapps"
                        )
                }
            )
            .unwrap_or(
                false
            )
        {
            return ancestor
                .parent()
                .map(
                    Path::to_path_buf
                );
        }
    }

    None
}


#[cfg(not(target_os = "windows"))]
fn proton_runner(
    proton_prefix: &Path,
    compatibility_tool: &str,
) -> Result<PathBuf, String> {
    let tool =
        compatibility_tool
            .trim();

    if tool.is_empty()
        || tool
            .to_ascii_lowercase()
            .contains(
                "default / automatic"
            )
    {
        return Err(
            "This game is using Steam's automatic Proton selection, so GameAtlas cannot safely identify an exact Proton runner for a Direct Executable profile. Choose Standard Launcher mode or configure an explicit compatibility tool in Steam."
                .to_string()
        );
    }

    let mut roots =
        Vec::new();

    if let Some(
        library_root
    ) =
        steam_library_root_from_prefix(
            proton_prefix
        )
    {
        roots.push(
            library_root
                .join(
                    "steamapps"
                )
                .join(
                    "common"
                )
        );
    }

    if let Some(
        home
    ) =
        std::env::var_os(
            "HOME"
        )
        .map(
            PathBuf::from
        )
    {
        for steam_root in [
            home
                .join(
                    ".steam"
                )
                .join(
                    "steam"
                ),
            home
                .join(
                    ".steam"
                )
                .join(
                    "root"
                ),
            home
                .join(
                    ".local"
                )
                .join(
                    "share"
                )
                .join(
                    "Steam"
                ),
            home
                .join(
                    ".var"
                )
                .join(
                    "app"
                )
                .join(
                    "com.valvesoftware.Steam"
                )
                .join(
                    "data"
                )
                .join(
                    "Steam"
                ),
        ] {
            roots.push(
                steam_root
                    .join(
                        "steamapps"
                    )
                    .join(
                        "common"
                    )
            );

            roots.push(
                steam_root
                    .join(
                        "compatibilitytools.d"
                    )
            );
        }
    }

    for root in
        roots
    {
        let Some(
            directory
        ) =
            find_tool_directory(
                &root,
                tool,
            )
        else {
            continue;
        };

        let runner =
            directory.join(
                "proton"
            );

        if runner.is_file() {
            return Ok(
                runner
            );
        }
    }

    Err(
        format!(
            "GameAtlas could not locate the configured Proton runner '{}'. Standard Launcher mode will still use Steam's normal compatibility pipeline.",
            tool
        )
    )
}


#[cfg(not(target_os = "windows"))]
fn launch_native_linux_target(
    executable: &Path,
    arguments: &[String],
    working_directory: &Path,
) -> Result<(), String> {
    let mut command =
        if let Some(
            host_exec
        ) =
            executable_in_path(
                "distrobox-host-exec"
            )
        {
            let mut command =
                Command::new(
                    host_exec
                );

            command.arg(
                executable
            );

            command
        } else {
            Command::new(
                executable
            )
        };

    command
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
                    "Failed to launch the Linux profile executable: {}",
                    error
                )
            }
        )?;

    Ok(())
}


#[cfg(not(target_os = "windows"))]
fn launch_proton_target(
    executable: &Path,
    arguments: &[String],
    working_directory: &Path,
    proton_prefix: &Path,
    compatibility_tool: &str,
) -> Result<(), String> {
    let runner =
        proton_runner(
            proton_prefix,
            compatibility_tool,
        )?;

    let compat_data =
        if proton_prefix
            .file_name()
            .and_then(
                |value| {
                    value.to_str()
                }
            )
            .map(
                |value| {
                    value
                        .eq_ignore_ascii_case(
                            "pfx"
                        )
                }
            )
            .unwrap_or(
                false
            )
        {
            proton_prefix
                .parent()
                .map(
                    Path::to_path_buf
                )
                .ok_or_else(
                    || {
                        "Could not determine Steam compatdata from the Proton prefix."
                            .to_string()
                    }
                )?
        } else {
            proton_prefix
                .to_path_buf()
        };

    let steam_client_root =
        steam_library_root_from_prefix(
            proton_prefix
        );

    if let Some(
        host_exec
    ) =
        executable_in_path(
            "distrobox-host-exec"
        )
    {
        let mut command =
            Command::new(
                host_exec
            );

        command
            .arg(
                "env"
            )
            .arg(
                format!(
                    "STEAM_COMPAT_DATA_PATH={}",
                    compat_data.display()
                )
            );

        if let Some(
            client_root
        ) =
            steam_client_root
                .as_ref()
        {
            command.arg(
                format!(
                    "STEAM_COMPAT_CLIENT_INSTALL_PATH={}",
                    client_root.display()
                )
            );
        }

        command
            .arg(
                &runner
            )
            .arg(
                "run"
            )
            .arg(
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
                        "Failed to launch the Proton profile executable on the host: {}",
                        error
                    )
                }
            )?;

        return Ok(());
    }

    let mut command =
        Command::new(
            &runner
        );

    command.env(
        "STEAM_COMPAT_DATA_PATH",
        &compat_data,
    );

    if let Some(
        client_root
    ) =
        steam_client_root
            .as_ref()
    {
        command.env(
            "STEAM_COMPAT_CLIENT_INSTALL_PATH",
            client_root,
        );
    }

    command
        .arg(
            "run"
        )
        .arg(
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
                    "Failed to launch the Proton profile executable: {}",
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
    proton_prefix: Option<&str>,
    compatibility_tool: Option<&str>,
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

    if extension == "exe" {
        let prefix =
            proton_prefix
                .map(
                    str::trim
                )
                .filter(
                    |value| {
                        !value.is_empty()
                    }
                )
                .ok_or_else(
                    || {
                        "A Windows .exe Direct Executable profile on Linux requires this game's Proton prefix. Use a detected Steam/Proton game or Standard Launcher mode."
                            .to_string()
                    }
                )?;

        let tool =
            compatibility_tool
                .map(
                    str::trim
                )
                .filter(
                    |value| {
                        !value.is_empty()
                    }
                )
                .ok_or_else(
                    || {
                        "A Windows .exe Direct Executable profile on Linux requires a known Proton compatibility tool. Standard Launcher mode can still use Steam's automatic compatibility selection."
                            .to_string()
                    }
                )?;

        return launch_proton_target(
            executable,
            arguments,
            working_directory,
            Path::new(
                prefix
            ),
            tool,
        );
    }

    launch_native_linux_target(
        executable,
        arguments,
        working_directory,
    )
}


#[cfg(not(target_os = "windows"))]
fn push_proton_tools_from_root(
    root: &Path,
    source: &str,
    tools: &mut Vec<ProtonToolInfo>,
) {
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };

    for entry in entries.flatten() {
        let directory = entry.path();

        if !directory.is_dir() {
            continue;
        }

        let runner = directory.join("proton");

        if !runner.is_file() {
            continue;
        }

        let Some(name) = directory
            .file_name()
            .and_then(|value| value.to_str())
        else {
            continue;
        };

        tools.push(ProtonToolInfo {
            name: name.to_string(),
            path: runner.to_string_lossy().to_string(),
            source: source.to_string(),
        });
    }
}


#[cfg(not(target_os = "windows"))]
fn discover_installed_proton_tools() -> Vec<ProtonToolInfo> {
    let mut tools = Vec::new();

    let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
        return tools;
    };

    let steam_roots = [
        (home.join(".steam").join("steam"), "Steam"),
        (home.join(".steam").join("root"), "Steam"),
        (home.join(".local").join("share").join("Steam"), "Steam"),
        (
            home.join(".var")
                .join("app")
                .join("com.valvesoftware.Steam")
                .join("data")
                .join("Steam"),
            "Steam Flatpak",
        ),
    ];

    for (steam_root, source) in steam_roots {
        push_proton_tools_from_root(
            &steam_root.join("steamapps").join("common"),
            source,
            &mut tools,
        );

        push_proton_tools_from_root(
            &steam_root.join("compatibilitytools.d"),
            "Custom / compatibilitytools.d",
            &mut tools,
        );
    }

    tools.sort_by(|left, right| {
        left.name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase())
    });

    tools.dedup_by(|left, right| left.path == right.path);

    tools
}


#[tauri::command]
pub fn get_installed_proton_tools() -> Result<Vec<ProtonToolInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        Ok(Vec::new())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(discover_installed_proton_tools())
    }
}


#[tauri::command]
pub fn launch_profile_executable(
    executable_path: String,
    arguments: Vec<String>,
    working_directory: Option<String>,
    proton_prefix: Option<String>,
    compatibility_tool: Option<String>,
    custom_proton_path: Option<String>,
) -> Result<ProfileLaunchResult, String> {
    let executable = clean_path(&executable_path);

    validate_executable(&executable)?;

    let working =
        resolved_working_directory(&executable, working_directory.as_deref())?;

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

    #[cfg(target_os = "windows")]
    launch_target(
        &executable,
        &arguments,
        &working,
    )?;

    #[cfg(not(target_os = "windows"))]
    {
        let extension =
            executable
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();

        let custom_runner =
            custom_proton_path
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty());

        if extension == "exe" {
            if let Some(runner) = custom_runner {
                let prefix =
                    proton_prefix
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .ok_or_else(|| {
                            "A custom Proton override requires this game's Proton prefix."
                                .to_string()
                        })?;

                let runner_path = PathBuf::from(runner);

                if !runner_path.is_file() {
                    return Err(
                        format!(
                            "The selected custom Proton runner no longer exists: {}",
                            runner_path.display()
                        )
                    );
                }

                let prefix_path = Path::new(prefix);

                let compat_data =
                    if prefix_path
                        .file_name()
                        .and_then(|value| value.to_str())
                        .map(|value| value.eq_ignore_ascii_case("pfx"))
                        .unwrap_or(false)
                    {
                        prefix_path
                            .parent()
                            .map(Path::to_path_buf)
                            .ok_or_else(|| {
                                "Could not determine compatdata path from the Proton prefix."
                                    .to_string()
                            })?
                    } else {
                        prefix_path.to_path_buf()
                    };

                let steam_client_root =
                    steam_library_root_from_prefix(prefix_path);

                if let Some(host_exec) =
                    executable_in_path("distrobox-host-exec")
                {
                    let mut command =
                        Command::new(host_exec);

                    command
                        .arg("env")
                        .arg(format!(
                            "STEAM_COMPAT_DATA_PATH={}",
                            compat_data.display()
                        ));

                    if let Some(client_root) =
                        steam_client_root.as_ref()
                    {
                        command.arg(format!(
                            "STEAM_COMPAT_CLIENT_INSTALL_PATH={}",
                            client_root.display()
                        ));
                    }

                    command
                        .arg(&runner_path)
                        .arg("run")
                        .arg(&executable)
                        .args(&arguments)
                        .current_dir(&working)
                        .spawn()
                        .map_err(|error| {
                            format!(
                                "Failed to launch the selected custom Proton runner on the host: {}",
                                error
                            )
                        })?;
                } else {
                    let mut command =
                        Command::new(&runner_path);

                    command.env(
                        "STEAM_COMPAT_DATA_PATH",
                        &compat_data,
                    );

                    if let Some(client_root) =
                        steam_client_root.as_ref()
                    {
                        command.env(
                            "STEAM_COMPAT_CLIENT_INSTALL_PATH",
                            client_root,
                        );
                    }

                    command
                        .arg("run")
                        .arg(&executable)
                        .args(&arguments)
                        .current_dir(&working)
                        .spawn()
                        .map_err(|error| {
                            format!(
                                "Failed to launch the selected custom Proton runner: {}",
                                error
                            )
                        })?;
                }
            } else {
                launch_target(
                    &executable,
                    &arguments,
                    &working,
                    proton_prefix.as_deref(),
                    compatibility_tool.as_deref(),
                )?;
            }
        } else {
            launch_target(
                &executable,
                &arguments,
                &working,
                proton_prefix.as_deref(),
                compatibility_tool.as_deref(),
            )?;
        }
    }

    #[cfg(target_os = "windows")]
    let method =
        "direct_executable".to_string();

    #[cfg(not(target_os = "windows"))]
    let method = {
        let extension =
            executable
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();

        if extension == "exe"
            && custom_proton_path
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .is_some()
        {
            "custom_proton_direct_executable".to_string()
        } else if extension == "exe" {
            "proton_direct_executable".to_string()
        } else {
            "native_linux_executable".to_string()
        }
    };

    Ok(ProfileLaunchResult {
        launched: true,
        method,
        message:
            "Launch profile started successfully."
                .to_string(),
    })
}
