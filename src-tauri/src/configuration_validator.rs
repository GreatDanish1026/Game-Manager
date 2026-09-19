use quick_xml::{events::Event, Reader};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::{os::windows::process::CommandExt, process::Command};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const MAX_FILES: usize = 500;
const MAX_DEPTH: usize = 8;
const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 16 * 1024 * 1024;
const MAX_SETTINGS: usize = 60;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationIssue {
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub file_name: Option<String>,
    pub line: Option<usize>,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationFileInfo {
    pub file_name: String,
    pub relative_path: String,
    pub format: String,
    pub size_bytes: u64,
    pub read_only: bool,
    pub status: String,
    pub issue_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationSetting {
    pub category: String,
    pub name: String,
    pub value: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationValidationReport {
    pub supported: bool,
    pub config_path: Option<String>,
    pub used_install_fallback: bool,
    pub files: Vec<ConfigurationFileInfo>,
    pub issues: Vec<ConfigurationIssue>,
    pub settings: Vec<ConfigurationSetting>,
    pub files_inspected: usize,
    pub files_skipped: usize,
    pub scan_truncated: bool,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationBackupEntry {
    pub id: String,
    pub created_unix: u64,
    pub reason: String,
    pub file_count: usize,
    pub total_size_bytes: u64,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationBackupStatus {
    pub supported: bool,
    pub backup_directory: String,
    pub backups: Vec<ConfigurationBackupEntry>,
    pub game_running: bool,
    pub executable_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationRecoveryResult {
    pub message: String,
    pub files_changed: usize,
    pub safety_backup: Option<ConfigurationBackupEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupManifestFile {
    relative_path: String,
    size_bytes: u64,
    sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupManifest {
    schema_version: u32,
    game_name: String,
    created_unix: u64,
    reason: String,
    source_root: String,
    used_install_fallback: bool,
    files: Vec<BackupManifestFile>,
}

#[derive(Debug)]
struct ConfigurationRoot {
    path: PathBuf,
    used_install_fallback: bool,
}

fn issue(
    severity: &str,
    title: impl Into<String>,
    detail: impl Into<String>,
    file_name: Option<&str>,
    line: Option<usize>,
    suggestion: Option<&str>,
) -> ConfigurationIssue {
    ConfigurationIssue {
        severity: severity.to_string(),
        title: title.into(),
        detail: detail.into(),
        file_name: file_name.map(str::to_string),
        line,
        suggestion: suggestion.map(str::to_string),
    }
}

fn format_name(path: &Path) -> String {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "ini" => "INI",
        "json" => "JSON",
        "xml" => "XML",
        "cfg" => "CFG",
        "conf" => "CONF",
        "toml" => "TOML",
        "yaml" | "yml" => "YAML",
        "txt" => "Text",
        _ if is_extensionless_config(path) => "Text configuration",
        _ => "Configuration",
    }
    .to_string()
}

fn is_extensionless_config(path: &Path) -> bool {
    if path.extension().is_some() {
        return false;
    }
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let normalized = normalized_key(name);
    matches!(
        normalized.as_str(),
        "config"
            | "configuration"
            | "settings"
            | "enginesettings"
            | "gamesettings"
            | "graphicssettings"
            | "usersettings"
            | "preferences"
            | "options"
    )
}

fn is_config_extension(path: &Path) -> bool {
    is_extensionless_config(path)
        || matches!(
            path.extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase()
                .as_str(),
            "ini" | "json" | "xml" | "cfg" | "conf" | "toml" | "yaml" | "yml" | "txt"
        )
}

fn likely_install_config(path: &Path) -> bool {
    if !is_config_extension(path) {
        return false;
    }
    let name = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    [
        "config",
        "setting",
        "option",
        "graphic",
        "display",
        "video",
        "engine",
        "renderer",
        "gameuser",
        "preferences",
    ]
    .iter()
    .any(|token| name.contains(token))
}

fn collect_files(root: &Path, install_fallback: bool) -> (Vec<PathBuf>, bool) {
    if root.is_file() {
        return (vec![root.to_path_buf()], false);
    }

    let max_depth = if install_fallback { 2 } else { MAX_DEPTH };
    let mut stack = vec![(root.to_path_buf(), 0usize)];
    let mut files = Vec::new();
    let mut truncated = false;

    while let Some((directory, depth)) = stack.pop() {
        let Ok(entries) = fs::read_dir(&directory) else {
            continue;
        };
        for entry in entries.flatten() {
            if files.len() >= MAX_FILES {
                truncated = true;
                break;
            }
            let path = entry.path();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                if depth < max_depth {
                    let directory_name = entry.file_name().to_string_lossy().to_ascii_lowercase();
                    if !install_fallback
                        || depth == 0
                        || ["config", "configs", "settings", "profiles", "saved"]
                            .iter()
                            .any(|token| directory_name.contains(token))
                    {
                        stack.push((path, depth + 1));
                    }
                }
                continue;
            }
            if is_config_extension(&path) && (!install_fallback || likely_install_config(&path)) {
                files.push(path);
            }
        }
        if truncated {
            break;
        }
    }
    files.sort_by_key(|path| path.to_string_lossy().to_ascii_lowercase());
    (files, truncated)
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn backup_id() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}-{:03}", duration.as_secs(), duration.subsec_millis())
}

fn sanitize_component(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | ' ') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches('.')
        .to_string();
    if cleaned.is_empty() {
        "Unknown Game".to_string()
    } else {
        cleaned
    }
}

fn configuration_backup_directory(
    app: &tauri::AppHandle,
    game_name: &str,
    game_id: Option<&str>,
) -> Result<PathBuf, String> {
    let mut folder = sanitize_component(game_name);
    if let Some(id) = game_id
        .map(sanitize_component)
        .filter(|value| !value.is_empty())
    {
        folder.push_str(" [");
        folder.push_str(&id);
        folder.push(']');
    }
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve GameAtlas data storage: {error}"))?
        .join("configuration-backups")
        .join(folder))
}

fn executable_name(executable_path: Option<&str>) -> Option<String> {
    executable_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .and_then(|value| Path::new(value).file_name())
        .and_then(|value| value.to_str())
        .map(str::to_string)
}

#[cfg(target_os = "windows")]
fn process_is_running(name: &str) -> bool {
    let mut command = Command::new("tasklist.exe");
    command
        .arg("/FI")
        .arg(format!("IMAGENAME eq {name}"))
        .arg("/FO")
        .arg("CSV")
        .arg("/NH")
        .creation_flags(CREATE_NO_WINDOW);
    command
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| {
            String::from_utf8_lossy(&output.stdout)
                .to_ascii_lowercase()
                .contains(&format!("\"{}\"", name.to_ascii_lowercase()))
        })
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
fn process_is_running(name: &str) -> bool {
    let wanted = name.to_ascii_lowercase();
    let Ok(entries) = fs::read_dir("/proc") else {
        return false;
    };

    entries
        .flatten()
        .filter_map(|entry| entry.file_name().to_string_lossy().parse::<u32>().ok())
        .any(|pid| {
            let comm_matches = fs::read_to_string(format!("/proc/{pid}/comm"))
                .ok()
                .is_some_and(|comm| comm.trim().eq_ignore_ascii_case(&wanted));
            if comm_matches {
                return true;
            }
            fs::read(format!("/proc/{pid}/cmdline"))
                .ok()
                .is_some_and(|cmdline| {
                    cmdline.split(|byte| *byte == 0).any(|argument| {
                        let normalized = String::from_utf8_lossy(argument).replace('\\', "/");
                        Path::new(&normalized)
                            .file_name()
                            .and_then(|value| value.to_str())
                            .is_some_and(|value| value.eq_ignore_ascii_case(&wanted))
                    })
                })
        })
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn process_is_running(_name: &str) -> bool {
    false
}

fn require_game_closed(executable_path: Option<&str>) -> Result<(), String> {
    if let Some(name) = executable_name(executable_path) {
        if process_is_running(&name) {
            return Err(format!(
                "{name} is still running. Close the game before backing up, resetting, or restoring its configuration."
            ));
        }
    }
    Ok(())
}

fn resolve_configuration_root(
    install_path: &str,
    config_path: Option<&str>,
    resolved_config_path: Option<&str>,
    proton_prefix: Option<&str>,
) -> Result<ConfigurationRoot, String> {
    let install = PathBuf::from(install_path.trim().trim_matches('"'));
    let resolved = resolved_config_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .filter(|path| path.exists())
        .filter(|path| !is_broad_configuration_root(path, proton_prefix))
        .or_else(|| {
            config_path
                .filter(|value| !value.trim().is_empty())
                .and_then(|raw| {
                    crate::local_paths::resolve_game_path_with_context(
                        raw,
                        install.to_str(),
                        proton_prefix,
                    )
                    .ok()
                })
                .filter(|path| !is_broad_configuration_root(path, proton_prefix))
        });

    if let Some(path) = resolved {
        return Ok(ConfigurationRoot {
            path,
            used_install_fallback: false,
        });
    }
    if install.is_dir() {
        return Ok(ConfigurationRoot {
            path: install,
            used_install_fallback: true,
        });
    }
    Err("No existing configuration or installation folder is available.".to_string())
}

fn same_existing_path(left: &Path, right: &Path) -> bool {
    let left = fs::canonicalize(left).unwrap_or_else(|_| left.to_path_buf());
    let right = fs::canonicalize(right).unwrap_or_else(|_| right.to_path_buf());
    #[cfg(target_os = "windows")]
    {
        return left
            .to_string_lossy()
            .eq_ignore_ascii_case(&right.to_string_lossy());
    }
    #[cfg(not(target_os = "windows"))]
    {
        left == right
    }
}

fn is_broad_configuration_root(path: &Path, proton_prefix: Option<&str>) -> bool {
    let mut protected = Vec::new();
    for variable in ["HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA"] {
        if let Some(value) = std::env::var_os(variable) {
            protected.push(PathBuf::from(value));
        }
    }
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        protected.push(home.join(".config"));
        protected.push(home.join(".local/share"));
    }
    if let Some(value) = std::env::var_os("XDG_CONFIG_HOME") {
        protected.push(PathBuf::from(value));
    }
    if let Some(value) = std::env::var_os("XDG_DATA_HOME") {
        protected.push(PathBuf::from(value));
    }
    if let Some(prefix) = proton_prefix
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
    {
        protected.push(prefix.clone());
        protected.push(prefix.join("drive_c"));
        protected.push(prefix.join("drive_c/users/steamuser"));
        protected.push(prefix.join("drive_c/users/steamuser/AppData"));
    }
    protected
        .iter()
        .filter(|candidate| candidate.exists())
        .any(|candidate| same_existing_path(path, candidate))
}

fn file_hash(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| {
        format!(
            "Could not read {} for verification: {error}",
            path.display()
        )
    })?;
    Ok(hex::encode(Sha256::digest(bytes)))
}

fn safe_relative_path(root: &Path, path: &Path) -> Result<PathBuf, String> {
    let relative = path.strip_prefix(root).map_err(|_| {
        "A configuration file was outside the resolved configuration folder.".to_string()
    })?;
    if relative.as_os_str().is_empty() {
        return path
            .file_name()
            .map(PathBuf::from)
            .ok_or_else(|| "A configuration file name could not be determined.".to_string());
    }
    if relative
        .components()
        .all(|component| matches!(component, std::path::Component::Normal(_)))
    {
        Ok(relative.to_path_buf())
    } else {
        Err("An unsafe configuration path was rejected.".to_string())
    }
}

fn validate_backup_id(value: &str) -> Result<&str, String> {
    if value.is_empty()
        || value.len() > 64
        || !value
            .chars()
            .all(|character| character.is_ascii_digit() || character == '-')
    {
        return Err("Invalid configuration backup identifier.".to_string());
    }
    Ok(value)
}

fn read_manifest(directory: &Path) -> Result<BackupManifest, String> {
    let text = fs::read_to_string(directory.join("manifest.json"))
        .map_err(|error| format!("Could not read the configuration backup manifest: {error}"))?;
    let manifest: BackupManifest = serde_json::from_str(&text)
        .map_err(|error| format!("The configuration backup manifest is invalid: {error}"))?;
    if manifest.schema_version != 1 {
        return Err("This configuration backup uses an unsupported format.".to_string());
    }
    Ok(manifest)
}

fn backup_entry(directory: &Path, manifest: &BackupManifest) -> ConfigurationBackupEntry {
    ConfigurationBackupEntry {
        id: directory
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string(),
        created_unix: manifest.created_unix,
        reason: manifest.reason.clone(),
        file_count: manifest.files.len(),
        total_size_bytes: manifest.files.iter().map(|file| file.size_bytes).sum(),
        path: directory.to_string_lossy().to_string(),
    }
}

fn list_configuration_backups(directory: &Path) -> Result<Vec<ConfigurationBackupEntry>, String> {
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut backups = fs::read_dir(directory)
        .map_err(|error| format!("Could not read configuration backups: {error}"))?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| {
            let path = entry.path();
            read_manifest(&path)
                .ok()
                .map(|manifest| backup_entry(&path, &manifest))
        })
        .collect::<Vec<_>>();
    backups.sort_by(|left, right| {
        right
            .created_unix
            .cmp(&left.created_unix)
            .then_with(|| right.id.cmp(&left.id))
    });
    Ok(backups)
}

fn create_configuration_backup_blocking(
    app: &tauri::AppHandle,
    game_name: &str,
    game_id: Option<&str>,
    root: &ConfigurationRoot,
    reason: &str,
) -> Result<ConfigurationBackupEntry, String> {
    let (files, truncated) = collect_files(&root.path, root.used_install_fallback);
    if truncated {
        return Err(
            "The configuration search reached its file limit. No incomplete backup was created."
                .to_string(),
        );
    }
    if files.is_empty() {
        return Err(
            "No recognizable configuration files are currently available to back up.".to_string(),
        );
    }

    const MAX_BACKUP_FILE_BYTES: u64 = 64 * 1024 * 1024;
    const MAX_BACKUP_TOTAL_BYTES: u64 = 256 * 1024 * 1024;
    let root_directory = configuration_backup_directory(app, game_name, game_id)?;
    fs::create_dir_all(&root_directory)
        .map_err(|error| format!("Could not create configuration backup storage: {error}"))?;
    let id = backup_id();
    let directory = root_directory.join(&id);
    let payload = directory.join("files");
    fs::create_dir_all(&payload)
        .map_err(|error| format!("Could not create the configuration backup: {error}"))?;

    let result = (|| {
        let mut total = 0u64;
        let mut manifest_files = Vec::new();
        for source in files {
            let metadata = fs::metadata(&source).map_err(|error| {
                format!(
                    "Could not inspect {} while creating the backup: {error}",
                    source.display()
                )
            })?;
            if metadata.len() > MAX_BACKUP_FILE_BYTES
                || total.saturating_add(metadata.len()) > MAX_BACKUP_TOTAL_BYTES
            {
                return Err("Configuration backup exceeded the 256 MB safety limit.".to_string());
            }
            total += metadata.len();
            let relative = safe_relative_path(&root.path, &source)?;
            let destination = payload.join(&relative);
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Could not create a backup subfolder: {error}"))?;
            }
            fs::copy(&source, &destination)
                .map_err(|error| format!("Could not back up {}: {error}", source.display()))?;
            let source_hash = file_hash(&source)?;
            if file_hash(&destination)? != source_hash {
                return Err(format!(
                    "Backup verification failed for {}.",
                    source.display()
                ));
            }
            manifest_files.push(BackupManifestFile {
                relative_path: relative.to_string_lossy().to_string(),
                size_bytes: metadata.len(),
                sha256: source_hash,
            });
        }

        let manifest = BackupManifest {
            schema_version: 1,
            game_name: game_name.to_string(),
            created_unix: unix_now(),
            reason: reason.to_string(),
            source_root: root.path.to_string_lossy().to_string(),
            used_install_fallback: root.used_install_fallback,
            files: manifest_files,
        };
        let json = serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("Could not serialize the backup manifest: {error}"))?;
        fs::write(directory.join("manifest.json"), json)
            .map_err(|error| format!("Could not finish the backup manifest: {error}"))?;
        Ok(backup_entry(&directory, &manifest))
    })();

    if result.is_err() {
        let _ = fs::remove_dir_all(&directory);
    }
    result
}

