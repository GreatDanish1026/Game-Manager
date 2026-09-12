use serde::Serialize;
use serde_json::Value;
use std::{
    env, fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtonInstallation {
    pub name: String,
    pub path: String,
    pub source: String,
    pub is_ge_proton: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtonPrefixInfo {
    pub exists: bool,
    pub compatdata_path: Option<String>,
    pub prefix_path: Option<String>,
    pub drive_c_path: Option<String>,
    pub user_path: Option<String>,
    pub size_bytes: Option<u64>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInUse {
    pub name: String,
    pub kind: String,
    pub path: Option<String>,
    pub source: String,
    pub config_path: Option<String>,
    pub matched_by: String,
    pub confidence: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtonToolboxInfo {
    pub supported: bool,
    pub host_platform: String,
    pub launcher_source: String,
    pub steam_app_id: Option<String>,
    pub steam_root: Option<String>,
    pub prefix: ProtonPrefixInfo,
    pub runtime_in_use: Option<RuntimeInUse>,
    pub installed_proton_versions: Vec<ProtonInstallation>,
    pub notes: Vec<String>,
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME").map(PathBuf::from)
}

fn dir_size(path: &Path) -> u64 {
    let mut total = 0_u64;
    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };

    for entry in entries.flatten() {
        let Ok(metadata) = entry.metadata() else {
            continue;
        };

        if metadata.is_dir() {
            total = total.saturating_add(dir_size(&entry.path()));
        } else {
            total = total.saturating_add(metadata.len());
        }
    }

    total
}

fn expand_home(value: &str) -> PathBuf {
    if value == "~" {
        return home_dir().unwrap_or_else(|| PathBuf::from(value));
    }

    if let Some(rest) = value.strip_prefix("~/") {
        if let Some(home) = home_dir() {
            return home.join(rest);
        }
    }

    PathBuf::from(value)
}

fn parse_numeric_id(value: &str) -> Option<String> {
    let trimmed = value.trim();

    if !trimmed.is_empty() && trimmed.chars().all(|ch| ch.is_ascii_digit()) {
        return Some(trimmed.to_string());
    }

    for token in trimmed.split(|ch: char| !ch.is_ascii_digit()) {
        if token.len() >= 3 && token.chars().all(|ch| ch.is_ascii_digit()) {
            return Some(token.to_string());
        }
    }

    None
}

fn prefix_info(
    prefix_path: Option<PathBuf>,
    compatdata: Option<PathBuf>,
    source: Option<String>,
) -> ProtonPrefixInfo {
    let drive_c = prefix_path
        .as_ref()
        .map(|path| path.join("drive_c"))
        .filter(|path| path.exists());

    let user_path = prefix_path.as_ref().and_then(|path| {
        for user in ["steamuser", "deck", "user"] {
            let candidate = path.join("drive_c/users").join(user);
            if candidate.exists() {
                return Some(candidate);
            }
        }
        None
    });

    let size_bytes = prefix_path
        .as_ref()
        .filter(|path| path.exists())
        .map(|path| dir_size(path));

    ProtonPrefixInfo {
        exists: prefix_path.as_ref().is_some_and(|path| path.exists()),
        compatdata_path: compatdata.as_ref().map(|path| path_string(path)),
        prefix_path: prefix_path.as_ref().map(|path| path_string(path)),
        drive_c_path: drive_c.as_ref().map(|path| path_string(path)),
        user_path: user_path.as_ref().map(|path| path_string(path)),
        size_bytes,
        source,
    }
}

#[cfg(target_os = "linux")]
fn steam_roots() -> Vec<PathBuf> {
    let Some(home) = home_dir() else {
        return Vec::new();
    };

    let candidates = [
        home.join(".local/share/Steam"),
        home.join(".steam/steam"),
        home.join(".steam/root"),
        home.join(".var/app/com.valvesoftware.Steam/data/Steam"),
        home.join(".var/app/com.valvesoftware.Steam/.local/share/Steam"),
    ];

    let mut roots = Vec::new();

    for candidate in candidates {
        if candidate.exists() && !roots.iter().any(|existing| existing == &candidate) {
            roots.push(candidate);
        }
    }

    roots
}

#[cfg(target_os = "linux")]
fn collect_steam_library_paths(root: &Path) -> Vec<PathBuf> {
    let mut libraries = vec![root.to_path_buf()];
    let vdf = root.join("steamapps/libraryfolders.vdf");

    let Ok(text) = fs::read_to_string(vdf) else {
        return libraries;
    };

    for line in text.lines() {
        if !line.contains("\"path\"") {
            continue;
        }

        let quoted: Vec<&str> = line.split('"').collect();
        if quoted.len() < 4 {
            continue;
        }

        let value = quoted[3].replace("\\\\", "\\");
        let path = PathBuf::from(value);

        if path.exists() && !libraries.iter().any(|existing| existing == &path) {
            libraries.push(path);
        }
    }

    libraries
}

#[cfg(target_os = "linux")]
fn find_steam_prefix(app_id: &str) -> (Option<PathBuf>, Option<PathBuf>) {
    for root in steam_roots() {
        for library in collect_steam_library_paths(&root) {
            let compatdata = library.join("steamapps/compatdata").join(app_id);
            let prefix = compatdata.join("pfx");

            if prefix.exists() {
                return (Some(compatdata), Some(prefix));
            }
        }
    }

    (None, None)
}

#[cfg(target_os = "linux")]
fn steam_runtime_override(app_id: &str) -> Option<RuntimeInUse> {
    for root in steam_roots() {
        let config = root.join("config/config.vdf");
        let Ok(text) = fs::read_to_string(&config) else {
            continue;
        };

        let lines = text.lines().collect::<Vec<_>>();
        for (index, line) in lines.iter().enumerate() {
            let trimmed = line.trim();
            if !trimmed.contains(&format!("\"{}\"", app_id)) {
                continue;
            }

            let end = (index + 16).min(lines.len());
            for candidate in &lines[index + 1..end] {
                let pieces = candidate.split('"').collect::<Vec<_>>();
                if pieces.len() >= 4 && pieces[1].trim() == "name" {
                    let value = pieces[3].trim();
                    if !value.is_empty() {
                        return Some(RuntimeInUse {
                            name: value.to_string(),
                            kind: "Proton".to_string(),
                            path: None,
                            source: "Steam CompatToolMapping".to_string(),
                            config_path: Some(path_string(&config)),
                            matched_by: format!("Steam App ID {}", app_id),
                            confidence: "high".to_string(),
                        });
                    }
                }
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn collect_proton_from_common(results: &mut Vec<ProtonInstallation>, common: &Path, source: &str) {
    let Ok(entries) = fs::read_dir(common) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(metadata) = entry.metadata() else {
            continue;
        };

        if !metadata.is_dir() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        let lower = name.to_ascii_lowercase();

        if !lower.contains("proton") || !path.join("proton").exists() {
            continue;
        }

        if results.iter().any(|item| item.path == path_string(&path)) {
            continue;
        }

        results.push(ProtonInstallation {
            is_ge_proton: lower.contains("ge-proton") || lower.contains("proton-ge"),
            name,
            path: path_string(&path),
            source: source.to_string(),
        });
    }
}

#[cfg(target_os = "linux")]
fn collect_compatibility_tools(
    results: &mut Vec<ProtonInstallation>,
    directory: &Path,
    source: &str,
) {
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(metadata) = entry.metadata() else {
            continue;
        };

        if !metadata.is_dir() {
            continue;
        }

        let proton = path.join("proton");
        let wine = path.join("bin/wine");

        if !proton.exists() && !wine.exists() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        let lower = name.to_ascii_lowercase();

        if results.iter().any(|item| item.path == path_string(&path)) {
            continue;
        }

        results.push(ProtonInstallation {
            is_ge_proton: lower.contains("ge-proton")
                || lower.contains("proton-ge")
                || lower.contains("wine-ge"),
            name,
            path: path_string(&path),
            source: source.to_string(),
        });
    }
}

#[cfg(target_os = "linux")]
fn installed_proton_versions() -> Vec<ProtonInstallation> {
    let mut results = Vec::new();

    for root in steam_roots() {
        collect_proton_from_common(&mut results, &root.join("steamapps/common"), "Steam");

        collect_compatibility_tools(
            &mut results,
            &root.join("compatibilitytools.d"),
            "Steam compatibilitytools.d",
        );
    }

    if let Some(home) = home_dir() {
        for (directory, source) in [
            (
                home.join(".local/share/Steam/compatibilitytools.d"),
                "User compatibilitytools.d",
            ),
            (
                home.join(".steam/root/compatibilitytools.d"),
                "User compatibilitytools.d",
            ),
            (
                home.join(".var/app/com.valvesoftware.Steam/data/Steam/compatibilitytools.d"),
                "Flatpak Steam compatibilitytools.d",
            ),
            (home.join(".config/heroic/tools/proton"), "Heroic Proton"),
            (home.join(".config/heroic/tools/wine"), "Heroic Wine"),
            (
                home.join(".var/app/com.heroicgameslauncher.hgl/config/heroic/tools/proton"),
                "Flatpak Heroic Proton",
            ),
            (
                home.join(".var/app/com.heroicgameslauncher.hgl/config/heroic/tools/wine"),
                "Flatpak Heroic Wine",
            ),
            (home.join(".local/share/lutris/runners/wine"), "Lutris Wine"),
            (
                home.join(".var/app/net.lutris.Lutris/data/lutris/runners/wine"),
                "Flatpak Lutris Wine",
            ),
        ] {
            collect_compatibility_tools(&mut results, &directory, source);
        }
    }

    results.sort_by(|left, right| {
        left.name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase())
    });

    results
}

#[cfg(target_os = "linux")]
fn json_string_for_keys(value: &Value, keys: &[&str]) -> Option<String> {
    match value {
        Value::Object(map) => {
            for (key, child) in map {
                if keys.iter().any(|wanted| key.eq_ignore_ascii_case(wanted)) {
                    match child {
                        Value::String(value) if !value.trim().is_empty() => {
                            return Some(value.trim().to_string());
                        }
                        Value::Number(value) => return Some(value.to_string()),
                        _ => {}
                    }
                }

                if let Some(found) = json_string_for_keys(child, keys) {
                    return Some(found);
                }
            }
            None
        }
        Value::Array(values) => values
            .iter()
            .find_map(|child| json_string_for_keys(child, keys)),
        _ => None,
    }
}

#[cfg(target_os = "linux")]
fn json_object_for_key<'a>(value: &'a Value, key_name: &str) -> Option<&'a Value> {
    match value {
        Value::Object(map) => {
            for (key, child) in map {
                if key.eq_ignore_ascii_case(key_name) {
                    return Some(child);
                }

                if let Some(found) = json_object_for_key(child, key_name) {
                    return Some(found);
                }
            }
            None
        }
        Value::Array(values) => values
            .iter()
            .find_map(|child| json_object_for_key(child, key_name)),
        _ => None,
    }
}

#[cfg(target_os = "linux")]
fn heroic_game_config_roots() -> Vec<PathBuf> {
    let Some(home) = home_dir() else {
        return Vec::new();
    };

    [
        home.join(".config/heroic/GameConfig"),
        home.join(".var/app/com.heroicgameslauncher.hgl/config/heroic/GameConfig"),
    ]
    .into_iter()
    .filter(|path| path.exists())
    .collect()
}

#[cfg(target_os = "linux")]
fn collect_json_files(root: &Path, depth: usize, results: &mut Vec<PathBuf>) {
    if depth > 3 {
        return;
    }

    let Ok(entries) = fs::read_dir(root) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_dir() {
            collect_json_files(&path, depth + 1, results);
        } else if path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("json"))
        {
            results.push(path);
        }
    }
}

