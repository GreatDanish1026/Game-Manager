use serde::Serialize;
use std::{
    collections::{
        BTreeMap,
        HashMap,
    },
    env,
    fs,
    path::{
        Path,
        PathBuf,
    },
};


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinuxSteamGame {
    pub id: String,
    pub name: String,
    pub store: String,
    pub launcher_id: String,
    pub install_path: String,
    pub source: String,
    pub runtime: String,
    pub native_linux: bool,
    pub proton: bool,
    pub proton_prefix: Option<String>,
    pub compatibility_tool: Option<String>,
    pub steam_library_path: String,
    pub manifest_path: String,
}


fn home_dir() -> Option<PathBuf> {
    env::var_os(
        "HOME"
    )
    .map(
        PathBuf::from
    )
}


fn expand_home(
    path: &str,
) -> Option<PathBuf> {
    if path == "~" {
        return home_dir();
    }

    if let Some(
        suffix
    ) =
        path.strip_prefix(
            "~/"
        )
    {
        return home_dir()
            .map(
                |home| {
                    home.join(
                        suffix
                    )
                }
            );
    }

    Some(
        PathBuf::from(
            path
        )
    )
}


fn candidate_steam_roots() -> Vec<PathBuf> {
    let mut candidates =
        Vec::new();

    for raw in [
        "~/.steam/steam",
        "~/.local/share/Steam",
        "~/.var/app/com.valvesoftware.Steam/data/Steam",
        "~/.var/app/com.valvesoftware.Steam/.local/share/Steam",
    ] {
        if let Some(
            path
        ) =
            expand_home(
                raw
            )
        {
            candidates.push(
                path
            );
        }
    }

    candidates
}


fn canonical_existing_dir(
    path: &Path,
) -> Option<PathBuf> {
    if !path.is_dir() {
        return None;
    }

    fs::canonicalize(
        path
    )
    .ok()
    .or_else(
        || {
            Some(
                path.to_path_buf()
            )
        }
    )
}


fn find_steam_root() -> Option<PathBuf> {
    for candidate in candidate_steam_roots() {
        if let Some(
            existing
        ) =
            canonical_existing_dir(
                &candidate
            )
        {
            if existing
                .join(
                    "steamapps"
                )
                .is_dir()
            {
                return Some(
                    existing
                );
            }
        }
    }

    None
}


fn parse_vdf_string_pairs(
    text: &str,
) -> Vec<(String, String)> {
    let mut pairs =
        Vec::new();

    for line in text.lines() {
        let trimmed =
            line.trim();

        if !trimmed.starts_with(
            '"'
        ) {
            continue;
        }

        let mut values =
            Vec::new();

        let mut current =
            String::new();

        let mut in_quotes =
            false;

        let mut escape =
            false;

        for ch in trimmed.chars() {
            if escape {
                current.push(
                    ch
                );
                escape =
                    false;
                continue;
            }

            if ch == '\\'
                && in_quotes
            {
                escape =
                    true;
                continue;
            }

            if ch == '"' {
                if in_quotes {
                    values.push(
                        current.clone()
                    );
                    current.clear();
                    in_quotes =
                        false;
                } else {
                    in_quotes =
                        true;
                }

                continue;
            }

            if in_quotes {
                current.push(
                    ch
                );
            }
        }

        if values.len() >= 2 {
            pairs.push(
                (
                    values[0].clone(),
                    values[1].clone(),
                )
            );
        }
    }

    pairs
}


fn parse_appmanifest(
    path: &Path,
) -> Option<HashMap<String, String>> {
    let text =
        fs::read_to_string(
            path
        )
        .ok()?;

    let mut values =
        HashMap::new();

    for (
        key,
        value,
    ) in parse_vdf_string_pairs(
        &text
    ) {
        values.insert(
            key.to_ascii_lowercase(),
            value,
        );
    }

    Some(
        values
    )
}


