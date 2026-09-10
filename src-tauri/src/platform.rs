use serde::Serialize;
use std::{
    env,
    fs,
    path::Path,
    process::Command,
};


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformCapabilities {
    pub registry: bool,
    pub steam: bool,
    pub native_linux_games: bool,
    pub proton: bool,
    pub windows_launcher_ecosystem: bool,
    pub system_hardware: bool,
    pub file_manager_open: bool,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub host_platform: String,
    pub host_display_name: String,
    pub architecture: String,
    pub distro_name: Option<String>,
    pub distro_version: Option<String>,
    pub kernel_version: Option<String>,
    pub desktop_environment: Option<String>,
    pub session_type: Option<String>,
    pub flatpak: bool,
    pub steam_deck: bool,
    pub bazzite: bool,
    pub capabilities: PlatformCapabilities,
}


fn clean_optional(
    value: Option<String>,
) -> Option<String> {
    value
        .map(
            |value| {
                value
                    .trim()
                    .trim_matches('"')
                    .to_string()
            }
        )
        .filter(
            |value| {
                !value.is_empty()
            }
        )
}


fn os_release_value(
    key: &str,
) -> Option<String> {
    let text =
        fs::read_to_string(
            "/etc/os-release"
        )
        .ok()?;

    for line in text.lines() {
        let Some(
            (
                candidate_key,
                value,
            )
        ) =
            line.split_once('=')
        else {
            continue;
        };

        if candidate_key.trim()
            != key
        {
            continue;
        }

        return clean_optional(
            Some(
                value.to_string()
            )
        );
    }

    None
}


fn command_output(
    program: &str,
    args: &[&str],
) -> Option<String> {
    let output =
        Command::new(
            program
        )
        .args(
            args
        )
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    clean_optional(
        Some(
            String::from_utf8_lossy(
                &output.stdout
            )
            .to_string()
        )
    )
}


fn linux_kernel_version() -> Option<String> {
    command_output(
        "uname",
        &[
            "-r",
        ],
    )
}


fn linux_is_flatpak() -> bool {
    env::var_os(
        "FLATPAK_ID"
    )
    .is_some()
        || Path::new(
            "/.flatpak-info"
        )
        .exists()
}


fn linux_is_steam_deck() -> bool {
    let id =
        os_release_value(
            "ID"
        )
        .unwrap_or_default()
        .to_ascii_lowercase();

    let variant =
        os_release_value(
            "VARIANT_ID"
        )
        .unwrap_or_default()
        .to_ascii_lowercase();

    let image_id =
        os_release_value(
            "IMAGE_ID"
        )
        .unwrap_or_default()
        .to_ascii_lowercase();

    id.contains(
        "steamos"
    )
        || variant.contains(
            "steamdeck"
        )
        || image_id.contains(
            "steamdeck"
        )
}


fn linux_is_bazzite() -> bool {
    let id =
        os_release_value(
            "ID"
        )
        .unwrap_or_default()
        .to_ascii_lowercase();

    let name =
        os_release_value(
            "NAME"
        )
        .unwrap_or_default()
        .to_ascii_lowercase();

    let pretty_name =
        os_release_value(
            "PRETTY_NAME"
        )
        .unwrap_or_default()
        .to_ascii_lowercase();

    id.contains(
        "bazzite"
    )
        || name.contains(
            "bazzite"
        )
        || pretty_name.contains(
            "bazzite"
        )
}


#[cfg(target_os = "windows")]
fn platform_info() -> PlatformInfo {
    PlatformInfo {
        host_platform:
            "windows"
                .to_string(),

        host_display_name:
            "Windows"
                .to_string(),

        architecture:
            env::consts::ARCH
                .to_string(),

        distro_name:
            None,

        distro_version:
            None,

        kernel_version:
            None,

        desktop_environment:
            None,

        session_type:
            None,

        flatpak:
            false,

        steam_deck:
            false,

        bazzite:
            false,

        capabilities:
            PlatformCapabilities {
                registry:
                    true,

                steam:
                    true,

                native_linux_games:
                    false,

                proton:
                    false,

                windows_launcher_ecosystem:
                    true,

                system_hardware:
                    true,

                file_manager_open:
                    true,
            },
    }
}


#[cfg(target_os = "linux")]
fn platform_info() -> PlatformInfo {
    let distro_name =
        os_release_value(
            "PRETTY_NAME"
        )
        .or_else(
            || {
                os_release_value(
                    "NAME"
                )
            }
        );

    let distro_version =
        os_release_value(
            "VERSION_ID"
        );

    PlatformInfo {
        host_platform:
            "linux"
                .to_string(),

        host_display_name:
            "Linux"
                .to_string(),

        architecture:
            env::consts::ARCH
                .to_string(),

        distro_name,

        distro_version,

        kernel_version:
            linux_kernel_version(),

        desktop_environment:
            clean_optional(
                env::var(
                    "XDG_CURRENT_DESKTOP"
                )
                .ok()
            ),

        session_type:
            clean_optional(
                env::var(
                    "XDG_SESSION_TYPE"
                )
                .ok()
            ),

        flatpak:
            linux_is_flatpak(),

        steam_deck:
            linux_is_steam_deck(),

        bazzite:
            linux_is_bazzite(),

        capabilities:
            PlatformCapabilities {
                registry:
                    false,

                steam:
                    true,

                native_linux_games:
                    true,

                proton:
                    true,

                windows_launcher_ecosystem:
                    false,

                system_hardware:
                    true,

                file_manager_open:
                    true,
            },
    }
}


#[cfg(target_os = "macos")]
fn platform_info() -> PlatformInfo {
    PlatformInfo {
        host_platform:
            "macos"
                .to_string(),

        host_display_name:
            "macOS"
                .to_string(),

        architecture:
            env::consts::ARCH
                .to_string(),

        distro_name:
            None,

        distro_version:
            None,

        kernel_version:
            command_output(
                "uname",
                &[
                    "-r",
                ],
            ),

        desktop_environment:
            None,

        session_type:
            None,

        flatpak:
            false,

        steam_deck:
            false,

        bazzite:
            false,

        capabilities:
            PlatformCapabilities {
                registry:
                    false,

                steam:
                    false,

                native_linux_games:
                    false,

                proton:
                    false,

                windows_launcher_ecosystem:
                    false,

                system_hardware:
                    false,

                file_manager_open:
                    true,
            },
    }
}


#[cfg(not(any(
    target_os = "windows",
    target_os = "linux",
    target_os = "macos"
)))]
fn platform_info() -> PlatformInfo {
    PlatformInfo {
        host_platform:
            env::consts::OS
                .to_string(),

        host_display_name:
            env::consts::OS
                .to_string(),

        architecture:
            env::consts::ARCH
                .to_string(),

        distro_name:
            None,

        distro_version:
            None,

        kernel_version:
            None,

        desktop_environment:
            None,

        session_type:
            None,

        flatpak:
            false,

        steam_deck:
            false,

        bazzite:
            false,

        capabilities:
            PlatformCapabilities {
                registry:
                    false,

                steam:
                    false,

                native_linux_games:
                    false,

                proton:
                    false,

                windows_launcher_ecosystem:
                    false,

                system_hardware:
                    false,

                file_manager_open:
                    false,
            },
    }
}


#[tauri::command]
pub fn get_platform_info() -> Result<PlatformInfo, String> {
    Ok(
        platform_info()
    )
}