#[cfg(target_os = "linux")]
fn heroic_match_score(path: &Path, text: &str, launcher_id: &str, install_path: &str) -> i32 {
    let mut score = 0_i32;
    let path_lower = path_string(path).to_ascii_lowercase();
    let text_lower = text.to_ascii_lowercase();
    let launcher_lower = launcher_id.trim().to_ascii_lowercase();
    let install_lower = install_path.trim().to_ascii_lowercase();

    if !launcher_lower.is_empty() {
        if path_lower.contains(&launcher_lower) {
            score += 100;
        }
        if text_lower.contains(&launcher_lower) {
            score += 60;
        }
    }

    if !install_lower.is_empty() && text_lower.contains(&install_lower) {
        score += 120;
    }

    score
}

#[cfg(target_os = "linux")]
fn find_heroic_config(launcher_id: &str, install_path: &str) -> Option<(PathBuf, Value, i32)> {
    let mut best: Option<(PathBuf, Value, i32)> = None;

    for root in heroic_game_config_roots() {
        let mut files = Vec::new();
        collect_json_files(&root, 0, &mut files);

        for path in files {
            let Ok(text) = fs::read_to_string(&path) else {
                continue;
            };

            let score = heroic_match_score(&path, &text, launcher_id, install_path);
            if score <= 0 {
                continue;
            }

            let Ok(value) = serde_json::from_str::<Value>(&text) else {
                continue;
            };

            if best
                .as_ref()
                .is_none_or(|(_, _, best_score)| score > *best_score)
            {
                best = Some((path, value, score));
            }
        }
    }

    best
}