fn decode_text(bytes: &[u8]) -> Result<String, &'static str> {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8(bytes[3..].to_vec()).map_err(|_| "invalid UTF-8");
    }
    if bytes.starts_with(&[0xFF, 0xFE]) {
        if (bytes.len() - 2) % 2 != 0 {
            return Err("invalid UTF-16 LE");
        }
        let units = bytes[2..]
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        return String::from_utf16(&units).map_err(|_| "invalid UTF-16 LE");
    }
    if bytes.starts_with(&[0xFE, 0xFF]) {
        if (bytes.len() - 2) % 2 != 0 {
            return Err("invalid UTF-16 BE");
        }
        let units = bytes[2..]
            .chunks_exact(2)
            .map(|pair| u16::from_be_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        return String::from_utf16(&units).map_err(|_| "invalid UTF-16 BE");
    }
    String::from_utf8(bytes.to_vec()).map_err(|_| "unsupported or invalid text encoding")
}

fn normalized_key(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn safe_value(value: &str) -> Option<String> {
    let clean = value.trim().trim_matches('"').trim_matches('\'');
    if clean.is_empty() || clean.len() > 48 {
        return None;
    }
    clean
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || ".,+-%_ xX".contains(character))
        .then(|| clean.to_string())
}

fn setting_definition(key: &str) -> Option<(&'static str, &'static str, &'static str)> {
    match normalized_key(key).as_str() {
        "resolutionx"
        | "resx"
        | "screenwidth"
        | "resolutionwidth"
        | "displaywidth"
        | "resolutionsizex"
        | "lastuserconfirmedresolutionsizex"
        | "desiredscreenwidth" => Some(("display", "Resolution width", "width")),
        "resolutiony"
        | "resy"
        | "screenheight"
        | "resolutionheight"
        | "displayheight"
        | "resolutionsizey"
        | "lastuserconfirmedresolutionsizey"
        | "desiredscreenheight" => Some(("display", "Resolution height", "height")),
        "refreshrate" | "screenrefreshrate" | "displayfrequency" | "refreshhz" => {
            Some(("display", "Refresh rate", "refresh"))
        }
        "fullscreen"
        | "fullscreenmode"
        | "lastconfirmedfullscreenmode"
        | "windowmode"
        | "displaymode"
        | "windowed" => Some(("display", "Window mode", "mode")),
        "vsync" | "usevsync" | "busevsync" | "verticalsync" | "vsyncenabled" => {
            Some(("performance", "V-Sync", "toggle"))
        }
        "frameratelimit" | "frameratecap" | "fpslimit" | "maxfps" | "targetfps" => {
            Some(("performance", "Frame-rate limit", "frame_cap"))
        }
        "renderscale" | "resolutionscale" | "screenpercentage" | "resolutionquality" => {
            Some(("graphics", "Render scale", "render_scale"))
        }
        "hdr" | "hdrenabled" | "enablehdr" | "usehdr" | "busehdrdisplayoutput" => {
            Some(("display", "HDR", "toggle"))
        }
        "adapter" | "adapterindex" | "gpuindex" | "graphicsadapter" | "displayadapter" => {
            Some(("hardware", "Graphics adapter", "adapter"))
        }
        _ => None,
    }
}

