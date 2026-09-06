use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledGame {
    pub id: String,
    pub name: String,
    pub store: String,
    pub install_path: String,
    pub launcher_id: Option<String>,
}

#[tauri::command]
pub fn get_installed_games() -> Result<Vec<InstalledGame>, String> {
    #[cfg(target_os = "windows")]
    {
        println!("========================================");
        println!("Game Manager: starting installed-game scan");
        println!("========================================");

        let mut games = Vec::new();

        let steam_games = scan_steam();
        println!("Steam games found: {}", steam_games.len());
        games.extend(steam_games);

        let epic_games = scan_epic();
        println!("Epic games found: {}", epic_games.len());
        games.extend(epic_games);

        let gog_games = scan_gog();
        println!("GOG games found: {}", gog_games.len());
        games.extend(gog_games);

        let ubisoft_games = scan_ubisoft();
        println!("Ubisoft games found: {}", ubisoft_games.len());
        games.extend(ubisoft_games);

        remove_duplicates(&mut games);

        games.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        println!("Total installed games found: {}", games.len());
        println!("========================================");

        Ok(games)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

fn remove_duplicates(games: &mut Vec<InstalledGame>) {
    let mut seen = HashSet::new();

    games.retain(|game| {
        let key = format!(
            "{}|{}|{}",
            game.store.to_lowercase(),
            game.name.to_lowercase(),
            game.install_path.to_lowercase()
        );

        seen.insert(key)
    });
}

// ============================================================
// Steam
// ============================================================

#[cfg(target_os = "windows")]
fn scan_steam() -> Vec<InstalledGame> {
    let mut games = Vec::new();

    let Some(steam_path) = find_steam_path() else {
        println!("[Steam] Steam installation not found.");
        return games;
    };

    println!("[Steam] Installation path: {}", steam_path.display());

    let mut libraries = vec![steam_path.clone()];

    let library_file = steam_path.join("steamapps").join("libraryfolders.vdf");

    println!(
        "[Steam] Looking for library file: {}",
        library_file.display()
    );

    if let Ok(contents) = fs::read_to_string(&library_file) {
        for line in contents.lines() {
            if let Some(path) = parse_vdf_value(line, "path") {
                let normalized = path.replace("\\\\", "\\");

                let library = PathBuf::from(normalized);

                println!("[Steam] Library discovered: {}", library.display());

                if !libraries.contains(&library) {
                    libraries.push(library);
                }
            }
        }
    } else {
        println!("[Steam] Could not read libraryfolders.vdf");
    }

    for library in libraries {
        let steamapps = library.join("steamapps");

        println!("[Steam] Scanning: {}", steamapps.display());

        let Ok(entries) = fs::read_dir(&steamapps) else {
            println!("[Steam] Cannot read directory: {}", steamapps.display());
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();

            let Some(filename) = path.file_name().and_then(|f| f.to_str()) else {
                continue;
            };

            if !filename.starts_with("appmanifest_") || !filename.ends_with(".acf") {
                continue;
            }

            let Ok(contents) = fs::read_to_string(&path) else {
                continue;
            };

            let app_id = find_vdf_field(&contents, "appid");

            let name = find_vdf_field(&contents, "name");

            let install_dir = find_vdf_field(&contents, "installdir");

            let (Some(app_id), Some(name), Some(install_dir)) = (app_id, name, install_dir) else {
                println!("[Steam] Could not parse manifest: {}", path.display());

                continue;
            };

            let game_path = steamapps.join("common").join(&install_dir);

            println!("[Steam] Manifest: {} -> {}", name, game_path.display());

            if !game_path.exists() {
                println!("[Steam] Install directory missing, skipping.");

                continue;
            }

            games.push(InstalledGame {
                id: format!("steam-{app_id}"),
                name,
                store: "Steam".to_string(),
                install_path: game_path.to_string_lossy().to_string(),
                launcher_id: Some(app_id),
            });
        }
    }

    games
}

#[cfg(target_os = "windows")]
fn find_steam_path() -> Option<PathBuf> {
    use winreg::{enums::*, RegKey};

    // --------------------------------------------------------
    // Current user registry
    // --------------------------------------------------------

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    if let Ok(key) = hkcu.open_subkey("Software\\Valve\\Steam") {
        for value_name in ["SteamPath", "SteamExe"] {
            if let Ok(value) = key.get_value::<String, _>(value_name) {
                println!("[Steam] Registry {} = {}", value_name, value);

                let mut path = PathBuf::from(value);

                if path.is_file() {
                    path.pop();
                }

                if path.exists() {
                    return Some(path);
                }
            }
        }
    }

    // --------------------------------------------------------
    // Local-machine registry
    // --------------------------------------------------------

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    for flags in [KEY_READ | KEY_WOW64_32KEY, KEY_READ | KEY_WOW64_64KEY] {
        if let Ok(key) = hklm.open_subkey_with_flags("SOFTWARE\\Valve\\Steam", flags) {
            if let Ok(value) = key.get_value::<String, _>("InstallPath") {
                println!("[Steam] HKLM InstallPath = {}", value);

                let path = PathBuf::from(value);

                if path.exists() {
                    return Some(path);
                }
            }
        }
    }

    // --------------------------------------------------------
    // Common fallback locations
    // --------------------------------------------------------

    let candidates = [
        PathBuf::from(r"C:\Program Files (x86)\Steam"),
        PathBuf::from(r"C:\Program Files\Steam"),
    ];

    for candidate in candidates {
        println!("[Steam] Testing fallback: {}", candidate.display());

        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn parse_vdf_value(line: &str, wanted_key: &str) -> Option<String> {
    let trimmed = line.trim();

    let first_quote = trimmed.find('"')?;

    let after_first = &trimmed[first_quote + 1..];

    let second_quote = after_first.find('"')?;

    let key = &after_first[..second_quote];

    if key != wanted_key {
        return None;
    }

    let after_key = &after_first[second_quote + 1..];

    let value_start = after_key.find('"')?;

    let value_part = &after_key[value_start + 1..];

    let value_end = value_part.find('"')?;

    Some(value_part[..value_end].to_string())
}

fn find_vdf_field(contents: &str, field: &str) -> Option<String> {
    contents
        .lines()
        .find_map(|line| parse_vdf_value(line, field))
}

// ============================================================
// Epic Games
// ============================================================

#[cfg(target_os = "windows")]
#[derive(Debug, Deserialize)]
struct EpicManifest {
    #[serde(rename = "DisplayName")]
    display_name: Option<String>,

    #[serde(rename = "InstallLocation")]
    install_location: Option<String>,

    #[serde(rename = "AppName")]
    app_name: Option<String>,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Deserialize)]
struct EpicInstalledList {
    #[serde(rename = "InstallationList", default)]
    installation_list: Vec<EpicInstalledEntry>,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Deserialize)]
struct EpicInstalledEntry {
    #[serde(rename = "InstallLocation")]
    install_location: Option<String>,

    #[serde(rename = "AppName")]
    app_name: Option<String>,
}

#[cfg(target_os = "windows")]
fn scan_epic() -> Vec<InstalledGame> {
    let mut games = Vec::new();

    let program_data = env::var("PROGRAMDATA").unwrap_or_else(|_| r"C:\ProgramData".to_string());

    // --------------------------------------------------------
    // .item manifests
    // --------------------------------------------------------

    let manifest_dir = PathBuf::from(&program_data)
        .join("Epic")
        .join("EpicGamesLauncher")
        .join("Data")
        .join("Manifests");

    println!("[Epic] Manifest directory: {}", manifest_dir.display());

    if let Ok(entries) = fs::read_dir(&manifest_dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            if path.extension().and_then(|x| x.to_str()) != Some("item") {
                continue;
            }

            let Ok(contents) = fs::read_to_string(&path) else {
                continue;
            };

            let Ok(manifest) = serde_json::from_str::<EpicManifest>(&contents) else {
                println!("[Epic] Invalid manifest: {}", path.display());

                continue;
            };

            let Some(install_location) = manifest.install_location else {
                continue;
            };

            if !Path::new(&install_location).exists() {
                continue;
            }

            let app_name = manifest.app_name.unwrap_or_else(|| "unknown".to_string());

            let name = manifest.display_name.unwrap_or_else(|| app_name.clone());

            if is_epic_non_game(&name, &app_name) {
                continue;
            }

            println!("[Epic] Found {} at {}", name, install_location);

            games.push(InstalledGame {
                id: format!("epic-{app_name}"),
                name,
                store: "Epic".to_string(),
                install_path: install_location,
                launcher_id: Some(app_name),
            });
        }
    }

    // --------------------------------------------------------
    // LauncherInstalled.dat fallback
    // --------------------------------------------------------

    let installed_list = PathBuf::from(&program_data)
        .join("Epic")
        .join("UnrealEngineLauncher")
        .join("LauncherInstalled.dat");

    println!("[Epic] Installed list: {}", installed_list.display());

    if let Ok(contents) = fs::read_to_string(&installed_list) {
        if let Ok(list) = serde_json::from_str::<EpicInstalledList>(&contents) {
            for item in list.installation_list {
                let (Some(app_name), Some(install_location)) =
                    (item.app_name, item.install_location)
                else {
                    continue;
                };

                if !Path::new(&install_location).exists() {
                    continue;
                }

                if is_epic_non_game(&app_name, &app_name) {
                    continue;
                }

                println!("[Epic] Installed-list entry: {}", app_name);

                games.push(InstalledGame {
                    id: format!("epic-{app_name}"),
                    name: app_name.clone(),
                    store: "Epic".to_string(),
                    install_path: install_location,
                    launcher_id: Some(app_name),
                });
            }
        }
    }

    games
}

#[cfg(target_os = "windows")]
fn is_epic_non_game(name: &str, app_name: &str) -> bool {
    let name = name.to_lowercase();

    let app = app_name.to_lowercase();

    name.starts_with("unreal engine")
        || app.starts_with("ue_")
        || name.contains("epic games launcher")
}

// ============================================================
// GOG
// ============================================================

#[cfg(target_os = "windows")]
fn scan_gog() -> Vec<InstalledGame> {
    use winreg::{enums::*, RegKey};

    let mut games = Vec::new();

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let paths = [
        (r"SOFTWARE\GOG.com\Games", KEY_READ | KEY_WOW64_32KEY),
        (r"SOFTWARE\GOG.com\Games", KEY_READ | KEY_WOW64_64KEY),
        (r"SOFTWARE\WOW6432Node\GOG.com\Games", KEY_READ),
    ];

    for (registry_path, flags) in paths {
        println!("[GOG] Checking registry: {}", registry_path);

        let Ok(games_key) = hklm.open_subkey_with_flags(registry_path, flags) else {
            continue;
        };

        println!("[GOG] Registry key found.");

        for game_id in games_key.enum_keys().flatten() {
            let Ok(game_key) = games_key.open_subkey(&game_id) else {
                continue;
            };

            // Registry value names can vary in case.
            let name = get_registry_string(&game_key, &["gameName", "GAMENAME", "GameName"]);

            let install_path = get_registry_string(&game_key, &["path", "PATH", "Path"]);

            let (Some(name), Some(install_path)) = (name, install_path) else {
                continue;
            };

            println!("[GOG] {} -> {}", name, install_path);

            if !Path::new(&install_path).exists() {
                continue;
            }

            games.push(InstalledGame {
                id: format!("gog-{game_id}"),
                name,
                store: "GOG".to_string(),
                install_path,
                launcher_id: Some(game_id),
            });
        }
    }

    games
}

// ============================================================
// Ubisoft Connect
// ============================================================

#[cfg(target_os = "windows")]
fn scan_ubisoft() -> Vec<InstalledGame> {
    use winreg::{enums::*, RegKey};

    let mut games = Vec::new();

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let paths = [
        (
            r"SOFTWARE\Ubisoft\Launcher\Installs",
            KEY_READ | KEY_WOW64_32KEY,
        ),
        (
            r"SOFTWARE\Ubisoft\Launcher\Installs",
            KEY_READ | KEY_WOW64_64KEY,
        ),
        (r"SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs", KEY_READ),
    ];

    for (registry_path, flags) in paths {
        println!("[Ubisoft] Checking registry: {}", registry_path);

        let Ok(installs_key) = hklm.open_subkey_with_flags(registry_path, flags) else {
            continue;
        };

        println!("[Ubisoft] Installs key found.");

        for game_id in installs_key.enum_keys().flatten() {
            let Ok(game_key) = installs_key.open_subkey(&game_id) else {
                continue;
            };

            let install_dir =
                get_registry_string(&game_key, &["InstallDir", "INSTALLDIR", "InstallPath"]);

            let Some(install_dir) = install_dir else {
                continue;
            };

            println!("[Ubisoft] ID {} -> {}", game_id, install_dir);

            if !Path::new(&install_dir).exists() {
                continue;
            }

            let name = find_ubisoft_display_name(&game_id)
                .or_else(|| {
                    PathBuf::from(&install_dir)
                        .file_name()
                        .and_then(|x| x.to_str())
                        .map(|x| x.to_string())
                })
                .unwrap_or_else(|| format!("Ubisoft Game {}", game_id));

            games.push(InstalledGame {
                id: format!("ubisoft-{game_id}"),
                name,
                store: "Ubisoft".to_string(),
                install_path: install_dir,
                launcher_id: Some(game_id),
            });
        }
    }

    games
}

#[cfg(target_os = "windows")]
fn find_ubisoft_display_name(game_id: &str) -> Option<String> {
    use winreg::{enums::*, RegKey};

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let possible_names = [
        format!(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\UPlay Install {game_id}"),
        format!(
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\UPlay Install {game_id}"
        ),
    ];

    for path in possible_names {
        for flags in [KEY_READ | KEY_WOW64_32KEY, KEY_READ | KEY_WOW64_64KEY] {
            if let Ok(key) = hklm.open_subkey_with_flags(&path, flags) {
                if let Some(name) = get_registry_string(&key, &["DisplayName"]) {
                    return Some(name);
                }
            }
        }
    }

    None
}

// ============================================================
// Registry helpers
// ============================================================

#[cfg(target_os = "windows")]
fn get_registry_string(key: &winreg::RegKey, names: &[&str]) -> Option<String> {
    for name in names {
        if let Ok(value) = key.get_value::<String, _>(name) {
            if !value.trim().is_empty() {
                return Some(value);
            }
        }
    }

    None
}
