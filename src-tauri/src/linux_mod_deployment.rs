use serde::{Deserialize, Serialize};

#[cfg(target_os = "linux")]
use sha2::{Digest, Sha256};

#[cfg(target_os = "linux")]
use std::{
    collections::{BTreeMap, BTreeSet, HashSet},
    fs,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "linux")]
use tauri::Manager;

#[cfg(target_os = "linux")]
const MAX_FILES: usize = 50_000;
#[cfg(target_os = "linux")]
const MAX_DEPTH: usize = 32;
#[cfg(target_os = "linux")]
const MAX_TOTAL_BYTES: u64 = 32 * 1024 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModDeploymentPreview {
    pub supported: bool,
    pub source_path: String,
    pub suggested_name: String,
    pub deployment_mode: String,
    pub destination_root: String,
    pub skipped_file_count: usize,
    pub file_count: usize,
    pub total_size_bytes: u64,
    pub existing_file_count: usize,
    pub managed_conflict_count: usize,
    pub conflict_samples: Vec<String>,
    pub file_samples: Vec<String>,
    pub warning: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedModDeployment {
    pub id: String,
    pub name: String,
    pub source_path: String,
    pub deployed_unix: u64,
    pub file_count: usize,
    pub total_size_bytes: u64,
    pub overwritten_file_count: usize,
    pub can_remove: bool,
    pub enabled: bool,
    pub can_toggle: bool,
    pub priority: usize,
    pub conflict_count: usize,
    pub winning_conflict_count: usize,
    pub losing_conflict_count: usize,
    pub can_move_higher: bool,
    pub can_move_lower: bool,
    pub version: String,
    pub author: String,
    pub website: String,
    pub notes: String,
    pub updated_unix: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedModConflict {
    pub relative_path: String,
    pub winner_id: String,
    pub winner_name: String,
    pub overridden_ids: Vec<String>,
    pub overridden_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModProfileSummary {
    pub id: String,
    pub name: String,
    pub enabled_mod_count: usize,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedModItem {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModDeploymentStatus {
    pub supported: bool,
    pub rar_supported: bool,
    pub rar_provider: String,
    pub install_path: String,
    pub storage_path: String,
    pub staging_path: String,
    pub staged_items: Vec<StagedModItem>,
    pub deployments: Vec<ManagedModDeployment>,
    pub conflicts: Vec<ManagedModConflict>,
    pub total_conflict_count: usize,
    pub purged: bool,
    pub profiles: Vec<ModProfileSummary>,
    pub active_profile_id: String,
    pub summary: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployModRequest {
    pub install_path: String,
    pub source_path: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveDeploymentRequest {
    pub install_path: String,
    pub deployment_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetDeploymentEnabledRequest {
    pub install_path: String,
    pub deployment_id: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveDeploymentPriorityRequest {
    pub install_path: String,
    pub deployment_id: String,
    pub direction: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateModMetadataRequest {
    pub install_path: String,
    pub deployment_id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub website: String,
    pub notes: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpgradeModRequest {
    pub install_path: String,
    pub deployment_id: String,
    pub source_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModProfileRequest {
    pub install_path: String,
    pub profile_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NamedModProfileRequest {
    pub install_path: String,
    pub profile_id: Option<String>,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModDeploymentActionResult {
    pub success: bool,
    pub deployment_id: Option<String>,
    pub files_changed: usize,
    pub bytes_changed: u64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModLibraryFinding {
    pub kind: String,
    pub relative_path: String,
    pub mod_name: String,
    pub detail: String,
    pub repairable: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModLibraryVerificationReport {
    pub healthy: bool,
    pub purged: bool,
    pub mods_checked: usize,
    pub payload_files_checked: usize,
    pub deployed_files_checked: usize,
    pub repairable_count: usize,
    pub findings: Vec<ModLibraryFinding>,
    pub summary: String,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone)]
struct SourceFile {
    source: PathBuf,
    relative: PathBuf,
    relative_text: String,
    size_bytes: u64,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone)]
struct DeploymentPlan {
    files: Vec<SourceFile>,
    mode: String,
    destination_root: String,
    skipped_file_count: usize,
    warning: String,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Deserialize)]
struct LsarListing {
    #[serde(rename = "lsarContents")]
    contents: Vec<LsarEntry>,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Deserialize)]
struct LsarEntry {
    #[serde(rename = "XADFileName")]
    file_name: String,
    #[serde(flatten)]
    properties: BTreeMap<String, serde_json::Value>,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone)]
struct RarTools {
    bridge: Option<PathBuf>,
    lsar: PathBuf,
    unar: PathBuf,
    provider: String,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ManifestFile {
    relative_path: String,
    size_bytes: u64,
    deployed_sha256: String,
    had_original: bool,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeploymentManifest {
    schema_version: u32,
    id: String,
    name: String,
    install_path: String,
    source_path: String,
    deployed_unix: u64,
    #[serde(default)]
    priority_order: u64,
    #[serde(default = "default_manifest_enabled")]
    enabled: bool,
    #[serde(default)]
    version: String,
    #[serde(default)]
    author: String,
    #[serde(default)]
    website: String,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    updated_unix: u64,
    files: Vec<ManifestFile>,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ModLibraryState {
    schema_version: u32,
    purged: bool,
    #[serde(default)]
    active_profile_id: String,
    #[serde(default)]
    profiles: Vec<StoredModProfile>,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredModProfile {
    id: String,
    name: String,
    enabled_mod_ids: Vec<String>,
}

#[cfg(target_os = "linux")]
fn default_manifest_enabled() -> bool {
    true
}

#[cfg(target_os = "linux")]
fn canonical_directory(raw: &str, label: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw.trim().trim_matches('"'));
    if !path.is_dir() {
        return Err(format!(
            "The {label} directory does not exist: {}",
            path.display()
        ));
    }
    fs::canonicalize(&path)
        .map_err(|error| format!("Could not resolve the {label} directory: {error}"))
}

#[cfg(target_os = "linux")]
fn validate_install_root(root: &Path) -> Result<(), String> {
    if root.parent().is_none() {
        return Err(
            "The filesystem root cannot be used as a game installation folder.".to_string(),
        );
    }
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        if fs::canonicalize(home).ok().as_deref() == Some(root) {
            return Err(
                "The home directory cannot be used as a game installation folder.".to_string(),
            );
        }
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn validate_source_relationship(source: &Path, install: &Path) -> Result<(), String> {
    if source == install || source.starts_with(install) || install.starts_with(source) {
        return Err(
            "The mod source and game installation must be separate, non-nested folders."
                .to_string(),
        );
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn safe_relative_text(path: &Path) -> Result<String, String> {
    if path.as_os_str().is_empty()
        || !path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
    {
        return Err("The mod contains an unsafe relative path.".to_string());
    }
    path.to_str()
        .map(|value| value.replace('\\', "/"))
        .ok_or_else(|| "The mod contains a file name that is not valid UTF-8.".to_string())
}

#[cfg(target_os = "linux")]
fn scan_source(source: &Path) -> Result<Vec<SourceFile>, String> {
    let mut files = Vec::new();
    let mut total = 0_u64;
    let mut stack = vec![(source.to_path_buf(), 0_usize)];
    let mut case_insensitive_paths = HashSet::new();

    while let Some((directory, depth)) = stack.pop() {
        if depth > MAX_DEPTH {
            return Err(format!(
                "The mod folder exceeds the {MAX_DEPTH}-level depth limit."
            ));
        }
        let entries = fs::read_dir(&directory)
            .map_err(|error| format!("Could not read {}: {error}", directory.display()))?;

        for entry in entries {
            let entry = entry.map_err(|error| format!("Could not read a mod entry: {error}"))?;
            let file_type = entry.file_type().map_err(|error| {
                format!("Could not inspect {}: {error}", entry.path().display())
            })?;
            let path = entry.path();

            if file_type.is_symlink() {
                return Err(format!(
                    "Symbolic links are not accepted in mod payloads: {}",
                    path.display()
                ));
            }
            if file_type.is_dir() {
                stack.push((path, depth + 1));
                continue;
            }
            if !file_type.is_file() {
                return Err(format!(
                    "The mod contains an unsupported filesystem entry: {}",
                    path.display()
                ));
            }

            let relative = path
                .strip_prefix(source)
                .map_err(|_| "A mod file escaped the selected source folder.".to_string())?
                .to_path_buf();
            let relative_text = safe_relative_text(&relative)?;
            if !case_insensitive_paths.insert(relative_text.to_ascii_lowercase()) {
                return Err(format!(
                    "The mod contains paths that differ only by letter case: {relative_text}"
                ));
            }
            let size_bytes = entry
                .metadata()
                .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?
                .len();
            total = total.saturating_add(size_bytes);
            if total > MAX_TOTAL_BYTES {
                return Err("The mod payload exceeds the 32 GiB safety limit.".to_string());
            }
            files.push(SourceFile {
                source: path,
                relative,
                relative_text,
                size_bytes,
            });
            if files.len() > MAX_FILES {
                return Err(format!(
                    "The mod payload exceeds the {MAX_FILES}-file safety limit."
                ));
            }
        }
    }

    files.sort_by(|left, right| left.relative_text.cmp(&right.relative_text));
    if files.is_empty() {
        return Err("The selected mod folder does not contain any files.".to_string());
    }
    Ok(files)
}

#[cfg(target_os = "linux")]
fn extension_is(path: &Path, wanted: &str) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(wanted))
}

#[cfg(target_os = "linux")]
fn is_unreal_package_file(path: &Path) -> bool {
    ["pak", "ucas", "utoc", "sig"]
        .iter()
        .any(|extension| extension_is(path, extension))
}

#[cfg(target_os = "linux")]
fn is_mod_documentation(path: &Path) -> bool {
    if ["txt", "md", "pdf", "jpg", "jpeg", "png", "gif", "webp"]
        .iter()
        .any(|extension| extension_is(path, extension))
    {
        return true;
    }
    path.file_stem()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .is_some_and(|value| {
            value.starts_with("readme")
                || value.starts_with("license")
                || value.starts_with("changelog")
        })
}

#[cfg(target_os = "linux")]
fn find_unreal_paks_directory(install: &Path) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    let mut stack = vec![(install.to_path_buf(), 0_usize)];
    let mut directories_seen = 0_usize;
    while let Some((directory, depth)) = stack.pop() {
        if depth > 7 {
            continue;
        }
        for entry in fs::read_dir(&directory)
            .map_err(|error| format!("Could not inspect {}: {error}", directory.display()))?
        {
            let entry =
                entry.map_err(|error| format!("Could not inspect a game folder: {error}"))?;
            let file_type = entry.file_type().map_err(|error| {
                format!("Could not inspect {}: {error}", entry.path().display())
            })?;
            if file_type.is_symlink() || !file_type.is_dir() {
                continue;
            }
            directories_seen += 1;
            if directories_seen > 20_000 {
                return Err(
                    "The game installation contains too many folders to locate Unreal Content/Paks safely."
                        .to_string(),
                );
            }
            let path = entry.path();
            let is_paks = path
                .file_name()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("Paks"));
            let parent_is_content = path
                .parent()
                .and_then(Path::file_name)
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("Content"));
            if is_paks && parent_is_content {
                let relative = path
                    .strip_prefix(install)
                    .map_err(|_| "An Unreal Paks directory escaped the game folder.".to_string())?;
                let lower = safe_relative_text(relative)?.to_ascii_lowercase();
                if !lower.contains("engine/programs/crashreportclient/content/paks") {
                    candidates.push(path);
                }
                continue;
            }
            stack.push((path, depth + 1));
        }
    }

    candidates.sort();
    candidates.dedup();
    match candidates.as_slice() {
        [candidate] => Ok(candidate.clone()),
        [] => Err(
            "This payload contains Unreal PAK files, but GameAtlas could not find the game's Content/Paks folder. Deployment was stopped instead of copying them to the game root."
                .to_string(),
        ),
        _ => {
            let examples = candidates
                .iter()
                .take(3)
                .filter_map(|path| path.strip_prefix(install).ok())
                .filter_map(|path| safe_relative_text(path).ok())
                .collect::<Vec<_>>()
                .join(", ");
            Err(format!(
                "Multiple Unreal Content/Paks folders were found ({examples}). GameAtlas cannot safely choose a deployment target."
            ))
        }
    }
}

#[cfg(target_os = "linux")]
fn deployment_plan(install: &Path, files: Vec<SourceFile>) -> Result<DeploymentPlan, String> {
    let has_pak = files.iter().any(|file| extension_is(&file.relative, "pak"));
    if !has_pak {
        return Ok(DeploymentPlan {
            files,
            mode: "Game root".to_string(),
            destination_root: "Game installation root".to_string(),
            skipped_file_count: 0,
            warning: "The selected folder's contents will be copied directly into the game installation. Fully exit the game before deploying."
                .to_string(),
        });
    }

    if let Some(file) = files.iter().find(|file| {
        !is_unreal_package_file(&file.relative) && !is_mod_documentation(&file.relative)
    }) {
        return Err(format!(
            "This archive mixes Unreal PAK files with an unsupported payload file ({}). GameAtlas stopped because it cannot safely infer one installation layout.",
            file.relative_text
        ));
    }

    let paks = find_unreal_paks_directory(install)?;
    let destination = paks.join("~mods");
    let destination_relative = destination
        .strip_prefix(install)
        .map_err(|_| "The Unreal mod destination escaped the game folder.".to_string())?;
    let destination_root = safe_relative_text(destination_relative)?;
    let skipped_file_count = files
        .iter()
        .filter(|file| is_mod_documentation(&file.relative))
        .count();
    let mut planned = Vec::new();
    let mut seen = HashSet::new();
    for mut file in files
        .into_iter()
        .filter(|file| is_unreal_package_file(&file.relative))
    {
        let file_name = file
            .relative
            .file_name()
            .ok_or_else(|| "An Unreal package file has no file name.".to_string())?;
        let relative = destination_relative.join(file_name);
        let relative_text = safe_relative_text(&relative)?;
        if !seen.insert(relative_text.to_ascii_lowercase()) {
            return Err(format!(
                "Multiple Unreal package files would use the same destination: {relative_text}"
            ));
        }
        file.relative = relative;
        file.relative_text = relative_text;
        planned.push(file);
    }
    planned.sort_by(|left, right| left.relative_text.cmp(&right.relative_text));

    Ok(DeploymentPlan {
        files: planned,
        mode: "Unreal PAK mod".to_string(),
        destination_root,
        skipped_file_count,
        warning: if skipped_file_count == 0 {
            "GameAtlas detected an Unreal PAK payload and will deploy it to the game's Content/Paks/~mods folder. Fully exit the game before deploying."
                .to_string()
        } else {
            format!(
                "GameAtlas detected an Unreal PAK payload and will deploy it to the game's Content/Paks/~mods folder. {skipped_file_count} documentation file{} will remain in staging. Fully exit the game before deploying.",
                if skipped_file_count == 1 { "" } else { "s" }
            )
        },
    })
}

#[cfg(target_os = "linux")]
fn game_storage_root(app: &tauri::AppHandle, install: &Path) -> Result<PathBuf, String> {
    let mut hasher = Sha256::new();
    hasher.update(install.as_os_str().as_encoded_bytes());
    let key = hex::encode(hasher.finalize());
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve GameAtlas data storage: {error}"))?
        .join("mod-deployments")
        .join(&key[..20]))
}

#[cfg(target_os = "linux")]
fn safe_folder_name(value: &str) -> String {
    let cleaned = value
        .trim()
        .chars()
        .map(|character| {
            if character.is_control() || matches!(character, '/' | '\\') {
                '_'
            } else {
                character
            }
        })
        .collect::<String>();
    let cleaned = cleaned.trim().trim_matches('.');
    if cleaned.is_empty() {
        "Unknown Game".to_string()
    } else {
        cleaned.chars().take(120).collect()
    }
}

#[cfg(target_os = "linux")]
fn staging_directory(game_name: &str) -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "The home directory could not be resolved.".to_string())?;
    let staging = home
        .join("Games")
        .join("VortexMods")
        .join(safe_folder_name(game_name));
    fs::create_dir_all(&staging)
        .map_err(|error| format!("Could not create {}: {error}", staging.display()))?;
    fs::canonicalize(&staging)
        .map_err(|error| format!("Could not resolve {}: {error}", staging.display()))
}

#[cfg(target_os = "linux")]
fn staged_items(staging: &Path) -> Result<Vec<StagedModItem>, String> {
    let mut items = Vec::new();
    for entry in fs::read_dir(staging)
        .map_err(|error| format!("Could not scan {}: {error}", staging.display()))?
        .flatten()
    {
        if entry
            .file_name()
            .to_string_lossy()
            .starts_with(".gameatlas-")
        {
            continue;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        let extension = path.extension().and_then(|value| value.to_str());
        let kind = if file_type.is_dir() {
            "folder"
        } else if file_type.is_file()
            && extension.is_some_and(|value| value.eq_ignore_ascii_case("zip"))
        {
            "zip"
        } else if file_type.is_file()
            && extension.is_some_and(|value| value.eq_ignore_ascii_case("rar"))
        {
            "rar"
        } else {
            continue;
        };
        let name = if matches!(kind, "zip" | "rar") {
            path.file_stem()
        } else {
            path.file_name()
        }
        .and_then(|value| value.to_str())
        .unwrap_or("Staged Mod")
        .to_string();
        let size_bytes = if file_type.is_file() {
            entry.metadata().map(|metadata| metadata.len()).unwrap_or(0)
        } else {
            0
        };
        items.push(StagedModItem {
            name,
            path: path.to_string_lossy().to_string(),
            kind: kind.to_string(),
            size_bytes,
        });
    }
    items.sort_by(|left, right| {
        left.name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase())
            .then_with(|| left.kind.cmp(&right.kind))
    });
    Ok(items)
}

#[cfg(target_os = "linux")]
fn deployment_id() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!(
        "{}-{:03}-{}",
        duration.as_secs(),
        duration.subsec_millis(),
        std::process::id()
    )
}

#[cfg(target_os = "linux")]
fn validate_deployment_id(value: &str) -> Result<&str, String> {
    if value.is_empty()
        || value.len() > 80
        || !value
            .chars()
            .all(|character| character.is_ascii_digit() || character == '-')
    {
        return Err("The deployment identifier is invalid.".to_string());
    }
    Ok(value)
}

#[cfg(target_os = "linux")]
fn read_manifest(directory: &Path) -> Result<DeploymentManifest, String> {
    let text = fs::read_to_string(directory.join("manifest.json"))
        .map_err(|error| format!("Could not read a deployment manifest: {error}"))?;
    let manifest: DeploymentManifest = serde_json::from_str(&text)
        .map_err(|error| format!("A deployment manifest is invalid: {error}"))?;
    let directory_id = directory
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if !(1..=2).contains(&manifest.schema_version) || manifest.id != directory_id {
        return Err("A deployment manifest failed validation.".to_string());
    }
    Ok(manifest)
}

#[cfg(target_os = "linux")]
fn manifests(storage: &Path, install: &Path) -> Result<Vec<DeploymentManifest>, String> {
    if !storage.is_dir() {
        return Ok(Vec::new());
    }
    let install_text = install.to_string_lossy();
    let mut result = Vec::new();
    for entry in fs::read_dir(storage)
        .map_err(|error| format!("Could not read managed deployments: {error}"))?
        .flatten()
    {
        if !entry.path().is_dir() {
            continue;
        }
        let Ok(manifest) = read_manifest(&entry.path()) else {
            continue;
        };
        if manifest.install_path == install_text {
            result.push(manifest);
        }
    }
    result.sort_by(|left, right| {
        let left_order = if left.priority_order > 0 {
            left.priority_order
        } else {
            left.deployed_unix.saturating_mul(1_000)
        };
        let right_order = if right.priority_order > 0 {
            right.priority_order
        } else {
            right.deployed_unix.saturating_mul(1_000)
        };
        left_order
            .cmp(&right_order)
            .then_with(|| left.id.cmp(&right.id))
    });
    Ok(result)
}

#[cfg(target_os = "linux")]
fn read_library_state(storage: &Path) -> Result<ModLibraryState, String> {
    let path = storage.join("library-state.json");
    if !path.is_file() {
        return Ok(ModLibraryState {
            schema_version: 1,
            purged: false,
            active_profile_id: String::new(),
            profiles: Vec::new(),
        });
    }
    let text = fs::read_to_string(path)
        .map_err(|error| format!("Could not read the mod library state: {error}"))?;
    let state: ModLibraryState = serde_json::from_str(&text)
        .map_err(|error| format!("The mod library state is invalid: {error}"))?;
    if state.schema_version != 1 {
        return Err("The mod library state uses an unsupported format.".to_string());
    }
    Ok(state)
}

#[cfg(target_os = "linux")]
fn write_library_state(storage: &Path, state: &ModLibraryState) -> Result<(), String> {
    fs::create_dir_all(storage)
        .map_err(|error| format!("Could not create mod library storage: {error}"))?;
    let json = serde_json::to_vec_pretty(state)
        .map_err(|error| format!("Could not serialize the mod library state: {error}"))?;
    let temporary = storage.join("library-state.json.tmp");
    fs::File::create(&temporary)
        .and_then(|mut file| file.write_all(&json).and_then(|_| file.sync_all()))
        .map_err(|error| format!("Could not save the mod library state: {error}"))?;
    fs::rename(&temporary, storage.join("library-state.json"))
        .map_err(|error| format!("Could not commit the mod library state: {error}"))
}

#[cfg(target_os = "linux")]
fn profile_mod_ids(manifests: &[DeploymentManifest]) -> Vec<String> {
    manifests
        .iter()
        .filter(|manifest| manifest.enabled)
        .map(|manifest| manifest.id.clone())
        .collect()
}

#[cfg(target_os = "linux")]
fn ensure_library_profiles(
    storage: &Path,
    manifests: &[DeploymentManifest],
    state: &mut ModLibraryState,
) -> Result<(), String> {
    let mut changed = false;
    if state.profiles.is_empty() {
        state.profiles.push(StoredModProfile {
            id: "default".to_string(),
            name: "Default".to_string(),
            enabled_mod_ids: profile_mod_ids(manifests),
        });
        state.active_profile_id = "default".to_string();
        changed = true;
    } else if !state
        .profiles
        .iter()
        .any(|profile| profile.id == state.active_profile_id)
    {
        state.active_profile_id = state.profiles[0].id.clone();
        changed = true;
    }
    if changed {
        write_library_state(storage, state)?;
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn sync_active_profile(storage: &Path, manifests: &[DeploymentManifest]) -> Result<(), String> {
    let mut state = read_library_state(storage)?;
    ensure_library_profiles(storage, manifests, &mut state)?;
    let enabled_mod_ids = profile_mod_ids(manifests);
    if let Some(profile) = state
        .profiles
        .iter_mut()
        .find(|profile| profile.id == state.active_profile_id)
    {
        profile.enabled_mod_ids = enabled_mod_ids;
    }
    write_library_state(storage, &state)
}

#[cfg(target_os = "linux")]
fn remove_mod_from_profiles(storage: &Path, deployment_id: &str) -> Result<(), String> {
    let mut state = read_library_state(storage)?;
    for profile in &mut state.profiles {
        profile
            .enabled_mod_ids
            .retain(|candidate| candidate != deployment_id);
    }
    write_library_state(storage, &state)
}

#[cfg(target_os = "linux")]
fn validate_profile_id(value: &str) -> Result<&str, String> {
    if value.is_empty()
        || value.len() > 96
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("The mod profile identifier is invalid.".to_string());
    }
    Ok(value)
}

#[cfg(target_os = "linux")]
fn find_case_insensitive(
    parent: &Path,
    wanted: &std::ffi::OsStr,
) -> Result<Option<PathBuf>, String> {
    let wanted = wanted.to_string_lossy();
    let mut matches = fs::read_dir(parent)
        .map_err(|error| format!("Could not inspect {}: {error}", parent.display()))?
        .flatten()
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .eq_ignore_ascii_case(&wanted)
        })
        .map(|entry| entry.path());
    let first = matches.next();
    if first.is_some() && matches.next().is_some() {
        return Err(format!(
            "Multiple existing paths differ only by letter case under {}.",
            parent.display()
        ));
    }
    Ok(first)
}

#[cfg(target_os = "linux")]
fn resolve_destination(root: &Path, relative: &Path) -> Result<PathBuf, String> {
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(name) = component else {
            return Err("An unsafe deployment path was rejected.".to_string());
        };
        let exact = current.join(name);
        let next = if exact.exists() {
            exact
        } else if current.is_dir() {
            find_case_insensitive(&current, name)?.unwrap_or(exact)
        } else {
            exact
        };
        if let Ok(metadata) = fs::symlink_metadata(&next) {
            if metadata.file_type().is_symlink() {
                return Err(format!(
                    "A symbolic-link destination was rejected: {}",
                    next.display()
                ));
            }
        }
        current = next;
    }
    if !current.starts_with(root) {
        return Err("A deployment destination escaped the game folder.".to_string());
    }
    Ok(current)
}

#[cfg(target_os = "linux")]
fn file_sha256(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 128 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex::encode(hasher.finalize()))
}

#[cfg(target_os = "linux")]
fn is_safe_regular_file(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
fn copy_atomic(source: &Path, destination: &Path, temporary: &Path) -> Result<(), String> {
    let parent = destination
        .parent()
        .ok_or_else(|| "A deployment destination has no parent folder.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    if temporary.exists() {
        fs::remove_file(temporary)
            .map_err(|error| format!("Could not clear a temporary file: {error}"))?;
    }
    if let Err(error) = fs::copy(source, temporary) {
        let _ = fs::remove_file(temporary);
        return Err(format!("Could not copy {}: {error}", source.display()));
    }
    if let Err(error) = fs::rename(temporary, destination) {
        let _ = fs::remove_file(temporary);
        return Err(format!(
            "Could not replace {}: {error}",
            destination.display()
        ));
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn preview_for(
    app: &tauri::AppHandle,
    install_path: &str,
    source_path: &str,
) -> Result<ModDeploymentPreview, String> {
    let install = canonical_directory(install_path, "game installation")?;
    validate_install_root(&install)?;
    let source = canonical_directory(source_path, "mod source")?;
    validate_source_relationship(&source, &install)?;
    let plan = deployment_plan(&install, scan_source(&source)?)?;
    let files = plan.files;
    let storage = game_storage_root(app, &install)?;
    let managed = manifests(&storage, &install)?
        .into_iter()
        .flat_map(|manifest| manifest.files)
        .map(|file| file.relative_path.to_ascii_lowercase())
        .collect::<HashSet<_>>();
    let mut existing = 0_usize;
    let mut managed_conflicts = 0_usize;
    let mut conflicts = Vec::new();
    for file in &files {
        let destination = resolve_destination(&install, &file.relative)?;
        let relative = destination
            .strip_prefix(&install)
            .map_err(|_| "A preview destination escaped the game folder.".to_string())?;
        let relative_text = safe_relative_text(relative)?;
        if destination.exists() {
            existing += 1;
            if conflicts.len() < 12 {
                conflicts.push(relative_text.clone());
            }
        }
        if managed.contains(&relative_text.to_ascii_lowercase()) {
            managed_conflicts += 1;
        }
    }
    let suggested_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Extracted Mod")
        .to_string();
    Ok(ModDeploymentPreview {
        supported: true,
        source_path: source.to_string_lossy().to_string(),
        suggested_name,
        deployment_mode: plan.mode,
        destination_root: plan.destination_root,
        skipped_file_count: plan.skipped_file_count,
        file_count: files.len(),
        total_size_bytes: files.iter().map(|file| file.size_bytes).sum(),
        existing_file_count: existing,
        managed_conflict_count: managed_conflicts,
        conflict_samples: conflicts,
        file_samples: files
            .iter()
            .take(12)
            .map(|file| file.relative_text.clone())
            .collect(),
        warning: plan.warning,
    })
}

#[cfg(target_os = "linux")]
fn extract_zip_archive(archive_path: &Path, staging: &Path) -> Result<PathBuf, String> {
    use std::os::unix::fs::PermissionsExt;

    let archive_file = fs::File::open(archive_path)
        .map_err(|error| format!("Could not open {}: {error}", archive_path.display()))?;
    let mut archive = zip::ZipArchive::new(archive_file)
        .map_err(|error| format!("The ZIP archive could not be read: {error}"))?;
    if archive.len() > MAX_FILES {
        return Err(format!(
            "The ZIP archive exceeds the {MAX_FILES}-entry safety limit."
        ));
    }

    let mut total_size = 0_u64;
    let mut seen = HashSet::new();
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| format!("Could not inspect ZIP entry {index}: {error}"))?;
        if entry.name().contains('\\') {
            return Err(format!(
                "ZIP entry {} uses ambiguous backslash separators.",
                entry.name()
            ));
        }
        let relative = entry
            .enclosed_name()
            .ok_or_else(|| format!("ZIP entry {} has an unsafe path.", entry.name()))?;
        if relative.as_os_str().is_empty() {
            continue;
        }
        let relative_text = safe_relative_text(&relative)?;
        if !seen.insert(relative_text.to_ascii_lowercase()) {
            return Err(format!(
                "The ZIP contains paths that differ only by letter case: {relative_text}"
            ));
        }
        if let Some(mode) = entry.unix_mode() {
            let file_type = mode & 0o170000;
            if file_type == 0o120000 {
                return Err(format!("The ZIP contains a symbolic link: {relative_text}"));
            }
            if file_type != 0 && file_type != 0o040000 && file_type != 0o100000 {
                return Err(format!(
                    "The ZIP contains an unsupported special entry: {relative_text}"
                ));
            }
        }
        total_size = total_size.saturating_add(entry.size());
        if total_size > MAX_TOTAL_BYTES {
            return Err("The extracted ZIP would exceed the 32 GiB safety limit.".to_string());
        }
    }

    let base_name = archive_path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(safe_folder_name)
        .unwrap_or_else(|| "Extracted Mod".to_string());
    let destination = staging.join(&base_name);
    if destination.exists() {
        return Err(format!(
            "{} already exists. Rename or remove it before extracting this archive.",
            destination.display()
        ));
    }
    let temporary = staging.join(format!(".gameatlas-extract-{}", deployment_id()));
    fs::create_dir(&temporary)
        .map_err(|error| format!("Could not create extraction staging: {error}"))?;

    let extraction = (|| -> Result<(), String> {
        let mut written = 0_u64;
        for index in 0..archive.len() {
            let mut entry = archive
                .by_index(index)
                .map_err(|error| format!("Could not read ZIP entry {index}: {error}"))?;
            let relative = entry
                .enclosed_name()
                .ok_or_else(|| format!("ZIP entry {} has an unsafe path.", entry.name()))?;
            if relative.as_os_str().is_empty() {
                continue;
            }
            let output = temporary.join(&relative);
            if entry.is_dir() {
                fs::create_dir_all(&output).map_err(|error| {
                    format!(
                        "Could not create extracted folder {}: {error}",
                        output.display()
                    )
                })?;
                continue;
            }
            if let Some(parent) = output.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!(
                        "Could not create extracted folder {}: {error}",
                        parent.display()
                    )
                })?;
            }
            let mut output_file = fs::File::create(&output).map_err(|error| {
                format!(
                    "Could not create extracted file {}: {error}",
                    output.display()
                )
            })?;
            let remaining = MAX_TOTAL_BYTES.saturating_sub(written);
            let copied = std::io::copy(
                &mut std::io::Read::by_ref(&mut entry).take(remaining.saturating_add(1)),
                &mut output_file,
            )
            .map_err(|error| format!("Could not extract {}: {error}", relative.display()))?;
            written = written.saturating_add(copied);
            if written > MAX_TOTAL_BYTES {
                return Err("ZIP extraction exceeded the 32 GiB safety limit.".to_string());
            }
            output_file
                .sync_all()
                .map_err(|error| format!("Could not finalize {}: {error}", output.display()))?;
            if let Some(mode) = entry.unix_mode() {
                let permissions = fs::Permissions::from_mode(mode & 0o777);
                fs::set_permissions(&output, permissions).map_err(|error| {
                    format!("Could not set permissions on {}: {error}", output.display())
                })?;
            }
        }
        Ok(())
    })();

    if let Err(error) = extraction {
        let _ = fs::remove_dir_all(&temporary);
        return Err(format!("ZIP extraction was rolled back: {error}"));
    }
    fs::rename(&temporary, &destination).map_err(|error| {
        let _ = fs::remove_dir_all(&temporary);
        format!("Could not finalize ZIP extraction: {error}")
    })?;
    Ok(destination)
}

#[cfg(target_os = "linux")]
fn executable_in_path(program: &str) -> Option<PathBuf> {
    use std::os::unix::fs::PermissionsExt;

    let mut candidates = std::env::var_os("PATH")
        .map(|value| {
            std::env::split_paths(&value)
                .map(|directory| directory.join(program))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    candidates.extend([
        PathBuf::from("/usr/bin").join(program),
        PathBuf::from("/usr/local/bin").join(program),
    ]);
    candidates.into_iter().find(|candidate| {
        candidate
            .metadata()
            .map(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    })
}

#[cfg(target_os = "linux")]
fn host_executable(bridge: &Path, program: &str) -> Option<PathBuf> {
    let output = Command::new(bridge)
        .args(["sh", "-lc", &format!("command -v -- {program}")])
        .stdin(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let path = text
        .lines()
        .map(str::trim)
        .find(|line| line.starts_with('/'))?
        .to_string();
    Some(PathBuf::from(path))
}

#[cfg(target_os = "linux")]
fn rar_tools() -> Option<RarTools> {
    if let (Some(lsar), Some(unar)) = (executable_in_path("lsar"), executable_in_path("unar")) {
        return Some(RarTools {
            bridge: None,
            lsar,
            unar,
            provider: "The Unarchiver (lsar + unar)".to_string(),
        });
    }

    let bridge = executable_in_path("distrobox-host-exec")?;
    let lsar = host_executable(&bridge, "lsar")?;
    let unar = host_executable(&bridge, "unar")?;
    Some(RarTools {
        bridge: Some(bridge),
        lsar,
        unar,
        provider: "The Unarchiver via Bazzite host (lsar + unar)".to_string(),
    })
}

#[cfg(target_os = "linux")]
fn rar_command(tools: &RarTools, program: &Path) -> Command {
    if let Some(bridge) = &tools.bridge {
        let mut command = Command::new(bridge);
        command.arg(program);
        command
    } else {
        Command::new(program)
    }
}

#[cfg(target_os = "linux")]
fn metadata_truthy(value: Option<&serde_json::Value>) -> bool {
    match value {
        Some(serde_json::Value::Bool(value)) => *value,
        Some(serde_json::Value::Number(value)) => value.as_u64().unwrap_or_default() != 0,
        Some(serde_json::Value::String(value)) => {
            matches!(value.to_ascii_lowercase().as_str(), "true" | "yes" | "1")
        }
        _ => false,
    }
}

#[cfg(target_os = "linux")]
fn rar_entry_size(entry: &LsarEntry) -> Result<u64, String> {
    match entry.properties.get("XADFileSize") {
        Some(serde_json::Value::Number(value)) => value
            .as_u64()
            .ok_or_else(|| format!("RAR entry {} has an invalid file size.", entry.file_name)),
        None if metadata_truthy(entry.properties.get("XADIsDirectory")) => Ok(0),
        None => Err(format!(
            "RAR entry {} does not report an unpacked size.",
            entry.file_name
        )),
        Some(_) => Err(format!(
            "RAR entry {} has an invalid file size.",
            entry.file_name
        )),
    }
}

#[cfg(target_os = "linux")]
fn validate_rar_listing(listing: &LsarListing) -> Result<(), String> {
    if listing.contents.len() > MAX_FILES {
        return Err(format!(
            "The RAR archive exceeds the {MAX_FILES}-entry safety limit."
        ));
    }

    let unsafe_kinds = [
        ("XADIsLink", "symbolic link"),
        ("XADIsHardLink", "hard link"),
        ("XADIsCharacterDevice", "character device"),
        ("XADIsBlockDevice", "block device"),
        ("XADIsFIFO", "named pipe"),
        ("XADIsSocket", "socket"),
        ("XADIsResourceFork", "resource fork"),
    ];
    let mut total_size = 0_u64;
    let mut seen = HashSet::new();
    for entry in &listing.contents {
        let name = entry.file_name.trim_end_matches('/');
        if name.is_empty()
            || name.contains('\\')
            || name.chars().any(char::is_control)
            || name
                .split('/')
                .next()
                .is_some_and(|component| component.ends_with(':'))
        {
            return Err(format!("RAR entry {} has an unsafe path.", entry.file_name));
        }
        let relative = Path::new(name);
        let relative_text = safe_relative_text(relative)
            .map_err(|_| format!("RAR entry {} has an unsafe path.", entry.file_name))?;
        if relative.components().count() > MAX_DEPTH {
            return Err(format!(
                "RAR entry {relative_text} exceeds the {MAX_DEPTH}-level depth limit."
            ));
        }
        if !seen.insert(relative_text.to_ascii_lowercase()) {
            return Err(format!(
                "The RAR contains duplicate or case-conflicting paths: {relative_text}"
            ));
        }
        if metadata_truthy(entry.properties.get("XADIsEncrypted")) {
            return Err(format!(
                "Password-protected RAR archives are not supported: {relative_text}"
            ));
        }
        for (property, label) in &unsafe_kinds {
            if metadata_truthy(entry.properties.get(*property)) {
                return Err(format!(
                    "The RAR contains an unsupported {label}: {relative_text}"
                ));
            }
        }
        total_size = total_size.saturating_add(rar_entry_size(entry)?);
        if total_size > MAX_TOTAL_BYTES {
            return Err("The extracted RAR would exceed the 32 GiB safety limit.".to_string());
        }
    }
    if listing.contents.is_empty() {
        return Err("The RAR archive does not contain any entries.".to_string());
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn extract_rar_archive(archive_path: &Path, staging: &Path) -> Result<PathBuf, String> {
    let Some(tools) = rar_tools() else {
        return Err(
            "RAR extraction requires the lsar and unar tools. Install the unar package and refresh."
                .to_string(),
        );
    };

    let listing_output = rar_command(&tools, &tools.lsar)
        .args(["-j", "-nr"])
        .arg(archive_path)
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("Could not inspect the RAR archive with lsar: {error}"))?;
    if !listing_output.status.success() {
        let detail = String::from_utf8_lossy(&listing_output.stderr)
            .trim()
            .to_string();
        return Err(if detail.is_empty() {
            "The RAR archive could not be read. It may be damaged or password-protected."
                .to_string()
        } else {
            format!("The RAR archive could not be read: {detail}")
        });
    }
    let listing: LsarListing = serde_json::from_slice(&listing_output.stdout)
        .map_err(|error| format!("lsar returned invalid archive metadata: {error}"))?;
    validate_rar_listing(&listing)?;

    let base_name = archive_path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(safe_folder_name)
        .unwrap_or_else(|| "Extracted Mod".to_string());
    let destination = staging.join(&base_name);
    if destination.exists() {
        return Err(format!(
            "{} already exists. Rename or remove it before extracting this archive.",
            destination.display()
        ));
    }
    let temporary = staging.join(format!(".gameatlas-extract-{}", deployment_id()));
    fs::create_dir(&temporary)
        .map_err(|error| format!("Could not create extraction staging: {error}"))?;

    let extraction = rar_command(&tools, &tools.unar)
        .args(["-q", "-D", "-nr", "-s", "-o"])
        .arg(&temporary)
        .arg(archive_path)
        .stdin(Stdio::null())
        .output();
    let extraction = match extraction {
        Ok(output) if output.status.success() => scan_source(&temporary).map(|_| ()),
        Ok(output) => {
            let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Err(if detail.is_empty() {
                "unar could not extract the archive. It may be damaged or password-protected."
                    .to_string()
            } else {
                format!("unar could not extract the archive: {detail}")
            })
        }
        Err(error) => Err(format!("Could not start unar: {error}")),
    };

    if let Err(error) = extraction {
        let _ = fs::remove_dir_all(&temporary);
        return Err(format!("RAR extraction was rolled back: {error}"));
    }
    fs::rename(&temporary, &destination).map_err(|error| {
        let _ = fs::remove_dir_all(&temporary);
        format!("Could not finalize RAR extraction: {error}")
    })?;
    Ok(destination)
}

#[cfg(target_os = "linux")]
fn prepare_staged_for(
    app: &tauri::AppHandle,
    install_path: &str,
    game_name: &str,
    item_path: &str,
) -> Result<ModDeploymentPreview, String> {
    let staging = staging_directory(game_name)?;
    let selected = fs::canonicalize(PathBuf::from(item_path.trim().trim_matches('"')))
        .map_err(|error| format!("Could not resolve the staged mod: {error}"))?;
    if selected.parent() != Some(staging.as_path()) {
        return Err(
            "Only direct children of this game's VortexMods folder can be prepared.".to_string(),
        );
    }
    let metadata = fs::symlink_metadata(&selected)
        .map_err(|error| format!("Could not inspect the staged mod: {error}"))?;
    if metadata.file_type().is_symlink() {
        return Err("Symbolic links cannot be prepared as staged mods.".to_string());
    }
    let extension = selected.extension().and_then(|value| value.to_str());
    let source = if metadata.is_dir() {
        selected
    } else if metadata.is_file() && extension.is_some_and(|value| value.eq_ignore_ascii_case("zip"))
    {
        extract_zip_archive(&selected, &staging)?
    } else if metadata.is_file() && extension.is_some_and(|value| value.eq_ignore_ascii_case("rar"))
    {
        extract_rar_archive(&selected, &staging)?
    } else {
        return Err("Only folders, ZIP archives, and RAR archives can be prepared.".to_string());
    };
    preview_for(app, install_path, &source.to_string_lossy())
}

#[cfg(target_os = "linux")]
fn status_for(
    app: &tauri::AppHandle,
    install_path: &str,
    game_name: &str,
) -> Result<ModDeploymentStatus, String> {
    let install = canonical_directory(install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let staging = staging_directory(game_name)?;
    let staged_items = staged_items(&staging)?;
    let found = manifests(&storage, &install)?;
    let mut library_state = read_library_state(&storage)?;
    ensure_library_profiles(&storage, &found, &mut library_state)?;
    let latest_enabled = found
        .iter()
        .rev()
        .find(|manifest| manifest.enabled)
        .map(|manifest| manifest.id.as_str());
    let enabled_count = found.iter().filter(|manifest| manifest.enabled).count();
    let all_enabled_library_ready = found
        .iter()
        .filter(|manifest| manifest.enabled)
        .all(|manifest| manifest.schema_version >= 2);
    let mut owners = BTreeMap::<String, (String, Vec<usize>)>::new();
    for (index, manifest) in found
        .iter()
        .enumerate()
        .filter(|(_, manifest)| manifest.enabled)
    {
        for file in &manifest.files {
            owners
                .entry(file.relative_path.to_ascii_lowercase())
                .or_insert_with(|| (file.relative_path.clone(), Vec::new()))
                .1
                .push(index);
        }
    }
    let mut conflict_stats = BTreeMap::<String, (usize, usize, usize)>::new();
    let mut conflicts = Vec::new();
    for (_, (relative_path, indexes)) in owners
        .into_iter()
        .filter(|(_, (_, indexes))| indexes.len() > 1)
    {
        let winner_index = *indexes.last().unwrap_or(&0);
        for index in &indexes {
            let stats = conflict_stats
                .entry(found[*index].id.clone())
                .or_insert((0, 0, 0));
            stats.0 += 1;
            if *index == winner_index {
                stats.1 += 1;
            } else {
                stats.2 += 1;
            }
        }
        conflicts.push(ManagedModConflict {
            relative_path,
            winner_id: found[winner_index].id.clone(),
            winner_name: found[winner_index].name.clone(),
            overridden_ids: indexes[..indexes.len() - 1]
                .iter()
                .map(|index| found[*index].id.clone())
                .collect(),
            overridden_names: indexes[..indexes.len() - 1]
                .iter()
                .map(|index| found[*index].name.clone())
                .collect(),
        });
    }
    let total_conflict_count = conflicts.len();
    conflicts.truncate(200);
    let deployments = found
        .iter()
        .enumerate()
        .rev()
        .map(|(manifest_index, manifest)| {
            let priority = if manifest.enabled {
                found[..=manifest_index]
                    .iter()
                    .filter(|candidate| candidate.enabled)
                    .count()
            } else {
                0
            };
            let stats = conflict_stats
                .get(&manifest.id)
                .copied()
                .unwrap_or((0, 0, 0));
            ManagedModDeployment {
                id: manifest.id.clone(),
                name: manifest.name.clone(),
                source_path: manifest.source_path.clone(),
                deployed_unix: manifest.deployed_unix,
                file_count: manifest.files.len(),
                total_size_bytes: manifest.files.iter().map(|file| file.size_bytes).sum(),
                overwritten_file_count: manifest
                    .files
                    .iter()
                    .filter(|file| file.had_original)
                    .count(),
                can_remove: library_state.purged
                    || !manifest.enabled
                    || latest_enabled == Some(manifest.id.as_str()),
                enabled: manifest.enabled,
                can_toggle: manifest.schema_version >= 2,
                priority,
                conflict_count: stats.0,
                winning_conflict_count: stats.1,
                losing_conflict_count: stats.2,
                can_move_higher: manifest.enabled
                    && manifest.schema_version >= 2
                    && all_enabled_library_ready
                    && priority < enabled_count,
                can_move_lower: manifest.enabled
                    && manifest.schema_version >= 2
                    && all_enabled_library_ready
                    && priority > 1,
                version: manifest.version.clone(),
                author: manifest.author.clone(),
                website: manifest.website.clone(),
                notes: manifest.notes.clone(),
                updated_unix: manifest.updated_unix,
            }
        })
        .collect::<Vec<_>>();
    let rar_tools = rar_tools();
    let rar_supported = rar_tools.is_some();
    Ok(ModDeploymentStatus {
        supported: true,
        rar_supported,
        rar_provider: rar_tools
            .map(|tools| tools.provider)
            .unwrap_or_else(|| "Unavailable — install the unar package".to_string()),
        install_path: install.to_string_lossy().to_string(),
        storage_path: storage.to_string_lossy().to_string(),
        staging_path: staging.to_string_lossy().to_string(),
        staged_items,
        conflicts,
        total_conflict_count,
        purged: library_state.purged,
        profiles: library_state
            .profiles
            .iter()
            .map(|profile| ModProfileSummary {
                id: profile.id.clone(),
                name: profile.name.clone(),
                enabled_mod_count: profile.enabled_mod_ids.len(),
                active: profile.id == library_state.active_profile_id,
            })
            .collect(),
        active_profile_id: library_state.active_profile_id.clone(),
        summary: if deployments.is_empty() {
            "No mods are installed in the GameAtlas library for this game.".to_string()
        } else if library_state.purged {
            format!(
                "{} mod{} installed; deployment is purged.",
                deployments.len(),
                if deployments.len() == 1 { "" } else { "s" },
            )
        } else {
            format!(
                "{} mod{} installed; {} enabled.",
                deployments.len(),
                if deployments.len() == 1 { "" } else { "s" },
                enabled_count,
            )
        },
        deployments,
    })
}

#[cfg(target_os = "linux")]
fn clean_name(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.len() > 120 || value.chars().any(char::is_control) {
        return Err("Enter a mod name between 1 and 120 characters.".to_string());
    }
    Ok(value.to_string())
}

#[cfg(target_os = "linux")]
fn clean_profile_name(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.len() > 80 || value.chars().any(char::is_control) {
        return Err("Enter a profile name between 1 and 80 characters.".to_string());
    }
    Ok(value.to_string())
}

#[cfg(target_os = "linux")]
fn clean_metadata_field(value: &str, label: &str, maximum: usize) -> Result<String, String> {
    let value = value.trim();
    if value.len() > maximum || value.chars().any(char::is_control) {
        return Err(format!(
            "The {label} must contain at most {maximum} printable characters."
        ));
    }
    Ok(value.to_string())
}

#[cfg(target_os = "linux")]
fn rollback_deployment(install: &Path, deployment_directory: &Path, files: &[ManifestFile]) {
    for file in files.iter().rev() {
        let relative = PathBuf::from(&file.relative_path);
        let Ok(destination) = resolve_destination(install, &relative) else {
            continue;
        };
        if file.had_original {
            let backup = deployment_directory.join("backup").join(&relative);
            if backup.is_file() {
                let _ = fs::copy(backup, destination);
            }
        } else if destination.is_file() {
            let _ = fs::remove_file(destination);
        }
    }
}

#[cfg(target_os = "linux")]
fn deploy_for(
    app: &tauri::AppHandle,
    request: DeployModRequest,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(&request.install_path, "game installation")?;
    validate_install_root(&install)?;
    let source = canonical_directory(&request.source_path, "mod source")?;
    validate_source_relationship(&source, &install)?;
    let name = clean_name(&request.name)?;
    let plan = deployment_plan(&install, scan_source(&source)?)?;
    let files = plan.files;
    let storage = game_storage_root(app, &install)?;
    if read_library_state(&storage)?.purged {
        if manifests(&storage, &install)?.is_empty() {
            write_library_state(
                &storage,
                &ModLibraryState {
                    schema_version: 1,
                    purged: false,
                    active_profile_id: String::new(),
                    profiles: Vec::new(),
                },
            )?;
        } else {
            return Err("Redeploy the mod library before installing another mod.".to_string());
        }
    }
    fs::create_dir_all(&storage)
        .map_err(|error| format!("Could not create deployment storage: {error}"))?;
    let id = deployment_id();
    let deployment_directory = storage.join(&id);
    let backup_root = deployment_directory.join("backup");
    let payload_root = deployment_directory.join("payload");
    fs::create_dir_all(&backup_root)
        .map_err(|error| format!("Could not create deployment backup storage: {error}"))?;
    fs::create_dir_all(&payload_root)
        .map_err(|error| format!("Could not create managed mod payload storage: {error}"))?;
    let mut manifest_files = Vec::new();

    let result = (|| -> Result<(), String> {
        for (index, file) in files.iter().enumerate() {
            let destination = resolve_destination(&install, &file.relative)?;
            if destination.is_dir() {
                return Err(format!(
                    "A source file conflicts with an existing directory: {}",
                    destination.display()
                ));
            }
            if destination.exists() && !destination.is_file() {
                return Err(format!(
                    "A source file conflicts with an unsupported existing entry: {}",
                    destination.display()
                ));
            }
            let relative = destination
                .strip_prefix(&install)
                .map_err(|_| "A deployment destination escaped the game folder.".to_string())?
                .to_path_buf();
            let relative_text = safe_relative_text(&relative)?;
            let payload = payload_root.join(&relative);
            if let Some(parent) = payload.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!("Could not create managed payload storage: {error}")
                })?;
            }
            fs::copy(&file.source, &payload).map_err(|error| {
                format!(
                    "Could not preserve {} in the managed library: {error}",
                    file.relative_text
                )
            })?;
            let had_original = destination.is_file();
            if had_original {
                let backup = backup_root.join(&relative);
                if let Some(parent) = backup.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|error| format!("Could not create backup storage: {error}"))?;
                }
                fs::copy(&destination, &backup).map_err(|error| {
                    format!("Could not back up {}: {error}", destination.display())
                })?;
            }
            let temporary = destination
                .parent()
                .unwrap_or(&install)
                .join(format!(".gameatlas-{id}-{index}.tmp"));
            copy_atomic(&file.source, &destination, &temporary)?;
            manifest_files.push(ManifestFile {
                relative_path: relative_text,
                size_bytes: file.size_bytes,
                deployed_sha256: String::new(),
                had_original,
            });
            let deployed_sha256 = file_sha256(&destination)?;
            if let Some(entry) = manifest_files.last_mut() {
                entry.deployed_sha256 = deployed_sha256;
            }
        }
        Ok(())
    })();

    if let Err(error) = result {
        rollback_deployment(&install, &deployment_directory, &manifest_files);
        let _ = fs::remove_dir_all(&deployment_directory);
        return Err(format!("Deployment was rolled back: {error}"));
    }

    let installed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let manifest = DeploymentManifest {
        schema_version: 2,
        id: id.clone(),
        name,
        install_path: install.to_string_lossy().to_string(),
        source_path: source.to_string_lossy().to_string(),
        deployed_unix: installed.as_secs(),
        priority_order: u64::try_from(installed.as_millis()).unwrap_or(u64::MAX),
        enabled: true,
        version: String::new(),
        author: String::new(),
        website: String::new(),
        notes: String::new(),
        updated_unix: installed.as_secs(),
        files: manifest_files,
    };
    let json = match serde_json::to_vec_pretty(&manifest) {
        Ok(json) => json,
        Err(error) => {
            rollback_deployment(&install, &deployment_directory, &manifest.files);
            let _ = fs::remove_dir_all(&deployment_directory);
            return Err(format!(
                "Deployment was rolled back because its manifest could not be serialized: {error}"
            ));
        }
    };
    let temporary_manifest = deployment_directory.join("manifest.json.tmp");
    fs::File::create(&temporary_manifest)
        .and_then(|mut file| file.write_all(&json).and_then(|_| file.sync_all()))
        .map_err(|error| {
            rollback_deployment(&install, &deployment_directory, &manifest.files);
            let _ = fs::remove_dir_all(&deployment_directory);
            format!("Deployment was rolled back because its manifest could not be saved: {error}")
        })?;
    fs::rename(
        &temporary_manifest,
        deployment_directory.join("manifest.json"),
    )
    .map_err(|error| {
        rollback_deployment(&install, &deployment_directory, &manifest.files);
        let _ = fs::remove_dir_all(&deployment_directory);
        format!("Deployment was rolled back because its manifest could not be committed: {error}")
    })?;

    let updated = manifests(&storage, &install)?;
    sync_active_profile(&storage, &updated)?;

    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: Some(id),
        files_changed: manifest.files.len(),
        bytes_changed: manifest.files.iter().map(|file| file.size_bytes).sum(),
        message: format!(
            "Installed and enabled {} file{} using {}. The mod payload is preserved in the managed library.",
            manifest.files.len(),
            if manifest.files.len() == 1 { "" } else { "s" },
            plan.mode
        ),
    })
}

#[cfg(target_os = "linux")]
fn remove_empty_parents(path: &Path, root: &Path) {
    let mut current = path.parent();
    while let Some(directory) = current {
        if directory == root || !directory.starts_with(root) {
            break;
        }
        if fs::remove_dir(directory).is_err() {
            break;
        }
        current = directory.parent();
    }
}

#[cfg(target_os = "linux")]
fn write_manifest(directory: &Path, manifest: &DeploymentManifest) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(manifest)
        .map_err(|error| format!("Could not serialize the mod library manifest: {error}"))?;
    let temporary = directory.join("manifest.json.tmp");
    fs::File::create(&temporary)
        .and_then(|mut file| file.write_all(&json).and_then(|_| file.sync_all()))
        .map_err(|error| format!("Could not save the mod library manifest: {error}"))?;
    fs::rename(&temporary, directory.join("manifest.json"))
        .map_err(|error| format!("Could not commit the mod library manifest: {error}"))
}

#[cfg(target_os = "linux")]
fn copy_directory_files(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.is_dir() {
        fs::create_dir_all(destination)
            .map_err(|error| format!("Could not create transaction storage: {error}"))?;
        return Ok(());
    }
    let mut stack = vec![(source.to_path_buf(), destination.to_path_buf())];
    while let Some((current_source, current_destination)) = stack.pop() {
        fs::create_dir_all(&current_destination)
            .map_err(|error| format!("Could not create transaction storage: {error}"))?;
        for entry in fs::read_dir(&current_source)
            .map_err(|error| format!("Could not read transaction source: {error}"))?
        {
            let entry =
                entry.map_err(|error| format!("Could not read transaction entry: {error}"))?;
            let metadata = entry
                .metadata()
                .map_err(|error| format!("Could not inspect transaction entry: {error}"))?;
            let target = current_destination.join(entry.file_name());
            if metadata.is_dir() {
                stack.push((entry.path(), target));
            } else if metadata.is_file() && !metadata.file_type().is_symlink() {
                fs::copy(entry.path(), target)
                    .map_err(|error| format!("Could not copy transaction data: {error}"))?;
            } else {
                return Err("Unsafe data was found in managed mod storage.".to_string());
            }
        }
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn deactivate_layer(
    install: &Path,
    deployment_directory: &Path,
    manifest: &DeploymentManifest,
) -> Result<(), String> {
    let backup_root = deployment_directory.join("backup");
    for file in &manifest.files {
        let relative = PathBuf::from(&file.relative_path);
        safe_relative_text(&relative)?;
        let destination = resolve_destination(install, &relative)?;
        if !destination.is_file() || file_sha256(&destination)? != file.deployed_sha256 {
            return Err(format!(
                "{} changed after deployment. The mod state was not changed.",
                file.relative_path
            ));
        }
        if file.had_original {
            let backup = backup_root.join(&relative);
            let valid = fs::symlink_metadata(&backup)
                .map(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
                .unwrap_or(false);
            if !valid {
                return Err(format!(
                    "The backup for {} is missing or unsafe.",
                    file.relative_path
                ));
            }
        }
    }

    for (index, file) in manifest.files.iter().enumerate().rev() {
        let relative = PathBuf::from(&file.relative_path);
        let destination = resolve_destination(install, &relative)?;
        if file.had_original {
            let backup = backup_root.join(&relative);
            let temporary = destination
                .parent()
                .unwrap_or(install)
                .join(format!(".gameatlas-disable-{}-{index}.tmp", manifest.id));
            copy_atomic(&backup, &destination, &temporary)?;
        } else {
            fs::remove_file(&destination)
                .map_err(|error| format!("Could not remove {}: {error}", destination.display()))?;
            remove_empty_parents(&destination, install);
        }
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn activate_layer(
    install: &Path,
    deployment_directory: &Path,
    manifest: &mut DeploymentManifest,
) -> Result<(), String> {
    let payload_root = deployment_directory.join("payload");
    let next_backup = deployment_directory.join("backup.next");
    if next_backup.exists() {
        fs::remove_dir_all(&next_backup)
            .map_err(|error| format!("Could not reset temporary backup storage: {error}"))?;
    }
    fs::create_dir_all(&next_backup)
        .map_err(|error| format!("Could not create temporary backup storage: {error}"))?;

    for (index, file) in manifest.files.iter_mut().enumerate() {
        let relative = PathBuf::from(&file.relative_path);
        safe_relative_text(&relative)?;
        let payload = payload_root.join(&relative);
        let valid_payload = fs::symlink_metadata(&payload)
            .map(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
            .unwrap_or(false);
        if !valid_payload || file_sha256(&payload)? != file.deployed_sha256 {
            return Err(format!(
                "The managed payload for {} is missing or changed.",
                file.relative_path
            ));
        }
        let destination = resolve_destination(install, &relative)?;
        if destination.exists() && !destination.is_file() {
            return Err(format!(
                "A mod file conflicts with a non-file destination: {}",
                destination.display()
            ));
        }
        file.had_original = destination.is_file();
        if file.had_original {
            let backup = next_backup.join(&relative);
            if let Some(parent) = backup.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Could not create backup storage: {error}"))?;
            }
            fs::copy(&destination, backup)
                .map_err(|error| format!("Could not back up {}: {error}", destination.display()))?;
        }
        let temporary = destination
            .parent()
            .unwrap_or(install)
            .join(format!(".gameatlas-enable-{}-{index}.tmp", manifest.id));
        copy_atomic(&payload, &destination, &temporary)?;
        file.deployed_sha256 = file_sha256(&destination)?;
    }

    let backup_root = deployment_directory.join("backup");
    let previous_backup = deployment_directory.join("backup.previous");
    if previous_backup.exists() {
        fs::remove_dir_all(&previous_backup)
            .map_err(|error| format!("Could not reset previous backup storage: {error}"))?;
    }
    if backup_root.exists() {
        fs::rename(&backup_root, &previous_backup)
            .map_err(|error| format!("Could not preserve the previous backup: {error}"))?;
    }
    fs::rename(&next_backup, &backup_root)
        .map_err(|error| format!("Could not activate the new backup set: {error}"))?;
    if previous_backup.exists() {
        fs::remove_dir_all(previous_backup)
            .map_err(|error| format!("Could not clean the previous backup: {error}"))?;
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn restore_toggle_transaction(
    install: &Path,
    storage: &Path,
    transaction: &Path,
    paths: &BTreeSet<String>,
    present: &BTreeSet<String>,
    deployment_ids: &[String],
) {
    for relative_text in paths {
        let relative = PathBuf::from(relative_text);
        let Ok(destination) = resolve_destination(install, &relative) else {
            continue;
        };
        if present.contains(relative_text) {
            let snapshot = transaction.join("game").join(&relative);
            if snapshot.is_file() {
                let temporary = destination
                    .parent()
                    .unwrap_or(install)
                    .join(".gameatlas-toggle-rollback.tmp");
                let _ = copy_atomic(&snapshot, &destination, &temporary);
            }
        } else if destination.is_file() {
            let _ = fs::remove_file(&destination);
            remove_empty_parents(&destination, install);
        }
    }
    for id in deployment_ids {
        let deployment = storage.join(id);
        let snapshot = transaction.join("layers").join(id);
        let backup = deployment.join("backup");
        let _ = fs::remove_dir_all(&backup);
        let _ = copy_directory_files(&snapshot.join("backup"), &backup);
        let _ = fs::copy(
            snapshot.join("manifest.json"),
            deployment.join("manifest.json"),
        );
        let _ = fs::remove_dir_all(deployment.join("backup.next"));
        let _ = fs::remove_dir_all(deployment.join("backup.previous"));
    }
}

#[cfg(target_os = "linux")]
fn set_enabled_for(
    app: &tauri::AppHandle,
    request: SetDeploymentEnabledRequest,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(&request.install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let mut found = manifests(&storage, &install)?;
    let library_state = read_library_state(&storage)?;
    let requested = validate_deployment_id(&request.deployment_id)?;
    let target_index = found
        .iter()
        .position(|manifest| manifest.id == requested)
        .ok_or_else(|| "The selected managed mod no longer exists.".to_string())?;
    if found[target_index].schema_version < 2 {
        return Err(
            "This legacy deployment cannot be toggled. Remove and reinstall it once to add it to the managed library."
                .to_string(),
        );
    }
    if found[target_index].enabled == request.enabled {
        return Ok(ModDeploymentActionResult {
            success: true,
            deployment_id: Some(requested.to_string()),
            files_changed: 0,
            bytes_changed: 0,
            message: format!(
                "{} is already {}.",
                found[target_index].name,
                if request.enabled {
                    "enabled"
                } else {
                    "disabled"
                }
            ),
        });
    }
    if library_state.purged {
        found[target_index].enabled = request.enabled;
        if request.enabled {
            let enabled_at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default();
            found[target_index].priority_order =
                u64::try_from(enabled_at.as_millis()).unwrap_or(u64::MAX);
        }
        write_manifest(&storage.join(requested), &found[target_index])?;
        let updated = manifests(&storage, &install)?;
        sync_active_profile(&storage, &updated)?;
        return Ok(ModDeploymentActionResult {
            success: true,
            deployment_id: Some(requested.to_string()),
            files_changed: 0,
            bytes_changed: 0,
            message: format!(
                "{} will be {} the next time the library is redeployed.",
                found[target_index].name,
                if request.enabled {
                    "enabled"
                } else {
                    "disabled"
                }
            ),
        });
    }

    let affected_indices = if request.enabled {
        vec![target_index]
    } else {
        found
            .iter()
            .enumerate()
            .skip(target_index)
            .filter_map(|(index, manifest)| manifest.enabled.then_some(index))
            .collect::<Vec<_>>()
    };
    if affected_indices
        .iter()
        .any(|index| found[*index].schema_version < 2)
    {
        return Err(
            "A newer legacy deployment prevents safe relayering. Remove and reinstall legacy deployments first."
                .to_string(),
        );
    }

    let transaction = storage.join(format!(".toggle-{}", deployment_id()));
    fs::create_dir_all(transaction.join("game"))
        .map_err(|error| format!("Could not create the mod-state transaction: {error}"))?;
    let mut paths = BTreeSet::new();
    let mut present = BTreeSet::new();
    let mut deployment_ids = Vec::new();
    let snapshot_result = (|| -> Result<(), String> {
        for index in &affected_indices {
            let manifest = &found[*index];
            deployment_ids.push(manifest.id.clone());
            let deployment = storage.join(&manifest.id);
            let layer_snapshot = transaction.join("layers").join(&manifest.id);
            fs::create_dir_all(&layer_snapshot)
                .map_err(|error| format!("Could not create layer snapshot storage: {error}"))?;
            fs::copy(
                deployment.join("manifest.json"),
                layer_snapshot.join("manifest.json"),
            )
            .map_err(|error| format!("Could not snapshot a mod manifest: {error}"))?;
            copy_directory_files(&deployment.join("backup"), &layer_snapshot.join("backup"))?;
            for file in &manifest.files {
                paths.insert(file.relative_path.clone());
            }
        }
        for relative_text in &paths {
            let relative = PathBuf::from(relative_text);
            safe_relative_text(&relative)?;
            let destination = resolve_destination(&install, &relative)?;
            if destination.is_file() {
                present.insert(relative_text.clone());
                let snapshot = transaction.join("game").join(&relative);
                if let Some(parent) = snapshot.parent() {
                    fs::create_dir_all(parent).map_err(|error| {
                        format!("Could not create game snapshot storage: {error}")
                    })?;
                }
                fs::copy(&destination, snapshot).map_err(|error| {
                    format!("Could not snapshot {}: {error}", destination.display())
                })?;
            } else if destination.exists() {
                return Err(format!(
                    "A managed destination is no longer a regular file: {}",
                    destination.display()
                ));
            }
        }
        Ok(())
    })();
    if let Err(error) = snapshot_result {
        let _ = fs::remove_dir_all(&transaction);
        return Err(error);
    }

    let operation = (|| -> Result<(), String> {
        if request.enabled {
            let deployment = storage.join(&found[target_index].id);
            activate_layer(&install, &deployment, &mut found[target_index])?;
            found[target_index].enabled = true;
            let enabled_at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default();
            found[target_index].priority_order =
                u64::try_from(enabled_at.as_millis()).unwrap_or(u64::MAX);
        } else {
            for index in affected_indices.iter().rev() {
                let deployment = storage.join(&found[*index].id);
                deactivate_layer(&install, &deployment, &found[*index])?;
            }
            found[target_index].enabled = false;
            for index in affected_indices
                .iter()
                .copied()
                .filter(|index| *index != target_index)
            {
                let deployment = storage.join(&found[index].id);
                activate_layer(&install, &deployment, &mut found[index])?;
            }
        }
        for index in &affected_indices {
            write_manifest(&storage.join(&found[*index].id), &found[*index])?;
        }
        Ok(())
    })();

    if let Err(error) = operation {
        restore_toggle_transaction(
            &install,
            &storage,
            &transaction,
            &paths,
            &present,
            &deployment_ids,
        );
        let _ = fs::remove_dir_all(&transaction);
        return Err(format!(
            "The mod state change failed and GameAtlas restored the previous deployment: {error}"
        ));
    }
    let _ = fs::remove_dir_all(&transaction);
    let updated = manifests(&storage, &install)?;
    sync_active_profile(&storage, &updated)?;
    let target = &found[target_index];
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: Some(target.id.clone()),
        files_changed: target.files.len(),
        bytes_changed: target.files.iter().map(|file| file.size_bytes).sum(),
        message: format!(
            "{} is now {}.{}",
            target.name,
            if request.enabled {
                "enabled"
            } else {
                "disabled"
            },
            if !request.enabled && affected_indices.len() > 1 {
                " Later mods were safely reapplied in priority order."
            } else {
                ""
            }
        ),
    })
}

#[cfg(target_os = "linux")]
fn move_priority_for(
    app: &tauri::AppHandle,
    request: MoveDeploymentPriorityRequest,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(&request.install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let mut found = manifests(&storage, &install)?;
    let library_state = read_library_state(&storage)?;
    let requested = validate_deployment_id(&request.deployment_id)?;
    let mut enabled_indices = found
        .iter()
        .enumerate()
        .filter_map(|(index, manifest)| manifest.enabled.then_some(index))
        .collect::<Vec<_>>();
    if enabled_indices.len() < 2 {
        return Err("At least two enabled mods are required to change priority.".to_string());
    }
    if enabled_indices
        .iter()
        .any(|index| found[*index].schema_version < 2)
    {
        return Err(
            "Legacy deployments must be reinstalled before priority can be changed.".to_string(),
        );
    }
    let position = enabled_indices
        .iter()
        .position(|index| found[*index].id == requested)
        .ok_or_else(|| "The selected mod is not enabled.".to_string())?;
    let swap_position = match request.direction.as_str() {
        "higher" if position + 1 < enabled_indices.len() => position + 1,
        "lower" if position > 0 => position - 1,
        "higher" | "lower" => {
            return Err("The selected mod is already at that priority boundary.".to_string())
        }
        _ => return Err("The priority direction is invalid.".to_string()),
    };
    if library_state.purged {
        let first_index = enabled_indices[position];
        let second_index = enabled_indices[swap_position];
        let first_priority = found[first_index].priority_order;
        found[first_index].priority_order = found[second_index].priority_order;
        found[second_index].priority_order = first_priority;
        write_manifest(&storage.join(&found[first_index].id), &found[first_index])?;
        write_manifest(&storage.join(&found[second_index].id), &found[second_index])?;
        let reordered = manifests(&storage, &install)?;
        sync_active_profile(&storage, &reordered)?;
        return Ok(ModDeploymentActionResult {
            success: true,
            deployment_id: Some(requested.to_string()),
            files_changed: 0,
            bytes_changed: 0,
            message:
                "Priority updated. The new order will be applied when the library is redeployed."
                    .to_string(),
        });
    }

    let transaction = storage.join(format!(".priority-{}", deployment_id()));
    fs::create_dir_all(transaction.join("game"))
        .map_err(|error| format!("Could not create the priority transaction: {error}"))?;
    let mut paths = BTreeSet::new();
    let mut present = BTreeSet::new();
    let deployment_ids = enabled_indices
        .iter()
        .map(|index| found[*index].id.clone())
        .collect::<Vec<_>>();
    let snapshot_result = (|| -> Result<(), String> {
        for index in &enabled_indices {
            let manifest = &found[*index];
            let deployment = storage.join(&manifest.id);
            let layer_snapshot = transaction.join("layers").join(&manifest.id);
            fs::create_dir_all(&layer_snapshot)
                .map_err(|error| format!("Could not create layer snapshot storage: {error}"))?;
            fs::copy(
                deployment.join("manifest.json"),
                layer_snapshot.join("manifest.json"),
            )
            .map_err(|error| format!("Could not snapshot a mod manifest: {error}"))?;
            copy_directory_files(&deployment.join("backup"), &layer_snapshot.join("backup"))?;
            for file in &manifest.files {
                paths.insert(file.relative_path.clone());
            }
        }
        for relative_text in &paths {
            let relative = PathBuf::from(relative_text);
            safe_relative_text(&relative)?;
            let destination = resolve_destination(&install, &relative)?;
            if destination.is_file() {
                present.insert(relative_text.clone());
                let snapshot = transaction.join("game").join(&relative);
                if let Some(parent) = snapshot.parent() {
                    fs::create_dir_all(parent).map_err(|error| {
                        format!("Could not create game snapshot storage: {error}")
                    })?;
                }
                fs::copy(&destination, snapshot).map_err(|error| {
                    format!("Could not snapshot {}: {error}", destination.display())
                })?;
            } else if destination.exists() {
                return Err(format!(
                    "A managed destination is no longer a regular file: {}",
                    destination.display()
                ));
            }
        }
        Ok(())
    })();
    if let Err(error) = snapshot_result {
        let _ = fs::remove_dir_all(&transaction);
        return Err(error);
    }

    let priority_values = enabled_indices
        .iter()
        .map(|index| found[*index].priority_order)
        .collect::<Vec<_>>();
    let operation = (|| -> Result<(), String> {
        for index in enabled_indices.iter().rev() {
            deactivate_layer(&install, &storage.join(&found[*index].id), &found[*index])?;
        }
        enabled_indices.swap(position, swap_position);
        for (rank, index) in enabled_indices.iter().enumerate() {
            found[*index].priority_order = priority_values[rank];
            activate_layer(
                &install,
                &storage.join(&found[*index].id),
                &mut found[*index],
            )?;
        }
        for index in &enabled_indices {
            write_manifest(&storage.join(&found[*index].id), &found[*index])?;
        }
        Ok(())
    })();
    if let Err(error) = operation {
        restore_toggle_transaction(
            &install,
            &storage,
            &transaction,
            &paths,
            &present,
            &deployment_ids,
        );
        let _ = fs::remove_dir_all(&transaction);
        return Err(format!(
            "The priority change failed and GameAtlas restored the previous order: {error}"
        ));
    }
    let _ = fs::remove_dir_all(&transaction);
    let reordered = manifests(&storage, &install)?;
    sync_active_profile(&storage, &reordered)?;
    let target = found
        .iter()
        .find(|manifest| manifest.id == requested)
        .ok_or_else(|| "The reordered mod could not be found.".to_string())?;
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: Some(target.id.clone()),
        files_changed: paths.len(),
        bytes_changed: target.files.iter().map(|file| file.size_bytes).sum(),
        message: format!(
            "Moved {} one priority level {}. Conflict winners were redeployed.",
            target.name, request.direction
        ),
    })
}

#[cfg(target_os = "linux")]
fn update_metadata_for(
    app: &tauri::AppHandle,
    request: UpdateModMetadataRequest,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(&request.install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let requested = validate_deployment_id(&request.deployment_id)?;
    let mut found = manifests(&storage, &install)?;
    let manifest = found
        .iter_mut()
        .find(|manifest| manifest.id == requested)
        .ok_or_else(|| "The selected managed mod no longer exists.".to_string())?;
    manifest.name = clean_name(&request.name)?;
    manifest.version = clean_metadata_field(&request.version, "version", 80)?;
    manifest.author = clean_metadata_field(&request.author, "author", 120)?;
    manifest.website = clean_metadata_field(&request.website, "source page", 500)?;
    let notes = request.notes.trim();
    if notes.len() > 2_000
        || notes
            .chars()
            .any(|character| character.is_control() && !matches!(character, '\n' | '\r' | '\t'))
    {
        return Err("Notes must contain at most 2,000 printable characters.".to_string());
    }
    manifest.notes = notes.replace("\r\n", "\n").replace('\r', "\n");
    let name = manifest.name.clone();
    write_manifest(&storage.join(requested), manifest)?;
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: Some(requested.to_string()),
        files_changed: 0,
        bytes_changed: 0,
        message: format!("Updated metadata for {name}."),
    })
}

#[cfg(target_os = "linux")]
fn snapshot_additional_game_paths(
    install: &Path,
    transaction: &Path,
    paths: &mut BTreeSet<String>,
    present: &mut BTreeSet<String>,
    additional: impl IntoIterator<Item = String>,
) -> Result<(), String> {
    for relative_text in additional {
        if !paths.insert(relative_text.clone()) {
            continue;
        }
        let relative = PathBuf::from(&relative_text);
        safe_relative_text(&relative)?;
        let destination = resolve_destination(install, &relative)?;
        if destination.is_file() {
            present.insert(relative_text);
            let snapshot = transaction.join("game").join(&relative);
            if let Some(parent) = snapshot.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Could not extend the upgrade snapshot: {error}"))?;
            }
            fs::copy(&destination, snapshot).map_err(|error| {
                format!("Could not snapshot {}: {error}", destination.display())
            })?;
        } else if destination.exists() {
            return Err(format!(
                "An upgrade destination is no longer a regular file: {}",
                destination.display()
            ));
        }
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn upgrade_mod_for(
    app: &tauri::AppHandle,
    request: UpgradeModRequest,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(&request.install_path, "game installation")?;
    validate_install_root(&install)?;
    let source = canonical_directory(&request.source_path, "mod source")?;
    validate_source_relationship(&source, &install)?;
    let plan = deployment_plan(&install, scan_source(&source)?)?;
    let storage = game_storage_root(app, &install)?;
    let state = read_library_state(&storage)?;
    let mut found = manifests(&storage, &install)?;
    let requested = validate_deployment_id(&request.deployment_id)?;
    let target_index = found
        .iter()
        .position(|manifest| manifest.id == requested)
        .ok_or_else(|| "The selected managed mod no longer exists.".to_string())?;
    if found[target_index].schema_version < 2 {
        return Err(
            "This legacy deployment must be removed and reinstalled before it can be upgraded."
                .to_string(),
        );
    }
    let actively_deployed = found[target_index].enabled && !state.purged;
    let affected_indices = if actively_deployed {
        found
            .iter()
            .enumerate()
            .skip(target_index)
            .filter_map(|(index, manifest)| manifest.enabled.then_some(index))
            .collect::<Vec<_>>()
    } else {
        vec![target_index]
    };
    if affected_indices
        .iter()
        .any(|index| found[*index].schema_version < 2)
    {
        return Err(
            "A higher-priority legacy deployment prevents a safe upgrade. Reinstall legacy deployments first."
                .to_string(),
        );
    }

    let deployment = storage.join(requested);
    let next_payload = deployment.join("payload.next");
    let previous_payload = deployment.join("payload.previous");
    if next_payload.exists() {
        fs::remove_dir_all(&next_payload)
            .map_err(|error| format!("Could not reset upgrade staging: {error}"))?;
    }
    if previous_payload.exists() {
        fs::remove_dir_all(&previous_payload)
            .map_err(|error| format!("Could not reset the previous upgrade payload: {error}"))?;
    }
    fs::create_dir_all(&next_payload)
        .map_err(|error| format!("Could not create upgrade staging: {error}"))?;
    let prepare = (|| -> Result<Vec<ManifestFile>, String> {
        let mut files = Vec::new();
        for file in &plan.files {
            let destination = next_payload.join(&file.relative);
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!("Could not create upgrade payload storage: {error}")
                })?;
            }
            fs::copy(&file.source, &destination).map_err(|error| {
                format!(
                    "Could not preserve {} for the upgrade: {error}",
                    file.relative_text
                )
            })?;
            files.push(ManifestFile {
                relative_path: file.relative_text.clone(),
                size_bytes: file.size_bytes,
                deployed_sha256: file_sha256(&destination)?,
                had_original: false,
            });
        }
        Ok(files)
    })();
    let replacement_files = match prepare {
        Ok(files) => files,
        Err(error) => {
            let _ = fs::remove_dir_all(&next_payload);
            return Err(error);
        }
    };

    let (transaction, mut paths, mut present, ids) =
        match snapshot_layers(&install, &storage, &found, &affected_indices, "upgrade") {
            Ok(snapshot) => snapshot,
            Err(error) => {
                let _ = fs::remove_dir_all(&next_payload);
                return Err(error);
            }
        };
    if actively_deployed {
        if let Err(error) = snapshot_additional_game_paths(
            &install,
            &transaction,
            &mut paths,
            &mut present,
            replacement_files
                .iter()
                .map(|file| file.relative_path.clone()),
        ) {
            let _ = fs::remove_dir_all(&transaction);
            let _ = fs::remove_dir_all(&next_payload);
            return Err(error);
        }
    }
    let upgraded_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let previous_source = found[target_index].source_path.clone();
    let previous_file_count = found[target_index].files.len();
    let operation = (|| -> Result<(), String> {
        if actively_deployed {
            for index in affected_indices.iter().rev() {
                deactivate_layer(&install, &storage.join(&found[*index].id), &found[*index])?;
            }
        }
        fs::rename(deployment.join("payload"), &previous_payload)
            .map_err(|error| format!("Could not preserve the previous mod payload: {error}"))?;
        fs::rename(&next_payload, deployment.join("payload"))
            .map_err(|error| format!("Could not activate the replacement payload: {error}"))?;
        found[target_index].source_path = source.to_string_lossy().to_string();
        found[target_index].updated_unix = upgraded_at;
        found[target_index].files = replacement_files.clone();
        if actively_deployed {
            for index in &affected_indices {
                activate_layer(
                    &install,
                    &storage.join(&found[*index].id),
                    &mut found[*index],
                )?;
            }
        }
        for index in &affected_indices {
            write_manifest(&storage.join(&found[*index].id), &found[*index])?;
        }
        Ok(())
    })();
    if let Err(error) = operation {
        restore_toggle_transaction(&install, &storage, &transaction, &paths, &present, &ids);
        if previous_payload.is_dir() {
            let _ = fs::remove_dir_all(deployment.join("payload"));
            let _ = fs::rename(&previous_payload, deployment.join("payload"));
        }
        let _ = fs::remove_dir_all(&next_payload);
        let _ = fs::remove_dir_all(&transaction);
        return Err(format!(
            "The upgrade failed and GameAtlas restored the previous version: {error}"
        ));
    }
    let _ = fs::remove_dir_all(&previous_payload);
    let _ = fs::remove_dir_all(&transaction);
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: Some(requested.to_string()),
        files_changed: if actively_deployed {
            paths.len()
        } else {
            replacement_files.len()
        },
        bytes_changed: replacement_files.iter().map(|file| file.size_bytes).sum(),
        message: format!(
            "Upgraded {} from {} to {} files using {}. Its enabled state, profiles, metadata, and priority were preserved.{}",
            found[target_index].name,
            previous_file_count,
            replacement_files.len(),
            plan.mode,
            if previous_source == found[target_index].source_path {
                ""
            } else {
                " The managed source path was updated."
            }
        ),
    })
}

#[cfg(target_os = "linux")]
fn create_profile_for(
    app: &tauri::AppHandle,
    request: NamedModProfileRequest,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(&request.install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let found = manifests(&storage, &install)?;
    let mut state = read_library_state(&storage)?;
    ensure_library_profiles(&storage, &found, &mut state)?;
    let name = clean_profile_name(&request.name)?;
    if state
        .profiles
        .iter()
        .any(|profile| profile.name.eq_ignore_ascii_case(&name))
    {
        return Err("A mod profile with that name already exists.".to_string());
    }
    let id = format!("profile-{}", deployment_id());
    state.profiles.push(StoredModProfile {
        id: id.clone(),
        name: name.clone(),
        enabled_mod_ids: profile_mod_ids(&found),
    });
    state.active_profile_id = id.clone();
    write_library_state(&storage, &state)?;
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: Some(id),
        files_changed: 0,
        bytes_changed: 0,
        message: format!("Created and activated the {name} profile from the current mod setup."),
    })
}

