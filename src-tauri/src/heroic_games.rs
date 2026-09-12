use std::{
    env, fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeroicInstalledGame {
    pub id: String,
    pub name: String,
    pub store: String,
    pub launcher_id: String,
    pub install_path: String,
    pub source: String,
    pub runtime: String,
    pub native_linux: bool,
    pub heroic_runner: String,
    pub heroic_app_name: String,

    pub cover_image_url: Option<String>,
}

#[derive(Debug, Clone)]
struct HeroicRoot {
    root: PathBuf,
    label: &'static str,
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME").map(PathBuf::from)
}

fn heroic_roots() -> Vec<HeroicRoot> {
    let Some(home) = home_dir() else {
        return Vec::new();
    };

    vec![
        HeroicRoot {
            root: home.join(".config").join("heroic"),

            label: "Heroic",
        },
        HeroicRoot {
            root: home
                .join(".var")
                .join("app")
                .join("com.heroicgameslauncher.hgl")
                .join("config")
                .join("heroic"),

            label: "Heroic Flatpak",
        },
    ]
}

fn text_field(value: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(text) = value
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
        {
            return Some(text.to_string());
        }
    }

    None
}

fn read_json(path: &Path) -> Option<Value> {
    let text = fs::read_to_string(path).ok()?;

    serde_json::from_str(&text).ok()
}

fn platform_is_linux(value: &Value) -> bool {
    text_field(value, &["platform", "os", "target_platform"])
        .map(|platform| platform.to_ascii_lowercase().contains("linux"))
        .unwrap_or(false)
}

fn epic_installed_file(root: &HeroicRoot) -> Vec<PathBuf> {
    vec![
        root.root
            .join("legendaryConfig")
            .join("legendary")
            .join("installed.json"),
        /*
         * Older Heroic configurations can point Legendary at the
         * traditional ~/.config/legendary directory.
         */
        home_dir()
            .unwrap_or_default()
            .join(".config")
            .join("legendary")
            .join("installed.json"),
    ]
}

fn gog_installed_file(root: &HeroicRoot) -> PathBuf {
    root.root.join("gog_store").join("installed.json")
}

fn epic_games_from_file(path: &Path, source: &str) -> Vec<HeroicInstalledGame> {
    let Some(json) = read_json(path) else {
        return Vec::new();
    };

    let Some(object) = json.as_object() else {
        return Vec::new();
    };

    object
        .iter()
        .filter_map(|(app_name, value)| {
            let install_path = text_field(value, &["install_path", "installPath", "path"])?;

            if !Path::new(&install_path).exists() {
                return None;
            }

            let name = text_field(value, &["title", "name", "app_title"])
                .unwrap_or_else(|| app_name.to_string());

            let native_linux = platform_is_linux(value);

            Some(HeroicInstalledGame {
                id: format!("heroic:legendary:{}", app_name),

                name,

                store: "Heroic - Epic".to_string(),

                launcher_id: format!("legendary:{}", app_name),

                install_path,

                source: source.to_string(),

                runtime: if native_linux {
                    "native_linux".to_string()
                } else {
                    "wine_or_proton".to_string()
                },

                native_linux,

                heroic_runner: "legendary".to_string(),

                heroic_app_name: app_name.to_string(),

                cover_image_url: None,
            })
        })
        .collect()
}

fn object_or_array_entries(json: &Value) -> Vec<(String, &Value)> {
    /*
     * Heroic GOG's installed.json is commonly shaped as:
     *
     * {
     *   "installed": [
     *     {
     *       "appName": "...",
     *       "install_path": "...",
     *       ...
     *     }
     *   ]
     * }
     *
     * Older/different versions may expose either a root object keyed by
     * app id or a root array, so support all three forms.
     */
    if let Some(installed) = json.get("installed").and_then(Value::as_array) {
        return installed
            .iter()
            .enumerate()
            .map(|(index, value)| {
                let key = text_field(
                    value,
                    &[
                        "app_name",
                        "appName",
                        "id",
                        "game_id",
                        "gameId",
                        "product_id",
                        "productId",
                    ],
                )
                .unwrap_or_else(|| index.to_string());

                (key, value)
            })
            .collect();
    }

    if let Some(object) = json.as_object() {
        return object
            .iter()
            .filter(|(key, _)| *key != "version" && *key != "installed")
            .map(|(key, value)| (key.clone(), value))
            .collect();
    }

    if let Some(array) = json.as_array() {
        return array
            .iter()
            .enumerate()
            .map(|(index, value)| {
                let key = text_field(
                    value,
                    &[
                        "app_name",
                        "appName",
                        "id",
                        "game_id",
                        "gameId",
                        "product_id",
                        "productId",
                    ],
                )
                .unwrap_or_else(|| index.to_string());

                (key, value)
            })
            .collect();
    }

    Vec::new()
}

fn value_matches_gog_id(value: &Value, app_name: &str) -> bool {
    const ID_KEYS: &[&str] = &[
        "app_name",
        "appName",
        "id",
        "game_id",
        "gameId",
        "product_id",
        "productId",
    ];

    for key in ID_KEYS {
        let Some(candidate) = value.get(*key) else {
            continue;
        };

        if let Some(text) = candidate.as_str() {
            if text.trim() == app_name {
                return true;
            }
        }

        if let Some(number) = candidate.as_u64() {
            if number.to_string() == app_name {
                return true;
            }
        }

        if let Some(number) = candidate.as_i64() {
            if number.to_string() == app_name {
                return true;
            }
        }
    }

    false
}

fn title_from_gog_metadata_object(value: &Value) -> Option<String> {
    text_field(value, &["title", "name", "app_title", "appTitle"])
}