fn steam_library_paths(
    steam_root: &Path,
) -> Vec<PathBuf> {
    let mut libraries =
        Vec::new();

    libraries.push(
        steam_root.to_path_buf()
    );

    let library_file =
        steam_root
            .join(
                "steamapps"
            )
            .join(
                "libraryfolders.vdf"
            );

    let Ok(
        text
    ) =
        fs::read_to_string(
            library_file
        )
    else {
        return libraries;
    };

    for (
        key,
        value,
    ) in parse_vdf_string_pairs(
        &text
    ) {
        if key.eq_ignore_ascii_case(
            "path"
        ) {
            let normalized =
                value.replace(
                    "\\\\",
                    "\\"
                );

            let path =
                PathBuf::from(
                    normalized
                );

            if path
                .join(
                    "steamapps"
                )
                .is_dir()
                && !libraries
                    .iter()
                    .any(
                        |candidate| {
                            candidate == &path
                        }
                    )
            {
                libraries.push(
                    path
                );
            }
        }
    }

    libraries
}


fn linux_binary_evidence(
    install_path: &Path,
) -> bool {
    let Ok(
        entries
    ) =
    fs::read_dir(
        install_path
    )
    else {
        return false;
    };

    let mut checked =
    0usize;

    for entry in entries.flatten() {
        if checked >= 128 {
            break;
        }

        checked += 1;

        let path =
        entry.path();

        if !path.is_file() {
            continue;
        }

        let Ok(
            mut file
        ) =
        std::fs::File::open(
            &path
        )
        else {
            continue;
        };

        let mut header =
        [0u8; 4];

        if std::io::Read::read_exact(
            &mut file,
            &mut header
        )
            .is_err()
            {
                continue;
            }

            if header
                == [
                    0x7f,
                    b'E',
                    b'L',
                    b'F',
                ]
                {
                    return true;
                }
    }

    false
}


fn windows_exe_evidence(
    install_path: &Path,
) -> bool {
    let Ok(
        entries
    ) =
        fs::read_dir(
            install_path
        )
    else {
        return false;
    };

    for entry in entries.flatten()
        .take(
            500
        )
    {
        let path =
            entry.path();

        if !path.is_file() {
            continue;
        }

        let is_exe =
            path.extension()
                .and_then(
                    |value| {
                        value.to_str()
                    }
                )
                .map(
                    |value| {
                        value.eq_ignore_ascii_case(
                            "exe"
                        )
                    }
                )
                .unwrap_or(
                    false
                );

        if is_exe {
            return true;
        }
    }

    false
}


fn compat_tool_mapping(
    steam_root: &Path,
) -> HashMap<String, String> {
    let mut result =
        HashMap::new();

    let config_path =
        steam_root
            .join(
                "config"
            )
            .join(
                "config.vdf"
            );

    let Ok(
        text
    ) =
        fs::read_to_string(
            config_path
        )
    else {
        return result;
    };

    let lines =
        text.lines()
            .collect::<Vec<_>>();

    let mut in_mapping =
        false;

    let mut current_app:
        Option<String> =
        None;

    let mut depth =
        0i32;

    for line in lines {
        let trimmed =
            line.trim();

        if trimmed.eq_ignore_ascii_case(
            "\"CompatToolMapping\""
        ) {
            in_mapping =
                true;

            current_app =
                None;

            depth =
                0;

            continue;
        }

        if !in_mapping {
            continue;
        }

        depth +=
            trimmed.matches(
                '{'
            )
            .count() as i32;

        depth -=
            trimmed.matches(
                '}'
            )
            .count() as i32;

        let quoted =
            parse_vdf_string_pairs(
                trimmed
            );

        if let Some(
            (
                key,
                value,
            )
        ) =
            quoted.first()
        {
            if key == "name"
                && current_app.is_some()
            {
                if !value.trim().is_empty() {
                    result.insert(
                        current_app
                            .clone()
                            .unwrap(),
                        value.clone(),
                    );
                }

                continue;
            }
        }

        if trimmed.starts_with(
            '"'
        )
            && trimmed.ends_with(
                '"'
            )
            && !trimmed.contains(
                "\"name\""
            )
        {
            let candidate =
                trimmed.trim_matches(
                    '"'
                );

            if candidate.chars()
                .all(
                    |ch| {
                        ch.is_ascii_digit()
                    }
                )
            {
                current_app =
                    Some(
                        candidate
                            .to_string()
                    );
            }
        }

        if depth < 0 {
            break;
        }
    }

    result
}