#[cfg(target_os = "linux")]
fn rename_profile_for(
    app: &tauri::AppHandle,
    request: NamedModProfileRequest,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(&request.install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let found = manifests(&storage, &install)?;
    let mut state = read_library_state(&storage)?;
    ensure_library_profiles(&storage, &found, &mut state)?;
    let requested = request
        .profile_id
        .as_deref()
        .ok_or_else(|| "Select a mod profile to rename.".to_string())?;
    validate_profile_id(requested)?;
    let name = clean_profile_name(&request.name)?;
    if state
        .profiles
        .iter()
        .any(|profile| profile.id != requested && profile.name.eq_ignore_ascii_case(&name))
    {
        return Err("A mod profile with that name already exists.".to_string());
    }
    let profile = state
        .profiles
        .iter_mut()
        .find(|profile| profile.id == requested)
        .ok_or_else(|| "The selected mod profile no longer exists.".to_string())?;
    profile.name = name.clone();
    write_library_state(&storage, &state)?;
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: Some(requested.to_string()),
        files_changed: 0,
        bytes_changed: 0,
        message: format!("Renamed the mod profile to {name}."),
    })
}

#[cfg(target_os = "linux")]
fn delete_profile_for(
    app: &tauri::AppHandle,
    request: ModProfileRequest,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(&request.install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let found = manifests(&storage, &install)?;
    let mut state = read_library_state(&storage)?;
    ensure_library_profiles(&storage, &found, &mut state)?;
    let requested = validate_profile_id(&request.profile_id)?;
    if state.profiles.len() == 1 {
        return Err("The only mod profile cannot be deleted.".to_string());
    }
    if state.active_profile_id == requested {
        return Err("Activate another profile before deleting this one.".to_string());
    }
    let position = state
        .profiles
        .iter()
        .position(|profile| profile.id == requested)
        .ok_or_else(|| "The selected mod profile no longer exists.".to_string())?;
    let name = state.profiles[position].name.clone();
    state.profiles.remove(position);
    write_library_state(&storage, &state)?;
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: Some(requested.to_string()),
        files_changed: 0,
        bytes_changed: 0,
        message: format!("Deleted the {name} profile. Managed mods were not removed."),
    })
}

