use serde::Serialize;
use std::{
    env, fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const RESHADE_HOME: &str = "https://reshade.me/";
const RESHADE_DOWNLOAD_BASE: &str = "https://reshade.me/downloads/";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReShadeAddonInstallerInfo {
    pub version: String,
    pub download_url: String,
    pub official_page: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReShadeAddonDownload {
    pub version: String,
    pub download_url: String,
    pub installer_path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReShadeInstallResult {
    pub installed: bool,
    pub method: String,
    pub target_executable: String,
    pub loader_path: String,
    pub loader_size_bytes: u64,
    pub reshade_ini_path: String,
    pub backup_path: Option<String>,
    pub message: String,
}

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "HOME is not available.".to_string())
}

fn cache_dir() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".cache/GameAtlas/reshade"))
}

fn backup_root() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".local/share/GameAtlas/renodx-backups"))
}

fn now_stamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

fn extract_current_version(html: &str) -> Option<String> {
    let marker = "Version ";
    let start = html.find(marker)? + marker.len();
    let rest = &html[start..];

    let version: String = rest
        .chars()
        .take_while(|character| character.is_ascii_digit() || *character == '.')
        .collect();

    if version.is_empty() {
        None
    } else {
        Some(version)
    }
}

fn addon_download_url(version: &str) -> String {
    format!(
        "{}ReShade_Setup_{}_Addon.exe",
        RESHADE_DOWNLOAD_BASE, version
    )
}

fn command_exists(program: &str) -> bool {
    Command::new("sh")
        .arg("-lc")
        .arg(format!("command -v {} >/dev/null 2>&1", program))
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn choose_loader_name(graphics_api: Option<&str>) -> &'static str {
    let api = graphics_api.unwrap_or("").to_ascii_lowercase();

    if api.contains("d3d9") || api.contains("direct3d 9") || api.contains("directx 9") {
        "d3d9.dll"
    } else if api.contains("opengl") {
        "opengl32.dll"
    } else {
        "dxgi.dll"
    }
}

fn backup_existing_file(source: &Path, game_key: &str) -> Result<Option<PathBuf>, String> {
    if !source.is_file() {
        return Ok(None);
    }

    let backup_dir = backup_root()?.join(game_key).join(now_stamp());

    fs::create_dir_all(&backup_dir).map_err(|error| {
        format!(
            "Could not create backup directory {}: {}",
            backup_dir.display(),
            error
        )
    })?;

    let file_name = source
        .file_name()
        .ok_or_else(|| "Could not determine existing loader filename.".to_string())?;

    let destination = backup_dir.join(file_name);

    fs::copy(source, &destination).map_err(|error| {
        format!(
            "Could not back up {} to {}: {}",
            source.display(),
            destination.display(),
            error
        )
    })?;

    Ok(Some(destination))
}

