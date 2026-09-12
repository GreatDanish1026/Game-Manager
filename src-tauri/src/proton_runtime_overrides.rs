use serde::Serialize;
use serde_json::{Map, Value};
use std::{
    env, fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeOverrideResult {
    pub launcher: String,
    pub action: String,
    pub runtime_name: Option<String>,
    pub config_path: String,
    pub backup_path: String,
    pub message: String,
}

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "HOME is not available.".to_string())
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn timestamp() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0);

    seconds.to_string()
}

fn safe_name(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();

    if cleaned.is_empty() {
        "config".to_string()
    } else {
        cleaned
    }
}

fn backup_config(launcher: &str, path: &Path) -> Result<PathBuf, String> {
    if !path.exists() {
        return Err(format!(
            "Configuration file does not exist: {}",
            path.display()
        ));
    }

    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("config");

    let directory = home_dir()?
        .join(".local/share/GameAtlas/runtime-override-backups")
        .join(timestamp())
        .join(safe_name(launcher));

    fs::create_dir_all(&directory).map_err(|error| {
        format!(
            "Failed to create backup directory {}: {}",
            directory.display(),
            error
        )
    })?;

    let backup = directory.join(safe_name(file_name));

    fs::copy(path, &backup)
        .map_err(|error| format!("Failed to back up {}: {}", path.display(), error))?;

    Ok(backup)
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

fn steam_roots() -> Vec<PathBuf> {
    let Ok(home) = home_dir() else {
        return Vec::new();
    };

    [
        home.join(".local/share/Steam"),
        home.join(".steam/steam"),
        home.join(".steam/root"),
        home.join(".var/app/com.valvesoftware.Steam/data/Steam"),
        home.join(".var/app/com.valvesoftware.Steam/.local/share/Steam"),
    ]
    .into_iter()
    .filter(|path| path.exists())
    .collect()
}

fn find_steam_config() -> Option<PathBuf> {
    steam_roots()
        .into_iter()
        .map(|root| root.join("config/config.vdf"))
        .find(|path| path.exists())
}

fn matching_brace(text: &str, open_index: usize) -> Option<usize> {
    let bytes = text.as_bytes();

    let mut depth = 0_i32;

    let mut in_quote = false;

    let mut escaped = false;

    for index in open_index..bytes.len() {
        let byte = bytes[index];

        if in_quote {
            if escaped {
                escaped = false;
                continue;
            }

            if byte == b'\\' {
                escaped = true;
                continue;
            }

            if byte == b'"' {
                in_quote = false;
            }

            continue;
        }

        if byte == b'"' {
            in_quote = true;
            continue;
        }

        if byte == b'{' {
            depth += 1;
        } else if byte == b'}' {
            depth -= 1;

            if depth == 0 {
                return Some(index);
            }
        }
    }

    None
}

fn vdf_block(text: &str, key: &str) -> Option<(usize, usize, usize)> {
    let needle = format!("\"{}\"", key);

    let key_start = text.find(&needle)?;

    let open_relative = text[key_start + needle.len()..].find('{')?;

    let open = key_start + needle.len() + open_relative;

    let close = matching_brace(text, open)?;

    Some((key_start, open, close))
}

fn nested_vdf_block(
    text: &str,
    parent_open: usize,
    parent_close: usize,
    key: &str,
) -> Option<(usize, usize, usize)> {
    let needle = format!("\"{}\"", key);

    let body = &text[parent_open + 1..parent_close];

    let relative = body.find(&needle)?;

    let key_start = parent_open + 1 + relative;

    let open_relative = text[key_start + needle.len()..parent_close].find('{')?;

    let open = key_start + needle.len() + open_relative;

    let close = matching_brace(text, open)?;

    if close > parent_close {
        return None;
    }

    Some((key_start, open, close))
}

fn escape_vdf(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn set_name_in_vdf_block(
    text: &mut String,
    open: usize,
    close: usize,
    value: &str,
) -> Result<(), String> {
    let block = text[open + 1..close].to_string();

    let mut offset = 0_usize;

    for line in block.split_inclusive('\n') {
        let trimmed = line.trim();

        if trimmed.starts_with("\"name\"") {
            let start = open + 1 + offset;

            let end = start + line.len();

            let indent = line
                .chars()
                .take_while(|character| {
                    character.is_whitespace() && *character != '\n' && *character != '\r'
                })
                .collect::<String>();

            let replacement = format!("{}\"name\" \"{}\"\n", indent, escape_vdf(value));

            text.replace_range(start..end, &replacement);

            return Ok(());
        }

        offset += line.len();
    }

    let insertion = format!("\n\t\t\t\"name\" \"{}\"", escape_vdf(value));

    text.insert_str(close, &insertion);

    Ok(())
}

fn steam_compat_name(runtime_name: &str, runtime_path: &str) -> String {
    let compatibility_vdf = Path::new(runtime_path).join("compatibilitytool.vdf");

    if let Ok(text) = fs::read_to_string(compatibility_vdf) {
        if let Some((_, compatibility_open, compatibility_close)) =
            vdf_block(&text, "compatibilitytools")
        {
            if let Some((_, tools_open, tools_close)) = nested_vdf_block(
                &text,
                compatibility_open,
                compatibility_close,
                "compat_tools",
            ) {
                let body = &text[tools_open + 1..tools_close];

                for line in body.lines() {
                    let trimmed = line.trim();

                    if !trimmed.starts_with('"') {
                        continue;
                    }

                    let Some(end) = trimmed[1..].find('"') else {
                        continue;
                    };

                    let key = &trimmed[1..end + 1];

                    if !key.is_empty() {
                        return key.to_string();
                    }
                }
            }
        }
    }

    let lower = runtime_name.trim().to_ascii_lowercase();

    if lower == "proton experimental" {
        return "proton_experimental".to_string();
    }

    if lower == "proton hotfix" {
        return "proton_hotfix".to_string();
    }

    for (prefix, internal) in [
        ("proton 10", "proton_10"),
        ("proton 9", "proton_9"),
        ("proton 8", "proton_8"),
        ("proton 7", "proton_7"),
        ("proton 6", "proton_6"),
        ("proton 5.13", "proton_513"),
        ("proton 5.0", "proton_50"),
        ("proton 4.11", "proton_411"),
        ("proton 4.2", "proton_42"),
    ] {
        if lower.starts_with(prefix) {
            return internal.to_string();
        }
    }

    runtime_name.trim().to_string()
}

fn set_steam_override(
    app_id: &str,
    runtime_name: &str,
    runtime_path: &str,
) -> Result<RuntimeOverrideResult, String> {
    if app_id.is_empty() || !app_id.chars().all(|character| character.is_ascii_digit()) {
        return Err("A numeric Steam App ID is required.".to_string());
    }

    let config =
        find_steam_config().ok_or_else(|| "Steam config.vdf was not found.".to_string())?;

    let backup = backup_config("steam", &config)?;

    let mut text = fs::read_to_string(&config)
        .map_err(|error| format!("Failed to read {}: {}", config.display(), error))?;

    let compat_name = steam_compat_name(runtime_name, runtime_path);

    let Some((_mapping_key, mapping_open, mapping_close)) = vdf_block(&text, "CompatToolMapping")
    else {
        return Err(format!(
            "Steam CompatToolMapping was not found in {}. The original file was backed up to {}.",
            config.display(),
            backup.display()
        ));
    };

    if let Some((_app_key, app_open, app_close)) =
        nested_vdf_block(&text, mapping_open, mapping_close, app_id)
    {
        set_name_in_vdf_block(&mut text, app_open, app_close, &compat_name)?;
    } else {
        let insertion =
            format!(
                "\n\t\t\"{}\"\n\t\t{{\n\t\t\t\"name\" \"{}\"\n\t\t\t\"config\" \"\"\n\t\t\t\"priority\" \"250\"\n\t\t}}\n",
                app_id,
                escape_vdf(
                    &compat_name
                )
            );

        text.insert_str(mapping_close, &insertion);
    }

    fs::write(&config, text)
        .map_err(|error| format!("Failed to write {}: {}", config.display(), error))?;

    Ok(
        RuntimeOverrideResult {
            launcher:
                "Steam".to_string(),
            action:
                "set".to_string(),
            runtime_name:
                Some(
                    runtime_name
                        .to_string()
                ),
            config_path:
                path_string(
                    &config
                ),
            backup_path:
                path_string(
                    &backup
                ),
            message:
                format!(
                    "Steam compatibility override set to {}. Fully restart Steam before launching the game.",
                    runtime_name
                ),
        }
    )
}

fn clear_steam_override(app_id: &str) -> Result<RuntimeOverrideResult, String> {
    let config =
        find_steam_config().ok_or_else(|| "Steam config.vdf was not found.".to_string())?;

    let backup = backup_config("steam", &config)?;

    let mut text = fs::read_to_string(&config)
        .map_err(|error| format!("Failed to read {}: {}", config.display(), error))?;

    let Some((_mapping_key, mapping_open, mapping_close)) = vdf_block(&text, "CompatToolMapping")
    else {
        return Err("Steam CompatToolMapping was not found.".to_string());
    };

    if let Some((app_key, _app_open, app_close)) =
        nested_vdf_block(&text, mapping_open, mapping_close, app_id)
    {
        let mut end = app_close + 1;

        while end < text.len() && matches!(text.as_bytes()[end], b'\r' | b'\n') {
            end += 1;
        }

        text.replace_range(app_key..end, "");

        fs::write(&config, text)
            .map_err(|error| format!("Failed to write {}: {}", config.display(), error))?;
    }

    Ok(RuntimeOverrideResult {
        launcher: "Steam".to_string(),
        action: "clear".to_string(),
        runtime_name: None,
        config_path: path_string(&config),
        backup_path: path_string(&backup),
        message:
            "Steam compatibility override cleared. Fully restart Steam before launching the game."
                .to_string(),
    })
}

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

fn heroic_roots() -> Vec<PathBuf> {
    let Ok(home) = home_dir() else {
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

fn config_match_score(
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

fn find_heroic_config(launcher_id: &str, install_path: &str) -> Option<PathBuf> {
    let mut best: Option<(PathBuf, i32)> = None;

    for root in heroic_roots() {
        let mut files = Vec::new();

        collect_json_files(&root, 0, &mut files);

        for path in files {
            let Ok(text) = fs::read_to_string(&path) else {
                continue;
            };

            let score = config_match_score(&path, &text, launcher_id, install_path, "");

            if score <= 0 {
                continue;
            }

            if best
                .as_ref()
                .is_none_or(|(_, best_score)| score > *best_score)
            {
                best = Some((path, score));
            }
        }
    }

    best.map(|(path, _)| path)
}

fn mutate_first_key(value: &mut Value, key_name: &str, replacement: Option<Value>) -> bool {
    match value {
        Value::Object(map) => {
            let matched_key = map
                .keys()
                .find(|key| key.eq_ignore_ascii_case(key_name))
                .cloned();

            if let Some(key) = matched_key {
                if let Some(replacement) = replacement {
                    map.insert(key, replacement);
                } else {
                    map.remove(&key);
                }

                return true;
            }

            for child in map.values_mut() {
                if mutate_first_key(child, key_name, replacement.clone()) {
                    return true;
                }
            }

            false
        }

        Value::Array(values) => {
            for child in values {
                if mutate_first_key(child, key_name, replacement.clone()) {
                    return true;
                }
            }

            false
        }

        _ => false,
    }
}

fn set_heroic_override(
    launcher_id: &str,
    install_path: &str,
    runtime_name: &str,
    runtime_path: &str,
) -> Result<RuntimeOverrideResult, String> {
    let config = find_heroic_config(launcher_id, install_path)
        .ok_or_else(|| "Heroic game configuration could not be matched.".to_string())?;

    let backup = backup_config("heroic", &config)?;

    let text = fs::read_to_string(&config)
        .map_err(|error| format!("Failed to read {}: {}", config.display(), error))?;

    let mut value: Value = serde_json::from_str(&text)
        .map_err(|error| format!("Heroic config is not valid JSON: {}", error))?;

    let path = Path::new(runtime_path);

    let lower = runtime_name.to_ascii_lowercase();

    let (runtime_type, binary) = if lower.contains("proton") || path.join("proton").exists() {
        ("proton", path.join("proton"))
    } else {
        ("wine", path.join("bin/wine"))
    };

    let mut runtime = Map::new();

    runtime.insert("name".to_string(), Value::String(runtime_name.to_string()));

    runtime.insert("type".to_string(), Value::String(runtime_type.to_string()));

    runtime.insert(
        "bin".to_string(),
        Value::String(if binary.exists() {
            path_string(&binary)
        } else {
            runtime_path.to_string()
        }),
    );

    if !mutate_first_key(&mut value, "wineVersion", Some(Value::Object(runtime))) {
        return Err(format!(
            "Heroic wineVersion setting was not found in {}. No changes were written. Backup: {}",
            config.display(),
            backup.display()
        ));
    }

    let output = serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?;

    fs::write(&config, format!("{}\n", output))
        .map_err(|error| format!("Failed to write {}: {}", config.display(), error))?;

    Ok(RuntimeOverrideResult {
        launcher: "Heroic".to_string(),
        action: "set".to_string(),
        runtime_name: Some(runtime_name.to_string()),
        config_path: path_string(&config),
        backup_path: path_string(&backup),
        message: format!(
            "Heroic runtime set to {}. Restart Heroic before launching the game.",
            runtime_name
        ),
    })
}

fn clear_heroic_override(
    launcher_id: &str,
    install_path: &str,
) -> Result<RuntimeOverrideResult, String> {
    let config = find_heroic_config(launcher_id, install_path)
        .ok_or_else(|| "Heroic game configuration could not be matched.".to_string())?;

    let backup = backup_config("heroic", &config)?;

    let text = fs::read_to_string(&config).map_err(|error| error.to_string())?;

    let mut value: Value = serde_json::from_str(&text).map_err(|error| error.to_string())?;

    if !mutate_first_key(&mut value, "wineVersion", None) {
        return Err("Heroic wineVersion setting was not found.".to_string());
    }

    fs::write(
        &config,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&value).map_err(|error| { error.to_string() })?
        ),
    )
    .map_err(|error| error.to_string())?;

    Ok(RuntimeOverrideResult {
        launcher: "Heroic".to_string(),
        action: "clear".to_string(),
        runtime_name: None,
        config_path: path_string(&config),
        backup_path: path_string(&backup),
        message:
            "Heroic per-game runtime setting cleared. Restart Heroic before launching the game."
                .to_string(),
    })
}

fn lutris_roots() -> Vec<PathBuf> {
    let Ok(home) = home_dir() else {
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

fn find_lutris_config(launcher_id: &str, install_path: &str, slug: &str) -> Option<PathBuf> {
    let mut best: Option<(PathBuf, i32)> = None;

    for root in lutris_roots() {
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

            let score = config_match_score(&path, &text, launcher_id, install_path, slug);

            if score <= 0 {
                continue;
            }

            if best
                .as_ref()
                .is_none_or(|(_, best_score)| score > *best_score)
            {
                best = Some((path, score));
            }
        }
    }

    best.map(|(path, _)| path)
}

fn set_lutris_wine_version(text: &str, runtime_name: Option<&str>) -> Result<String, String> {
    let lines = text
        .lines()
        .map(|line| line.to_string())
        .collect::<Vec<_>>();

    let wine_index = lines.iter().position(|line| line.trim() == "wine:");

    let mut lines = lines;

    let Some(wine_index) = wine_index else {
        if let Some(runtime_name) = runtime_name {
            lines.push("wine:".to_string());
            lines.push(format!(
                "  version: '{}'",
                runtime_name.replace('\'', "''",)
            ));

            return Ok(format!("{}\n", lines.join("\n")));
        }

        return Ok(format!("{}\n", lines.join("\n")));
    };

    let section_end = (wine_index + 1..lines.len())
        .find(|index| {
            let line = &lines[*index];

            !line.trim().is_empty() && !line.starts_with(' ') && !line.starts_with('\t')
        })
        .unwrap_or(lines.len());

    let version_index = (wine_index + 1..section_end)
        .find(|index| lines[*index].trim_start().starts_with("version:"));

    match (runtime_name, version_index) {
        (Some(runtime_name), Some(index)) => {
            let indent = lines[index]
                .chars()
                .take_while(|character| character.is_whitespace())
                .collect::<String>();

            lines[index] = format!("{}version: '{}'", indent, runtime_name.replace('\'', "''",));
        }

        (Some(runtime_name), None) => {
            lines.insert(
                wine_index + 1,
                format!("  version: '{}'", runtime_name.replace('\'', "''",)),
            );
        }

        (None, Some(index)) => {
            lines.remove(index);
        }

        (None, None) => {}
    }

    Ok(format!("{}\n", lines.join("\n")))
}

fn set_lutris_override(
    launcher_id: &str,
    install_path: &str,
    slug: &str,
    runtime_name: &str,
) -> Result<RuntimeOverrideResult, String> {
    let config = find_lutris_config(launcher_id, install_path, slug)
        .ok_or_else(|| "Lutris game configuration could not be matched.".to_string())?;

    let backup = backup_config("lutris", &config)?;

    let text = fs::read_to_string(&config).map_err(|error| error.to_string())?;

    let output = set_lutris_wine_version(&text, Some(runtime_name))?;

    fs::write(&config, output).map_err(|error| error.to_string())?;

    Ok(RuntimeOverrideResult {
        launcher: "Lutris".to_string(),
        action: "set".to_string(),
        runtime_name: Some(runtime_name.to_string()),
        config_path: path_string(&config),
        backup_path: path_string(&backup),
        message: format!(
            "Lutris Wine runner set to {}. Restart Lutris before launching the game.",
            runtime_name
        ),
    })
}

fn clear_lutris_override(
    launcher_id: &str,
    install_path: &str,
    slug: &str,
) -> Result<RuntimeOverrideResult, String> {
    let config = find_lutris_config(launcher_id, install_path, slug)
        .ok_or_else(|| "Lutris game configuration could not be matched.".to_string())?;

    let backup = backup_config("lutris", &config)?;

    let text = fs::read_to_string(&config).map_err(|error| error.to_string())?;

    let output = set_lutris_wine_version(&text, None)?;

    fs::write(&config, output).map_err(|error| error.to_string())?;

    Ok(
        RuntimeOverrideResult {
            launcher:
                "Lutris".to_string(),
            action:
                "clear".to_string(),
            runtime_name:
                None,
            config_path:
                path_string(
                    &config
                ),
            backup_path:
                path_string(
                    &backup
                ),
            message:
                "Lutris per-game Wine version setting cleared. Restart Lutris before launching the game."
                    .to_string(),
        }
    )
}

#[tauri::command]
pub fn set_proton_runtime_override(
    store: Option<String>,
    launcher_id: Option<String>,
    install_path: Option<String>,
    source: Option<String>,
    lutris_slug: Option<String>,
    runtime_name: String,
    runtime_path: String,
) -> Result<RuntimeOverrideResult, String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (
            store,
            launcher_id,
            install_path,
            source,
            lutris_slug,
            runtime_name,
            runtime_path,
        );

        return Err("Runtime overrides are available on Linux.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        if runtime_name.trim().is_empty() {
            return Err("Select a compatibility runtime first.".to_string());
        }

        let store = store.unwrap_or_default();

        let source = source.unwrap_or_default();

        let launcher = launcher_kind(&store, &source);

        let launcher_id = launcher_id.unwrap_or_default();

        let install_path = install_path.unwrap_or_default();

        let lutris_slug = lutris_slug.unwrap_or_default();

        match launcher.as_str() {
            "Steam" => set_steam_override(&launcher_id, runtime_name.trim(), runtime_path.trim()),

            "Heroic" => set_heroic_override(
                &launcher_id,
                &install_path,
                runtime_name.trim(),
                runtime_path.trim(),
            ),

            "Lutris" => set_lutris_override(
                &launcher_id,
                &install_path,
                &lutris_slug,
                runtime_name.trim(),
            ),

            _ => Err(format!(
                "Runtime override management is not supported for launcher '{}'.",
                launcher
            )),
        }
    }
}

#[tauri::command]
pub fn clear_proton_runtime_override(
    store: Option<String>,
    launcher_id: Option<String>,
    install_path: Option<String>,
    source: Option<String>,
    lutris_slug: Option<String>,
) -> Result<RuntimeOverrideResult, String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (store, launcher_id, install_path, source, lutris_slug);

        return Err("Runtime overrides are available on Linux.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let store = store.unwrap_or_default();

        let source = source.unwrap_or_default();

        let launcher = launcher_kind(&store, &source);

        let launcher_id = launcher_id.unwrap_or_default();

        let install_path = install_path.unwrap_or_default();

        let lutris_slug = lutris_slug.unwrap_or_default();

        match launcher.as_str() {
            "Steam" => clear_steam_override(&launcher_id),

            "Heroic" => clear_heroic_override(&launcher_id, &install_path),

            "Lutris" => clear_lutris_override(&launcher_id, &install_path, &lutris_slug),

            _ => Err(format!(
                "Runtime override management is not supported for launcher '{}'.",
                launcher
            )),
        }
    }
}