#[cfg(target_os = "linux")]
fn activate_profile_for(
    app: &tauri::AppHandle,
    request: ModProfileRequest,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(&request.install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let mut found = manifests(&storage, &install)?;
    let mut state = read_library_state(&storage)?;
    ensure_library_profiles(&storage, &found, &mut state)?;
    let requested = validate_profile_id(&request.profile_id)?;
    if state.active_profile_id == requested {
        return Ok(ModDeploymentActionResult {
            success: true,
            deployment_id: Some(requested.to_string()),
            files_changed: 0,
            bytes_changed: 0,
            message: "That mod profile is already active.".to_string(),
        });
    }
    let target_position = state
        .profiles
        .iter()
        .position(|profile| profile.id == requested)
        .ok_or_else(|| "The selected mod profile no longer exists.".to_string())?;
    let target = state.profiles[target_position].clone();
    let mut desired_indices = Vec::new();
    let mut desired_ids = HashSet::new();
    for id in &target.enabled_mod_ids {
        if !desired_ids.insert(id.clone()) {
            continue;
        }
        if let Some(index) = found.iter().position(|manifest| manifest.id == *id) {
            desired_indices.push(index);
        }
    }
    let desired_id_list = desired_indices
        .iter()
        .map(|index| found[*index].id.clone())
        .collect::<Vec<_>>();
    let desired_index_set = desired_indices.iter().copied().collect::<BTreeSet<_>>();
    let current_indices = found
        .iter()
        .enumerate()
        .filter_map(|(index, manifest)| manifest.enabled.then_some(index))
        .collect::<Vec<_>>();
    let affected_indices = current_indices
        .iter()
        .copied()
        .chain(desired_indices.iter().copied())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    if affected_indices
        .iter()
        .any(|index| found[*index].schema_version < 2)
    {
        return Err(
            "Legacy deployments must be removed and reinstalled before profiles can be switched."
                .to_string(),
        );
    }
    let (transaction, paths, present, ids) =
        snapshot_layers(&install, &storage, &found, &affected_indices, "profile")?;
    let previous_state = state.clone();
    let was_purged = state.purged;
    let operation = (|| -> Result<(), String> {
        if !was_purged {
            for index in current_indices.iter().rev() {
                deactivate_layer(&install, &storage.join(&found[*index].id), &found[*index])?;
            }
        }
        for index in &affected_indices {
            found[*index].enabled = false;
        }
        for (rank, index) in desired_indices.iter().enumerate() {
            found[*index].enabled = true;
            found[*index].priority_order = u64::try_from(rank + 1).unwrap_or(u64::MAX);
            if !was_purged {
                activate_layer(
                    &install,
                    &storage.join(&found[*index].id),
                    &mut found[*index],
                )?;
            }
        }
        for index in &affected_indices {
            write_manifest(&storage.join(&found[*index].id), &found[*index])?;
        }
        state.active_profile_id = requested.to_string();
        state.profiles[target_position].enabled_mod_ids = desired_id_list.clone();
        write_library_state(&storage, &state)
    })();
    if let Err(error) = operation {
        restore_toggle_transaction(&install, &storage, &transaction, &paths, &present, &ids);
        let _ = write_library_state(&storage, &previous_state);
        let _ = fs::remove_dir_all(&transaction);
        return Err(format!(
            "Profile activation failed and GameAtlas restored the previous setup: {error}"
        ));
    }
    let _ = fs::remove_dir_all(&transaction);
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: Some(requested.to_string()),
        files_changed: if was_purged { 0 } else { paths.len() },
        bytes_changed: desired_index_set
            .iter()
            .flat_map(|index| &found[*index].files)
            .map(|file| file.size_bytes)
            .sum(),
        message: if was_purged {
            format!(
                "Activated the {} profile. Its mod setup will be applied when the library is redeployed.",
                target.name
            )
        } else {
            format!(
                "Activated the {} profile with {} enabled mod{} in saved priority order.",
                target.name,
                desired_indices.len(),
                if desired_indices.len() == 1 { "" } else { "s" }
            )
        },
    })
}

