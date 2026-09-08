use std::{
    cmp::Reverse,
    fs,
    io::{
        Read,
        Seek,
        SeekFrom,
    },
    path::{
        Path,
        PathBuf,
    },
};

use serde::Serialize;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;


const MAX_SCAN_DEPTH: usize = 5;
const MAX_FILES_VISITED: usize = 25000;


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutableInfo {
    pub found: bool,
    pub file_name: Option<String>,
    pub path: Option<String>,
    pub architecture: Option<String>,
    pub size_bytes: Option<u64>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsTechnologyInfo {
    pub dlss: bool,
    pub dlss_path: Option<String>,
    pub dlss_version: Option<String>,

    pub dlss_frame_generation: bool,
    pub dlss_frame_generation_path: Option<String>,
    pub dlss_frame_generation_version: Option<String>,

    pub xess: bool,
    pub xess_path: Option<String>,
    pub xess_version: Option<String>,

    pub fsr: bool,
    pub fsr_path: Option<String>,
    pub fsr_version: Option<String>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReShadeInfo {
    pub installed: bool,
    pub proxy_dll: Option<String>,
    pub proxy_path: Option<String>,
    pub ini_path: Option<String>,
    pub preset_path: Option<String>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModManagerInfo {
    pub vortex_evidence: bool,
    pub vortex_evidence_path: Option<String>,
    pub fluffy_evidence: bool,
    pub fluffy_evidence_path: Option<String>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalInstallationInfo {
    pub install_path: String,
    pub executable: ExecutableInfo,
    pub graphics: GraphicsTechnologyInfo,
    pub reshade: ReShadeInfo,
    pub mod_managers: LocalModManagerInfo,
    pub files_scanned: usize,
    pub scan_truncated: bool,
}


#[derive(Debug, Clone)]
struct ScannedFile {
    path: PathBuf,
    depth: usize,
    size_bytes: u64,
}


#[derive(Debug)]
struct ScanResult {
    files: Vec<ScannedFile>,
    visited: usize,
    truncated: bool,
}


fn path_string(
    path: &Path,
) -> String {
    path
        .to_string_lossy()
        .to_string()
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


fn scan_directory(
    root: &Path,
) -> Result<ScanResult, String> {
    let mut files =
        Vec::new();

    let mut stack =
        vec![
            (
                root.to_path_buf(),
                0usize,
            ),
        ];

    let mut visited =
        0usize;

    let mut truncated =
        false;

    while let Some(
        (
            directory,
            depth,
        )
    ) = stack.pop()
    {
        if depth
            > MAX_SCAN_DEPTH
        {
            continue;
        }

        let entries =
            match fs::read_dir(
                &directory
            ) {
                Ok(entries) =>
                    entries,

                Err(_) =>
                    continue,
            };

        for entry in
            entries.flatten()
        {
            if visited
                >= MAX_FILES_VISITED
            {
                truncated =
                    true;

                break;
            }

            visited +=
                1;

            let path =
                entry.path();

            let metadata =
                match entry.metadata() {
                    Ok(metadata) =>
                        metadata,

                    Err(_) =>
                        continue,
                };

            if metadata.is_dir() {
                let folder_name =
                    entry
                        .file_name()
                        .to_string_lossy()
                        .to_ascii_lowercase();

                /*
                 * Avoid scanning obvious caches/log folders that can
                 * explode the file count without helping detection.
                 */
                if matches!(
                    folder_name.as_str(),
                    "cache"
                        | "logs"
                        | "log"
                        | "crashdumps"
                        | "crash_reports"
                ) {
                    continue;
                }

                if depth
                    < MAX_SCAN_DEPTH
                {
                    stack.push(
                        (
                            path,
                            depth + 1,
                        )
                    );
                }

                continue;
            }

            if metadata.is_file() {
                files.push(
                    ScannedFile {
                        path,
                        depth,
                        size_bytes:
                            metadata.len(),
                    }
                );
            }
        }

        if truncated {
            break;
        }
    }

    Ok(
        ScanResult {
            files,
            visited,
            truncated,
        }
    )
}


fn read_pe_architecture(
    path: &Path,
) -> Option<String> {
    let mut file =
        fs::File::open(
            path
        )
        .ok()?;

    let mut dos =
        [0u8; 64];

    file.read_exact(
        &mut dos
    )
    .ok()?;

    if dos[0] != b'M'
        || dos[1] != b'Z'
    {
        return None;
    }

    let pe_offset =
        u32::from_le_bytes([
            dos[60],
            dos[61],
            dos[62],
            dos[63],
        ]) as u64;

    file.seek(
        SeekFrom::Start(
            pe_offset
        )
    )
    .ok()?;

    let mut header =
        [0u8; 6];

    file.read_exact(
        &mut header
    )
    .ok()?;

    if &header[0..4]
        != b"PE\0\0"
    {
        return None;
    }

    let machine =
        u16::from_le_bytes([
            header[4],
            header[5],
        ]);

    match machine {
        0x014c =>
            Some(
                "32-bit (x86)"
                    .to_string()
            ),

        0x8664 =>
            Some(
                "64-bit (x64)"
                    .to_string()
            ),

        0xAA64 =>
            Some(
                "64-bit (ARM64)"
                    .to_string()
            ),

        _ =>
            Some(
                format!(
                    "Unknown PE architecture (0x{:04X})",
                    machine
                )
            ),
    }
}


fn executable_score(
    game_name: &str,
    root: &Path,
    file: &ScannedFile,
) -> i64 {
    let file_name =
        file
            .path
            .file_name()
            .and_then(
                |value| {
                    value.to_str()
                }
            )
            .unwrap_or("")
            .to_ascii_lowercase();

    if !file_name
        .ends_with(
            ".exe"
        )
    {
        return i64::MIN;
    }

    let stem =
        file
            .path
            .file_stem()
            .and_then(
                |value| {
                    value.to_str()
                }
            )
            .unwrap_or("");

    let normalized_game =
        normalize_name(
            game_name
        );

    let normalized_stem =
        normalize_name(
            stem
        );

    let helper_terms =
        [
            "unins",
            "uninstall",
            "crash",
            "report",
            "benchmark",
            "setup",
            "installer",
            "redist",
            "vc_redist",
            "dxsetup",
            "easyanticheat",
            "eac",
            "battleye",
            "launcherhelper",
            "support",
        ];

    let mut score =
        0i64;

    if normalized_stem
        == normalized_game
        && !normalized_stem
            .is_empty()
    {
        score +=
            1200;
    } else if !normalized_stem
        .is_empty()
        && (
            normalized_game
                .contains(
                    &normalized_stem
                )
            || normalized_stem
                .contains(
                    &normalized_game
                )
        )
    {
        score +=
            500;
    }

    for term in helper_terms {
        if file_name
            .contains(
                term
            )
        {
            score -=
                900;
        }
    }

    /*
     * Real game executables are usually comparatively large and
     * usually near the game root or a bin/binaries folder.
     */
    score +=
        match file.size_bytes {
            0..=999_999 =>
                -100,

            1_000_000..=9_999_999 =>
                40,

            10_000_000..=49_999_999 =>
                120,

            50_000_000..=199_999_999 =>
                220,

            _ =>
                300,
        };

    score -=
        (file.depth as i64)
        * 25;

    if file
        .path
        .parent()
        == Some(
            root
        )
    {
        score +=
            120;
    }

    let parent_text =
        file
            .path
            .parent()
            .map(
                |path| {
                    path
                        .to_string_lossy()
                        .to_ascii_lowercase()
                }
            )
            .unwrap_or_default();

    if parent_text
        .contains(
            "binaries"
        )
        || parent_text
            .contains(
                "\\bin"
            )
        || parent_text
            .contains(
                "/bin"
            )
    {
        score +=
            80;
    }

    score
}


fn detect_executable(
    game_name: &str,
    root: &Path,
    files: &[ScannedFile],
) -> ExecutableInfo {
    let mut candidates =
        files
            .iter()
            .filter(
                |file| {
                    file
                        .path
                        .extension()
                        .and_then(
                            |value| {
                                value.to_str()
                            }
                        )
                        .map(
                            |value| {
                                value
                                    .eq_ignore_ascii_case(
                                        "exe"
                                    )
                            }
                        )
                        .unwrap_or(
                            false
                        )
                }
            )
            .map(
                |file| {
                    (
                        executable_score(
                            game_name,
                            root,
                            file,
                        ),
                        file,
                    )
                }
            )
            .filter(
                |(
                    score,
                    _,
                )| {
                    *score
                        > -500
                }
            )
            .collect::<Vec<_>>();

    candidates.sort_by_key(
        |(
            score,
            file,
        )| {
            (
                Reverse(
                    *score
                ),
                Reverse(
                    file.size_bytes
                ),
            )
        }
    );

    let Some(
        (
            _,
            best,
        )
    ) = candidates.first()
    else {
        return ExecutableInfo {
            found:
                false,

            file_name:
                None,

            path:
                None,

            architecture:
                None,

            size_bytes:
                None,
        };
    };

    ExecutableInfo {
        found:
            true,

        file_name:
            best
                .path
                .file_name()
                .map(
                    |value| {
                        value
                            .to_string_lossy()
                            .to_string()
                    }
                ),

        path:
            Some(
                path_string(
                    &best.path
                )
            ),

        architecture:
            read_pe_architecture(
                &best.path
            ),

        size_bytes:
            Some(
                best.size_bytes
            ),
    }
}


fn find_named_file(
    files: &[ScannedFile],
    names: &[&str],
) -> Option<PathBuf> {
    files
        .iter()
        .filter_map(
            |file| {
                let name =
                    file
                        .path
                        .file_name()?
                        .to_str()?;

                let matched =
                    names.iter()
                        .any(
                            |target| {
                                name
                                    .eq_ignore_ascii_case(
                                        target
                                    )
                            }
                        );

                matched.then(
                    || {
                        file.path.clone()
                    }
                )
            }
        )
        .min_by_key(
            |path| {
                path
                    .components()
                    .count()
            }
        )
}


fn find_name_contains(
    files: &[ScannedFile],
    terms: &[&str],
) -> Option<PathBuf> {
    files
        .iter()
        .find_map(
            |file| {
                let name =
                    file
                        .path
                        .file_name()?
                        .to_str()?
                        .to_ascii_lowercase();

                terms.iter()
                    .any(
                        |term| {
                            name.contains(
                                &term
                                    .to_ascii_lowercase()
                            )
                        }
                    )
                    .then(
                        || {
                            file.path.clone()
                        }
                    )
            }
        )
}


#[cfg(target_os = "windows")]
fn file_version(
    path: &Path,
) -> Option<String> {
    use std::process::Command;

    /*
     * Read the Windows VERSIONINFO resource without adding a new
     * Rust dependency. The DLL path is passed through an environment
     * variable so paths containing spaces, apostrophes, or other
     * shell-sensitive characters do not need to be interpolated
     * into the PowerShell command.
     */
    let output =
        Command::new(
            "powershell.exe"
        )
        .creation_flags(
            CREATE_NO_WINDOW
        )
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            "$v = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($env:GM_FILE_VERSION_PATH); if ($v.FileVersion) { $v.FileVersion } elseif ($v.ProductVersion) { $v.ProductVersion }",
        ])
        .env(
            "GM_FILE_VERSION_PATH",
            path
        )
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let value =
        String::from_utf8_lossy(
            &output.stdout
        )
        .trim()
        .trim_matches(
            '\0'
        )
        .trim()
        .to_string();

    if value.is_empty() {
        None
    } else {
        Some(
            value
        )
    }
}


#[cfg(not(target_os = "windows"))]
fn file_version(
    _path: &Path,
) -> Option<String> {
    None
}


fn detect_graphics(
    files: &[ScannedFile],
) -> GraphicsTechnologyInfo {
    let dlss =
        find_named_file(
            files,
            &[
                "nvngx_dlss.dll",
            ],
        );

    let dlssg =
        find_named_file(
            files,
            &[
                "nvngx_dlssg.dll",
            ],
        );

    let xess =
        find_named_file(
            files,
            &[
                "libxess.dll",
                "libxess_dx11.dll",
                "libxess_fg.dll",
            ],
        );

    /*
     * FSR is less standardized than DLSS/XeSS. Only flag it when
     * a filename explicitly identifies AMD FSR rather than guessing
     * from a generic game DLL.
     */
    let fsr =
        find_name_contains(
            files,
            &[
                "ffx_fsr",
                "amd_fsr",
                "fsr2",
                "fsr3",
            ],
        );

    let dlss_version =
        dlss
            .as_deref()
            .and_then(
                file_version
            );

    let dlssg_version =
        dlssg
            .as_deref()
            .and_then(
                file_version
            );

    let xess_version =
        xess
            .as_deref()
            .and_then(
                file_version
            );

    let fsr_version =
        fsr
            .as_deref()
            .and_then(
                file_version
            );

    GraphicsTechnologyInfo {
        dlss:
            dlss.is_some(),

        dlss_path:
            dlss
                .as_deref()
                .map(
                    path_string
                ),

        dlss_version,

        dlss_frame_generation:
            dlssg.is_some(),

        dlss_frame_generation_path:
            dlssg
                .as_deref()
                .map(
                    path_string
                ),

        dlss_frame_generation_version:
            dlssg_version,

        xess:
            xess.is_some(),

        xess_path:
            xess
                .as_deref()
                .map(
                    path_string
                ),

        xess_version,

        fsr:
            fsr.is_some(),

        fsr_path:
            fsr
                .as_deref()
                .map(
                    path_string
                ),

        fsr_version,
    }
}

fn parse_reshade_preset(
    ini_path: &Path,
) -> Option<String> {
    let text =
        fs::read_to_string(
            ini_path
        )
        .ok()?;

    for line in
        text.lines()
    {
        let trimmed =
            line.trim();

        let Some(
            (
                key,
                value,
            )
        ) = trimmed
            .split_once(
                '='
            )
        else {
            continue;
        };

        if key
            .trim()
            .eq_ignore_ascii_case(
                "PresetPath"
            )
        {
            let value =
                value
                    .trim();

            if !value.is_empty() {
                return Some(
                    value.to_string()
                );
            }
        }
    }

    None
}


fn detect_reshade(
    root: &Path,
    files: &[ScannedFile],
) -> ReShadeInfo {
    let proxy_names =
        [
            "dxgi.dll",
            "d3d9.dll",
            "d3d10.dll",
            "d3d11.dll",
            "d3d12.dll",
            "opengl32.dll",
        ];

    let ini =
        find_named_file(
            files,
            &[
                "ReShade.ini",
            ],
        );

    let mut proxy =
        None;

    /*
     * A generic dxgi.dll can belong to other mods. Treat the presence
     * of ReShade.ini as the strongest signal, then select the nearest
     * recognized proxy DLL in that directory first.
     */
    if let Some(
        ini_path
    ) = &ini
    {
        if let Some(
            parent
        ) = ini_path.parent()
        {
            for name in
                proxy_names
            {
                let candidate =
                    parent.join(
                        name
                    );

                if candidate.is_file() {
                    proxy =
                        Some(
                            candidate
                        );

                    break;
                }
            }
        }
    }

    if proxy.is_none()
        && ini.is_some()
    {
        proxy =
            find_named_file(
                files,
                &proxy_names,
            );
    }

    let preset =
        ini
            .as_deref()
            .and_then(
                parse_reshade_preset
            );

    ReShadeInfo {
        installed:
            ini.is_some(),

        proxy_dll:
            proxy
                .as_deref()
                .and_then(
                    |path| {
                        path
                            .file_name()
                            .map(
                                |value| {
                                    value
                                        .to_string_lossy()
                                        .to_string()
                                }
                            )
                    }
                ),

        proxy_path:
            proxy
                .as_deref()
                .map(
                    path_string
                ),

        ini_path:
            ini
                .as_deref()
                .map(
                    path_string
                ),

        preset_path:
            preset
                .map(
                    |preset| {
                        let candidate =
                            PathBuf::from(
                                &preset
                            );

                        if candidate.is_absolute() {
                            path_string(
                                &candidate
                            )
                        } else {
                            ini
                                .as_deref()
                                .and_then(
                                    |path| {
                                        path.parent()
                                    }
                                )
                                .unwrap_or(
                                    root
                                )
                                .join(
                                    candidate
                                )
                                .to_string_lossy()
                                .to_string()
                        }
                    }
                ),
    }
}


fn detect_mod_managers(
    files: &[ScannedFile],
) -> LocalModManagerInfo {
    /*
     * These are intentionally conservative "evidence" checks.
     * They do not claim a manager is actively controlling the game.
     */
    let vortex =
        find_name_contains(
            files,
            &[
                ".vortex_backup",
                "vortex.deployment",
            ],
        );

    let fluffy =
        find_name_contains(
            files,
            &[
                "fluffy",
                "modmanager",
            ],
        );

    LocalModManagerInfo {
        vortex_evidence:
            vortex.is_some(),

        vortex_evidence_path:
            vortex
                .as_deref()
                .map(
                    path_string
                ),

        fluffy_evidence:
            fluffy.is_some(),

        fluffy_evidence_path:
            fluffy
                .as_deref()
                .map(
                    path_string
                ),
    }
}


#[tauri::command]
pub fn inspect_local_installation(
    game_name: String,
    install_path: String,
) -> Result<LocalInstallationInfo, String> {
    let root =
        PathBuf::from(
            install_path
                .trim()
                .trim_matches('"')
        );

    if !root.exists() {
        return Err(
            format!(
                "The install path does not exist: {}",
                root.display()
            )
        );
    }

    if !root.is_dir() {
        return Err(
            format!(
                "The install path is not a directory: {}",
                root.display()
            )
        );
    }

    println!(
        "[LOCAL INSPECTOR] Scanning: {}",
        root.display()
    );

    let scan =
        scan_directory(
            &root
        )?;

    let executable =
        detect_executable(
            &game_name,
            &root,
            &scan.files,
        );

    let graphics =
        detect_graphics(
            &scan.files
        );

    let reshade =
        detect_reshade(
            &root,
            &scan.files,
        );

    let mod_managers =
        detect_mod_managers(
            &scan.files
        );

    println!(
        "[LOCAL INSPECTOR] Files visited: {}, truncated: {}",
        scan.visited,
        scan.truncated
    );

    Ok(
        LocalInstallationInfo {
            install_path:
                path_string(
                    &root
                ),

            executable,
            graphics,
            reshade,
            mod_managers,

            files_scanned:
                scan.visited,

            scan_truncated:
                scan.truncated,
        }
    )
}