fn validate_setting(
    kind: &str,
    value: &str,
    file_name: &str,
    line: Option<usize>,
    issues: &mut Vec<ConfigurationIssue>,
) {
    let numeric = value
        .trim()
        .trim_matches('"')
        .trim_end_matches('%')
        .parse::<f64>();
    let (minimum, maximum, label) = match kind {
        "width" | "height" => (0.0, 16384.0, "resolution dimension"),
        "refresh" => (0.0, 1000.0, "refresh rate"),
        "render_scale" => (0.0, 500.0, "render scale"),
        "frame_cap" => (-0.001, 2000.0, "frame-rate limit"),
        "adapter" => (-0.001, 128.0, "graphics-adapter index"),
        _ => return,
    };
    if let Ok(number) = numeric {
        if number <= minimum || number > maximum {
            issues.push(issue(
                "warning",
                "Suspicious graphics value",
                format!("The configured {label} ({value}) is outside a plausible range."),
                Some(file_name),
                line,
                Some("Review this value in the game's settings menu or reset this configuration file using the game's supported reset method."),
            ));
        }
    }
}

fn record_setting(
    key: &str,
    value: &str,
    source: &str,
    line: Option<usize>,
    settings: &mut Vec<ConfigurationSetting>,
    issues: &mut Vec<ConfigurationIssue>,
) {
    if settings.len() >= MAX_SETTINGS {
        return;
    }
    let Some((category, name, kind)) = setting_definition(key) else {
        return;
    };
    let Some(display_value) = safe_value(value) else {
        return;
    };
    validate_setting(kind, &display_value, source, line, issues);
    settings.push(ConfigurationSetting {
        category: category.to_string(),
        name: name.to_string(),
        value: display_value,
        source: source.to_string(),
    });
}

