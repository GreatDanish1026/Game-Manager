use std::{
    process::{
        Command,
        Output,
    },
};

use serde::{
    Deserialize,
    Serialize,
};


#[cfg(target_os = "linux")]
#[derive(Debug, Clone, Copy)]
enum LutrisBackend {
    NativeLocal,
    NativeHost,
    FlatpakLocal,
    FlatpakHost,
}


#[cfg(target_os = "linux")]
#[cfg(target_os = "linux")]
fn command_success(
    program: &str,
    args: &[&str],
) -> bool {
    let mut command =
    Command::new(
        program
    );

    command.args(
        args
    );

    /*
     * AppImages inject library/Python environment variables which can
     * interfere with host-native Lutris. Do not pass those into Lutris.
     */
    if program == "lutris"
        || program == "/usr/bin/lutris"
        {
            command.env_remove(
                "LD_LIBRARY_PATH"
            );

            command.env_remove(
                "PYTHONHOME"
            );

            command.env_remove(
                "PYTHONPATH"
            );
        }

        command
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
fn detect_lutris_backend() -> Option<LutrisBackend> {
    /*
     * In Distrobox, prefer host probes first so we do not pay the cost
     * of launching/failing container-side Lutris commands on every scan.
     */
    let in_distrobox =
        std::env::var_os(
            "CONTAINER_ID"
        )
        .is_some()
        || std::env::var_os(
            "DISTROBOX_ENTER_PATH"
        )
        .is_some()
        || std::path::Path::new(
            "/run/.containerenv"
        )
        .exists();

    if in_distrobox {
        if command_success(
            "distrobox-host-exec",
            &[
                "lutris",
                "--version",
            ],
        ) {
            return Some(
                LutrisBackend::NativeHost
            );
        }

        if command_success(
            "distrobox-host-exec",
            &[
                "flatpak",
                "info",
                "net.lutris.Lutris",
            ],
        ) {
            return Some(
                LutrisBackend::FlatpakHost
            );
        }
    }

    if command_success(
        "/usr/bin/lutris",
        &[
            "--version",
        ],
    )
        || command_success(
            "lutris",
            &[
                "--version",
            ],
        )
        {
            return Some(
                LutrisBackend::NativeLocal
            );
        }

    if command_success(
        "flatpak",
        &[
            "info",
            "net.lutris.Lutris",
        ],
    ) {
        return Some(
            LutrisBackend::FlatpakLocal
        );
    }

    if !in_distrobox {
        if command_success(
            "distrobox-host-exec",
            &[
                "lutris",
                "--version",
            ],
        ) {
            return Some(
                LutrisBackend::NativeHost
            );
        }

        if command_success(
            "distrobox-host-exec",
            &[
                "flatpak",
                "info",
                "net.lutris.Lutris",
            ],
        ) {
            return Some(
                LutrisBackend::FlatpakHost
            );
        }
    }

    None
}


#[derive(Debug, Clone, Deserialize)]
struct LutrisRawGame {
    #[serde(default)]
    id: Option<serde_json::Value>,

    #[serde(default)]
    name: Option<String>,

    #[serde(default)]
    slug: Option<String>,

    #[serde(default)]
    runner: Option<String>,

    #[serde(default)]
    directory: Option<String>,

    #[serde(default)]
    platform: Option<String>,

    #[serde(default)]
    service: Option<String>,

    #[serde(
        default,
        alias = "service_id",
        alias = "serviceId",
        alias = "appid",
        alias = "app_id"
    )]
    service_id: Option<serde_json::Value>,

    #[serde(default)]
    installed: Option<bool>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LutrisInstalledGame {
    pub id: String,
    pub name: String,
    pub store: String,
    pub launcher_id: String,
    pub install_path: String,
    pub source: String,
    pub runtime: String,
    pub native_linux: bool,
    pub lutris_runner: Option<String>,
    pub lutris_slug: Option<String>,
    pub lutris_service: Option<String>,
    pub lutris_service_id: Option<String>,

    pub cover_image_url: Option<String>,
}


fn output_text(
    output: Output,
) -> Option<String> {
    if !output.status.success() {
        return None;
    }

    let text =
        String::from_utf8_lossy(
            &output.stdout
        )
        .trim()
        .to_string();

    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}


#[cfg(target_os = "linux")]
#[cfg(target_os = "linux")]
fn run_local(
    program: &str,
    args: &[&str],
) -> Option<String> {
    let mut command =
    Command::new(
        program
    );

    command.args(
        args
    );

    /*
     * A packaged AppImage modifies its process environment. Native Lutris
     * must use the host's Python and system libraries rather than the
     * AppImage environment.
     */
    if program == "lutris"
        || program == "/usr/bin/lutris"
        {
            command.env_remove(
                "LD_LIBRARY_PATH"
            );

            command.env_remove(
                "PYTHONHOME"
            );

            command.env_remove(
                "PYTHONPATH"
            );
        }

        command
        .output()
        .ok()
        .and_then(
            output_text
        )
}


