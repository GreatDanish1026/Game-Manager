use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

const MAX_SCAN_DEPTH: usize = 8;
const MAX_FILES_VISITED: usize = 30_000;
const MAX_DLLS_RETURNED: usize = 750;
const MAX_FINGERPRINT_BYTES: u64 = 512 * 1024;

const PROXY_NAMES: &[&str] = &[
    "dinput8.dll",
    "dxgi.dll",
    "d3d9.dll",
    "d3d10.dll",
    "d3d11.dll",
    "d3d12.dll",
    "dsound.dll",
    "opengl32.dll",
    "version.dll",
    "winhttp.dll",
    "winmm.dll",
    "xinput1_3.dll",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModFrameworkEvidence {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectedDll {
    pub file_name: String,
    pub relative_path: String,
    pub full_path: String,
    pub category: String,
    pub architecture: Option<String>,
    pub size_bytes: u64,
    pub modified_unix: Option<u64>,
    pub executable_directory: bool,
    pub proxy_name: bool,
    pub architecture_mismatch: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateDllGroup {
    pub file_name: String,
    pub copies: usize,
    pub distinct_versions: usize,
    pub paths: Vec<String>,
    pub potentially_conflicting: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModConflictFinding {
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub suggestion: Option<String>,
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModConflictReport {
    pub supported: bool,
    pub install_path: String,
    pub executable_path: Option<String>,
    pub executable_architecture: Option<String>,
    pub dll_count: usize,
    pub dlls_returned: usize,
    pub proxy_count: usize,
    pub mod_dll_count: usize,
    pub frameworks: Vec<ModFrameworkEvidence>,
    pub dlls: Vec<InspectedDll>,
    pub duplicate_groups: Vec<DuplicateDllGroup>,
    pub findings: Vec<ModConflictFinding>,
    pub files_visited: usize,
    pub scan_truncated: bool,
    pub summary: String,
}

#[derive(Debug, Clone)]
struct ScannedFile {
    path: PathBuf,
    relative_path: String,
    lower_relative_path: String,
    file_name: String,
    lower_name: String,
    size_bytes: u64,
    modified_unix: Option<u64>,
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn modified_unix(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_secs())
}

fn read_pe_architecture(path: &Path) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let mut dos = [0u8; 64];
    file.read_exact(&mut dos).ok()?;
    if &dos[0..2] != b"MZ" {
        return None;
    }

    let offset = u32::from_le_bytes([dos[60], dos[61], dos[62], dos[63]]) as u64;
    file.seek(SeekFrom::Start(offset)).ok()?;
    let mut header = [0u8; 6];
    file.read_exact(&mut header).ok()?;
    if &header[0..4] != b"PE\0\0" {
        return None;
    }

    match u16::from_le_bytes([header[4], header[5]]) {
        0x014c => Some("x86".to_string()),
        0x8664 => Some("x64".to_string()),
        0xAA64 => Some("ARM64".to_string()),
        _ => None,
    }
}

fn is_dll_like(name: &str) -> bool {
    name.ends_with(".dll")
        || name.ends_with(".asi")
        || name.ends_with(".addon")
        || name.ends_with(".addon32")
        || name.ends_with(".addon64")
}

fn is_proxy_name(name: &str) -> bool {
    PROXY_NAMES.iter().any(|candidate| name == *candidate)
}

fn path_has_component(path: &str, names: &[&str]) -> bool {
    path.split(['/', '\\']).any(|component| {
        names
            .iter()
            .any(|candidate| component.eq_ignore_ascii_case(candidate))
    })
}

fn known_mod_binary(name: &str) -> bool {
    [
        "bepinex",
        "melonloader",
        "reframework",
        "ue4ss",
        "specialk",
        "reshade",
        "renodx",
        "optiscaler",
        "scripthook",
        "ultimate-asi-loader",
    ]
    .iter()
    .any(|marker| name.contains(marker))
}

fn is_runtime_name(name: &str) -> bool {
    [
        "vcruntime",
        "msvcp",
        "msvcr",
        "api-ms-win-",
        "ucrtbase",
        "d3dcompiler_",
        "xaudio",
        "xinput",
        "openal",
        "steam_api",
        "eossdk",
        "galaxy",
    ]
    .iter()
    .any(|marker| name.starts_with(marker))
}

fn category(name: &str, relative_path: &str, executable_directory: bool) -> String {
    if is_proxy_name(name) && executable_directory {
        return "Proxy / injector".to_string();
    }
    if name.ends_with(".addon") || name.ends_with(".addon32") || name.ends_with(".addon64") {
        return "ReShade add-on".to_string();
    }
    if name.ends_with(".asi") {
        return "ASI plug-in".to_string();
    }
    if known_mod_binary(name)
        || path_has_component(
            relative_path,
            &[
                "mods",
                "mod",
                "plugins",
                "plugin",
                "bepinex",
                "melonloader",
                "reframework",
                "ue4ss",
            ],
        )
    {
        return "Mod / plug-in".to_string();
    }
    if is_runtime_name(name) {
        return "Runtime / platform".to_string();
    }
    "Game library".to_string()
}

fn finding(
    severity: &str,
    title: impl Into<String>,
    detail: impl Into<String>,
    suggestion: Option<&str>,
    evidence: Vec<String>,
) -> ModConflictFinding {
    ModConflictFinding {
        severity: severity.to_string(),
        title: title.into(),
        detail: detail.into(),
        suggestion: suggestion.map(str::to_string),
        evidence,
    }
}

fn scan_files(root: &Path) -> Result<(Vec<ScannedFile>, usize, bool), String> {
    let mut files = Vec::new();
    let mut visited = 0usize;
    let mut truncated = false;
    let mut stack = vec![(root.to_path_buf(), 0usize)];

    while let Some((directory, depth)) = stack.pop() {
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            visited += 1;
            if visited > MAX_FILES_VISITED {
                truncated = true;
                break;
            }

            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(value) => value,
                Err(_) => continue,
            };

            if file_type.is_dir() {
                if depth < MAX_SCAN_DEPTH {
                    stack.push((path, depth + 1));
                }
                continue;
            }
            if !file_type.is_file() {
                continue;
            }

            let file_name = entry.file_name().to_string_lossy().to_string();
            let lower_name = file_name.to_ascii_lowercase();
            let relative_path = path
                .strip_prefix(root)
                .map(path_string)
                .unwrap_or_else(|_| path_string(&path));
            let lower_relative_path = relative_path.to_ascii_lowercase();
            let keep_indicator = matches!(
                lower_name.as_str(),
                "doorstop_config.ini"
                    | "reshade.ini"
                    | "reshade.log"
                    | "reframework.ini"
                    | "ue4ss-settings.ini"
                    | "ue4ss.dll"
                    | "dxvk.conf"
                    | "optiscaler.ini"
                    | "specialk.ini"
            ) || lower_name.contains("scripthook")
                || lower_relative_path.contains("bepinex")
                || lower_relative_path.contains("melonloader")
                || lower_relative_path.contains("reframework")
                || lower_relative_path.contains("ue4ss")
                || lower_relative_path.contains("reshade-shaders")
                || lower_relative_path.contains("rtx-remix");

            if !is_dll_like(&lower_name) && !keep_indicator {
                continue;
            }

            let metadata = match entry.metadata() {
                Ok(value) => value,
                Err(_) => continue,
            };
            files.push(ScannedFile {
                path,
                relative_path,
                lower_relative_path,
                file_name,
                lower_name,
                size_bytes: metadata.len(),
                modified_unix: modified_unix(&metadata),
            });
        }

        if truncated {
            break;
        }
    }

    Ok((files, visited, truncated))
}

fn matching_paths(files: &[ScannedFile], predicate: impl Fn(&ScannedFile) -> bool) -> Vec<String> {
    files
        .iter()
        .filter(|file| predicate(file))
        .map(|file| file.relative_path.clone())
        .take(6)
        .collect()
}

fn detect_frameworks(files: &[ScannedFile]) -> Vec<ModFrameworkEvidence> {
    let definitions: [(&str, &str, &str, &[&str]); 10] = [
        (
            "bepinex",
            "BepInEx",
            "Mod loader",
            &["bepinex", "doorstop_config.ini"],
        ),
        ("melonloader", "MelonLoader", "Mod loader", &["melonloader"]),
        (
            "reframework",
            "REFramework",
            "Script / DLL framework",
            &["reframework"],
        ),
        ("ue4ss", "UE4SS", "Script / DLL framework", &["ue4ss"]),
        (
            "reshade",
            "ReShade",
            "Graphics injector",
            &["reshade.ini", "reshade-shaders"],
        ),
        (
            "special-k",
            "Special K",
            "Graphics / input injector",
            &["specialk"],
        ),
        (
            "optiscaler",
            "OptiScaler",
            "Upscaling injector",
            &["optiscaler"],
        ),
        (
            "script-hook",
            "Script Hook",
            "Script / ASI loader",
            &["scripthook"],
        ),
        (
            "rtx-remix",
            "RTX Remix",
            "Graphics replacement",
            &["rtx-remix", "nvremixbridge"],
        ),
        (
            "renodx",
            "RenoDX",
            "ReShade add-on",
            &["renodx", "reno_dx", "reno-dx"],
        ),
    ];

    let mut frameworks = Vec::new();
    for (id, name, kind, markers) in definitions {
        let evidence = matching_paths(files, |file| {
            markers.iter().any(|marker| {
                file.lower_name.contains(marker) || file.lower_relative_path.contains(marker)
            })
        });
        if !evidence.is_empty() {
            frameworks.push(ModFrameworkEvidence {
                id: id.to_string(),
                name: name.to_string(),
                kind: kind.to_string(),
                evidence,
            });
        }
    }

    let asi = matching_paths(files, |file| file.lower_name.ends_with(".asi"));
    if !asi.is_empty() {
        frameworks.push(ModFrameworkEvidence {
            id: "asi-plugins".to_string(),
            name: "ASI plug-ins".to_string(),
            kind: "Native plug-ins".to_string(),
            evidence: asi,
        });
    }
    frameworks
}

fn short_hash(path: &Path, size: u64) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(size.to_le_bytes());
    let mut buffer = [0u8; 64 * 1024];
    let mut limited = file.take(MAX_FINGERPRINT_BYTES);
    loop {
        let read = limited.read(&mut buffer).ok()?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Some(format!("{:x}", hasher.finalize())[..16].to_string())
}

fn duplicate_groups(
    files: &[ScannedFile],
    executable: Option<&Path>,
    root: &Path,
) -> Vec<DuplicateDllGroup> {
    let mut groups: BTreeMap<String, Vec<&ScannedFile>> = BTreeMap::new();
    for file in files
        .iter()
        .filter(|file| file.lower_name.ends_with(".dll"))
    {
        groups
            .entry(file.lower_name.clone())
            .or_default()
            .push(file);
    }

    let mut results = Vec::new();
    for (name, copies) in groups.into_iter().filter(|(_, copies)| copies.len() > 1) {
        let relevant = is_proxy_name(&name)
            || known_mod_binary(&name)
            || copies.iter().any(|file| {
                path_has_component(
                    &file.relative_path,
                    &[
                        "mods",
                        "mod",
                        "plugins",
                        "plugin",
                        "bepinex",
                        "melonloader",
                        "reframework",
                        "ue4ss",
                    ],
                )
            });
        if !relevant {
            continue;
        }

        let fingerprints = copies
            .iter()
            .map(|file| {
                short_hash(&file.path, file.size_bytes)
                    .unwrap_or_else(|| format!("size:{}", file.size_bytes))
            })
            .collect::<HashSet<_>>();
        let executable_copy = copies.iter().any(|file| {
            executable
                .map(|path| same_directory(&file.path, path))
                .unwrap_or_else(|| file.path.parent() == Some(root))
        });
        results.push(DuplicateDllGroup {
            file_name: copies[0].file_name.clone(),
            copies: copies.len(),
            distinct_versions: fingerprints.len(),
            paths: copies
                .iter()
                .map(|file| file.relative_path.clone())
                .take(8)
                .collect(),
            potentially_conflicting: fingerprints.len() > 1 && executable_copy,
        });
    }
    results.sort_by(|left, right| {
        right
            .potentially_conflicting
            .cmp(&left.potentially_conflicting)
            .then_with(|| right.copies.cmp(&left.copies))
            .then_with(|| left.file_name.cmp(&right.file_name))
    });
    results.truncate(30);
    results
}

fn same_directory(left: &Path, right: &Path) -> bool {
    left.parent()
        .zip(right.parent())
        .map(|(left, right)| left == right)
        .unwrap_or(false)
}

#[tauri::command]
pub async fn inspect_mod_conflicts(
    install_path: String,
    executable_path: Option<String>,
) -> Result<ModConflictReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = PathBuf::from(install_path.trim().trim_matches('"'));
        if !root.is_dir() {
            return Err(format!("The install path does not exist: {}", root.display()));
        }

        let executable = executable_path
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| PathBuf::from(value.trim_matches('"')))
            .filter(|path| path.is_file());
        let executable_architecture = executable.as_deref().and_then(read_pe_architecture);
        let (files, files_visited, scan_truncated) = scan_files(&root)?;
        let frameworks = detect_frameworks(&files);
        let duplicates = duplicate_groups(&files, executable.as_deref(), &root);

        let mut dlls = Vec::new();
        let mut dll_count = 0usize;
        let mut proxy_count = 0usize;
        let mut mod_dll_count = 0usize;
        for file in files.iter().filter(|file| is_dll_like(&file.lower_name)) {
            dll_count += 1;
            let executable_directory = executable
                .as_deref()
                .map(|path| same_directory(&file.path, path))
                .unwrap_or_else(|| file.path.parent() == Some(root.as_path()));
            let proxy_name = is_proxy_name(&file.lower_name) && executable_directory;
            let file_category = category(&file.lower_name, &file.relative_path, executable_directory);
            let mod_related = file_category != "Game library" && file_category != "Runtime / platform";
            if proxy_name {
                proxy_count += 1;
            }
            if mod_related {
                mod_dll_count += 1;
            }
            if dlls.len() >= MAX_DLLS_RETURNED {
                continue;
            }
            let architecture = read_pe_architecture(&file.path);
            let architecture_mismatch = mod_related
                && architecture.is_some()
                && executable_architecture.is_some()
                && architecture != executable_architecture;
            dlls.push(InspectedDll {
                file_name: file.file_name.clone(),
                relative_path: file.relative_path.clone(),
                full_path: path_string(&file.path),
                category: file_category,
                architecture,
                size_bytes: file.size_bytes,
                modified_unix: file.modified_unix,
                executable_directory,
                proxy_name,
                architecture_mismatch,
            });
        }

        dlls.sort_by(|left, right| {
            right
                .architecture_mismatch
                .cmp(&left.architecture_mismatch)
                .then_with(|| right.proxy_name.cmp(&left.proxy_name))
                .then_with(|| left.category.cmp(&right.category))
                .then_with(|| left.file_name.to_ascii_lowercase().cmp(&right.file_name.to_ascii_lowercase()))
        });

        let mut findings = Vec::new();
        let mismatches = dlls
            .iter()
            .filter(|dll| dll.architecture_mismatch)
            .collect::<Vec<_>>();
        if !mismatches.is_empty() {
            findings.push(finding(
                "warning",
                "Mod DLL architecture does not match the game",
                format!(
                    "{} mod or injector file{} use a different PE architecture than the primary executable.",
                    mismatches.len(),
                    if mismatches.len() == 1 { "" } else { "s" }
                ),
                Some("Install the x86 or x64 build that matches the game. Keep a backup before replacing any file."),
                mismatches
                    .iter()
                    .take(6)
                    .map(|dll| format!("{} ({})", dll.relative_path, dll.architecture.as_deref().unwrap_or("unknown")))
                    .collect(),
            ));
        }

        let zero_length = dlls
            .iter()
            .filter(|dll| dll.size_bytes == 0)
            .collect::<Vec<_>>();
        if !zero_length.is_empty() {
            findings.push(finding(
                "warning",
                "Empty DLL or plug-in files found",
                "Zero-byte binary files cannot be loaded and usually indicate an interrupted install, failed extraction, or placeholder file.",
                Some("Reinstall the affected mod or verify the game files after backing up intentional custom files."),
                zero_length.iter().take(6).map(|dll| dll.relative_path.clone()).collect(),
            ));
        }

        let conflicting_duplicates = duplicates
            .iter()
            .filter(|group| group.potentially_conflicting)
            .collect::<Vec<_>>();
        if !conflicting_duplicates.is_empty() {
            findings.push(finding(
                "warning",
                "Different copies of mod DLLs were found",
                format!(
                    "{} duplicated mod DLL name{} have different contents and may be selected differently by loaders or deployment order.",
                    conflicting_duplicates.len(),
                    if conflicting_duplicates.len() == 1 { "" } else { "s" }
                ),
                Some("Compare the owning mods and keep the version required by the active load order. Duplicate dependencies in isolated plug-in folders can be intentional."),
                conflicting_duplicates
                    .iter()
                    .take(5)
                    .flat_map(|group| group.paths.iter().take(2).cloned())
                    .collect(),
            ));
        }

        if proxy_count > 1 {
            let proxy_paths = dlls
                .iter()
                .filter(|dll| dll.proxy_name)
                .map(|dll| dll.relative_path.clone())
                .collect::<Vec<_>>();
            findings.push(finding(
                "warning",
                "Multiple proxy entry points are present",
                format!(
                    "{} proxy-named DLLs sit beside the game executable. This can be valid, but graphics and input injectors may compete or depend on a specific chain-loading setup.",
                    proxy_count
                ),
                Some("Check each framework's chain-loading instructions. Test from a backup with one recently added injector disabled at a time."),
                proxy_paths,
            ));
        }

        if frameworks.len() > 1 {
            findings.push(finding(
                "info",
                "Multiple mod frameworks detected",
                format!(
                    "GameAtlas found {} frameworks or plug-in families. Coexistence may be supported, but updates and load order can affect compatibility.",
                    frameworks.len()
                ),
                Some("Keep framework versions documented and change one component at a time when troubleshooting."),
                frameworks.iter().map(|item| item.name.clone()).collect(),
            ));
        }

        if scan_truncated || dll_count > MAX_DLLS_RETURNED {
            findings.push(finding(
                "info",
                "The DLL inventory was limited",
                format!(
                    "GameAtlas visited {files_visited} entries and returned details for {} of {dll_count} DLL or plug-in files.",
                    dlls.len()
                ),
                Some("The highest-risk injector and mod files are prioritized. Very large installations may not show every game library."),
                Vec::new(),
            ));
        }

        if findings.iter().all(|item| item.severity != "warning") {
            findings.insert(
                0,
                finding(
                    "good",
                    "No high-confidence DLL conflict found",
                    "The scan did not find an architecture mismatch, empty binary, conflicting duplicate, or multiple proxy entry points.",
                    Some("This does not guarantee that every mod is compatible; script-level and load-order conflicts require mod-specific knowledge."),
                    Vec::new(),
                ),
            );
        }

        let warning_count = findings
            .iter()
            .filter(|item| item.severity == "warning")
            .count();
        let summary = if warning_count > 0 {
            format!(
                "Found {warning_count} potential conflict{} across {dll_count} DLL and plug-in files.",
                if warning_count == 1 { "" } else { "s" }
            )
        } else if frameworks.is_empty() {
            format!("Inspected {dll_count} DLL files; no recognized mod framework or high-confidence conflict was found.")
        } else {
            format!(
                "Detected {} mod framework{} across {dll_count} DLL and plug-in files with no high-confidence conflict.",
                frameworks.len(),
                if frameworks.len() == 1 { "" } else { "s" }
            )
        };

        Ok(ModConflictReport {
            supported: true,
            install_path: path_string(&root),
            executable_path: executable.as_deref().map(path_string),
            executable_architecture,
            dll_count,
            dlls_returned: dlls.len(),
            proxy_count,
            mod_dll_count,
            frameworks,
            dlls,
            duplicate_groups: duplicates,
            findings,
            files_visited,
            scan_truncated,
            summary,
        })
    })
    .await
    .map_err(|error| format!("Mod conflict scan worker failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_proxy_only_beside_executable() {
        assert_eq!(category("dxgi.dll", "dxgi.dll", true), "Proxy / injector");
        assert_eq!(
            category("dxgi.dll", "Engine/dxgi.dll", false),
            "Game library"
        );
    }

    #[test]
    fn recognizes_common_mod_paths() {
        assert_eq!(
            category("example.dll", "BepInEx/plugins/example.dll", false),
            "Mod / plug-in"
        );
        assert_eq!(category("example.asi", "example.asi", true), "ASI plug-in");
    }

    #[test]
    fn proxy_names_are_specific() {
        assert!(is_proxy_name("dinput8.dll"));
        assert!(!is_proxy_name("gameplay.dll"));
    }
}