fn validate_ini(
    text: &str,
    file_name: &str,
    strict: bool,
    settings: &mut Vec<ConfigurationSetting>,
    issues: &mut Vec<ConfigurationIssue>,
) {
    let mut section = String::new();
    let mut keys = HashMap::<String, usize>::new();
    for (index, raw_line) in text.lines().enumerate() {
        let line_number = index + 1;
        let line = raw_line.trim();
        if line.is_empty()
            || line.starts_with(';')
            || line.starts_with('#')
            || line.starts_with("//")
        {
            continue;
        }
        if line.starts_with('[') {
            if strict && !line.ends_with(']') {
                issues.push(issue(
                    "warning",
                    "Malformed section header",
                    "An INI section begins with '[' but does not end with ']'.",
                    Some(file_name),
                    Some(line_number),
                    Some("Correct the section header or let the game recreate the configuration file."),
                ));
            } else if line.ends_with(']') {
                section = line[1..line.len() - 1].trim().to_string();
            }
            continue;
        }
        let Some(separator) = line.find('=').or_else(|| line.find(':')) else {
            continue;
        };
        let key = line[..separator].trim();
        let value = line[separator + 1..].trim();
        if key.is_empty() {
            if strict {
                issues.push(issue(
                    "warning",
                    "Setting has no name",
                    "An INI value has a separator but no setting name.",
                    Some(file_name),
                    Some(line_number),
                    Some("Remove the incomplete line or restore the setting name."),
                ));
            }
            continue;
        }
        if strict
            && !key.starts_with('+')
            && !key.starts_with('-')
            && !key.starts_with('.')
            && !key.starts_with('!')
        {
            let identity = format!(
                "{}::{}",
                section.to_ascii_lowercase(),
                key.to_ascii_lowercase()
            );
            if let Some(first_line) = keys.insert(identity, line_number) {
                issues.push(issue(
                    "warning",
                    "Duplicate INI setting",
                    format!("'{key}' is defined more than once in this section (first seen on line {first_line})."),
                    Some(file_name),
                    Some(line_number),
                    Some("Keep the intended value and remove the duplicate if the game does not require repeated keys."),
                ));
            }
        }
        record_setting(key, value, file_name, Some(line_number), settings, issues);
    }
}