#[cfg(target_os = "linux")]
fn run_host(
    program: &str,
    args: &[&str],
) -> Option<String> {
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

    Command::new(
        "distrobox-host-exec"
    )
    .args(
        host_args
    )
    .output()
    .ok()
    .and_then(
        output_text
    )
}


#[cfg(target_os = "linux")]
fn lutris_json_for_backend(
    backend: LutrisBackend,
) -> Option<String> {
    match backend {
        LutrisBackend::NativeLocal =>
            run_local(
                "/usr/bin/lutris",
                &[
                    "--list-games",
                    "--installed",
                    "--json",
                ],
            ),

        LutrisBackend::NativeHost =>
            run_host(
                "lutris",
                &[
                    "--list-games",
                    "--installed",
                    "--json",
                ],
            ),

        LutrisBackend::FlatpakLocal =>
            run_local(
                "flatpak",
                &[
                    "run",
                    "net.lutris.Lutris",
                    "--list-games",
                    "--installed",
                    "--json",
                ],
            ),

        LutrisBackend::FlatpakHost =>
            run_host(
                "flatpak",
                &[
                    "run",
                    "net.lutris.Lutris",
                    "--list-games",
                    "--installed",
                    "--json",
                ],
            ),
    }
}


#[cfg(target_os = "linux")]
#[cfg(target_os = "linux")]
fn native_lutris_json()
-> Option<String>
{
    run_local(
        "/usr/bin/lutris",
        &[
            "--list-games",
            "--installed",
            "--json",
        ],
    )
    .or_else(
        || {
            run_local(
                "lutris",
                &[
                    "--list-games",
                    "--installed",
                    "--json",
                ],
            )
        }
    )
    .or_else(
        || {
            run_host(
                "lutris",
                &[
                    "--list-games",
                     "--installed",
                     "--json",
                ],
            )
        }
    )
}


#[cfg(target_os = "linux")]
fn flatpak_lutris_json()
    -> Option<String>
{
    run_local(
        "flatpak",
        &[
            "run",
            "net.lutris.Lutris",
            "--list-games",
            "--installed",
            "--json",
        ],
    )
    .or_else(
        || {
            run_host(
                "flatpak",
                &[
                    "run",
                    "net.lutris.Lutris",
                    "--list-games",
                    "--installed",
                    "--json",
                ],
            )
        }
    )
}


#[cfg(target_os = "linux")]
fn normalize_json_rows(
    text: &str,
) -> Vec<LutrisRawGame> {
    if let Ok(
        rows
    ) =
        serde_json::from_str::<
            Vec<LutrisRawGame>
        >(
            text
        )
    {
        return rows;
    }

    /*
     * Be tolerant if Lutris emits one JSON object per line.
     */
    text.lines()
        .filter_map(
            |line| {
                serde_json::from_str::<
                    LutrisRawGame
                >(
                    line
                )
                .ok()
            }
        )
        .collect()
}


fn scalar_to_string(
    value: Option<serde_json::Value>,
) -> Option<String> {
    match value {
        Some(
            serde_json::Value::String(
                text
            )
        ) => {
            let trimmed =
                text
                    .trim()
                    .to_string();

            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        }

        Some(
            serde_json::Value::Number(
                number
            )
        ) => {
            Some(
                number.to_string()
            )
        }

        _ =>
            None,
    }
}


fn store_label(
    service: Option<&str>,
) -> String {
    let normalized =
        service
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase();

    match normalized.as_str() {
        "steam" =>
            "Lutris - Steam"
                .to_string(),

        "gog" =>
            "Lutris - GOG"
                .to_string(),

        "egs"
        | "epic"
        | "epic-games"
        | "epic games" =>
            "Lutris - Epic"
                .to_string(),

        "ubisoft"
        | "uplay" =>
            "Lutris - Ubisoft"
                .to_string(),

        "ea"
        | "origin" =>
            "Lutris - EA"
                .to_string(),

        "battle.net"
        | "battlenet" =>
            "Lutris - Battle.net"
                .to_string(),

        "" =>
            "Lutris"
                .to_string(),

        other =>
            format!(
                "Lutris - {}",
                other
            ),
    }
}


fn native_linux_runtime(
    runner: Option<&str>,
    platform: Option<&str>,
) -> bool {
    let runner =
        runner
            .unwrap_or("")
            .to_ascii_lowercase();

    let platform =
        platform
            .unwrap_or("")
            .to_ascii_lowercase();

    runner == "linux"
        || (
            platform.contains(
                "linux"
            )
            && !runner.contains(
                "wine"
            )
        )
}