fn find_gog_title_recursive(value: &Value, app_name: &str) -> Option<String> {
    if let Some(object) = value.as_object() {
        /*
         * Some cache layouts key the object directly by product id.
         */
        if let Some(entry) = object.get(app_name) {
            if let Some(title) = title_from_gog_metadata_object(entry) {
                return Some(title);
            }
        }

        if value_matches_gog_id(value, app_name) {
            if let Some(title) = title_from_gog_metadata_object(value) {
                return Some(title);
            }
        }

        for child in object.values() {
            if let Some(title) = find_gog_title_recursive(child, app_name) {
                return Some(title);
            }
        }
    }

    if let Some(array) = value.as_array() {
        for child in array {
            if let Some(title) = find_gog_title_recursive(child, app_name) {
                return Some(title);
            }
        }
    }

    None
}

fn cover_from_gog_metadata_object(value: &Value) -> Option<String> {
    text_field(
        value,
        &[
            "art_cover",
            "artCover",
            "art_square",
            "artSquare",
            "cover",
            "cover_url",
            "coverUrl",
            "image",
            "image_url",
            "imageUrl",
        ],
    )
}

fn find_gog_cover_recursive(value: &Value, app_name: &str) -> Option<String> {
    if let Some(object) = value.as_object() {
        if let Some(entry) = object.get(app_name) {
            if let Some(cover) = cover_from_gog_metadata_object(entry) {
                return Some(cover);
            }
        }

        if value_matches_gog_id(value, app_name) {
            if let Some(cover) = cover_from_gog_metadata_object(value) {
                return Some(cover);
            }
        }

        for child in object.values() {
            if let Some(cover) = find_gog_cover_recursive(child, app_name) {
                return Some(cover);
            }
        }
    }

    if let Some(array) = value.as_array() {
        for child in array {
            if let Some(cover) = find_gog_cover_recursive(child, app_name) {
                return Some(cover);
            }
        }
    }

    None
}

fn gog_cover_from_library_cache(heroic_root: &Path, app_name: &str) -> Option<String> {
    let candidates = [
        heroic_root.join("store_cache").join("gog_library.json"),
        heroic_root.join("gog_store").join("gog_library.json"),
    ];

    for candidate in candidates {
        let Some(json) = read_json(&candidate) else {
            continue;
        };

        if let Some(cover) = find_gog_cover_recursive(&json, app_name) {
            return Some(cover);
        }
    }

    None
}

fn gog_title_from_library_cache(heroic_root: &Path, app_name: &str) -> Option<String> {
    let candidates = [
        heroic_root.join("store_cache").join("gog_library.json"),
        heroic_root.join("gog_store").join("gog_library.json"),
    ];

    for candidate in candidates {
        let Some(json) = read_json(&candidate) else {
            continue;
        };

        if let Some(title) = find_gog_title_recursive(&json, app_name) {
            return Some(title);
        }
    }

    None
}

fn gog_games_from_file(path: &Path, source: &str, heroic_root: &Path) -> Vec<HeroicInstalledGame> {
    let Some(json) = read_json(path) else {
        return Vec::new();
    };

    object_or_array_entries(&json)
        .into_iter()
        .filter_map(|(fallback_id, value)| {
            let install_path = text_field(value, &["install_path", "installPath", "path"])?;

            if !Path::new(&install_path).exists() {
                return None;
            }

            let app_name = text_field(
                value,
                &[
                    "app_name",
                    "appName",
                    "id",
                    "game_id",
                    "gameId",
                    "product_id",
                    "productId",
                ],
            )
            .unwrap_or(fallback_id);

            let name = text_field(value, &["title", "name", "app_title", "appTitle"])
                .or_else(|| gog_title_from_library_cache(heroic_root, &app_name))
                .unwrap_or_else(|| app_name.clone());

            let native_linux = platform_is_linux(value);

            Some(HeroicInstalledGame {
                id: format!("heroic:gog:{}", app_name),

                name,

                store: "Heroic - GOG".to_string(),

                launcher_id: format!("gog:{}", app_name),

                install_path,

                source: source.to_string(),

                runtime: if native_linux {
                    "native_linux".to_string()
                } else {
                    "wine_or_proton".to_string()
                },

                native_linux,

                heroic_runner: "gog".to_string(),

                cover_image_url: gog_cover_from_library_cache(heroic_root, &app_name),

                heroic_app_name: app_name,
            })
        })
        .collect()
}

fn dedupe_games(games: Vec<HeroicInstalledGame>) -> Vec<HeroicInstalledGame> {
    let mut unique: Vec<HeroicInstalledGame> = Vec::new();

    for game in games {
        if unique.iter().any(|existing| existing.id == game.id) {
            continue;
        }

        unique.push(game);
    }

    unique.sort_by(|left, right| {
        left.name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase())
    });

    unique
}

#[cfg(target_os = "linux")]
fn discover_heroic_games() -> Vec<HeroicInstalledGame> {
    let mut games = Vec::new();

    for root in heroic_roots() {
        for path in epic_installed_file(&root) {
            games.extend(epic_games_from_file(&path, root.label));
        }

        games.extend(gog_games_from_file(
            &gog_installed_file(&root),
            root.label,
            &root.root,
        ));
    }

    dedupe_games(games)
}

#[cfg(not(target_os = "linux"))]
fn discover_heroic_games() -> Vec<HeroicInstalledGame> {
    Vec::new()
}

#[tauri::command]
pub fn get_heroic_installed_games() -> Result<Vec<HeroicInstalledGame>, String> {
    Ok(discover_heroic_games())
}