fn validate_loose_settings(
    text: &str,
    file_name: &str,
    settings: &mut Vec<ConfigurationSetting>,
    issues: &mut Vec<ConfigurationIssue>,
) {
    for (index, raw_line) in text.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with(['{', '}', '#', ';']) || line.starts_with("//") {
            continue;
        }
        let values = line.split_whitespace().collect::<Vec<_>>();
        if values.len() < 2 {
            continue;
        }
        let line_number = Some(index + 1);
        if normalized_key(values[0]) == "resolution" && values.len() >= 3 {
            record_setting(
                "resolutionx",
                values[1],
                file_name,
                line_number,
                settings,
                issues,
            );
            record_setting(
                "resolutiony",
                values[2],
                file_name,
                line_number,
                settings,
                issues,
            );
        } else {
            record_setting(
                values[0],
                &values[1..].join(" "),
                file_name,
                line_number,
                settings,
                issues,
            );
        }
    }
}

fn validate_json(
    text: &str,
    file_name: &str,
    settings: &mut Vec<ConfigurationSetting>,
    issues: &mut Vec<ConfigurationIssue>,
) {
    fn visit(
        value: &Value,
        source: &str,
        settings: &mut Vec<ConfigurationSetting>,
        issues: &mut Vec<ConfigurationIssue>,
    ) {
        match value {
            Value::Object(map) => {
                for (key, child) in map {
                    if let Some(value) = match child {
                        Value::String(value) => Some(value.clone()),
                        Value::Number(value) => Some(value.to_string()),
                        Value::Bool(value) => Some(value.to_string()),
                        _ => None,
                    } {
                        record_setting(key, &value, source, None, settings, issues);
                    }
                    visit(child, source, settings, issues);
                }
            }
            Value::Array(items) => {
                for item in items {
                    visit(item, source, settings, issues);
                }
            }
            _ => {}
        }
    }

    match serde_json::from_str::<Value>(text) {
        Ok(value) => visit(&value, file_name, settings, issues),
        Err(error) => issues.push(issue(
            "warning",
            "Invalid JSON configuration",
            format!(
                "JSON parsing stopped at line {}, column {}: {}",
                error.line(),
                error.column(),
                error
            ),
            Some(file_name),
            Some(error.line()),
            Some("Use the game's settings menu or restore a known-good copy of this file."),
        )),
    }
}

fn validate_xml(text: &str, file_name: &str, issues: &mut Vec<ConfigurationIssue>) {
    let mut reader = Reader::from_str(text);
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();
    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => {
                issues.push(issue(
                    "warning",
                    "Invalid XML configuration",
                    format!(
                        "XML parsing failed near byte {}: {error}",
                        reader.buffer_position()
                    ),
                    Some(file_name),
                    None,
                    Some("Use the game's settings menu or restore a known-good copy of this file."),
                ));
                break;
            }
        }
        buffer.clear();
    }
}

