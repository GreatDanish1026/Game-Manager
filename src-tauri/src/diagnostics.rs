use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn diagnostics_root() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let base =
            env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA is not available.".to_string())?;

        return Ok(PathBuf::from(base).join("GameManager").join("Diagnostics"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home = env::var("HOME").map_err(|_| "HOME is not available.".to_string())?;

        Ok(PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("GameManager")
            .join("Diagnostics"))
    }
}

fn export_directory() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(profile) = env::var("USERPROFILE") {
            let downloads = PathBuf::from(profile).join("Downloads");

            if downloads.exists() {
                return Ok(downloads);
            }
        }
    }

    diagnostics_root()
}

fn write_text(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create diagnostics directory: {}", error))?;
    }

    fs::write(path, content).map_err(|error| format!("Failed to write diagnostics file: {}", error))
}

fn copy_existing_logs(bundle_directory: &Path) -> Result<usize, String> {
    #[cfg(target_os = "windows")]
    {
        let base = match env::var("LOCALAPPDATA") {
            Ok(value) => value,

            Err(_) => return Ok(0),
        };

        let candidates = [
            PathBuf::from(&base).join("GameManager").join("Logs"),
            PathBuf::from(&base).join("GameAtlas").join("Logs"),
        ];

        let destination = bundle_directory.join("logs");

        let mut copied = 0usize;

        for candidate in candidates {
            if !candidate.exists() || !candidate.is_dir() {
                continue;
            }

            fs::create_dir_all(&destination)
                .map_err(|error| format!("Failed to create bundle log directory: {}", error))?;

            for entry in fs::read_dir(&candidate)
                .map_err(|error| format!("Failed to read log directory: {}", error))?
            {
                let entry =
                    entry.map_err(|error| format!("Failed to read log entry: {}", error))?;

                let path = entry.path();

                if !path.is_file() {
                    continue;
                }

                let extension = path
                    .extension()
                    .and_then(|value| value.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();

                if !["log", "txt"].contains(&extension.as_str()) {
                    continue;
                }

                let metadata = entry
                    .metadata()
                    .map_err(|error| format!("Failed to read log metadata: {}", error))?;

                if metadata.len() > 5 * 1024 * 1024 {
                    continue;
                }

                fs::copy(&path, destination.join(entry.file_name()))
                    .map_err(|error| format!("Failed to copy log file: {}", error))?;

                copied += 1;
            }
        }

        return Ok(copied);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = bundle_directory;

        Ok(0)
    }
}

#[tauri::command]
pub fn export_diagnostics_text(content: String) -> Result<String, String> {
    let directory = export_directory()?;

    fs::create_dir_all(&directory)
        .map_err(|error| format!("Failed to create diagnostics export directory: {}", error))?;

    let path = directory.join(format!("GameAtlas-Diagnostics-{}.txt", unix_now()));

    write_text(&path, &content)?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_diagnostics_support_bundle(
    diagnostic_text: String,
    diagnostic_json: String,
) -> Result<String, String> {
    let root = diagnostics_root()?;

    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create diagnostics directory: {}", error))?;

    let timestamp = unix_now();

    let bundle_directory = root.join(format!("support-{}", timestamp));

    fs::create_dir_all(&bundle_directory)
        .map_err(|error| format!("Failed to create support bundle directory: {}", error))?;

    write_text(&bundle_directory.join("diagnostics.txt"), &diagnostic_text)?;

    write_text(&bundle_directory.join("diagnostics.json"), &diagnostic_json)?;

    let copied_logs = copy_existing_logs(&bundle_directory)?;

    let manifest = format!(
        concat!(
            "GameAtlas Support Bundle\n",
            "========================\n\n",
            "Generated Unix: {}\n",
            "Bundle schema: 1\n",
            "Persistent log files copied: {}\n\n",
            "Privacy\n",
            "-------\n",
            "This bundle is intentionally generated from the sanitized diagnostics payload.\n",
            "It does not include game installation paths, save paths, backup archives,\n",
            "backup filenames, user tags, saved-view names, account identifiers,\n",
            "updater private keys, or signing passwords.\n\n",
            "Logs\n",
            "----\n",
            "Existing GameAtlas/GameManager .log or .txt files under the local application\n",
            "log directory are included only when present and smaller than 5 MB each.\n",
            "No new persistent logging is enabled by creating this bundle.\n"
        ),
        timestamp, copied_logs
    );

    write_text(&bundle_directory.join("README.txt"), &manifest)?;

    #[cfg(target_os = "windows")]
    {
        let export_directory = export_directory()?;

        fs::create_dir_all(&export_directory).map_err(|error| {
            format!(
                "Failed to create support bundle export directory: {}",
                error
            )
        })?;

        let zip_path = export_directory.join(format!("GameAtlas-Support-{}.zip", timestamp));

        if zip_path.exists() {
            fs::remove_file(&zip_path)
                .map_err(|error| format!("Failed to replace existing support bundle: {}", error))?;
        }

        let source = format!("{}\\*", bundle_directory.to_string_lossy());

        let command = format!(
            "Compress-Archive -Path '{}' -DestinationPath '{}' -CompressionLevel Optimal -Force",
            source.replace('\'', "''"),
            zip_path.to_string_lossy().replace('\'', "''")
        );

        let status = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &command,
            ])
            .status()
            .map_err(|error| {
                format!(
                    "Failed to start PowerShell for support bundle compression: {}",
                    error
                )
            })?;

        if !status.success() {
            return Err(format!(
                "PowerShell failed to create the support bundle (exit code {:?}).",
                status.code()
            ));
        }

        let _ = fs::remove_dir_all(&bundle_directory);

        return Ok(zip_path.to_string_lossy().to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(bundle_directory.to_string_lossy().to_string())
    }
}
