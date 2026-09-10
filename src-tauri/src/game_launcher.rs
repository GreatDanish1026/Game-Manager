use std::{
    env,
    path::{
        Path,
        PathBuf,
    },
    process::Command,
};

use serde::Serialize;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 =
    0x08000000;

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


#[cfg(target_os = "linux")]
fn steam_candidates() -> Vec<PathBuf> {
    let mut candidates =
        Vec::new();

    /*
     * Native Linux install.
     */
    for path in [
        "/usr/bin/steam",
        "/usr/local/bin/steam",
    ] {
        candidates.push(
            PathBuf::from(
                path
            )
        );
    }

    /*
     * Bazzite development commonly runs GameAtlas inside Distrobox.
     * The container shares HOME with the host, so detecting a host
     * Steam data directory is enough to know Steam is present even
     * when the host's /usr/bin/steam is not mounted into the container.
     */
    if let Ok(home) =
        env::var(
            "HOME"
        )
    {
        for relative in [
            ".steam/steam",
            ".local/share/Steam",
            ".var/app/com.valvesoftware.Steam/data/Steam",
        ] {
            candidates.push(
                PathBuf::from(
                    &home
                )
                .join(
                    relative
                )
            );
        }
    }

    candidates
}


#[cfg(not(any(
    target_os = "windows",
    target_os = "linux"
)))]
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
fn ea_app_candidates() -> Vec<PathBuf> {
    let mut candidates =
        Vec::new();

    if let Ok(program_files) =
        env::var(
            "ProgramFiles"
        )
    {
        let root =
            PathBuf::from(
                program_files
            )
            .join(
                "Electronic Arts"
            )
            .join(
                "EA Desktop"
            )
            .join(
                "EA Desktop"
            );

        candidates.push(
            root.join(
                "EADesktop.exe"
            )
        );

        candidates.push(
            root.join(
                "EALauncher.exe"
            )
        );
    }

    /*
     * Older/migrated installations can still be under x86 Program Files.
     */
    if let Ok(program_files_x86) =
        env::var(
            "ProgramFiles(x86)"
        )
    {
        let root =
            PathBuf::from(
                program_files_x86
            )
            .join(
                "Electronic Arts"
            )
            .join(
                "EA Desktop"
            )
            .join(
                "EA Desktop"
            );

        candidates.push(
            root.join(
                "EADesktop.exe"
            )
        );

        candidates.push(
            root.join(
                "EALauncher.exe"
            )
        );
    }

    candidates
}