fn extract_reshade_dll(installer: &Path, architecture: &str) -> Result<PathBuf, String> {
    let member = if architecture == "32-bit" {
        "ReShade32.dll"
    } else {
        "ReShade64.dll"
    };

    let temp_dir = cache_dir()?.join(format!("extract-{}", now_stamp()));

    fs::create_dir_all(&temp_dir).map_err(|error| {
        format!(
            "Could not create temporary extraction directory {}: {}",
            temp_dir.display(),
            error
        )
    })?;

    // ReShade_Setup_*.exe is a self-extracting archive that 7-Zip can
    // inspect directly. Do not try to carve out the first PK ZIP signature:
    // PE resources can contain earlier ZIP-looking signatures that are not
    // the actual archive payload.
    let output = if command_exists("7z") {
        Command::new("7z")
            .arg("e")
            .arg("-y")
            .arg(format!("-o{}", temp_dir.to_string_lossy()))
            .arg(installer)
            .arg(member)
            .output()
    } else if command_exists("7zz") {
        Command::new("7zz")
            .arg("e")
            .arg("-y")
            .arg(format!("-o{}", temp_dir.to_string_lossy()))
            .arg(installer)
            .arg(member)
            .output()
    } else {
        return Err(
            "GameAtlas needs 7z or 7zz to extract ReShade from the official Windows installer on Linux."
                .to_string()
        );
    }
    .map_err(|error| {
        format!(
            "Could not run the ReShade archive extractor: {}",
            error
        )
    })?;

    if !output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        return Err(format!(
            "Could not extract {} directly from the official ReShade installer.\n{}\n{}",
            member,
            stdout.trim(),
            stderr.trim()
        ));
    }

    let extracted = temp_dir.join(member);

    if !extracted.is_file() {
        // Some 7-Zip versions can return success when the requested member
        // was not selected. List the archive so the error contains useful
        // information rather than falsely reporting install success.
        let listing = if command_exists("7z") {
            Command::new("7z").arg("l").arg(installer).output()
        } else {
            Command::new("7zz").arg("l").arg(installer).output()
        };

        let details = listing
            .ok()
            .map(|output| {
                String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .filter(|line| {
                        line.to_ascii_lowercase().contains("reshade")
                            && line.to_ascii_lowercase().contains(".dll")
                    })
                    .take(20)
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();

        let _ = fs::remove_dir_all(&temp_dir);

        return Err(format!(
            "7-Zip opened the ReShade installer, but {} was not extracted. Archive DLL entries:\n{}",
            member,
            if details.is_empty() {
                "(none found)"
            } else {
                &details
            }
        ));
    }

    let size = fs::metadata(&extracted)
        .map_err(|error| error.to_string())?
        .len();

    if size < 500_000 {
        let _ = fs::remove_dir_all(&temp_dir);

        return Err(format!(
            "Extracted {} is unexpectedly small ({} bytes).",
            member, size
        ));
    }

    Ok(extracted)
}

fn copy_and_verify(source: &Path, destination: &Path) -> Result<u64, String> {
    let expected_size = fs::metadata(source)
        .map_err(|error| error.to_string())?
        .len();

    let temp_destination = destination.with_extension("dll.gameatlas-tmp");

    {
        let mut input = fs::File::open(source).map_err(|error| error.to_string())?;

        let mut output = fs::File::create(&temp_destination).map_err(|error| {
            format!("Could not create {}: {}", temp_destination.display(), error)
        })?;

        std::io::copy(&mut input, &mut output).map_err(|error| error.to_string())?;

        output.flush().map_err(|error| error.to_string())?;

        output.sync_all().map_err(|error| error.to_string())?;
    }

    let temp_size = fs::metadata(&temp_destination)
        .map_err(|error| error.to_string())?
        .len();

    if temp_size != expected_size {
        let _ = fs::remove_file(&temp_destination);

        return Err(format!(
            "ReShade copy verification failed before commit: expected {} bytes, wrote {} bytes.",
            expected_size, temp_size
        ));
    }

    if destination.exists() {
        fs::remove_file(destination)
            .map_err(|error| format!("Could not replace {}: {}", destination.display(), error))?;
    }

    fs::rename(&temp_destination, destination).map_err(|error| {
        format!(
            "Could not commit ReShade loader to {}: {}",
            destination.display(),
            error
        )
    })?;

    let actual = fs::metadata(destination)
        .map_err(|error| {
            format!(
                "ReShade installation claimed success, but {} cannot be read: {}",
                destination.display(),
                error
            )
        })?
        .len();

    if actual != expected_size || actual < 500_000 {
        return Err(format!(
            "Post-install verification failed for {}: expected {} bytes, found {} bytes.",
            destination.display(),
            expected_size,
            actual
        ));
    }

    Ok(actual)
}

fn ensure_reshade_ini(directory: &Path) -> Result<PathBuf, String> {
    let ini = directory.join("ReShade.ini");

    if !ini.exists() {
        let contents = r#"[GENERAL]
PerformanceMode=0
PreprocessorDefinitions=

[ADDON]
DisabledAddons=
"#;

        let mut file = fs::File::create(&ini)
            .map_err(|error| format!("Could not create {}: {}", ini.display(), error))?;

        file.write_all(contents.as_bytes())
            .map_err(|error| error.to_string())?;

        file.sync_all().map_err(|error| error.to_string())?;
    }

    if !ini.is_file() {
        return Err(format!(
            "ReShade.ini verification failed at {}.",
            ini.display()
        ));
    }

    Ok(ini)
}

#[tauri::command]
pub async fn get_reshade_addon_installer_info() -> Result<ReShadeAddonInstallerInfo, String> {
    let client = reqwest::Client::builder()
        .user_agent("GameAtlas/2.1 ReShade Manager")
        .build()
        .map_err(|error| error.to_string())?;

    let html = client
        .get(RESHADE_HOME)
        .send()
        .await
        .map_err(|error| format!("Could not reach the official ReShade site: {}", error))?
        .error_for_status()
        .map_err(|error| format!("The official ReShade site returned an error: {}", error))?
        .text()
        .await
        .map_err(|error| error.to_string())?;

    let version = extract_current_version(&html).ok_or_else(|| {
        "GameAtlas could not determine the current ReShade version from reshade.me.".to_string()
    })?;

    let download_url = addon_download_url(&version);

    Ok(ReShadeAddonInstallerInfo {
        version,
        download_url,
        official_page: RESHADE_HOME.to_string(),
    })
}

#[tauri::command]
pub async fn download_reshade_addon_installer() -> Result<ReShadeAddonDownload, String> {
    let info = get_reshade_addon_installer_info().await?;

    let client = reqwest::Client::builder()
        .user_agent("GameAtlas/2.1 ReShade Manager")
        .build()
        .map_err(|error| error.to_string())?;

    let bytes = client
        .get(&info.download_url)
        .send()
        .await
        .map_err(|error| {
            format!(
                "Could not download the official ReShade installer: {}",
                error
            )
        })?
        .error_for_status()
        .map_err(|error| format!("The ReShade download returned an error: {}", error))?
        .bytes()
        .await
        .map_err(|error| error.to_string())?;

    if bytes.len() < 500_000 || bytes.get(0..2) != Some(b"MZ") {
        return Err("The ReShade download failed executable validation.".to_string());
    }

    let directory = cache_dir()?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;

    let destination = directory.join(format!("ReShade_Setup_{}_Addon.exe", info.version));

    let mut file = fs::File::create(&destination).map_err(|error| error.to_string())?;

    file.write_all(&bytes).map_err(|error| error.to_string())?;

    file.sync_all().map_err(|error| error.to_string())?;

    Ok(ReShadeAddonDownload {
        version: info.version,
        download_url: info.download_url,
        installer_path: destination.to_string_lossy().to_string(),
        size_bytes: bytes.len() as u64,
    })
}

#[tauri::command]
pub fn install_reshade_addons_direct_linux(
    installer_path: String,
    target_executable: String,
    architecture: String,
    graphics_api: Option<String>,
    game_key: String,
) -> Result<ReShadeInstallResult, String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (
            installer_path,
            target_executable,
            architecture,
            graphics_api,
            game_key,
        );

        return Err(
            "Direct ReShade installation is currently enabled for Linux validation only."
                .to_string(),
        );
    }

    #[cfg(target_os = "linux")]
    {
        let installer = PathBuf::from(&installer_path);
        let target = PathBuf::from(&target_executable);

        if !installer.is_file() {
            return Err(format!(
                "ReShade installer not found: {}",
                installer.display()
            ));
        }

        if !target.is_file() {
            return Err(format!(
                "Detected game executable not found: {}",
                target.display()
            ));
        }

        let directory = target
            .parent()
            .ok_or_else(|| "Could not determine the executable directory.".to_string())?;

        let loader_name = choose_loader_name(graphics_api.as_deref());

        let loader_path = directory.join(loader_name);

        let backup = backup_existing_file(&loader_path, &game_key)?;

        let extracted = extract_reshade_dll(&installer, &architecture)?;

        let loader_size = copy_and_verify(&extracted, &loader_path)?;

        if let Some(parent) = extracted.parent() {
            let _ = fs::remove_dir_all(parent);
        }

        let ini = ensure_reshade_ini(directory)?;

        // Final hard verification: success is impossible unless both files
        // exist in the exact target directory and the loader has real payload.
        if !loader_path.is_file() || !ini.is_file() {
            return Err(format!(
                "Final ReShade verification failed in {}.",
                directory.display()
            ));
        }

        Ok(ReShadeInstallResult {
            installed: true,
            method: "direct-extraction-verified".to_string(),
            target_executable: target.to_string_lossy().to_string(),
            loader_path: loader_path.to_string_lossy().to_string(),
            loader_size_bytes: loader_size,
            reshade_ini_path: ini.to_string_lossy().to_string(),
            backup_path: backup.map(|path| path.to_string_lossy().to_string()),
            message: format!(
                "ReShade installed and verified: {} ({} bytes).",
                loader_path.display(),
                loader_size
            ),
        })
    }
}