fn inspect_report(
    install_path: String,
    config_path: Option<String>,
    resolved_config_path: Option<String>,
    proton_prefix: Option<String>,
) -> Result<ConfigurationValidationReport, String> {
    let mut issues = Vec::new();
    let configuration_root = resolve_configuration_root(
        &install_path,
        config_path.as_deref(),
        resolved_config_path.as_deref(),
        proton_prefix.as_deref(),
    )?;
    let root = configuration_root.path;
    let used_install_fallback = configuration_root.used_install_fallback;
    if used_install_fallback {
        if config_path
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        {
            issues.push(issue(
                "info",
                "Reported configuration location not found",
                "The PCGamingWiki-reported location did not resolve to a safe existing folder for this operating-system account or compatibility prefix.",
                None,
                None,
                Some("Launch the game once and save its settings, then run the validator again."),
            ));
        }
    }

    let (paths, scan_truncated) = collect_files(&root, used_install_fallback);
    let mut files = Vec::new();
    let mut settings = Vec::new();
    let mut files_skipped = 0usize;
    let mut total_bytes = 0u64;
    let mut seen = HashSet::new();

    for path in paths {
        let identity = path.to_string_lossy().to_ascii_lowercase();
        if !seen.insert(identity) {
            continue;
        }
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Configuration file")
            .to_string();
        let relative_path = path
            .strip_prefix(&root)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();
        let Ok(metadata) = fs::metadata(&path) else {
            files_skipped += 1;
            issues.push(issue(
                "warning",
                "Configuration file could not be read",
                "The operating system denied access or the file disappeared during validation.",
                Some(&file_name),
                None,
                Some("Close the game and try again. Check the file's permissions if the problem continues."),
            ));
            continue;
        };
        let size = metadata.len();
        let read_only = metadata.permissions().readonly();
        let issue_start = issues.len();

        if size == 0 {
            issues.push(issue(
                "warning",
                "Empty configuration file",
                "This file contains no configuration data.",
                Some(&file_name),
                None,
                Some("Launch the game and save its settings, or restore a known-good copy."),
            ));
        } else if size > MAX_FILE_BYTES || total_bytes.saturating_add(size) > MAX_TOTAL_BYTES {
            files_skipped += 1;
            issues.push(issue(
                "info",
                "Large configuration file skipped",
                "The file exceeded the validator's safe read limit and was not parsed.",
                Some(&file_name),
                None,
                None,
            ));
        } else {
            total_bytes += size;
            match fs::read(&path) {
                Ok(bytes) => match decode_text(&bytes) {
                    Ok(text) => match path
                        .extension()
                        .and_then(|value| value.to_str())
                        .unwrap_or_default()
                        .to_ascii_lowercase()
                        .as_str()
                    {
                        "json" => validate_json(&text, &file_name, &mut settings, &mut issues),
                        "xml" => validate_xml(&text, &file_name, &mut issues),
                        "ini" => validate_ini(&text, &file_name, true, &mut settings, &mut issues),
                        "cfg" | "conf" | "toml" | "yaml" | "yml" | "txt" => {
                            validate_ini(&text, &file_name, false, &mut settings, &mut issues)
                        }
                        _ if is_extensionless_config(&path) => {
                            validate_loose_settings(&text, &file_name, &mut settings, &mut issues)
                        }
                        _ => {}
                    },
                    Err(error) => {
                        files_skipped += 1;
                        issues.push(issue(
                            "info",
                            "Unsupported text encoding",
                            format!("The validator could not safely decode this file: {error}."),
                            Some(&file_name),
                            None,
                            None,
                        ));
                    }
                },
                Err(error) => {
                    files_skipped += 1;
                    issues.push(issue(
                        "warning",
                        "Configuration file could not be read",
                        format!("The operating system could not read this file: {error}"),
                        Some(&file_name),
                        None,
                        Some("Close the game and try again. Check the file's permissions if the problem continues."),
                    ));
                }
            }
        }
        if read_only {
            issues.push(issue(
                "warning",
                "Read-only configuration file",
                "The game may be unable to save settings to this file.",
                Some(&file_name),
                None,
                Some("Remove the read-only attribute only if you expect the game to update this file."),
            ));
        }
        let issue_count = issues.len() - issue_start;
        files.push(ConfigurationFileInfo {
            file_name,
            relative_path,
            format: format_name(&path),
            size_bytes: size,
            read_only,
            status: if issue_count == 0 {
                "valid"
            } else {
                "attention"
            }
            .to_string(),
            issue_count,
        });
    }

    settings.sort_by(|left, right| {
        left.category
            .cmp(&right.category)
            .then_with(|| left.name.cmp(&right.name))
            .then_with(|| left.source.cmp(&right.source))
    });
    settings.dedup_by(|left, right| {
        left.category == right.category
            && left.name == right.name
            && left.value == right.value
            && left.source == right.source
    });

    if files.is_empty() {
        issues.push(issue(
            "info",
            "No recognizable configuration files found",
            if used_install_fallback {
                "No likely settings files were found near the game installation, and no local PCGamingWiki configuration folder was available."
            } else {
                "The reported configuration folder exists, but it contains no supported settings files."
            },
            None,
            None,
            Some("Launch the game once, change a setting, close it normally, and run the validator again."),
        ));
    }

    let warnings = issues
        .iter()
        .filter(|item| item.severity == "warning")
        .count();
    let summary = if files.is_empty() {
        "No configuration files were available to validate.".to_string()
    } else if warnings == 0 {
        format!(
            "Validated {} configuration file{} with no definite problems found.",
            files.len(),
            if files.len() == 1 { "" } else { "s" }
        )
    } else {
        format!(
            "Validated {} configuration file{} and found {} item{} needing attention.",
            files.len(),
            if files.len() == 1 { "" } else { "s" },
            warnings,
            if warnings == 1 { "" } else { "s" }
        )
    };

    Ok(ConfigurationValidationReport {
        supported: true,
        config_path: (!used_install_fallback).then(|| root.to_string_lossy().to_string()),
        used_install_fallback,
        files_inspected: files.len(),
        files_skipped,
        files,
        issues,
        settings,
        scan_truncated,
        summary,
    })
}

#[tauri::command]
pub async fn get_game_configuration_validation_report(
    install_path: String,
    config_path: Option<String>,
    resolved_config_path: Option<String>,
    proton_prefix: Option<String>,
) -> Result<ConfigurationValidationReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        inspect_report(
            install_path,
            config_path,
            resolved_config_path,
            proton_prefix,
        )
    })
    .await
    .map_err(|error| format!("Configuration Validator worker failed: {error}"))?
}

