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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModDeploymentActionResult {
    pub success: bool,
    pub deployment_id: Option<String>,
    pub files_changed: usize,
    pub bytes_changed: u64,
    pub message: String,
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
    files: Vec<ManifestFile>,
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
    if manifest.schema_version != 1 || manifest.id != directory_id {
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
        left.deployed_unix
            .cmp(&right.deployed_unix)
            .then_with(|| left.id.cmp(&right.id))
    });
    Ok(result)
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
    let latest = found.last().map(|manifest| manifest.id.as_str());
    let deployments = found
        .iter()
        .rev()
        .map(|manifest| ManagedModDeployment {
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
            can_remove: latest == Some(manifest.id.as_str()),
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
        summary: if deployments.is_empty() {
            "No GameAtlas-managed mods are deployed for this game.".to_string()
        } else {
            format!(
                "{} GameAtlas-managed mod{} deployed. Remove mods in reverse deployment order.",
                deployments.len(),
                if deployments.len() == 1 {
                    " is"
                } else {
                    "s are"
                }
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
    fs::create_dir_all(&storage)
        .map_err(|error| format!("Could not create deployment storage: {error}"))?;
    let id = deployment_id();
    let deployment_directory = storage.join(&id);
    let backup_root = deployment_directory.join("backup");
    fs::create_dir_all(&backup_root)
        .map_err(|error| format!("Could not create deployment backup storage: {error}"))?;
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

    let manifest = DeploymentManifest {
        schema_version: 1,
        id: id.clone(),
        name,
        install_path: install.to_string_lossy().to_string(),
        source_path: source.to_string_lossy().to_string(),
        deployed_unix: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
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

    Ok(ModDeploymentActionResult {
        success: true,
        deployment_id: Some(id),
        files_changed: manifest.files.len(),
        bytes_changed: manifest.files.iter().map(|file| file.size_bytes).sum(),
        message: format!(
            "Deployed {} file{} using {} and saved a reversible manifest.",
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
fn remove_for(
    app: &tauri::AppHandle,
    request: RemoveDeploymentRequest,
) -> Result<ModDeploymentActionResult, String> {
    let install = canonical_directory(&request.install_path, "game installation")?;
    validate_install_root(&install)?;
    let storage = game_storage_root(app, &install)?;
    let found = manifests(&storage, &install)?;
    let Some(latest) = found.last() else {
        return Err("No managed deployment is available to remove.".to_string());
    };
    let requested = validate_deployment_id(&request.deployment_id)?;
    if latest.id != requested {
        return Err(
            "Mods must be removed in reverse deployment order. Remove the newest mod first."
                .to_string(),
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
        deployment_id, deployment_plan, safe_relative_text, validate_deployment_id,
        validate_rar_listing, LsarEntry, LsarListing, SourceFile, MAX_TOTAL_BYTES,
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
}
