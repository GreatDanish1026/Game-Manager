use std::{
    env,
    path::{
        Path,
        PathBuf,
    },
    process::Command,
};

use serde::Serialize;

use crate::logging;

#[cfg(target_os = "windows")]
use winreg::{
    enums::{
        HKEY_CLASSES_ROOT,
        HKEY_CURRENT_USER,
    },
    RegKey,
};


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResult {
    pub launched: bool,
    pub method: String,
    pub message: String,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherStatus {
    pub id: String,
    pub label: String,
    pub installed: bool,
    pub path: Option<String>,
    pub protocol_registered: bool,
    pub launch_method: String,
    pub message: String,
}


fn normalized_store(
    store: &str,
) -> String {
    store
        .trim()
        .to_ascii_lowercase()
}


fn existing_path(
    candidates: Vec<PathBuf>,
) -> Option<PathBuf> {
    candidates
        .into_iter()
        .find(
            |candidate| {
                candidate.exists()
            }
        )
}


#[cfg(target_os = "windows")]
fn registry_string(
    root: &RegKey,
    subkey: &str,
    value: &str,
) -> Option<String> {
    let key =
        root
            .open_subkey(
                subkey
            )
            .ok()?;

    key.get_value::<String, _>(
        value
    )
    .ok()
    .map(
        |entry| {
            entry
                .trim()
                .trim_matches('"')
                .to_string()
        }
    )
    .filter(
        |entry| {
            !entry.is_empty()
        }
    )
}


#[cfg(target_os = "windows")]
fn protocol_registered(
    protocol: &str,
) -> bool {
    let hkcr =
        RegKey::predef(
            HKEY_CLASSES_ROOT
        );

    hkcr.open_subkey(
        protocol
    )
    .is_ok()
}


#[cfg(not(target_os = "windows"))]
fn protocol_registered(
    _protocol: &str,
) -> bool {
    false
}


#[cfg(target_os = "windows")]
fn steam_candidates() -> Vec<PathBuf> {
    let mut candidates =
        Vec::new();

    let hkcu =
        RegKey::predef(
            HKEY_CURRENT_USER
        );

    if let Some(path) =
        registry_string(
            &hkcu,
            r"Software\Valve\Steam",
            "SteamPath",
        )
    {
        candidates.push(
            PathBuf::from(path)
                .join("steam.exe")
        );
    }

    if let Ok(program_files_x86) =
        env::var(
            "ProgramFiles(x86)"
        )
    {
        candidates.push(
            PathBuf::from(
                program_files_x86
            )
            .join("Steam")
            .join("steam.exe")
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
            .join("Steam")
            .join("steam.exe")
        );
    }

    candidates
}


#[cfg(not(target_os = "windows"))]
fn steam_candidates() -> Vec<PathBuf> {
    Vec::new()
}


#[cfg(target_os = "windows")]
fn epic_candidates() -> Vec<PathBuf> {
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
            .join("Epic Games")
            .join("Launcher")
            .join("Portal")
            .join("Binaries")
            .join("Win64")
            .join("EpicGamesLauncher.exe")
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
            .join("Epic Games")
            .join("Launcher")
            .join("Portal")
            .join("Binaries")
            .join("Win64")
            .join("EpicGamesLauncher.exe")
        );
    }

    candidates
}


#[cfg(not(target_os = "windows"))]
fn epic_candidates() -> Vec<PathBuf> {
    Vec::new()
}


#[cfg(target_os = "windows")]
fn ubisoft_candidates() -> Vec<PathBuf> {
    let mut candidates =
        Vec::new();

    for variable in [
        "ProgramFiles(x86)",
        "ProgramFiles",
    ] {
        if let Ok(program_files) =
            env::var(variable)
        {
            let root =
                PathBuf::from(
                    program_files
                )
                .join("Ubisoft")
                .join("Ubisoft Game Launcher");

            candidates.push(
                root.join(
                    "UbisoftConnect.exe"
                )
            );

            candidates.push(
                root.join(
                    "upc.exe"
                )
            );
        }
    }

    candidates
}


#[cfg(not(target_os = "windows"))]
fn ubisoft_candidates() -> Vec<PathBuf> {
    Vec::new()
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
            .join("GOG Galaxy")
            .join("GalaxyClient.exe")
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
            .join("GOG Galaxy")
            .join("GalaxyClient.exe")
        );
    }

    candidates
}


#[cfg(not(target_os = "windows"))]
fn gog_galaxy_candidates() -> Vec<PathBuf> {
    Vec::new()
}


fn launcher_status(
    id: &str,
    label: &str,
    candidates: Vec<PathBuf>,
    protocol: Option<&str>,
    launch_method: &str,
) -> LauncherStatus {
    let path =
        existing_path(
            candidates
        );

    let protocol_ok =
        protocol
            .map(
                protocol_registered
            )
            .unwrap_or(false);

    let installed =
        path.is_some()
        || protocol_ok;

    let message =
        if installed {
            if path.is_some()
                && protocol_ok
            {
                "Launcher executable and Windows protocol handler detected."
                    .to_string()
            } else if path.is_some() {
                "Launcher executable detected."
                    .to_string()
            } else {
                "Windows launcher protocol handler detected."
                    .to_string()
            }
        } else {
            format!(
                "{} was not detected. Games from this launcher may not start until the launcher is installed or repaired.",
                label
            )
        };

    LauncherStatus {
        id:
            id.to_string(),

        label:
            label.to_string(),

        installed,

        path:
            path.map(
                |entry| {
                    entry
                        .to_string_lossy()
                        .to_string()
                }
            ),

        protocol_registered:
            protocol_ok,

        launch_method:
            launch_method
                .to_string(),

        message,
    }
}