#[cfg(target_os = "linux")]
fn snapshot_layers(
    install: &Path,
    storage: &Path,
    manifests: &[DeploymentManifest],
    indices: &[usize],
    label: &str,
) -> Result<(PathBuf, BTreeSet<String>, BTreeSet<String>, Vec<String>), String> {
    let transaction = storage.join(format!(".{label}-{}", deployment_id()));
    fs::create_dir_all(transaction.join("game"))
        .map_err(|error| format!("Could not create the {label} transaction: {error}"))?;
    let mut paths = BTreeSet::new();
    let mut present = BTreeSet::new();
    let mut ids = Vec::new();
    let result = (|| -> Result<(), String> {
        for index in indices {
            let manifest = &manifests[*index];
            ids.push(manifest.id.clone());
            let layer_snapshot = transaction.join("layers").join(&manifest.id);
            fs::create_dir_all(&layer_snapshot)
                .map_err(|error| format!("Could not create layer snapshot storage: {error}"))?;
            fs::copy(
                storage.join(&manifest.id).join("manifest.json"),
                layer_snapshot.join("manifest.json"),
            )
            .map_err(|error| format!("Could not snapshot a mod manifest: {error}"))?;
            copy_directory_files(
                &storage.join(&manifest.id).join("backup"),
                &layer_snapshot.join("backup"),
            )?;
            for file in &manifest.files {
                paths.insert(file.relative_path.clone());
            }
        }
        for relative_text in &paths {
            let relative = PathBuf::from(relative_text);
            safe_relative_text(&relative)?;
            let destination = resolve_destination(install, &relative)?;
            if destination.is_file() {
                present.insert(relative_text.clone());
                let snapshot = transaction.join("game").join(&relative);
                if let Some(parent) = snapshot.parent() {
                    fs::create_dir_all(parent).map_err(|error| {
                        format!("Could not create game snapshot storage: {error}")
                    })?;
                }
                fs::copy(&destination, snapshot).map_err(|error| {
                    format!("Could not snapshot {}: {error}", destination.display())
                })?;
            } else if destination.exists() {
                return Err(format!(
                    "A managed destination is no longer a regular file: {}",
                    destination.display()
                ));
            }
        }
        Ok(())
    })();
    if let Err(error) = result {
        let _ = fs::remove_dir_all(&transaction);
        return Err(error);
    }
    Ok((transaction, paths, present, ids))
}

