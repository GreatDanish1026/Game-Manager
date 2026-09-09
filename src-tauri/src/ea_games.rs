use std::{
    collections::HashSet,
    path::PathBuf,
};

use serde::Serialize;

#[cfg(target_os = "windows")]
use winreg::{
    enums::{
        HKEY_LOCAL_MACHINE,
        KEY_READ,
        KEY_WOW64_32KEY,
        KEY_WOW64_64KEY,
    },
    RegKey,
};


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EaInstalledGame {
    pub id: String,
    pub name: String,
    pub store: String,
    pub launcher_id: String,
    pub install_path: String,
}


fn clean_string(
    value: String,
) -> Option<String> {
    let cleaned =
        value
            .trim()
            .trim_matches('"')
            .trim()
            .to_string();

    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}


#[cfg(target_os = "windows")]
fn string_value(
    key: &RegKey,
    names: &[&str],
) -> Option<String> {
    for name in
        names
    {
        if let Ok(value) =
            key.get_value::<String, _>(
                name
            )
        {
            if let Some(value) =
                clean_string(
                    value
                )
            {
                return Some(
                    value
                );
            }
        }
    }

    None
}


fn existing_directory(
    value: &str,
) -> Option<String> {
    let path =
        PathBuf::from(
            value
        );

    if path.exists()
        && path.is_dir()
    {
        Some(
            path
                .to_string_lossy()
                .trim_end_matches([
                    '\\',
                    '/',
                ])
                .to_string()
        )
    } else {
        None
    }
}