#[cfg(target_os = "linux")]
fn heroic_prefix_and_runtime(
    launcher_id: &str,
    install_path: &str,
) -> (Option<PathBuf>, Option<RuntimeInUse>, Vec<String>) {
    let mut notes = Vec::new();
    let Some((config_path, value, score)) = find_heroic_config(launcher_id, install_path) else {
        notes.push("Heroic game settings were not matched automatically.".to_string());
        return (None, None, notes);
    };

    let prefix = json_string_for_keys(
        &value,
        &[
            "winePrefix",
            "wine_prefix",
            "prefix",
            "STEAM_COMPAT_DATA_PATH",
        ],
    )
    .map(|value| expand_home(&value));

    let wine_version = json_object_for_key(&value, "wineVersion");
    let name = wine_version
        .and_then(|value| json_string_for_keys(value, &["name"]))
        .or_else(|| json_string_for_keys(&value, &["wineVersionName", "wine_version"]));

    let runtime_path = wine_version
        .and_then(|value| json_string_for_keys(value, &["bin", "path", "proton"]))
        .map(|value| path_string(&expand_home(&value)));

    let kind = wine_version
        .and_then(|value| json_string_for_keys(value, &["type"]))
        .unwrap_or_else(|| {
            let name_lower = name.clone().unwrap_or_default().to_ascii_lowercase();
            if name_lower.contains("proton") {
                "proton".to_string()
            } else {
                "wine".to_string()
            }
        });

    let runtime = name.map(|runtime_name| RuntimeInUse {
        name: runtime_name,
        kind: if kind.eq_ignore_ascii_case("proton") {
            "Proton".to_string()
        } else {
            "Wine".to_string()
        },
        path: runtime_path,
        source: "Heroic game settings".to_string(),
        config_path: Some(path_string(&config_path)),
        matched_by: if !install_path.trim().is_empty() && score >= 120 {
            "Install path / Heroic config".to_string()
        } else {
            "Launcher ID / Heroic config".to_string()
        },
        confidence: if score >= 120 { "high" } else { "medium" }.to_string(),
    });

    (prefix, runtime, notes)
}