#[cfg(target_os = "linux")]
fn verify_library_at(
    storage: &Path,
    install: &Path,
) -> Result<ModLibraryVerificationReport, String> {
    let found = manifests(storage, install)?;
    let state = read_library_state(storage)?;
    let mut findings = Vec::new();
    let mut payload_files_checked = 0_usize;
    let mut deployed_files_checked = 0_usize;
    let mut winners = BTreeMap::<String, (usize, usize)>::new();

    for (manifest_index, manifest) in found.iter().enumerate() {
        if manifest.schema_version < 2 {
            findings.push(ModLibraryFinding {
                kind: "legacy".to_string(),
                relative_path: String::new(),
                mod_name: manifest.name.clone(),
                detail: "Reinstall this legacy deployment to make it verifiable and repairable."
                    .to_string(),
                repairable: false,
            });
            continue;
        }
        for (file_index, file) in manifest.files.iter().enumerate() {
            payload_files_checked += 1;
            let relative = PathBuf::from(&file.relative_path);
            safe_relative_text(&relative)?;
            let payload = storage.join(&manifest.id).join("payload").join(&relative);
            let payload_valid = is_safe_regular_file(&payload)
                && file_sha256(&payload)
                    .map(|hash| hash == file.deployed_sha256)
                    .unwrap_or(false);
            if !payload_valid {
                findings.push(ModLibraryFinding {
                    kind: "payload".to_string(),
                    relative_path: file.relative_path.clone(),
                    mod_name: manifest.name.clone(),
                    detail: "The preserved mod payload is missing or changed; reinstall the mod."
                        .to_string(),
                    repairable: false,
                });
            }
            if manifest.enabled {
                winners.insert(
                    file.relative_path.to_ascii_lowercase(),
                    (manifest_index, file_index),
                );
                if !state.purged && file.had_original {
                    let backup = storage.join(&manifest.id).join("backup").join(&relative);
                    if !is_safe_regular_file(&backup) {
                        findings.push(ModLibraryFinding {
                            kind: "backup".to_string(),
                            relative_path: file.relative_path.clone(),
                            mod_name: manifest.name.clone(),
                            detail:
                                "A required rollback backup is missing; redeployment is unsafe."
                                    .to_string(),
                            repairable: false,
                        });
                    }
                }
            }
        }
    }

    if !state.purged {
        for (_, (manifest_index, file_index)) in winners {
            let manifest = &found[manifest_index];
            let file = &manifest.files[file_index];
            deployed_files_checked += 1;
            let relative = PathBuf::from(&file.relative_path);
            let destination = resolve_destination(install, &relative)?;
            let valid = destination.is_file()
                && file_sha256(&destination)
                    .map(|hash| hash == file.deployed_sha256)
                    .unwrap_or(false);
            if !valid {
                let payload = storage.join(&manifest.id).join("payload").join(&relative);
                let repairable = is_safe_regular_file(&payload)
                    && file_sha256(&payload)
                        .map(|hash| hash == file.deployed_sha256)
                        .unwrap_or(false);
                findings.push(ModLibraryFinding {
                    kind: "deployment".to_string(),
                    relative_path: file.relative_path.clone(),
                    mod_name: manifest.name.clone(),
                    detail: if destination.exists() {
                        "The deployed winning file was changed outside GameAtlas.".to_string()
                    } else {
                        "The deployed winning file is missing.".to_string()
                    },
                    repairable,
                });
            }
        }
    }
    let repairable_count = findings.iter().filter(|finding| finding.repairable).count();
    let healthy = findings.is_empty();
    Ok(ModLibraryVerificationReport {
        healthy,
        purged: state.purged,
        mods_checked: found.len(),
        payload_files_checked,
        deployed_files_checked,
        repairable_count,
        summary: if healthy {
            if state.purged {
                "The managed payloads are healthy. Game files are currently purged.".to_string()
            } else {
                "Managed payloads, backups, and winning deployed files passed verification."
                    .to_string()
            }
        } else {
            format!(
                "Found {} mod library issue{}; {} can be repaired automatically.",
                findings.len(),
                if findings.len() == 1 { "" } else { "s" },
                repairable_count
            )
        },
        findings,
    })
}

