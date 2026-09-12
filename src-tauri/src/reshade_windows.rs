use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReShadeWindowsInstallResult {
    pub installed: bool,
    pub executable_path: String,
    pub binary_directory: String,
    pub graphics_api: Option<String>,
    pub installer_path: String,
    pub detected_loader: Option<String>,
    pub message: String,
}

fn map_graphics_api(value: Option<&str>) -> Option<&'static str> {
    let normalized = value?
        .trim()
        .to_ascii_lowercase()
        .replace([' ', '-', '_'], "");

    if normalized.contains("d3d9") || normalized.contains("direct3d9") {
        Some("d3d9")
    } else if normalized.contains("d3d10") || normalized.contains("direct3d10") {
        Some("d3d10")
    } else if normalized.contains("d3d11") || normalized.contains("direct3d11") {
        Some("d3d11")
    } else if normalized.contains("d3d12") || normalized.contains("direct3d12") {
        Some("d3d12")
    } else if normalized.contains("dxgi") {
        Some("dxgi")
    } else if normalized.contains("opengl") {
        Some("opengl")
    } else if normalized.contains("vulkan") {
        Some("vulkan")
    } else {
        None
    }
}

fn detect_loader(directory: &Path) -> Option<String> {
    [
        "dxgi.dll",
        "d3d9.dll",
        "d3d10.dll",
        "d3d11.dll",
        "d3d12.dll",
        "opengl32.dll",
    ]
    .into_iter()
    .map(|name| directory.join(name))
    .find(|path| path.is_file())
    .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn install_reshade_addons_windows(
    installer_path: String,
    executable_path: String,
    graphics_api: Option<String>,
) -> Result<ReShadeWindowsInstallResult, String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (installer_path, executable_path, graphics_api);
        return Err(
            "The Windows ReShade installer command is only available on Windows."
                .to_string(),
        );
    }

    #[cfg(target_os = "windows")]
    {
        let installer = PathBuf::from(&installer_path);
        if !installer.is_file() {
            return Err(format!(
                "ReShade installer was not found: {}",
                installer.display()
            ));
        }

        let executable = PathBuf::from(&executable_path);
        if !executable.is_file() {
            return Err(format!(
                "Game executable was not found: {}",
                executable.display()
            ));
        }

        let extension = executable
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default();

        if !extension.eq_ignore_ascii_case("exe") {
            return Err(format!(
                "ReShade installation requires a Windows .exe target: {}",
                executable.display()
            ));
        }

        let binary_directory = executable
            .parent()
            .ok_or_else(|| {
                "Could not determine the game executable directory."
                    .to_string()
            })?
            .to_path_buf();

        if !binary_directory.is_dir() {
            return Err(format!(
                "Game executable directory does not exist: {}",
                binary_directory.display()
            ));
        }

        // ReShade's official setup tool accepts:
        //   <game.exe> --api <api> --headless
        //
        // If GameAtlas cannot confidently map the detected API, omit --api and
        // allow the official installer to analyze the executable itself.
        let mapped_api = map_graphics_api(graphics_api.as_deref());

        let mut command = Command::new(&installer);
        command.arg(&executable);

        if let Some(api) = mapped_api {
            command.arg("--api").arg(api);
        }

        command.arg("--headless");

        let output = command
            .output()
            .map_err(|error| {
                format!(
                    "Could not start the official ReShade installer: {}",
                    error
                )
            })?;

        if !output.status.success() {
            let stdout =
                String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr =
                String::from_utf8_lossy(&output.stderr).trim().to_string();

            let details = if !stderr.is_empty() {
                stderr
            } else if !stdout.is_empty() {
                stdout
            } else {
                format!("exit status {}", output.status)
            };

            return Err(format!(
                "The official ReShade installer did not complete successfully: {}",
                details
            ));
        }

        // The installer may install different proxy names depending on the
        // graphics API. Detection is deliberately broad here; the existing
        // RenoDX readiness scan performs the authoritative post-install check.
        let detected_loader = detect_loader(&binary_directory);

        let ini = binary_directory.join("ReShade.ini");
        let log = binary_directory.join("ReShade.log");

        if detected_loader.is_none() && !ini.is_file() && !log.is_file() {
            return Err(
                "ReShade setup exited successfully, but GameAtlas could not detect a ReShade loader or configuration in the game directory."
                    .to_string(),
            );
        }

        Ok(ReShadeWindowsInstallResult {
            installed: true,
            executable_path: executable.to_string_lossy().to_string(),
            binary_directory: binary_directory.to_string_lossy().to_string(),
            graphics_api: mapped_api.map(str::to_string),
            installer_path: installer.to_string_lossy().to_string(),
            detected_loader,
            message: format!(
                "ReShade with full add-on support was installed for {}.",
                executable
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("the selected game")
            ),
        })
    }
}