#[cfg(target_os = "linux")]
fn lutris_config_roots() -> Vec<PathBuf> {
    let Some(home) = home_dir() else {
        return Vec::new();
    };

    [
        home.join(".config/lutris/games"),
        home.join(".var/app/net.lutris.Lutris/config/lutris/games"),
    ]
    .into_iter()
    .filter(|path| path.exists())
    .collect()
}

#[cfg(target_os = "linux")]
fn yaml_scalar(text: &str, section: Option<&str>, key: &str) -> Option<String> {
    let mut current_section: Option<String> = None;

    for line in text.lines() {
        if line.trim().is_empty() || line.trim_start().starts_with('#') {
            continue;
        }

        let indent = line.chars().take_while(|ch| ch.is_whitespace()).count();
        let trimmed = line.trim();

        if indent == 0 && trimmed.ends_with(':') && !trimmed.contains(": ") {
            current_section = Some(trimmed.trim_end_matches(':').to_string());
            continue;
        }

        let Some((raw_key, raw_value)) = trimmed.split_once(':') else {
            continue;
        };

        if raw_key.trim() != key {
            continue;
        }

        if let Some(expected) = section {
            if current_section.as_deref() != Some(expected) {
                continue;
            }
        }

        let value = raw_value
            .trim()
            .trim_matches('"')
            .trim_matches('\'')
            .to_string();

        if !value.is_empty() {
            return Some(value);
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn lutris_match_score(
    path: &Path,
    text: &str,
    launcher_id: &str,
    install_path: &str,
    slug: &str,
) -> i32 {
    let path_lower = path_string(path).to_ascii_lowercase();
    let text_lower = text.to_ascii_lowercase();
    let mut score = 0_i32;

    for value in [launcher_id, slug] {
        let lower = value.trim().to_ascii_lowercase();
        if lower.is_empty() {
            continue;
        }

        if path_lower.contains(&lower) {
            score += 100;
        }
        if text_lower.contains(&lower) {
            score += 50;
        }
    }

    let install_lower = install_path.trim().to_ascii_lowercase();
    if !install_lower.is_empty() && text_lower.contains(&install_lower) {
        score += 120;
    }

    score
}

#[cfg(target_os = "linux")]
fn find_lutris_config(
    launcher_id: &str,
    install_path: &str,
    slug: &str,
) -> Option<(PathBuf, String, i32)> {
    let mut best: Option<(PathBuf, String, i32)> = None;

    for root in lutris_config_roots() {
        let Ok(entries) = fs::read_dir(root) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();

            if !path.extension().is_some_and(|extension| {
                extension.eq_ignore_ascii_case("yml") || extension.eq_ignore_ascii_case("yaml")
            }) {
                continue;
            }

            let Ok(text) = fs::read_to_string(&path) else {
                continue;
            };

            let score = lutris_match_score(&path, &text, launcher_id, install_path, slug);
            if score <= 0 {
                continue;
            }

            if best
                .as_ref()
                .is_none_or(|(_, _, best_score)| score > *best_score)
            {
                best = Some((path, text, score));
            }
        }
    }

    best
}

#[cfg(target_os = "linux")]
fn lutris_prefix_and_runtime(
    launcher_id: &str,
    install_path: &str,
    slug: &str,
    runner_hint: &str,
) -> (Option<PathBuf>, Option<RuntimeInUse>, Vec<String>) {
    let mut notes = Vec::new();
    let Some((config_path, text, score)) = find_lutris_config(launcher_id, install_path, slug)
    else {
        notes.push("Lutris game configuration was not matched automatically.".to_string());
        return (None, None, notes);
    };

    let prefix = yaml_scalar(&text, Some("game"), "prefix").map(|value| expand_home(&value));

    let configured_runner = yaml_scalar(&text, None, "runner").or_else(|| {
        if runner_hint.trim().is_empty() {
            None
        } else {
            Some(runner_hint.trim().to_string())
        }
    });

    let version = yaml_scalar(&text, Some("wine"), "version");

    let runtime = version
        .clone()
        .or(configured_runner.clone())
        .map(|runtime_name| {
            let runner = configured_runner.unwrap_or_else(|| "wine".to_string());
            RuntimeInUse {
                name: runtime_name,
                kind: if runner.eq_ignore_ascii_case("wine") {
                    "Wine / Proton runner".to_string()
                } else {
                    runner.clone()
                },
                path: None,
                source: "Lutris game configuration".to_string(),
                config_path: Some(path_string(&config_path)),
                matched_by: if !install_path.trim().is_empty() && score >= 120 {
                    "Install path / Lutris config".to_string()
                } else {
                    "Lutris ID or slug".to_string()
                },
                confidence: if score >= 120 { "high" } else { "medium" }.to_string(),
            }
        });

    (prefix, runtime, notes)
}

fn launcher_kind(store: &str, source: &str) -> String {
    let combined = format!("{} {}", store, source).to_ascii_lowercase();

    if combined.contains("steam") {
        "Steam".to_string()
    } else if combined.contains("heroic") {
        "Heroic".to_string()
    } else if combined.contains("lutris") {
        "Lutris".to_string()
    } else {
        store.trim().to_string()
    }
}

#[tauri::command]
pub fn get_proton_toolbox_info(
    store: Option<String>,
    launcher_id: Option<String>,
    install_path: Option<String>,
    source: Option<String>,
    runtime: Option<String>,
    lutris_runner: Option<String>,
    lutris_slug: Option<String>,
) -> Result<ProtonToolboxInfo, String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (
            store,
            launcher_id,
            install_path,
            source,
            runtime,
            lutris_runner,
            lutris_slug,
        );

        return Ok(ProtonToolboxInfo {
            supported: false,
            host_platform: env::consts::OS.to_string(),
            launcher_source: "Unsupported".to_string(),
            steam_app_id: None,
            steam_root: None,
            prefix: prefix_info(None, None, None),
            runtime_in_use: None,
            installed_proton_versions: Vec::new(),
            notes: vec!["Proton Toolbox is available on Linux.".to_string()],
        });
    }

    #[cfg(target_os = "linux")]
    {
        let store_value = store.unwrap_or_default();
        let launcher_value = launcher_id.unwrap_or_default();
        let install_value = install_path.unwrap_or_default();
        let source_value = source.unwrap_or_default();
        let runtime_hint = runtime.unwrap_or_default();
        let lutris_runner_value = lutris_runner.unwrap_or_default();
        let lutris_slug_value = lutris_slug.unwrap_or_default();

        let launcher = launcher_kind(&store_value, &source_value);
        let roots = steam_roots();
        let steam_root = roots.first().map(|path| path_string(path));
        let mut notes = Vec::new();
        let mut app_id = None;
        let mut runtime_in_use = None;
        let prefix;

        match launcher.as_str() {
            "Steam" => {
                app_id = parse_numeric_id(&launcher_value);
                let (compatdata, prefix_path) = match app_id.as_deref() {
                    Some(id) => find_steam_prefix(id),
                    None => (None, None),
                };

                if let Some(id) = app_id.as_deref() {
                    runtime_in_use = steam_runtime_override(id);

                    if runtime_in_use.is_none() && prefix_path.is_some() {
                        runtime_in_use = Some(RuntimeInUse {
                            name: "Steam automatic/default".to_string(),
                            kind: "Proton".to_string(),
                            path: None,
                            source: "Steam".to_string(),
                            config_path: None,
                            matched_by: format!("Steam App ID {}", id),
                            confidence: "medium".to_string(),
                        });

                        notes.push(
                            "Steam has a Proton prefix for this game, but no explicit per-game CompatToolMapping was found. Steam may be selecting the compatibility tool automatically."
                                .to_string(),
                        );
                    }
                }

                if app_id.is_none() {
                    notes.push(
                        "This Steam entry does not expose a numeric App ID, so its compatdata prefix could not be matched automatically."
                            .to_string(),
                    );
                } else if prefix_path.is_none() {
                    notes.push(
                        "No Steam compatdata prefix exists yet. The game may be native Linux or may not have been launched through Proton."
                            .to_string(),
                    );
                }

                prefix = prefix_info(
                    prefix_path,
                    compatdata,
                    Some("Steam compatdata".to_string()),
                );
            }

            "Heroic" => {
                let (prefix_path, detected_runtime, heroic_notes) =
                    heroic_prefix_and_runtime(&launcher_value, &install_value);

                notes.extend(heroic_notes);
                runtime_in_use = detected_runtime.or_else(|| {
                    if runtime_hint.trim().is_empty() {
                        None
                    } else {
                        Some(RuntimeInUse {
                            name: runtime_hint.trim().to_string(),
                            kind: "Heroic runtime".to_string(),
                            path: None,
                            source: "GameAtlas Heroic discovery".to_string(),
                            config_path: None,
                            matched_by: "Launcher metadata".to_string(),
                            confidence: "low".to_string(),
                        })
                    }
                });

                prefix = prefix_info(
                    prefix_path,
                    None,
                    Some("Heroic Wine/Proton prefix".to_string()),
                );
            }

            "Lutris" => {
                let (prefix_path, detected_runtime, lutris_notes) = lutris_prefix_and_runtime(
                    &launcher_value,
                    &install_value,
                    &lutris_slug_value,
                    &lutris_runner_value,
                );

                notes.extend(lutris_notes);
                runtime_in_use = detected_runtime.or_else(|| {
                    if runtime_hint.trim().is_empty() {
                        None
                    } else {
                        Some(RuntimeInUse {
                            name: runtime_hint.trim().to_string(),
                            kind: "Lutris runtime".to_string(),
                            path: None,
                            source: "GameAtlas Lutris discovery".to_string(),
                            config_path: None,
                            matched_by: "Launcher metadata".to_string(),
                            confidence: "low".to_string(),
                        })
                    }
                });

                prefix = prefix_info(prefix_path, None, Some("Lutris Wine prefix".to_string()));
            }

            _ => {
                prefix = prefix_info(None, None, None);
                notes.push(
                    "Automatic prefix/runtime matching currently supports Steam, Heroic, and Lutris entries."
                        .to_string(),
                );
            }
        }

        if roots.is_empty() {
            notes.push(
                "Steam installation was not detected in the standard Linux locations.".to_string(),
            );
        }

        let installed = installed_proton_versions();

        if installed.is_empty() {
            notes.push(
                "No Steam Proton, Heroic Wine/Proton, or Lutris Wine runner installations were found in the standard locations."
                    .to_string(),
            );
        }

        Ok(ProtonToolboxInfo {
            supported: true,
            host_platform: "linux".to_string(),
            launcher_source: launcher,
            steam_app_id: app_id,
            steam_root,
            prefix,
            runtime_in_use,
            installed_proton_versions: installed,
            notes,
        })
    }
}