#[cfg(target_os = "linux")]
fn purge_library_for(
    app: &tauri::AppHandle,
    install_path: &str,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let found = manifests(&storage, &install)?;
    let state = read_library_state(&storage)?;
    if state.purged {
        return Ok(ModDeploymentActionResult {
            success: true,
            deployment_id: None,
            files_changed: 0,
            bytes_changed: 0,
            message: "The mod library is already purged.".to_string(),
        });
    }
    let indices = found
        .iter()
        .enumerate()
        .filter_map(|(index, manifest)| manifest.enabled.then_some(index))
        .collect::<Vec<_>>();
    if indices.iter().any(|index| found[*index].schema_version < 2) {
        return Err("Reinstall legacy deployments before purging the managed library.".to_string());
    }
    let (transaction, paths, present, ids) =
        snapshot_layers(&install, &storage, &found, &indices, "purge")?;
    let operation = (|| -> Result<(), String> {
        for index in indices.iter().rev() {
            deactivate_layer(&install, &storage.join(&found[*index].id), &found[*index])?;
        }
        let mut next_state = state.clone();
        next_state.purged = true;
        write_library_state(&storage, &next_state)
    })();
    if let Err(error) = operation {
        restore_toggle_transaction(&install, &storage, &transaction, &paths, &present, &ids);
        let _ = write_library_state(&storage, &state);
        let _ = fs::remove_dir_all(&transaction);
        return Err(format!(
            "Purge failed and the deployment was restored: {error}"
        ));
    }
    let _ = fs::remove_dir_all(&transaction);
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: None,
        files_changed: paths.len(),
        bytes_changed: 0,
        message: format!(
            "Purged {} managed file{}. Enabled selections and payloads were preserved.",
            paths.len(),
            if paths.len() == 1 { "" } else { "s" }
        ),
    })
}