fn all_launcher_statuses() -> Vec<LauncherStatus> {
    vec![
        launcher_status(
            "steam",
            "Steam",
            steam_candidates(),
            Some("steam"),
            "steam:// protocol",
        ),

        launcher_status(
            "epic",
            "Epic Games Launcher",
            epic_candidates(),
            Some(
                "com.epicgames.launcher"
            ),
            "Epic Games protocol",
        ),

        launcher_status(
            "gog",
            "GOG Galaxy",
            gog_galaxy_candidates(),
            None,
            "GalaxyClient.exe",
        ),

        launcher_status(
            "ubisoft",
            "Ubisoft Connect",
            ubisoft_candidates(),
            Some("uplay"),
            "uplay:// protocol",
        ),
    ]
}


#[tauri::command]
pub fn get_launcher_status()
    -> Result<Vec<LauncherStatus>, String>
{
    Ok(
        all_launcher_statuses()
    )
}


fn launcher_status_for_store(
    store: &str,
) -> Option<LauncherStatus> {
    let normalized =
        normalized_store(
            store
        );

    let id =
        if normalized == "steam" {
            "steam"
        } else if normalized == "epic"
            || normalized == "epic games"
            || normalized == "epic games store"
        {
            "epic"
        } else if normalized == "gog"
            || normalized == "gog galaxy"
        {
            "gog"
        } else if normalized == "ubisoft"
            || normalized == "ubisoft connect"
            || normalized == "uplay"
        {
            "ubisoft"
        } else {
            return None;
        };

    all_launcher_statuses()
        .into_iter()
        .find(
            |status| {
                status.id == id
            }
        )
}


#[cfg(target_os = "windows")]
fn open_protocol(
    uri: &str,
) -> Result<(), String> {
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
                    "Windows could not hand the launch request to the game launcher: {}",
                    error
                )
            }
        )?;

    if !status.success() {
        return Err(
            format!(
                "Windows launcher protocol request failed with exit code {:?}.",
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
        .arg(uri)
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
        .map(str::trim)
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

    if candidate
        .chars()
        .all(
            |character| {
                character
                    .is_ascii_digit()
            }
        )
    {
        Some(candidate)
    } else {
        None
    }
}


#[cfg(target_os = "windows")]
fn launch_gog(
    launcher_id: &str,
    install_path: &str,
) -> Result<(), String> {
    let client =
        existing_path(
            gog_galaxy_candidates()
        )
        .ok_or_else(
            || {
                "GOG Galaxy was not detected. Install or repair GOG Galaxy, then use Refresh Launchers in Library Overview."
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

    Command::new(client)
        .arg("/command=runGame")
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
                    "GOG Galaxy was detected, but GameAtlas could not start the game through it: {}",
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

    logging::dev_log(
        &format!(
            "[LAUNCH] Game: {:?}",
            name
        )
    );

    logging::dev_log(
        &format!(
            "[LAUNCH] Store: {:?}",
            store
        )
    );

    logging::dev_log(
        &format!(
            "[LAUNCH] Launcher ID: {:?}",
            launcher_id
        )
    );

    if let Some(status) =
        launcher_status_for_store(
            &store
        )
    {
        if !status.installed {
            return Err(
                format!(
                    "{} was not detected. Install or repair the launcher, then open Library Overview and select Refresh Launchers before trying again.",
                    status.label
                )
            );
        }
    }

    if store_normalized == "steam" {
        let app_id =
            steam_id(
                launcher_id.as_deref(),
                game_id.as_deref(),
            )
            .ok_or_else(
                || {
                    "Steam is available, but this game does not have a valid Steam AppID."
                        .to_string()
                }
            )?;

        let uri =
            format!(
                "steam://rungameid/{}",
                app_id
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

    if store_normalized == "epic"
        || store_normalized == "epic games"
        || store_normalized == "epic games store"
    {
        let app_id =
            clean_launcher_id(
                launcher_id
                    .as_deref()
            )
            .ok_or_else(
                || {
                    "Epic Games Launcher is available, but this game is missing its Epic launcher ID."
                        .to_string()
                }
            )?;

        let uri =
            format!(
                "com.epicgames.launcher://apps/{}?action=launch&silent=true",
                app_id
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

    if store_normalized == "ubisoft"
        || store_normalized == "ubisoft connect"
        || store_normalized == "uplay"
    {
        let app_id =
            clean_launcher_id(
                launcher_id
                    .as_deref()
            )
            .ok_or_else(
                || {
                    "Ubisoft Connect is available, but this game is missing its Ubisoft launcher ID."
                        .to_string()
                }
            )?;

        let uri =
            format!(
                "uplay://launch/{}/0",
                app_id
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

    if store_normalized == "gog"
        || store_normalized == "gog galaxy"
    {
        let product_id =
            clean_launcher_id(
                launcher_id
                    .as_deref()
            )
            .ok_or_else(
                || {
                    "GOG Galaxy is available, but this game is missing its GOG product ID."
                        .to_string()
                }
            )?;

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