#[tauri::command]
pub fn get_game_configuration_backup_status(
    app: tauri::AppHandle,
    game_name: String,
    game_id: Option<String>,
    executable_path: Option<String>,
) -> Result<ConfigurationBackupStatus, String> {
    let directory = configuration_backup_directory(&app, &game_name, game_id.as_deref())?;
    let name = executable_name(executable_path.as_deref());
    Ok(ConfigurationBackupStatus {
        supported: cfg!(any(target_os = "windows", target_os = "linux")),
        backup_directory: directory.to_string_lossy().to_string(),
        backups: list_configuration_backups(&directory)?,
        game_running: name.as_deref().map(process_is_running).unwrap_or(false),
        executable_name: name,
    })
}

#[tauri::command]
pub async fn create_game_configuration_backup(
    app: tauri::AppHandle,
    game_name: String,
    game_id: Option<String>,
    install_path: String,
    config_path: Option<String>,
    resolved_config_path: Option<String>,
    executable_path: Option<String>,
    proton_prefix: Option<String>,
) -> Result<ConfigurationRecoveryResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        require_game_closed(executable_path.as_deref())?;
        let root = resolve_configuration_root(
            &install_path,
            config_path.as_deref(),
            resolved_config_path.as_deref(),
            proton_prefix.as_deref(),
        )?;
        let backup = create_configuration_backup_blocking(
            &app,
            &game_name,
            game_id.as_deref(),
            &root,
            "Manual backup",
        )?;
        Ok(ConfigurationRecoveryResult {
            message: format!(
                "Backed up {} configuration file{} and verified each copy.",
                backup.file_count,
                if backup.file_count == 1 { "" } else { "s" }
            ),
            files_changed: 0,
            safety_backup: Some(backup),
        })
    })
    .await
    .map_err(|error| format!("Configuration backup worker failed: {error}"))?
}

#[tauri::command]
pub async fn safely_reset_game_configuration(
    app: tauri::AppHandle,
    game_name: String,
    game_id: Option<String>,
    install_path: String,
    config_path: Option<String>,
    resolved_config_path: Option<String>,
    executable_path: Option<String>,
    proton_prefix: Option<String>,
) -> Result<ConfigurationRecoveryResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        require_game_closed(executable_path.as_deref())?;
        let root = resolve_configuration_root(
            &install_path,
            config_path.as_deref(),
            resolved_config_path.as_deref(),
            proton_prefix.as_deref(),
        )?;
        if root.used_install_fallback {
            return Err(
                "Safe Reset requires a resolved configuration folder. GameAtlas will not rename files based only on install-folder guesses."
                    .to_string(),
            );
        }
        let safety_backup = create_configuration_backup_blocking(
            &app,
            &game_name,
            game_id.as_deref(),
            &root,
            "Before safe reset",
        )?;
        let (files, truncated) = collect_files(&root.path, root.used_install_fallback);
        if truncated {
            return Err("The configuration search reached its safety limit. Nothing was reset.".to_string());
        }

        let mut renamed = Vec::<(PathBuf, PathBuf)>::new();
        for source in files {
            let file_name = source
                .file_name()
                .and_then(|value| value.to_str())
                .ok_or_else(|| "A configuration file had an unsupported name.".to_string())?;
            let mut destination = source.with_file_name(format!(
                "{file_name}.gameatlas-reset-{}",
                safety_backup.id
            ));
            let mut counter = 1usize;
            while destination.exists() {
                destination = source.with_file_name(format!(
                    "{file_name}.gameatlas-reset-{}-{counter}",
                    safety_backup.id
                ));
                counter += 1;
            }
            if let Err(error) = fs::rename(&source, &destination) {
                for (original, moved) in renamed.iter().rev() {
                    let _ = fs::rename(moved, original);
                }
                return Err(format!(
                    "Could not safely reset {}: {error}. Earlier changes were rolled back.",
                    source.display()
                ));
            }
            renamed.push((source, destination));
        }

        Ok(ConfigurationRecoveryResult {
            message: format!(
                "Safely reset {} configuration file{}. Launch the game to let it create fresh defaults.",
                renamed.len(),
                if renamed.len() == 1 { "" } else { "s" }
            ),
            files_changed: renamed.len(),
            safety_backup: Some(safety_backup),
        })
    })
    .await
    .map_err(|error| format!("Configuration reset worker failed: {error}"))?
}

