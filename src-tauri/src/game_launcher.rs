use std::{
    env,
    path::{
        Path,
        PathBuf,
    },
    process::Command,
};

use serde::Serialize;


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResult {
    pub launched: bool,
    pub method: String,
    pub message: String,
}


fn normalized_store(
    store: &str,
) -> String {
    store
        .trim()
        .to_ascii_lowercase()
}


#[cfg(target_os = "windows")]
fn open_protocol(
    uri: &str,
) -> Result<(), String> {
    /*
     * Use cmd.exe's START command so Windows dispatches the URI
     * through the registered launcher protocol handler.
     *
     * The empty title argument after START is required when the
     * following argument is quoted.
     */
    let status =
        Command::new(
            "cmd.exe"
        )
        .args([
            "/C",
            "start",
            "",
            uri,
        ])
        .status()
        .map_err(
            |error| {
                format!(
                    "Failed to invoke Windows protocol handler: {}",
                    error
                )
            }
        )?;

    if !status.success() {
        return Err(
            format!(
                "Windows protocol launch failed with exit code {:?}.",
                status.code()
            )
        );
    }

    Ok(())
}


#[cfg(not(target_os = "windows"))]
fn open_protocol(
    uri: &str,
) -> Result<(), String> {
    let status =
        Command::new(
            "xdg-open"
        )
        .arg(
            uri
        )
        .status()
        .map_err(
            |error| {
                format!(
                    "Failed to open launcher URI: {}",
                    error
                )
            }
        )?;

    if !status.success() {
        return Err(
            "The launcher URI could not be opened."
                .to_string()
        );
    }

    Ok(())
}


fn clean_launcher_id(
    launcher_id: Option<&str>,
) -> Option<String> {
    launcher_id
        .map(
            str::trim
        )
        .filter(
            |value| {
                !value.is_empty()
            }
        )
        .map(
            |value| {
                value
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string()
            }
        )
}


fn steam_id(
    launcher_id: Option<&str>,
    game_id: Option<&str>,
) -> Option<String> {
    let candidate =
        clean_launcher_id(
            launcher_id
        )
        .or_else(
            || {
                clean_launcher_id(
                    game_id
                )
            }
        )?;

    /*
     * Steam AppIDs are numeric. Avoid sending Game Manager's
     * composite local IDs to Steam by mistake.
     */
    if candidate
        .chars()
        .all(
            |character| {
                character
                    .is_ascii_digit()
            }
        )
    {
        Some(
            candidate
        )
    } else {
        None
    }
}


#[cfg(target_os = "windows")]
fn gog_galaxy_candidates() -> Vec<PathBuf> {
    let mut candidates =
        Vec::new();

    if let Ok(program_files_x86) =
        env::var(
            "ProgramFiles(x86)"
        )
    {
        candidates.push(
            PathBuf::from(
                program_files_x86
            )
            .join(
                "GOG Galaxy"
            )
            .join(
                "GalaxyClient.exe"
            )
        );
    }

    if let Ok(program_files) =
        env::var(
            "ProgramFiles"
        )
    {
        candidates.push(
            PathBuf::from(
                program_files
            )
            .join(
                "GOG Galaxy"
            )
            .join(
                "GalaxyClient.exe"
            )
        );
    }

    candidates
}


#[cfg(target_os = "windows")]
fn launch_gog(
    launcher_id: &str,
    install_path: &str,
) -> Result<(), String> {
    let client =
        gog_galaxy_candidates()
            .into_iter()
            .find(
                |candidate| {
                    candidate.exists()
                }
            )
            .ok_or_else(
                || {
                    "GOG Galaxy could not be found in its standard installation locations."
                        .to_string()
                }
            )?;

    let install =
        Path::new(
            install_path
        );

    if !install.exists() {
        return Err(
            format!(
                "The GOG game installation path does not exist: {}",
                install.display()
            )
        );
    }

    Command::new(
        client
    )
    .arg(
        "/command=runGame"
    )
    .arg(
        format!(
            "/gameId={}",
            launcher_id
        )
    )
    .arg(
        format!(
            "/path={}",
            install_path
        )
    )
    .spawn()
    .map_err(
        |error| {
            format!(
                "Failed to launch the game through GOG Galaxy: {}",
                error
            )
        }
    )?;

    Ok(())
}