fn steam_compatibility_tool_dirs(
    libraries: &[PathBuf],
) -> BTreeMap<String, PathBuf> {
    let mut tools =
        BTreeMap::new();

    for library in libraries {
        let common =
            library
                .join(
                    "steamapps"
                )
                .join(
                    "common"
                );

        let Ok(
            entries
        ) =
            fs::read_dir(
                common
            )
        else {
            continue;
        };

        for entry in entries.flatten() {
            let path =
                entry.path();

            if !path.is_dir() {
                continue;
            }

            let Some(
                name
            ) =
                path.file_name()
                    .and_then(
                        |value| {
                            value.to_str()
                        }
                    )
            else {
                continue;
            };

            let lower =
                name.to_ascii_lowercase();

            if lower.starts_with(
                "proton"
            ) {
                tools.insert(
                    name.to_string(),
                    path,
                );
            }
        }
    }

    tools
}


fn custom_compatibility_tools() -> BTreeMap<String, PathBuf> {
    let mut tools =
        BTreeMap::new();

    let mut roots =
        Vec::new();

    if let Some(
        home
    ) =
        home_dir()
    {
        roots.push(
            home
                .join(
                    ".steam"
                )
                .join(
                    "root"
                )
                .join(
                    "compatibilitytools.d"
                )
        );

        roots.push(
            home
                .join(
                    ".local"
                )
                .join(
                    "share"
                )
                .join(
                    "Steam"
                )
                .join(
                    "compatibilitytools.d"
                )
        );

        roots.push(
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
                )
                .join(
                    "compatibilitytools.d"
                )
        );
    }

    for root in roots {
        let Ok(
            entries
        ) =
            fs::read_dir(
                root
            )
        else {
            continue;
        };

        for entry in entries.flatten() {
            let path =
                entry.path();

            if !path.is_dir() {
                continue;
            }

            let Some(
                name
            ) =
                path.file_name()
                    .and_then(
                        |value| {
                            value.to_str()
                        }
                    )
            else {
                continue;
            };

            tools.insert(
                name.to_string(),
                path,
            );
        }
    }

    tools
}


fn resolve_tool_name(
    configured:
        Option<&str>,
    known_tools:
        &BTreeMap<String, PathBuf>,
) -> Option<String> {
    let configured =
        configured?
            .trim();

    if configured.is_empty() {
        return None;
    }

    if known_tools.contains_key(
        configured
    ) {
        return Some(
            configured.to_string()
        );
    }

    let lower =
        configured.to_ascii_lowercase();

    for name in known_tools.keys() {
        if name.to_ascii_lowercase()
            == lower
        {
            return Some(
                name.clone()
            );
        }
    }

    Some(
        configured.to_string()
    )
}