fn runtime_label(
    runner: Option<&str>,
    native_linux: bool,
) -> String {
    if native_linux {
        return "native_linux"
            .to_string();
    }

    let normalized =
        runner
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase();

    if normalized.contains(
        "wine"
    ) {
        "wine"
            .to_string()
    } else if normalized.contains(
        "steam"
    ) {
        "steam"
            .to_string()
    } else if normalized.is_empty() {
        "unknown"
            .to_string()
    } else {
        normalized
    }
}


fn lutris_cover_url(
    slug: Option<&str>,
) -> Option<String> {
    let slug =
        slug
            .map(str::trim)
            .filter(
                |value| {
                    !value.is_empty()
                }
            )?;

    /*
     * Lutris cover media is addressed by game slug. Lutris also caches
     * the same artwork under ~/.cache/lutris/coverart/<slug>.jpg.
     *
     * Use the HTTPS source URL here because GameAtlas's existing cover
     * renderer already accepts remote image URLs without needing a new
     * Tauri local-file protocol/CSP path.
     */
    Some(
        format!(
            "https://lutris.net/games/cover/{}.jpg",
            slug
        )
    )
}


fn map_game(
    raw: LutrisRawGame,
    source: &str,
) -> Option<LutrisInstalledGame> {
    if raw.installed
        == Some(
            false
        )
    {
        return None;
    }

    let id =
        scalar_to_string(
            raw.id
        )?;

    let name =
        raw.name
            .as_deref()
            .map(
                str::trim
            )
            .filter(
                |value| {
                    !value.is_empty()
                }
            )
            .map(
                str::to_string
            )
            .or_else(
                || {
                    raw.slug
                        .clone()
                }
            )
            .unwrap_or_else(
                || {
                    format!(
                        "Lutris Game {}",
                        id
                    )
                }
            );

    let install_path =
        raw.directory
            .as_deref()
            .map(
                str::trim
            )
            .filter(
                |value| {
                    !value.is_empty()
                }
            )
            .map(
                str::to_string
            )
            .unwrap_or_default();

    let service_id =
        scalar_to_string(
            raw.service_id
        );

    let native_linux =
        native_linux_runtime(
            raw.runner
                .as_deref(),
            raw.platform
                .as_deref(),
        );

    let store =
        store_label(
            raw.service
                .as_deref()
        );

    let runtime =
        runtime_label(
            raw.runner
                .as_deref(),
            native_linux,
        );

    let cover_image_url =
        lutris_cover_url(
            raw.slug
                .as_deref(),
        );

    Some(
        LutrisInstalledGame {
            id:
                format!(
                    "lutris:{}",
                    id
                ),

            name,

            store,

            launcher_id:
                id,

            install_path,

            source:
                source
                    .to_string(),

            runtime,

            native_linux,

            lutris_runner:
                raw.runner,

            lutris_slug:
                raw.slug,

            lutris_service:
                raw.service,

            lutris_service_id:
                service_id,

            cover_image_url,
        }
    )
}


fn dedupe(
    games: Vec<LutrisInstalledGame>,
) -> Vec<LutrisInstalledGame> {
    let mut unique:
        Vec<LutrisInstalledGame> =
        Vec::new();

    for game in games {
        if unique
            .iter()
            .any(
                |existing| {
                    existing.id
                        == game.id
                }
            )
        {
            continue;
        }

        unique.push(
            game
        );
    }

    unique.sort_by(
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

    unique
}


#[cfg(target_os = "linux")]
fn discover_lutris_games()
    -> Vec<LutrisInstalledGame>
{
    let Some(
        backend
    ) =
        detect_lutris_backend()
    else {
        return Vec::new();
    };

    let Some(
        text
    ) =
        lutris_json_for_backend(
            backend
        )
    else {
        return Vec::new();
    };

    let source =
        match backend {
            LutrisBackend::NativeLocal
            | LutrisBackend::NativeHost =>
                "Lutris",

            LutrisBackend::FlatpakLocal
            | LutrisBackend::FlatpakHost =>
                "Lutris Flatpak",
        };

    let games =
        normalize_json_rows(
            &text
        )
        .into_iter()
        .filter_map(
            |raw| {
                map_game(
                    raw,
                    source,
                )
            }
        )
        .collect();

    dedupe(
        games
    )
}


#[cfg(not(target_os = "linux"))]
fn discover_lutris_games()
    -> Vec<LutrisInstalledGame>
{
    Vec::new()
}


#[tauri::command]
pub fn get_lutris_installed_games()
    -> Result<Vec<LutrisInstalledGame>, String>
{
    Ok(
        discover_lutris_games()
    )
}