#[cfg(not(target_os = "windows"))]
fn ea_app_candidates() -> Vec<PathBuf> {
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


fn ea_launcher_status() -> LauncherStatus {
    let path =
        existing_path(
            ea_app_candidates()
        );

    let origin2 =
        protocol_registered(
            "origin2"
        );

    let link2ea =
        protocol_registered(
            "link2ea"
        );

    let protocol_ok =
        origin2
        || link2ea;

    let installed =
        path.is_some()
        || protocol_ok;

    let message =
        if installed {
            if path.is_some()
                && protocol_ok
            {
                "EA app executable and Windows launch protocol detected."
                    .to_string()
            } else if path.is_some() {
                "EA app executable detected."
                    .to_string()
            } else {
                "EA Windows launch protocol detected."
                    .to_string()
            }
        } else {
            "EA app was not detected. EA games may not start until the EA app is installed or repaired."
                .to_string()
        };

    LauncherStatus {
        id:
            "ea"
                .to_string(),

        label:
            "EA app"
                .to_string(),

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
            "origin2:// game launch"
                .to_string(),

        message,
    }
}



#[cfg(target_os = "windows")]
fn xbox_launcher_status() -> LauncherStatus {
let script =
    r#"$gamingApp = Get-AppxPackage -Name Microsoft.GamingApp -ErrorAction SilentlyContinue;
    $gamingServices = Get-AppxPackage -Name Microsoft.GamingServices -ErrorAction SilentlyContinue;
    if ($gamingApp -or $gamingServices) { exit 0 } else { exit 1 }"#;

    let detected =
        Command::new(
            "powershell.exe"
        )
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .creation_flags(
            CREATE_NO_WINDOW
        )
        .status()
        .map(
            |status| {
                status.success()
            }
        )
        .unwrap_or(false);

    LauncherStatus {
        id:
            "xbox"
                .to_string(),

        label:
            "Xbox / Microsoft Store"
                .to_string(),

        installed:
            detected,

        path:
            None,

        protocol_registered:
            detected,

        launch_method:
            "Windows package registration / AUMID"
                .to_string(),

        message:
            if detected {
                "Xbox app or Windows Gaming Services detected. Microsoft Store games launch through Windows package registration."
                    .to_string()
            } else {
                "Xbox app / Windows Gaming Services were not detected. Xbox or Microsoft Store games may not launch until Gaming Services is installed."
                    .to_string()
            },
    }
}


#[cfg(not(target_os = "windows"))]
fn xbox_launcher_status() -> LauncherStatus {
    LauncherStatus {
        id:
            "xbox"
                .to_string(),

        label:
            "Xbox / Microsoft Store"
                .to_string(),

        installed:
            false,

        path:
            None,

        protocol_registered:
            false,

        launch_method:
            "Windows package registration / AUMID"
                .to_string(),

        message:
            "Xbox / Microsoft Store integration is currently available on Windows."
                .to_string(),
    }
}

#[cfg(target_os = "linux")]
fn heroic_command_available(
    program: &str,
    args: &[&str],
) -> bool {
    let direct =
        Command::new(
            program
        )
        .args(
            args
        )
        .status()
        .map(
            |status| {
                status.success()
            }
        )
        .unwrap_or(
            false
        );

    if direct {
        return true;
    }

    if command_exists(
        "distrobox-host-exec"
    ) {
        let mut host_args =
            Vec::with_capacity(
                args.len() + 1
            );

        host_args.push(
            program
        );

        host_args.extend_from_slice(
            args
        );

        return Command::new(
            "distrobox-host-exec"
        )
        .args(
            host_args
        )
        .status()
        .map(
            |status| {
                status.success()
            }
        )
        .unwrap_or(
            false
        );
    }

    false
}


#[cfg(target_os = "linux")]
fn heroic_flatpak_available() -> bool {
    heroic_command_available(
        "flatpak",
        &[
            "info",
            "com.heroicgameslauncher.hgl",
        ],
    )
}


#[cfg(target_os = "linux")]
fn heroic_native_available() -> bool {
    heroic_command_available(
        "heroic",
        &[
            "--version",
        ],
    )
}


#[cfg(target_os = "linux")]
fn heroic_launcher_status() -> LauncherStatus {
    let flatpak =
        heroic_flatpak_available();

    let native =
        heroic_native_available();

    let installed =
        flatpak
            || native;

    LauncherStatus {
        id:
            "heroic"
                .to_string(),

        label:
            "Heroic Games Launcher"
                .to_string(),

        installed,

        path:
            if flatpak {
                Some(
                    "flatpak:com.heroicgameslauncher.hgl"
                        .to_string()
                )
            } else if native {
                Some(
                    "heroic"
                        .to_string()
                )
            } else {
                None
            },

        protocol_registered:
            installed,

        launch_method:
            "Heroic launch protocol"
                .to_string(),

        message:
            if flatpak {
                "Heroic Flatpak detected. Epic and GOG games can launch through Heroic with their configured Wine/Proton settings."
                    .to_string()
            } else if native {
                "Heroic detected. Epic and GOG games can launch through Heroic with their configured Wine/Proton settings."
                    .to_string()
            } else {
                "Heroic Games Launcher was not detected on the Linux host."
                    .to_string()
            },
    }
}


#[cfg(not(target_os = "linux"))]
fn heroic_launcher_status() -> LauncherStatus {
    LauncherStatus {
        id:
            "heroic"
                .to_string(),

        label:
            "Heroic Games Launcher"
                .to_string(),

        installed:
            false,

        path:
            None,

        protocol_registered:
            false,

        launch_method:
            "Heroic launch protocol"
                .to_string(),

        message:
            "Heroic integration is currently enabled for Linux GameAtlas builds."
                .to_string(),
    }
}


#[cfg(target_os = "linux")]
fn launch_heroic_game(
    runner: &str,
    app_name: &str,
) -> Result<(), String> {
    let uri =
        format!(
            "heroic://launch?appName={}&runner={}",
            app_name,
            runner
        );

    let use_host =
        command_exists(
            "distrobox-host-exec"
        );

    if heroic_flatpak_available() {
        let mut command =
            if use_host {
                let mut command =
                    Command::new(
                        "distrobox-host-exec"
                    );

                command.arg(
                    "flatpak"
                );

                command
            } else {
                Command::new(
                    "flatpak"
                )
            };

        command
            .args([
                "run",
                "com.heroicgameslauncher.hgl",
                "--no-gui",
                &uri,
            ])
            .spawn()
            .map_err(
                |error| {
                    format!(
                        "Heroic Flatpak was detected, but GameAtlas could not start the game: {}",
                        error
                    )
                }
            )?;

        return Ok(());
    }

    if heroic_native_available() {
        let mut command =
            if use_host {
                let mut command =
                    Command::new(
                        "distrobox-host-exec"
                    );

                command.arg(
                    "heroic"
                );

                command
            } else {
                Command::new(
                    "heroic"
                )
            };

        command
            .arg(
                "--no-gui"
            )
            .arg(
                &uri
            )
            .spawn()
            .map_err(
                |error| {
                    format!(
                        "Heroic was detected, but GameAtlas could not start the game: {}",
                        error
                    )
                }
            )?;

        return Ok(());
    }

    /*
     * Last chance: use the desktop protocol handler. This covers
     * installations where Heroic registered the protocol but its binary
     * isn't on GameAtlas's PATH.
     */
    open_protocol(
        &uri
    )
}


#[cfg(not(target_os = "linux"))]
fn launch_heroic_game(
    _runner: &str,
    _app_name: &str,
) -> Result<(), String> {
    Err(
        "Heroic game launching is currently enabled for Linux GameAtlas builds."
            .to_string()
    )
}


#[cfg(target_os = "linux")]
fn lutris_command_success(
    program: &str,
    args: &[&str],
) -> bool {
    let direct =
        Command::new(
            program
        )
        .args(
            args
        )
        .status()
        .map(
            |status| {
                status.success()
            }
        )
        .unwrap_or(
            false
        );

    if direct {
        return true;
    }

    if command_exists(
        "distrobox-host-exec"
    ) {
        let mut host_args =
            Vec::with_capacity(
                args.len() + 1
            );

        host_args.push(
            program
        );

        host_args.extend_from_slice(
            args
        );

        return Command::new(
            "distrobox-host-exec"
        )
        .args(
            host_args
        )
        .status()
        .map(
            |status| {
                status.success()
            }
        )
        .unwrap_or(
            false
        );
    }

    false
}


#[cfg(target_os = "linux")]
fn lutris_flatpak_available() -> bool {
    lutris_command_success(
        "flatpak",
        &[
            "info",
            "net.lutris.Lutris",
        ],
    )
}


#[cfg(target_os = "linux")]
fn lutris_native_available() -> bool {
    lutris_command_success(
        "lutris",
        &[
            "--version",
        ],
    )
}


#[cfg(target_os = "linux")]
fn lutris_launcher_status() -> LauncherStatus {
    let flatpak =
        lutris_flatpak_available();

    let native =
        lutris_native_available();

    let installed =
        flatpak
            || native;

    LauncherStatus {
        id:
            "lutris"
                .to_string(),

        label:
            "Lutris"
                .to_string(),

        installed,

        path:
            if flatpak {
                Some(
                    "flatpak:net.lutris.Lutris"
                        .to_string()
                )
            } else if native {
                Some(
                    "lutris"
                        .to_string()
                )
            } else {
                None
            },

        protocol_registered:
            installed,

        launch_method:
            "Lutris rungameid protocol"
                .to_string(),

        message:
            if flatpak {
                "Lutris Flatpak detected. Games launch through Lutris with their configured runner and prefix."
                    .to_string()
            } else if native {
                "Lutris detected. Games launch through Lutris with their configured runner and prefix."
                    .to_string()
            } else {
                "Lutris was not detected on the Linux host."
                    .to_string()
            },
    }
}


#[cfg(not(target_os = "linux"))]
fn lutris_launcher_status() -> LauncherStatus {
    LauncherStatus {
        id:
            "lutris"
                .to_string(),

        label:
            "Lutris"
                .to_string(),

        installed:
            false,

        path:
            None,

        protocol_registered:
            false,

        launch_method:
            "Lutris rungameid protocol"
                .to_string(),

        message:
            "Lutris integration is currently enabled for Linux GameAtlas builds."
                .to_string(),
    }
}


#[cfg(target_os = "linux")]
fn launch_lutris_game(
    game_id: &str,
) -> Result<(), String> {
    let uri =
        format!(
            "lutris:rungameid/{}",
            game_id
        );

    let host_exec =
        command_exists(
            "distrobox-host-exec"
        );

    if lutris_flatpak_available() {
        let mut command =
            if host_exec {
                let mut command =
                    Command::new(
                        "distrobox-host-exec"
                    );

                command.arg(
                    "flatpak"
                );

                command
            } else {
                Command::new(
                    "flatpak"
                )
            };

        command
            .args([
                "run",
                "net.lutris.Lutris",
                &uri,
            ])
            .spawn()
            .map_err(
                |error| {
                    format!(
                        "Lutris Flatpak was detected, but GameAtlas could not start the game: {}",
                        error
                    )
                }
            )?;

        return Ok(());
    }

    if lutris_native_available() {
        let mut command =
            if host_exec {
                let mut command =
                    Command::new(
                        "distrobox-host-exec"
                    );

                command.arg(
                    "lutris"
                );

                command
            } else {
                Command::new(
                    "lutris"
                )
            };

        command
            .arg(
                &uri
            )
            .spawn()
            .map_err(
                |error| {
                    format!(
                        "Lutris was detected, but GameAtlas could not start the game: {}",
                        error
                    )
                }
            )?;

        return Ok(());
    }

    Err(
        "Lutris is not available on the Linux host."
            .to_string()
    )
}


#[cfg(not(target_os = "linux"))]
fn launch_lutris_game(
    _game_id: &str,
) -> Result<(), String> {
    Err(
        "Lutris launching is currently enabled for Linux GameAtlas builds."
            .to_string()
    )
}


fn all_launcher_statuses() -> Vec<LauncherStatus> {
    vec![
        lutris_launcher_status(),

        heroic_launcher_status(),

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

        ea_launcher_status(),

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

        xbox_launcher_status(),    ]
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
        if normalized == "heroic - epic" || normalized == "heroic - gog" || normalized == "heroic" {
            "heroic"
        } else if normalized == "lutris" || normalized.starts_with("lutris - ") {
            "lutris"
        } else if normalized == "steam" {
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
        } else if normalized == "ea"
            || normalized == "ea app"
            || normalized == "origin"
            || normalized == "origin games"
        {
            "ea"
        } else if normalized == "ubisoft"
            || normalized == "ubisoft connect"
            || normalized == "uplay"
        {
            "ubisoft"
        } else if normalized == "xbox"
            || normalized == "microsoft store"
            || normalized == "xbox / microsoft store"
            || normalized == "xbox app"
        {
            "xbox"
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
    /*
     * `cmd /C start` can return exit code 1 for custom URI protocols even
     * after Windows successfully hands the URI to the registered launcher.
     * EA App is one confirmed example: the game starts, but waiting for the
     * short-lived cmd.exe process reports a false failure.
     *
     * For protocol launches, the meaningful synchronous check is whether
     * Windows was able to start the shell handoff process. The launcher itself
     * is asynchronous, so its eventual game-start result cannot be inferred
     * from cmd.exe's exit code.
     */
    Command::new(
        "cmd.exe"
    )
    .args([
        "/C",
        "start",
        "",
        uri,
    ])
    .creation_flags(
        CREATE_NO_WINDOW
    )
    .spawn()
    .map_err(
        |error| {
            format!(
                "Windows could not hand the launch request to the game launcher: {}",
                error
            )
        }
    )?;

    Ok(())
}


#[cfg(target_os = "linux")]
fn command_exists(
    command: &str,
) -> bool {
    Command::new(
        "sh"
    )
    .args([
        "-lc",
        &format!(
            "command -v {} >/dev/null 2>&1",
            command
        ),
    ])
    .status()
    .map(
        |status| {
            status.success()
        }
    )
    .unwrap_or(
        false
    )
}


#[cfg(target_os = "linux")]
fn open_protocol(
    uri: &str,
) -> Result<(), String> {
    /*
     * When developing GameAtlas in Distrobox, Steam lives on the
     * Bazzite host rather than inside the Fedora development container.
     * Prefer a host-exec handoff for Steam URIs when available.
     */
    if uri.starts_with(
        "steam://"
    )
        && command_exists(
            "distrobox-host-exec"
        )
    {
        Command::new(
            "distrobox-host-exec"
        )
        .arg(
            "steam"
        )
        .arg(
            uri
        )
        .spawn()
        .map_err(
            |error| {
                format!(
                    "GameAtlas could not send the Steam launch request to the Bazzite host: {}",
                    error
                )
            }
        )?;

        return Ok(());
    }

    /*
     * Native Linux GameAtlas build with a directly available Steam
     * client.
     */
    if uri.starts_with(
        "steam://"
    )
        && command_exists(
            "steam"
        )
    {
        Command::new(
            "steam"
        )
        .arg(
            uri
        )
        .spawn()
        .map_err(
            |error| {
                format!(
                    "GameAtlas detected Steam but could not start the game: {}",
                    error
                )
            }
        )?;

        return Ok(());
    }

    /*
     * Desktop URI handler / portal fallback. This also allows a
     * containerized environment to hand the URI out through xdg-open.
     */
    Command::new(
        "xdg-open"
    )
    .arg(
        uri
    )
    .spawn()
    .map_err(
        |error| {
            format!(
                "Failed to open launcher URI: {}",
                error
            )
        }
    )?;

    Ok(())
}


#[cfg(not(any(
    target_os = "windows",
    target_os = "linux"
)))]
fn open_protocol(
    _uri: &str,
) -> Result<(), String> {
    Err(
        "Launcher URI opening is not supported on this operating system."
            .to_string()
    )
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

    if store_normalized == "xbox"
        || store_normalized == "microsoft store"
        || store_normalized == "xbox / microsoft store"
        || store_normalized == "xbox app"
    {
        let aumid =
            clean_launcher_id(
                launcher_id
                    .as_deref()
            )
            .ok_or_else(
                || {
                    "Xbox / Microsoft Store is available, but this game is missing its Windows AUMID."
                        .to_string()
                }
            )?;

        crate::xbox_games::launch_xbox_aumid(
            &aumid
        )?;

        return Ok(
            LaunchResult {
                launched:
                    true,

                method:
                    "windows_aumid"
                        .to_string(),

                message:
                    "Launch request sent to Windows / Xbox."
                        .to_string(),
            }
        );
    }

    if store_normalized
        == "heroic - epic"
        || store_normalized
            == "heroic - gog"
        || store_normalized
            == "heroic"
    {
        let encoded =
            clean_launcher_id(
                launcher_id
                    .as_deref()
            )
            .ok_or_else(
                || {
                    "This Heroic game is missing its Heroic runner/app identifier."
                        .to_string()
                }
            )?;

        let (
            runner,
            app_name
        ) =
            encoded
                .split_once(
                    ':'
                )
                .ok_or_else(
                    || {
                        "The Heroic game identifier is invalid."
                            .to_string()
                    }
                )?;

        logging::dev_log(
            &format!(
                "[HEROIC LAUNCH] runner={:?}, app={:?}",
                runner,
                app_name
            )
        );

        launch_heroic_game(
            runner,
            app_name,
        )?;

        return Ok(
            LaunchResult {
                launched:
                    true,

                method:
                    "heroic_protocol"
                        .to_string(),

                message:
                    "Launch request sent to Heroic."
                        .to_string(),
            }
        );
    }


    if store_normalized
        == "lutris"
        || store_normalized
            .starts_with(
                "lutris - "
            )
    {
        let game_id =
            clean_launcher_id(
                launcher_id
                    .as_deref()
            )
            .ok_or_else(
                || {
                    "This Lutris game is missing its Lutris game ID."
                        .to_string()
                }
            )?;

        logging::dev_log(
            &format!(
                "[LUTRIS LAUNCH] id={:?}",
                game_id
            )
        );

        launch_lutris_game(
            &game_id
        )?;

        return Ok(
            LaunchResult {
                launched:
                    true,

                method:
                    "lutris_rungameid"
                        .to_string(),

                message:
                    "Launch request sent to Lutris."
                        .to_string(),
            }
        );
    }


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

    if store_normalized == "ea"
        || store_normalized == "ea app"
        || store_normalized == "origin"
        || store_normalized == "origin games"
    {
        let content_id =
            clean_launcher_id(
                launcher_id
                    .as_deref()
            )
            .or_else(
                || {
                    clean_launcher_id(
                        game_id
                            .as_deref()
                    )
                }
            )
            .ok_or_else(
                || {
                    "EA app is available, but this game is missing its EA Content ID."
                        .to_string()
                }
            )?;

        let uri =
            format!(
                "origin2://game/launch?offerIds={}&autoDownload=1",
                content_id
            );

        open_protocol(
            &uri
        )?;

        return Ok(
            LaunchResult {
                launched:
                    true,

                method:
                    "ea_origin2_uri"
                        .to_string(),

                message:
                    "Launch request sent to the EA app."
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