#[cfg(target_os = "linux")]
fn redeploy_library_for(
    app: &tauri::AppHandle,
    install_path: &str,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let mut found = manifests(&storage, &install)?;
    let state = read_library_state(&storage)?;
    let indices = found
        .iter()
        .enumerate()
        .filter_map(|(index, manifest)| manifest.enabled.then_some(index))
        .collect::<Vec<_>>();
    if indices.iter().any(|index| found[*index].schema_version < 2) {
        return Err(
            "Reinstall legacy deployments before redeploying the managed library.".to_string(),
        );
    }
    let (transaction, paths, present, ids) =
        snapshot_layers(&install, &storage, &found, &indices, "redeploy")?;
    let operation = (|| -> Result<(), String> {
        if !state.purged {
            for index in indices.iter().rev() {
                deactivate_layer(&install, &storage.join(&found[*index].id), &found[*index])?;
            }
        }
        for index in &indices {
            let id = found[*index].id.clone();
            activate_layer(&install, &storage.join(id), &mut found[*index])?;
        }
        for index in &indices {
            write_manifest(&storage.join(&found[*index].id), &found[*index])?;
        }
        let mut next_state = state.clone();
        next_state.purged = false;
        write_library_state(&storage, &next_state)
    })();
    if let Err(error) = operation {
        restore_toggle_transaction(&install, &storage, &transaction, &paths, &present, &ids);
        let _ = write_library_state(&storage, &state);
        let _ = fs::remove_dir_all(&transaction);
        return Err(format!(
            "Redeploy failed and the previous state was restored: {error}"
        ));
    }
    let _ = fs::remove_dir_all(&transaction);
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: None,
        files_changed: paths.len(),
        bytes_changed: found
            .iter()
            .filter(|manifest| manifest.enabled)
            .flat_map(|manifest| &manifest.files)
            .map(|file| file.size_bytes)
            .sum(),
        message: format!(
            "Redeployed {} enabled mod{} in priority order.",
            indices.len(),
            if indices.len() == 1 { "" } else { "s" }
        ),
    })
}

#[cfg(target_os = "linux")]
fn repair_library_for(
    app: &tauri::AppHandle,
    install_path: &str,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let report = verify_library_at(&storage, &install)?;
    if report.purged {
        return Err("Redeploy the library before repairing deployed files.".to_string());
    }
    let repair_paths = report
        .findings
        .iter()
        .filter(|finding| finding.repairable && finding.kind == "deployment")
        .map(|finding| finding.relative_path.clone())
        .collect::<BTreeSet<_>>();
    if repair_paths.is_empty() {
        return Ok(ModDeploymentActionResult {
            success: report.healthy,
            deployment_id: None,
            files_changed: 0,
            bytes_changed: 0,
            message: if report.healthy {
                "No repairs are needed.".to_string()
            } else {
                "No issue can be repaired automatically. Reinstall the affected mods.".to_string()
            },
        });
    }

    let found = manifests(&storage, &install)?;
    let mut winners = BTreeMap::<String, (usize, usize)>::new();
    for (manifest_index, manifest) in found.iter().enumerate().filter(|(_, item)| item.enabled) {
        for (file_index, file) in manifest.files.iter().enumerate() {
            winners.insert(
                file.relative_path.to_ascii_lowercase(),
                (manifest_index, file_index),
            );
        }
    }
    let transaction = storage.join(format!(".repair-{}", deployment_id()));
    fs::create_dir_all(transaction.join("game"))
        .map_err(|error| format!("Could not create the repair transaction: {error}"))?;
    let mut present = BTreeSet::new();
    for relative_text in &repair_paths {
        let relative = PathBuf::from(relative_text);
        let destination = resolve_destination(&install, &relative)?;
        if destination.is_file() {
            present.insert(relative_text.clone());
            let snapshot = transaction.join("game").join(&relative);
            if let Some(parent) = snapshot.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!("Could not create repair snapshot storage: {error}")
                })?;
            }
            fs::copy(&destination, snapshot).map_err(|error| {
                format!("Could not snapshot {}: {error}", destination.display())
            })?;
        }
    }

    let operation = (|| -> Result<u64, String> {
        let mut bytes = 0_u64;
        for relative_text in &repair_paths {
            let (manifest_index, file_index) = winners
                .get(&relative_text.to_ascii_lowercase())
                .copied()
                .ok_or_else(|| format!("No winning mod owns {relative_text}."))?;
            let manifest = &found[manifest_index];
            let file = &manifest.files[file_index];
            let relative = PathBuf::from(relative_text);
            let payload = storage.join(&manifest.id).join("payload").join(&relative);
            let destination = resolve_destination(&install, &relative)?;
            let temporary = destination
                .parent()
                .unwrap_or(&install)
                .join(format!(".gameatlas-repair-{file_index}.tmp"));
            copy_atomic(&payload, &destination, &temporary)?;
            bytes = bytes.saturating_add(file.size_bytes);
        }
        Ok(bytes)
    })();
    let bytes = match operation {
        Ok(bytes) => bytes,
        Err(error) => {
            restore_toggle_transaction(
                &install,
                &storage,
                &transaction,
                &repair_paths,
                &present,
                &[],
            );
            let _ = fs::remove_dir_all(&transaction);
            return Err(format!(
                "Repair failed and changed files were restored: {error}"
            ));
        }
    };
    let _ = fs::remove_dir_all(&transaction);
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: None,
        files_changed: repair_paths.len(),
        bytes_changed: bytes,
        message: format!(
            "Repaired {} winning deployed file{} from preserved payloads.",
            repair_paths.len(),
            if repair_paths.len() == 1 { "" } else { "s" }
        ),
    })
}

#[cfg(target_os = "linux")]
fn remove_for(
    app: &tauri::AppHandle,
    request: RemoveDeploymentRequest,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(&request.install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let found = manifests(&storage, &install)?;
    let library_state = read_library_state(&storage)?;
    let requested = validate_deployment_id(&request.deployment_id)?;
    let selected = found
        .iter()
        .find(|manifest| manifest.id == requested)
        .ok_or_else(|| "The selected managed mod no longer exists.".to_string())?;
    if !selected.enabled || library_state.purged {
        fs::remove_dir_all(storage.join(requested)).map_err(|error| {
            format!("Could not remove the disabled mod from the library: {error}")
        })?;
        remove_mod_from_profiles(&storage, requested)?;
        if found.len() == 1 {
            let mut next_state = read_library_state(&storage)?;
            next_state.purged = false;
            write_library_state(&storage, &next_state)?;
        }
        return Ok(ModDeploymentActionResult {
            success: true,
            deployment_id: Some(requested.to_string()),
            files_changed: 0,
            bytes_changed: selected.files.iter().map(|file| file.size_bytes).sum(),
            message: format!("Removed {} from the managed mod library.", selected.name),
        });
    }
    let Some(latest) = found.iter().rev().find(|manifest| manifest.enabled) else {
        return Err("No enabled managed deployment is available to remove.".to_string());
    };
    if latest.id != requested {
        return Err(
            "Disable this mod first, or remove enabled mods in reverse priority order.".to_string(),
        );
    }
    let deployment_directory = storage.join(requested);
    let backup_root = deployment_directory.join("backup");

    for file in &latest.files {
        let relative = PathBuf::from(&file.relative_path);
        safe_relative_text(&relative)?;
        let destination = resolve_destination(&install, &relative)?;
        if destination.exists() {
            if !destination.is_file() || file_sha256(&destination)? != file.deployed_sha256 {
                return Err(format!(
                    "{} changed after deployment. Removal was stopped so the newer file is not overwritten.",
                    file.relative_path
                ));
            }
        }
        if file.had_original {
            let backup = backup_root.join(&relative);
            let valid_backup = fs::symlink_metadata(&backup)
                .map(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
                .unwrap_or(false);
            if !valid_backup {
                return Err(format!(
                    "The backup for {} is missing or unsafe. Removal was stopped.",
                    file.relative_path
                ));
            }
        }
    }

    let staging = deployment_directory.join("uninstall-staging");
    if staging.exists() {
        fs::remove_dir_all(&staging)
            .map_err(|error| format!("Could not reset uninstall staging: {error}"))?;
    }
    fs::create_dir_all(&staging)
        .map_err(|error| format!("Could not create uninstall staging: {error}"))?;
    let mut staged = BTreeSet::new();
    for file in &latest.files {
        let relative = PathBuf::from(&file.relative_path);
        let destination = install.join(&relative);
        if destination.is_file() {
            let staged_path = staging.join(&relative);
            if let Some(parent) = staged_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Could not prepare uninstall staging: {error}"))?;
            }
            fs::copy(&destination, &staged_path)
                .map_err(|error| format!("Could not stage {}: {error}", destination.display()))?;
            staged.insert(file.relative_path.clone());
        }
    }

    let manifest_path = deployment_directory.join("manifest.json");
    let removing_manifest_path = deployment_directory.join("manifest.removing.json");
    fs::rename(&manifest_path, &removing_manifest_path)
        .map_err(|error| format!("Could not begin the managed removal transaction: {error}"))?;

    let mut changed = Vec::new();
    let apply = (|| -> Result<(), String> {
        for (index, file) in latest.files.iter().enumerate().rev() {
            let relative = PathBuf::from(&file.relative_path);
            let destination = install.join(&relative);
            if file.had_original {
                let backup = backup_root.join(&relative);
                let temporary = destination
                    .parent()
                    .unwrap_or(&install)
                    .join(format!(".gameatlas-uninstall-{requested}-{index}.tmp"));
                copy_atomic(&backup, &destination, &temporary)?;
            } else if destination.exists() {
                fs::remove_file(&destination).map_err(|error| {
                    format!("Could not remove {}: {error}", destination.display())
                })?;
                remove_empty_parents(&destination, &install);
            }
            changed.push(file.relative_path.clone());
        }
        Ok(())
    })();

    if let Err(error) = apply {
        for file in &latest.files {
            let relative = PathBuf::from(&file.relative_path);
            let destination = install.join(&relative);
            if staged.contains(&file.relative_path) {
                let staged_path = staging.join(&relative);
                if let Some(parent) = destination.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::copy(staged_path, destination);
            } else if destination.is_file() {
                let _ = fs::remove_file(destination);
            }
        }
        let _ = fs::remove_dir_all(&staging);
        let _ = fs::rename(&removing_manifest_path, &manifest_path);
        return Err(format!(
            "Removal failed and GameAtlas attempted to roll it back: {error}"
        ));
    }

    let cleanup_warning = fs::remove_dir_all(&deployment_directory)
        .err()
        .map(|error| format!(" Backup cleanup can be retried later: {error}"))
        .unwrap_or_default();
    remove_mod_from_profiles(&storage, requested)?;
    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: Some(requested.to_string()),
        files_changed: changed.len(),
        bytes_changed: latest.files.iter().map(|file| file.size_bytes).sum(),
        message: format!(
            "Removed {} and restored {} overwritten file{}.{}",
            latest.name,
            latest.files.iter().filter(|file| file.had_original).count(),
            if latest.files.iter().filter(|file| file.had_original).count() == 1 {
                ""
            } else {
                "s"
            },
            cleanup_warning
        ),
    })
}