fn normalize_name(
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


#[cfg(target_os = "windows")]
fn resolve_titanfall2_path()
    -> Option<String>
{
    let hklm =
        RegKey::predef(
            HKEY_LOCAL_MACHINE
        );

    for (
        registry_path,
        flags,
    ) in [
        (
            r"SOFTWARE\Respawn\Titanfall2",
            KEY_WOW64_64KEY,
        ),
        (
            r"SOFTWARE\Respawn\Titanfall 2",
            KEY_WOW64_64KEY,
        ),
        (
            r"SOFTWARE\Respawn\Titanfall2",
            KEY_WOW64_32KEY,
        ),
        (
            r"SOFTWARE\Respawn\Titanfall 2",
            KEY_WOW64_32KEY,
        ),
    ] {
        if let Ok(key) =
            hklm.open_subkey_with_flags(
                registry_path,
                KEY_READ | flags,
            )
        {
            if let Some(path) =
                string_value(
                    &key,
                    &[
                        "Install Dir",
                        "InstallDir",
                        "Install Location",
                        "InstallLocation",
                    ],
                )
                .and_then(
                    |value| {
                        existing_directory(
                            &value
                        )
                    }
                )
            {
                return Some(
                    path
                );
            }
        }
    }

    None
}


#[cfg(target_os = "windows")]
fn resolve_uninstall_path(
    display_name: &str,
) -> Option<String> {
    let wanted =
        normalize_name(
            display_name
        );

    if wanted.is_empty() {
        return None;
    }

    let hklm =
        RegKey::predef(
            HKEY_LOCAL_MACHINE
        );

    for flags in [
        KEY_WOW64_64KEY,
        KEY_WOW64_32KEY,
    ] {
        let root =
            match hklm.open_subkey_with_flags(
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                KEY_READ | flags,
            ) {
                Ok(root) =>
                    root,

                Err(_) =>
                    continue,
            };

        for subkey_result in
            root.enum_keys()
        {
            let subkey_name =
                match subkey_result {
                    Ok(value) =>
                        value,

                    Err(_) =>
                        continue,
                };

            let key =
                match root.open_subkey_with_flags(
                    &subkey_name,
                    KEY_READ | flags,
                ) {
                    Ok(key) =>
                        key,

                    Err(_) =>
                        continue,
                };

            let candidate_name =
                match string_value(
                    &key,
                    &[
                        "DisplayName",
                    ],
                ) {
                    Some(value) =>
                        value,

                    None =>
                        continue,
                };

            if normalize_name(
                &candidate_name
            ) != wanted
            {
                continue;
            }

            if let Some(path) =
                string_value(
                    &key,
                    &[
                        "InstallLocation",
                        "Install Location",
                    ],
                )
                .and_then(
                    |value| {
                        existing_directory(
                            &value
                        )
                    }
                )
            {
                return Some(
                    path
                );
            }
        }
    }

    None
}


#[cfg(target_os = "windows")]
fn resolve_fallback_install_path(
    display_name: &str,
) -> Option<String> {
    let normalized =
        normalize_name(
            display_name
        );

    /*
     * Titanfall 2 often stores its actual path under Respawn rather
     * than beneath the EA/Origin Games product key.
     */
    if normalized
        == "titanfall2"
    {
        if let Some(path) =
            resolve_titanfall2_path()
        {
            return Some(
                path
            );
        }
    }

    /*
     * Generic Windows fallback for EA titles whose Origin Games key
     * has no Install Dir value.
     */
    resolve_uninstall_path(
        display_name
    )
}


#[cfg(target_os = "windows")]
fn scan_origin_games_view(
    flags: u32,
) -> Vec<EaInstalledGame> {
    let hklm =
        RegKey::predef(
            HKEY_LOCAL_MACHINE
        );

    let root =
        match hklm.open_subkey_with_flags(
            r"SOFTWARE\Origin Games",
            KEY_READ | flags,
        ) {
            Ok(root) =>
                root,

            Err(_) =>
                return Vec::new(),
        };

    let mut games =
        Vec::new();

    for content_id_result in
        root.enum_keys()
    {
        let content_id =
            match content_id_result {
                Ok(value) =>
                    value,

                Err(_) =>
                    continue,
            };

        let game_key =
            match root.open_subkey_with_flags(
                &content_id,
                KEY_READ | flags,
            ) {
                Ok(key) =>
                    key,

                Err(_) =>
                    continue,
            };

        let name =
            match string_value(
                &game_key,
                &[
                    "DisplayName",
                    "Display Name",
                    "Title",
                ],
            ) {
                Some(value) =>
                    value,

                None => {
                    /*
                     * EA keeps a number of auxiliary/component product
                     * registrations under Origin Games. Those entries often
                     * have only a numeric product key and no human-readable
                     * display name. They are not library games.
                     */
                    continue;
                }
            };

        let install_path =
            string_value(
                &game_key,
                &[
                    "Install Dir",
                    "InstallDir",
                    "Install Location",
                    "InstallLocation",
                ],
            )
            .and_then(
                |value| {
                    existing_directory(
                        &value
                    )
                }
            )
            .or_else(
                || {
                    resolve_fallback_install_path(
                        &name
                    )
                }
            )
            .unwrap_or_default();

        /*
         * Important:
         *
         * EA App can retain a valid installed-game product registration
         * without storing Install Dir on the Origin Games key itself.
         *
         * v1.3 Phase 1 originally rejected those entries, which caused
         * titles such as Titanfall 2 to disappear from GameAtlas even
         * though EA App itself listed them.
         *
         * Keep the game visible even when the path cannot be resolved.
         * Local inspection/health can report the missing path separately,
         * while EA launching can still use the product/content ID.
         */
        games.push(
            EaInstalledGame {
                id:
                    format!(
                        "ea:{}",
                        content_id
                    ),

                name,

                store:
                    "EA App"
                        .to_string(),

                launcher_id:
                    content_id,

                install_path,
            }
        );
    }

    games
}


#[cfg(target_os = "windows")]
fn scan_ea_registry()
    -> Vec<EaInstalledGame>
{
    let mut games =
        Vec::new();

    games.extend(
        scan_origin_games_view(
            KEY_WOW64_32KEY
        )
    );

    games.extend(
        scan_origin_games_view(
            KEY_WOW64_64KEY
        )
    );

    /*
     * First remove duplicate registry-view reads of the same EA product ID.
     */
    let mut seen_ids =
        HashSet::new();

    games.retain(
        |game| {
            seen_ids.insert(
                game.launcher_id
                    .to_ascii_lowercase()
            )
        }
    );


    /*
     * EA can register the same retail title under several offer/product IDs.
     * The Sims 4 is a common example. GameAtlas should present one library
     * entry, not one row per entitlement/edition/component.
     *
     * Prefer a game that has a resolved install path. Otherwise keep the
     * first human-readable registration.
     */
    let mut deduped =
        Vec::<EaInstalledGame>::new();

    for game in
        games
    {
        let normalized_name =
            normalize_name(
                &game.name
            );

        let existing_index =
            deduped
                .iter()
                .position(
                    |existing| {
                        normalize_name(
                            &existing.name
                        ) == normalized_name
                    }
                );

        match existing_index {
            Some(index) => {
                let existing =
                    &deduped[index];

                if existing.install_path.is_empty()
                    && !game.install_path.is_empty()
                {
                    deduped[index] =
                        game;
                }
            }

            None =>
                deduped.push(
                    game
                ),
        }
    }

    let mut games =
        deduped;

    games.sort_by(
        |left, right| {
            left.name
                .to_ascii_lowercase()
                .cmp(
                    &right
                        .name
                        .to_ascii_lowercase()
                )
        }
    );

    games
}


#[cfg(not(target_os = "windows"))]
fn scan_ea_registry()
    -> Vec<EaInstalledGame>
{
    Vec::new()
}


#[tauri::command]
pub fn get_ea_installed_games()
    -> Result<Vec<EaInstalledGame>, String>
{
    Ok(
        scan_ea_registry()
    )
}