#[cfg(target_os = "linux")]
#[tauri::command]
pub fn get_linux_steam_games() -> Result<Vec<LinuxSteamGame>, String> {
    let steam_root =
        find_steam_root()
            .ok_or_else(
                || {
                    "Steam installation was not found on Linux."
                        .to_string()
                }
            )?;

    let libraries =
        steam_library_paths(
            &steam_root
        );

    let configured_tools =
        compat_tool_mapping(
            &steam_root
        );

    let mut known_tools =
        steam_compatibility_tool_dirs(
            &libraries
        );

    for (
        name,
        path,
    ) in custom_compatibility_tools() {
        known_tools.entry(
            name
        )
        .or_insert(
            path
        );
    }

    let mut games =
        Vec::new();

    for library in libraries {
        let steamapps =
            library.join(
                "steamapps"
            );

        let Ok(
            entries
        ) =
            fs::read_dir(
                &steamapps
            )
        else {
            continue;
        };

        for entry in entries.flatten() {
            let manifest_path =
                entry.path();

            let Some(
                filename
            ) =
                manifest_path.file_name()
                    .and_then(
                        |value| {
                            value.to_str()
                        }
                    )
            else {
                continue;
            };

            if !filename.starts_with(
                "appmanifest_"
            )
                || !filename.ends_with(
                    ".acf"
                )
            {
                continue;
            }

            let Some(
                manifest
            ) =
                parse_appmanifest(
                    &manifest_path
                )
            else {
                continue;
            };

            let Some(
                appid
            ) =
                manifest.get(
                    "appid"
                )
                .cloned()
            else {
                continue;
            };

            let Some(
                name
            ) =
                manifest.get(
                    "name"
                )
                .cloned()
            else {
                continue;
            };

            let Some(
                installdir
            ) =
                manifest.get(
                    "installdir"
                )
                .cloned()
            else {
                continue;
            };

            let install_path =
                steamapps
                    .join(
                        "common"
                    )
                    .join(
                        installdir
                    );

            if !install_path.is_dir() {
                continue;
            }

            let prefix =
                steamapps
                    .join(
                        "compatdata"
                    )
                    .join(
                        &appid
                    )
                    .join(
                        "pfx"
                    );

            let has_prefix =
                prefix.is_dir();

            let native_linux =
                linux_binary_evidence(
                    &install_path
                );

            let has_windows_exe =
                windows_exe_evidence(
                    &install_path
                );

            let proton =
                has_prefix
                    || (
                        has_windows_exe
                            && !native_linux
                    );

            let runtime =
                if proton {
                    "proton"
                } else if native_linux {
                    "native_linux"
                } else if has_windows_exe {
                    "windows_unknown"
                } else {
                    "unknown"
                };

            let configured =
                configured_tools
                    .get(
                        &appid
                    )
                    .map(
                        String::as_str
                    );

            let compatibility_tool =
                resolve_tool_name(
                    configured,
                    &known_tools,
                )
                .or_else(
                    || {
                        if proton {
                            Some(
                                "Steam default / automatic"
                                    .to_string()
                            )
                        } else {
                            None
                        }
                    }
                );

            games.push(
                LinuxSteamGame {
                    id:
                        format!(
                            "steam:{}",
                            appid
                        ),

                    name,

                    store:
                        "Steam"
                            .to_string(),

                    launcher_id:
                        appid.clone(),

                    install_path:
                        install_path
                            .to_string_lossy()
                            .to_string(),

                    source:
                        "steam-linux"
                            .to_string(),

                    runtime:
                        runtime
                            .to_string(),

                    native_linux,

                    proton,

                    proton_prefix:
                        if has_prefix {
                            Some(
                                prefix
                                    .to_string_lossy()
                                    .to_string()
                            )
                        } else {
                            None
                        },

                    compatibility_tool,

                    steam_library_path:
                        library
                            .to_string_lossy()
                            .to_string(),

                    manifest_path:
                        manifest_path
                            .to_string_lossy()
                            .to_string(),
                }
            );
        }
    }

    games.sort_by(
        |a, b| {
            a.name
                .to_ascii_lowercase()
                .cmp(
                    &b.name
                        .to_ascii_lowercase()
                )
        }
    );

    Ok(
        games
    )
}


#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn get_linux_steam_games() -> Result<Vec<LinuxSteamGame>, String> {
    Ok(
        Vec::new()
    )
}