#[cfg(not(target_os = "windows"))]
fn launch_gog(
    _launcher_id: &str,
    _install_path: &str,
) -> Result<(), String> {
    Err(
        "GOG Galaxy launching is currently implemented for Windows."
            .to_string()
    )
}


#[tauri::command]
pub fn launch_game(
    name: String,
    store: String,
    launcher_id: Option<String>,
    game_id: Option<String>,
    install_path: String,
) -> Result<LaunchResult, String> {
    let store_normalized =
        normalized_store(
            &store
        );

    println!(
        "[LAUNCH] Game: {:?}",
        name
    );

    println!(
        "[LAUNCH] Store: {:?}",
        store
    );

    println!(
        "[LAUNCH] Launcher ID: {:?}",
        launcher_id
    );

    if store_normalized
        == "steam"
    {
        let app_id =
            steam_id(
                launcher_id
                    .as_deref(),
                game_id
                    .as_deref(),
            )
            .ok_or_else(
                || {
                    "Steam AppID is missing or invalid."
                        .to_string()
                }
            )?;

        let uri =
            format!(
                "steam://rungameid/{}",
                app_id
            );

        println!(
            "[LAUNCH] Steam URI: {}",
            uri
        );

        open_protocol(
            &uri
        )?;

        return Ok(
            LaunchResult {
                launched:
                    true,

                method:
                    "steam_uri"
                        .to_string(),

                message:
                    "Launch request sent to Steam."
                        .to_string(),
            }
        );
    }


    if store_normalized
        == "epic"
        || store_normalized
            == "epic games"
        || store_normalized
            == "epic games store"
    {
        let app_id =
            clean_launcher_id(
                launcher_id
                    .as_deref()
            )
            .ok_or_else(
                || {
                    "Epic Games launcher ID is missing."
                        .to_string()
                }
            )?;

        let uri =
            format!(
                "com.epicgames.launcher://apps/{}?action=launch&silent=true",
                app_id
            );

        println!(
            "[LAUNCH] Epic URI: {}",
            uri
        );

        open_protocol(
            &uri
        )?;

        return Ok(
            LaunchResult {
                launched:
                    true,

                method:
                    "epic_uri"
                        .to_string(),

                message:
                    "Launch request sent to Epic Games Launcher."
                        .to_string(),
            }
        );
    }


    if store_normalized
        == "ubisoft"
        || store_normalized
            == "ubisoft connect"
        || store_normalized
            == "uplay"
    {
        let app_id =
            clean_launcher_id(
                launcher_id
                    .as_deref()
            )
            .ok_or_else(
                || {
                    "Ubisoft Connect launcher ID is missing."
                        .to_string()
                }
            )?;

        let uri =
            format!(
                "uplay://launch/{}/0",
                app_id
            );

        println!(
            "[LAUNCH] Ubisoft URI: {}",
            uri
        );

        open_protocol(
            &uri
        )?;

        return Ok(
            LaunchResult {
                launched:
                    true,

                method:
                    "ubisoft_uri"
                        .to_string(),

                message:
                    "Launch request sent to Ubisoft Connect."
                        .to_string(),
            }
        );
    }


    if store_normalized
        == "gog"
        || store_normalized
            == "gog galaxy"
    {
        let product_id =
            clean_launcher_id(
                launcher_id
                    .as_deref()
            )
            .ok_or_else(
                || {
                    "GOG product ID is missing."
                        .to_string()
                }
            )?;

        println!(
            "[LAUNCH] GOG product ID: {}",
            product_id
        );

        launch_gog(
            &product_id,
            &install_path,
        )?;

        return Ok(
            LaunchResult {
                launched:
                    true,

                method:
                    "gog_galaxy"
                        .to_string(),

                message:
                    "Launch request sent to GOG Galaxy."
                        .to_string(),
            }
        );
    }


    Err(
        format!(
            "Game launching is not yet implemented for the {} store.",
            store
        )
    )
}