#[tauri::command]
pub fn get_linux_mod_deployment_status(
    app: tauri::AppHandle,
    install_path: String,
    game_name: String,
) -> Result<ModDeploymentStatus, String> {
    #[cfg(target_os = "linux")]
    {
        return status_for(&app, &install_path, &game_name);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, install_path, game_name);
        Ok(ModDeploymentStatus {
            supported: false,
            rar_supported: false,
            rar_provider: String::new(),
            install_path: String::new(),
            storage_path: String::new(),
            staging_path: String::new(),
            staged_items: Vec::new(),
            deployments: Vec::new(),
            conflicts: Vec::new(),
            total_conflict_count: 0,
            purged: false,
            profiles: Vec::new(),
            active_profile_id: String::new(),
            summary: "Use Vortex for managed mod deployment on Windows.".to_string(),
        })
    }
}

#[tauri::command]
pub fn pick_linux_mod_source(
    app: tauri::AppHandle,
    install_path: String,
    game_name: String,
) -> Result<Option<ModDeploymentPreview>, String> {
    #[cfg(target_os = "linux")]
    {
        let staging = staging_directory(&game_name)?;
        let picked = rfd::FileDialog::new()
            .set_title("Select extracted mod payload folder")
            .set_directory(staging)
            .pick_folder();
        return picked
            .map(|path| preview_for(&app, &install_path, &path.to_string_lossy()))
            .transpose();
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, install_path, game_name);
        Err("Linux Mod Deployment Manager is available only on Linux.".to_string())
    }
}

#[tauri::command]
pub fn prepare_linux_staged_mod(
    app: tauri::AppHandle,
    install_path: String,
    game_name: String,
    item_path: String,
) -> Result<ModDeploymentPreview, String> {
    #[cfg(target_os = "linux")]
    {
        return prepare_staged_for(&app, &install_path, &game_name, &item_path);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, install_path, game_name, item_path);
        Err("Linux Mod Deployment Manager is available only on Linux.".to_string())
    }
}

#[tauri::command]
pub fn deploy_linux_mod(
    app: tauri::AppHandle,
    request: DeployModRequest,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return deploy_for(&app, request);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, request);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn set_linux_mod_enabled(
    app: tauri::AppHandle,
    request: SetDeploymentEnabledRequest,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return set_enabled_for(&app, request);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, request);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn move_linux_mod_priority(
    app: tauri::AppHandle,
    request: MoveDeploymentPriorityRequest,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return move_priority_for(&app, request);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, request);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn update_linux_mod_metadata(
    app: tauri::AppHandle,
    request: UpdateModMetadataRequest,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return update_metadata_for(&app, request);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, request);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn upgrade_linux_mod(
    app: tauri::AppHandle,
    request: UpgradeModRequest,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return upgrade_mod_for(&app, request);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, request);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn create_linux_mod_profile(
    app: tauri::AppHandle,
    request: NamedModProfileRequest,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return create_profile_for(&app, request);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, request);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn rename_linux_mod_profile(
    app: tauri::AppHandle,
    request: NamedModProfileRequest,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return rename_profile_for(&app, request);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, request);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn delete_linux_mod_profile(
    app: tauri::AppHandle,
    request: ModProfileRequest,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return delete_profile_for(&app, request);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, request);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn activate_linux_mod_profile(
    app: tauri::AppHandle,
    request: ModProfileRequest,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return activate_profile_for(&app, request);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, request);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn verify_linux_mod_library(
    app: tauri::AppHandle,
    install_path: String,
) -> Result<ModLibraryVerificationReport, String> {
    #[cfg(target_os = "linux")]
    {
        let install = canonical_directory(&install_path, "game installation")?;
        validate_install_root(&install)?;
        let storage = game_storage_root(&app, &install)?;
        return verify_library_at(&storage, &install);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, install_path);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn purge_linux_mod_library(
    app: tauri::AppHandle,
    install_path: String,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return purge_library_for(&app, &install_path);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, install_path);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn redeploy_linux_mod_library(
    app: tauri::AppHandle,
    install_path: String,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return redeploy_library_for(&app, &install_path);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, install_path);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn repair_linux_mod_library(
    app: tauri::AppHandle,
    install_path: String,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return repair_library_for(&app, &install_path);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, install_path);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[tauri::command]
pub fn remove_linux_mod_deployment(
    app: tauri::AppHandle,
    request: RemoveDeploymentRequest,
) -> Result<ModDeploymentActionResult, String> {
    #[cfg(target_os = "linux")]
    {
        return remove_for(&app, request);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, request);
        Err("Use Vortex for managed mod deployment on Windows.".to_string())
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::{
        activate_layer, deactivate_layer, deployment_id, deployment_plan, file_sha256,
        profile_mod_ids, safe_relative_text, validate_deployment_id, validate_rar_listing,
        verify_library_at, write_library_state, write_manifest, DeploymentManifest, LsarEntry,
        LsarListing, ManifestFile, ModLibraryState, SourceFile, MAX_TOTAL_BYTES,
    };
    use serde_json::json;
    use std::{collections::BTreeMap, fs, path::Path};

    fn rar_entry(name: &str, size: u64) -> LsarEntry {
        LsarEntry {
            file_name: name.to_string(),
            properties: BTreeMap::from([("XADFileSize".to_string(), json!(size))]),
        }
    }

    #[test]
    fn rejects_parent_relative_paths() {
        assert!(safe_relative_text(Path::new("../outside.dll")).is_err());
        assert!(safe_relative_text(Path::new("mods/example.dll")).is_ok());
    }

    #[test]
    fn validates_generated_deployment_ids() {
        assert!(validate_deployment_id("1700000000-123-4567").is_ok());
        assert!(validate_deployment_id("../manifest").is_err());
    }

    #[test]
    fn validates_safe_rar_metadata() {
        let listing = LsarListing {
            contents: vec![rar_entry("bin/mod.dll", 42)],
        };
        assert!(validate_rar_listing(&listing).is_ok());
    }

    #[test]
    fn rejects_unsafe_rar_metadata() {
        let traversal = LsarListing {
            contents: vec![rar_entry("../outside.dll", 42)],
        };
        assert!(validate_rar_listing(&traversal).is_err());

        let mut encrypted = rar_entry("bin/mod.dll", 42);
        encrypted
            .properties
            .insert("XADIsEncrypted".to_string(), json!(1));
        assert!(validate_rar_listing(&LsarListing {
            contents: vec![encrypted],
        })
        .is_err());

        let oversized = LsarListing {
            contents: vec![rar_entry("bin/huge.bin", MAX_TOTAL_BYTES + 1)],
        };
        assert!(validate_rar_listing(&oversized).is_err());
    }

    #[test]
    fn routes_loose_unreal_packages_to_mods_directory() {
        let root = std::env::temp_dir().join(format!("gameatlas-pak-test-{}", deployment_id()));
        let install = root.join("HighOnLife");
        fs::create_dir_all(install.join("Oregon/Content/Paks")).unwrap();
        fs::create_dir_all(install.join("Engine/Programs/CrashReportClient/Content/Paks")).unwrap();
        let source = root.join("Health_P.pak");
        fs::write(&source, b"test").unwrap();
        let plan = deployment_plan(
            &install,
            vec![SourceFile {
                source,
                relative: "Health_P.pak".into(),
                relative_text: "Health_P.pak".to_string(),
                size_bytes: 4,
            }],
        )
        .unwrap();

        assert_eq!(plan.mode, "Unreal PAK mod");
        assert_eq!(plan.destination_root, "Oregon/Content/Paks/~mods");
        assert_eq!(
            plan.files[0].relative_text,
            "Oregon/Content/Paks/~mods/Health_P.pak"
        );
        fs::remove_dir_all(root).unwrap();
    }

    fn test_manifest(id: &str, deployed_sha256: String) -> DeploymentManifest {
        DeploymentManifest {
            schema_version: 2,
            id: id.to_string(),
            name: id.to_string(),
            install_path: String::new(),
            source_path: String::new(),
            deployed_unix: 1,
            priority_order: 1_000,
            enabled: true,
            version: String::new(),
            author: String::new(),
            website: String::new(),
            notes: String::new(),
            updated_unix: 1,
            files: vec![ManifestFile {
                relative_path: "shared.txt".to_string(),
                size_bytes: 3,
                deployed_sha256,
                had_original: true,
            }],
        }
    }

    #[test]
    fn profile_snapshot_preserves_enabled_priority_order() {
        let first = test_manifest("low-priority", String::new());
        let mut disabled = test_manifest("disabled", String::new());
        disabled.enabled = false;
        let mut last = test_manifest("high-priority", String::new());
        last.priority_order = 2_000;

        assert_eq!(
            profile_mod_ids(&[first, disabled, last]),
            vec!["low-priority".to_string(), "high-priority".to_string()]
        );
    }

    #[test]
    fn existing_manifests_receive_empty_metadata_defaults() {
        let manifest: DeploymentManifest = serde_json::from_value(json!({
            "schema_version": 2,
            "id": "mod-one",
            "name": "Mod One",
            "install_path": "/game",
            "source_path": "/mods/mod-one",
            "deployed_unix": 1,
            "priority_order": 1000,
            "enabled": true,
            "files": []
        }))
        .unwrap();

        assert!(manifest.version.is_empty());
        assert!(manifest.author.is_empty());
        assert!(manifest.website.is_empty());
        assert!(manifest.notes.is_empty());
        assert_eq!(manifest.updated_unix, 0);
    }

    #[test]
    fn managed_layer_can_be_disabled_and_enabled_without_source_folder() {
        let root = std::env::temp_dir().join(format!("gameatlas-library-test-{}", deployment_id()));
        let install = root.join("game");
        let deployment = root.join("library/mod-one");
        fs::create_dir_all(deployment.join("payload")).unwrap();
        fs::create_dir_all(deployment.join("backup")).unwrap();
        fs::create_dir_all(&install).unwrap();
        fs::write(install.join("shared.txt"), b"mod").unwrap();
        fs::write(deployment.join("payload/shared.txt"), b"mod").unwrap();
        fs::write(deployment.join("backup/shared.txt"), b"base").unwrap();
        let mut manifest =
            test_manifest("mod-one", file_sha256(&install.join("shared.txt")).unwrap());

        deactivate_layer(&install, &deployment, &manifest).unwrap();
        assert_eq!(fs::read(install.join("shared.txt")).unwrap(), b"base");

        activate_layer(&install, &deployment, &mut manifest).unwrap();
        assert_eq!(fs::read(install.join("shared.txt")).unwrap(), b"mod");
        assert_eq!(
            fs::read(deployment.join("backup/shared.txt")).unwrap(),
            b"base"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn later_layer_survives_disabling_an_overlapped_lower_layer() {
        let root = std::env::temp_dir().join(format!("gameatlas-relayer-test-{}", deployment_id()));
        let install = root.join("game");
        let first = root.join("library/mod-one");
        let second = root.join("library/mod-two");
        for directory in [&first, &second] {
            fs::create_dir_all(directory.join("payload")).unwrap();
            fs::create_dir_all(directory.join("backup")).unwrap();
        }
        fs::create_dir_all(&install).unwrap();
        fs::write(install.join("shared.txt"), b"two").unwrap();
        fs::write(first.join("payload/shared.txt"), b"one").unwrap();
        fs::write(first.join("backup/shared.txt"), b"base").unwrap();
        fs::write(second.join("payload/shared.txt"), b"two").unwrap();
        fs::write(second.join("backup/shared.txt"), b"one").unwrap();
        let first_hash = file_sha256(&first.join("payload/shared.txt")).unwrap();
        let second_hash = file_sha256(&second.join("payload/shared.txt")).unwrap();
        let first_manifest = test_manifest("mod-one", first_hash);
        let mut second_manifest = test_manifest("mod-two", second_hash);

        deactivate_layer(&install, &second, &second_manifest).unwrap();
        deactivate_layer(&install, &first, &first_manifest).unwrap();
        activate_layer(&install, &second, &mut second_manifest).unwrap();

        assert_eq!(fs::read(install.join("shared.txt")).unwrap(), b"two");
        assert_eq!(fs::read(second.join("backup/shared.txt")).unwrap(), b"base");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn overlapping_layers_can_be_reapplied_in_reverse_priority() {
        let root =
            std::env::temp_dir().join(format!("gameatlas-priority-test-{}", deployment_id()));
        let install = root.join("game");
        let first = root.join("library/mod-one");
        let second = root.join("library/mod-two");
        for directory in [&first, &second] {
            fs::create_dir_all(directory.join("payload")).unwrap();
            fs::create_dir_all(directory.join("backup")).unwrap();
        }
        fs::create_dir_all(&install).unwrap();
        fs::write(install.join("shared.txt"), b"two").unwrap();
        fs::write(first.join("payload/shared.txt"), b"one").unwrap();
        fs::write(first.join("backup/shared.txt"), b"base").unwrap();
        fs::write(second.join("payload/shared.txt"), b"two").unwrap();
        fs::write(second.join("backup/shared.txt"), b"one").unwrap();
        let mut first_manifest = test_manifest(
            "mod-one",
            file_sha256(&first.join("payload/shared.txt")).unwrap(),
        );
        let mut second_manifest = test_manifest(
            "mod-two",
            file_sha256(&second.join("payload/shared.txt")).unwrap(),
        );

        deactivate_layer(&install, &second, &second_manifest).unwrap();
        deactivate_layer(&install, &first, &first_manifest).unwrap();
        activate_layer(&install, &second, &mut second_manifest).unwrap();
        activate_layer(&install, &first, &mut first_manifest).unwrap();

        assert_eq!(fs::read(install.join("shared.txt")).unwrap(), b"one");
        assert_eq!(fs::read(first.join("backup/shared.txt")).unwrap(), b"two");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn verification_detects_and_classifies_repairable_winner_damage() {
        let root = std::env::temp_dir().join(format!("gameatlas-verify-test-{}", deployment_id()));
        let install = root.join("game");
        let storage = root.join("library");
        let deployment = storage.join("mod-one");
        fs::create_dir_all(deployment.join("payload")).unwrap();
        fs::create_dir_all(deployment.join("backup")).unwrap();
        fs::create_dir_all(&install).unwrap();
        fs::write(install.join("shared.txt"), b"mod").unwrap();
        fs::write(deployment.join("payload/shared.txt"), b"mod").unwrap();
        fs::write(deployment.join("backup/shared.txt"), b"base").unwrap();
        let mut manifest = test_manifest(
            "mod-one",
            file_sha256(&deployment.join("payload/shared.txt")).unwrap(),
        );
        manifest.install_path = install.to_string_lossy().to_string();
        write_manifest(&deployment, &manifest).unwrap();
        write_library_state(
            &storage,
            &ModLibraryState {
                schema_version: 1,
                purged: false,
                active_profile_id: String::new(),
                profiles: Vec::new(),
            },
        )
        .unwrap();

        let healthy = verify_library_at(&storage, &install).unwrap();
        assert!(healthy.healthy);
        fs::write(install.join("shared.txt"), b"changed").unwrap();
        let damaged = verify_library_at(&storage, &install).unwrap();
        assert!(!damaged.healthy);
        assert_eq!(damaged.repairable_count, 1);
        assert_eq!(damaged.findings[0].kind, "deployment");
        fs::remove_dir_all(root).unwrap();
    }
}