#[tauri::command]
pub async fn restore_game_configuration_backup(
    app: tauri::AppHandle,
    game_name: String,
    game_id: Option<String>,
    backup_id: String,
    install_path: String,
    config_path: Option<String>,
    resolved_config_path: Option<String>,
    executable_path: Option<String>,
    proton_prefix: Option<String>,
) -> Result<ConfigurationRecoveryResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        require_game_closed(executable_path.as_deref())?;
        let requested_id = validate_backup_id(&backup_id)?;
        let backup_root = configuration_backup_directory(&app, &game_name, game_id.as_deref())?;
        let directory = backup_root.join(requested_id);
        let manifest = read_manifest(&directory)?;
        let root = resolve_configuration_root(
            &install_path,
            config_path.as_deref(),
            resolved_config_path.as_deref(),
            proton_prefix.as_deref(),
        )?;
        if root.used_install_fallback {
            return Err(
                "Restore requires a resolved configuration folder. GameAtlas will not write backup files into an install-folder guess."
                    .to_string(),
            );
        }

        let mut restore_files = Vec::<(PathBuf, PathBuf)>::new();
        for entry in &manifest.files {
            let relative = PathBuf::from(&entry.relative_path);
            if relative.as_os_str().is_empty()
                || !relative
                    .components()
                    .all(|component| matches!(component, std::path::Component::Normal(_)))
            {
                return Err("The backup manifest contains an unsafe file path.".to_string());
            }
            let source = directory.join("files").join(&relative);
            if !source.is_file() || file_hash(&source)? != entry.sha256 {
                return Err(format!(
                    "Backup verification failed for {}. Nothing was restored.",
                    entry.relative_path
                ));
            }
            restore_files.push((source, root.path.join(relative)));
        }
        if restore_files.is_empty() {
            return Err("The selected backup contains no configuration files.".to_string());
        }

        let (current_files, current_truncated) =
            collect_files(&root.path, root.used_install_fallback);
        if current_truncated {
            return Err(
                "The current configuration search reached its safety limit. Nothing was restored."
                    .to_string(),
            );
        }
        let safety_backup = if current_files.is_empty() {
            None
        } else {
            Some(create_configuration_backup_blocking(
                &app,
                &game_name,
                game_id.as_deref(),
                &root,
                "Before restore",
            )?)
        };

        let mut completed = Vec::<(PathBuf, Option<PathBuf>)>::new();
        for (source, target) in &restore_files {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Could not create a configuration folder: {error}"))?;
            }
            let target_name = target
                .file_name()
                .and_then(|value| value.to_str())
                .ok_or_else(|| "A restore target had an unsupported name.".to_string())?;
            let staged = target.with_file_name(format!(
                ".{target_name}.gameatlas-restore-new-{requested_id}"
            ));
            if staged.exists() {
                fs::remove_file(&staged).map_err(|error| {
                    format!("Could not clear an interrupted restore file: {error}")
                })?;
            }
            fs::copy(source, &staged).map_err(|error| {
                format!("Could not stage {} for restore: {error}", target.display())
            })?;
            if file_hash(&staged)? != file_hash(source)? {
                let _ = fs::remove_file(&staged);
                return Err(format!(
                    "Restore verification failed for {}.",
                    target.display()
                ));
            }

            let previous = if target.exists() {
                let previous = target.with_file_name(format!(
                    ".{target_name}.gameatlas-restore-old-{requested_id}"
                ));
                if previous.exists() {
                    fs::remove_file(&previous).map_err(|error| {
                        format!("Could not clear an interrupted restore backup: {error}")
                    })?;
                }
                fs::rename(target, &previous).map_err(|error| {
                    format!(
                        "Could not preserve the current {}: {error}",
                        target.display()
                    )
                })?;
                Some(previous)
            } else {
                None
            };

            if let Err(error) = fs::rename(&staged, target) {
                if let Some(previous) = &previous {
                    let _ = fs::rename(previous, target);
                }
                for (completed_target, completed_previous) in completed.iter().rev() {
                    let _ = fs::remove_file(completed_target);
                    if let Some(previous) = completed_previous {
                        let _ = fs::rename(previous, completed_target);
                    }
                }
                return Err(format!(
                    "Could not restore {}: {error}. Earlier file changes were rolled back.",
                    target.display()
                ));
            }
            completed.push((target.clone(), previous));
        }

        for (_, previous) in &completed {
            if let Some(previous) = previous {
                let _ = fs::remove_file(previous);
            }
        }

        Ok(ConfigurationRecoveryResult {
            message: format!(
                "Restored {} configuration file{} from the selected backup.",
                completed.len(),
                if completed.len() == 1 { "" } else { "s" }
            ),
            files_changed: completed.len(),
            safety_backup,
        })
    })
    .await
    .map_err(|error| format!("Configuration restore worker failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_duplicate_ini_keys_and_suspicious_values() {
        let mut settings = Vec::new();
        let mut issues = Vec::new();
        validate_ini(
            "[Display]\nResolutionX=1920\nResolutionX=99999\nRefreshRate=144\n",
            "settings.ini",
            true,
            &mut settings,
            &mut issues,
        );
        assert!(issues
            .iter()
            .any(|item| item.title == "Duplicate INI setting"));
        assert!(issues
            .iter()
            .any(|item| item.title == "Suspicious graphics value"));
        assert_eq!(settings.len(), 3);
    }

    #[test]
    fn reports_invalid_json() {
        let mut settings = Vec::new();
        let mut issues = Vec::new();
        validate_json(
            "{\"vsync\": true,}",
            "settings.json",
            &mut settings,
            &mut issues,
        );
        assert!(issues
            .iter()
            .any(|item| item.title == "Invalid JSON configuration"));
    }

    #[test]
    fn allows_unreal_array_operations() {
        let mut settings = Vec::new();
        let mut issues = Vec::new();
        validate_ini(
            "[/Script/Engine.Engine]\n+Paths=../../../Engine/Content\n+Paths=../../../Game/Content\n",
            "engine.ini",
            true,
            &mut settings,
            &mut issues,
        );
        assert!(!issues
            .iter()
            .any(|item| item.title == "Duplicate INI setting"));
    }

    #[test]
    fn parses_extensionless_engine_settings() {
        let mut settings = Vec::new();
        let mut issues = Vec::new();
        validate_loose_settings(
            "{Video\n  Windowed 1\n  Resolution 3840 2160\n  VSync 0\n}\n",
            "ENGINESETTINGS",
            &mut settings,
            &mut issues,
        );
        assert_eq!(settings.len(), 4);
        assert!(settings
            .iter()
            .any(|setting| setting.name == "Resolution width" && setting.value == "3840"));
        assert!(issues.is_empty());
    }
}
