use std::{
    cmp::Reverse,
    env,
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
    time::Instant,
};

use serde::Serialize;


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
    pub vortex_executable_path: Option<String>,
    pub fluffy_evidence: bool,
    pub fluffy_evidence_path: Option<String>,
    pub fluffy_executable_path: Option<String>,
    pub generic_manager_name: Option<String>,
    pub generic_manager_path: Option<String>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecialKInfo {
    pub detected: bool,
    pub evidence_path: Option<String>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheatEngineInfo {
    pub tables_found: usize,
    pub first_table_path: Option<String>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TechnicalDetailsInfo {
    pub engine: Option<String>,
    pub engine_version: Option<String>,
    pub graphics_apis: Vec<String>,
    pub executable_architecture: Option<String>,
    pub anti_cheat: Vec<String>,
    pub drm: Vec<String>,
    pub detection_notes: Vec<String>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryStorageInfo {
    pub available: bool,
    pub resolved_path: Option<String>,
    pub size_bytes: Option<u64>,
    pub file_count: Option<usize>,
    pub truncated: bool,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LargestFileInfo {
    pub file_name: String,
    pub relative_path: String,
    pub size_bytes: u64,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageDetailsInfo {
    pub install_size_bytes: u64,
    pub install_file_count: usize,
    pub install_size_complete: bool,
    pub drive_root: Option<String>,
    pub drive_free_bytes: Option<u64>,
    pub drive_total_bytes: Option<u64>,
    pub executable_size_bytes: Option<u64>,
    pub save_data: DirectoryStorageInfo,
    pub config_data: DirectoryStorageInfo,
    pub largest_files: Vec<LargestFileInfo>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotInfo {
    pub found: bool,
    pub source: Option<String>,
    pub folder_path: Option<String>,
    pub screenshot_count: usize,
    pub newest_path: Option<String>,
    pub newest_modified_unix: Option<u64>,
    pub newest_file_name: Option<String>,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalInstallationInfo {
    pub install_path: String,
    pub executable: ExecutableInfo,
    pub graphics: GraphicsTechnologyInfo,
    pub reshade: ReShadeInfo,
    pub mod_managers: LocalModManagerInfo,
    pub special_k: SpecialKInfo,
    pub cheat_engine: CheatEngineInfo,
    pub technical_details: TechnicalDetailsInfo,
    pub storage_details: StorageDetailsInfo,
    pub screenshots: ScreenshotInfo,
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
#[repr(C)]
struct VsFixedFileInfo {
    signature: u32,
    struct_version: u32,
    file_version_ms: u32,
    file_version_ls: u32,
    product_version_ms: u32,
    product_version_ls: u32,
    file_flags_mask: u32,
    file_flags: u32,
    file_os: u32,
    file_type: u32,
    file_subtype: u32,
    file_date_ms: u32,
    file_date_ls: u32,
}


#[cfg(target_os = "windows")]
#[link(name = "version")]
extern "system" {
    fn GetFileVersionInfoSizeW(
        filename: *const u16,
        handle: *mut u32,
    ) -> u32;

    fn GetFileVersionInfoW(
        filename: *const u16,
        handle: u32,
        length: u32,
        data: *mut std::ffi::c_void,
    ) -> i32;

    fn VerQueryValueW(
        block: *const std::ffi::c_void,
        sub_block: *const u16,
        buffer: *mut *mut std::ffi::c_void,
        length: *mut u32,
    ) -> i32;
}


#[cfg(target_os = "windows")]
fn file_version(
    path: &Path,
) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;

    let wide_path =
        path
            .as_os_str()
            .encode_wide()
            .chain(
                std::iter::once(
                    0
                )
            )
            .collect::<Vec<_>>();

    let mut ignored_handle =
        0u32;

    let size =
        unsafe {
            GetFileVersionInfoSizeW(
                wide_path.as_ptr(),
                &mut ignored_handle,
            )
        };

    if size == 0 {
        return None;
    }

    let mut data =
        vec![
            0u8;
            size as usize
        ];

    let loaded =
        unsafe {
            GetFileVersionInfoW(
                wide_path.as_ptr(),
                0,
                size,
                data.as_mut_ptr()
                    .cast(),
            )
        };

    if loaded == 0 {
        return None;
    }

    let root_query =
        [
            '\\' as u16,
            0,
        ];

    let mut fixed_info_ptr:
        *mut std::ffi::c_void =
        std::ptr::null_mut();

    let mut fixed_info_len =
        0u32;

    let queried =
        unsafe {
            VerQueryValueW(
                data.as_ptr()
                    .cast(),
                root_query.as_ptr(),
                &mut fixed_info_ptr,
                &mut fixed_info_len,
            )
        };

    if queried == 0
        || fixed_info_ptr.is_null()
        || fixed_info_len
            < std::mem::size_of::<VsFixedFileInfo>()
                as u32
    {
        return None;
    }

    let fixed_info =
        unsafe {
            &*(fixed_info_ptr
                as *const VsFixedFileInfo)
        };

    if fixed_info.signature
        != 0xFEEF04BD
    {
        return None;
    }

    let major =
        fixed_info.file_version_ms
            >> 16;

    let minor =
        fixed_info.file_version_ms
            & 0xFFFF;

    let build =
        fixed_info.file_version_ls
            >> 16;

    let revision =
        fixed_info.file_version_ls
            & 0xFFFF;

    Some(
        format!(
            "{}.{}.{}.{}",
            major,
            minor,
            build,
            revision
        )
    )
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


fn first_existing_path(
    candidates: &[PathBuf],
) -> Option<PathBuf> {
    candidates
        .iter()
        .find(
            |path| {
                path.is_file()
            }
        )
        .cloned()
}


#[cfg(target_os = "windows")]
fn detect_vortex_executable() -> Option<PathBuf> {
    let mut candidates =
        Vec::new();

    if let Ok(local_app_data) =
        env::var(
            "LOCALAPPDATA"
        )
    {
        candidates.push(
            PathBuf::from(
                &local_app_data
            )
            .join(
                "Programs"
            )
            .join(
                "Vortex"
            )
            .join(
                "Vortex.exe"
            )
        );
    }

    for variable in [
        "PROGRAMFILES",
        "PROGRAMFILES(X86)",
    ] {
        if let Ok(program_files) =
            env::var(
                variable
            )
        {
            candidates.push(
                PathBuf::from(
                    &program_files
                )
                .join(
                    "Black Tree Gaming Ltd"
                )
                .join(
                    "Vortex"
                )
                .join(
                    "Vortex.exe"
                )
            );

            candidates.push(
                PathBuf::from(
                    &program_files
                )
                .join(
                    "Vortex"
                )
                .join(
                    "Vortex.exe"
                )
            );
        }
    }

    first_existing_path(
        &candidates
    )
}


#[cfg(not(target_os = "windows"))]
fn detect_vortex_executable() -> Option<PathBuf> {
    None
}


fn find_executable_by_names(
    files: &[ScannedFile],
    names: &[&str],
) -> Option<PathBuf> {
    find_named_file(
        files,
        names,
    )
}


fn detect_special_k(
    files: &[ScannedFile],
) -> SpecialKInfo {
    let evidence =
        find_named_file(
            files,
            &[
                "SpecialK.ini",
                "SpecialK64.dll",
                "SpecialK32.dll",
                "SKIF.exe",
            ],
        )
        .or_else(
            || {
                find_name_contains(
                    files,
                    &[
                        "specialk",
                        "special_k",
                    ],
                )
            }
        );

    SpecialKInfo {
        detected:
            evidence.is_some(),

        evidence_path:
            evidence
                .as_deref()
                .map(
                    path_string
                ),
    }
}


fn detect_cheat_engine_tables(
    files: &[ScannedFile],
) -> CheatEngineInfo {
    let mut tables =
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
                                        "ct"
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
                    file.path.clone()
                }
            )
            .collect::<Vec<_>>();

    tables.sort();

    CheatEngineInfo {
        tables_found:
            tables.len(),

        first_table_path:
            tables
                .first()
                .map(
                    |path| {
                        path_string(
                            path
                        )
                    }
                ),
    }
}


fn detect_mod_managers(
    files: &[ScannedFile],
) -> LocalModManagerInfo {
    /*
     * Keep support, installation, and per-game evidence separate.
     * Evidence inside the game directory does not prove that a manager
     * is currently controlling the game.
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

    let fluffy_executable =
        find_executable_by_names(
            files,
            &[
                "Modmanager.exe",
                "FluffyModManager.exe",
                "Fluffy Manager 5000.exe",
            ],
        );

    let generic_managers =
        [
            (
                "Mod Organizer 2",
                "ModOrganizer.exe",
            ),
            (
                "Mod Organizer 2",
                "ModOrganizer2.exe",
            ),
            (
                "r2modman",
                "r2modman.exe",
            ),
            (
                "Thunderstore Mod Manager",
                "Thunderstore Mod Manager.exe",
            ),
            (
                "Generic Mod Manager",
                "modmanager.exe",
            ),
        ];

    let mut generic_manager_name =
        None;

    let mut generic_manager_path =
        None;

    for (
        label,
        executable_name,
    ) in generic_managers
    {
        if let Some(path) =
            find_named_file(
                files,
                &[
                    executable_name,
                ],
            )
        {
            /*
             * Fluffy frequently uses Modmanager.exe. Do not report the
             * same executable twice when Fluffy evidence is present.
             */
            if executable_name
                .eq_ignore_ascii_case(
                    "modmanager.exe"
                )
                && fluffy.is_some()
            {
                continue;
            }

            generic_manager_name =
                Some(
                    label.to_string()
                );

            generic_manager_path =
                Some(
                    path_string(
                        &path
                    )
                );

            break;
        }
    }

    LocalModManagerInfo {
        vortex_evidence:
            vortex.is_some(),

        vortex_evidence_path:
            vortex
                .as_deref()
                .map(
                    path_string
                ),

        vortex_executable_path:
            detect_vortex_executable()
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

        fluffy_executable_path:
            fluffy_executable
                .as_deref()
                .map(
                    path_string
                ),

        generic_manager_name,

        generic_manager_path,
    }
}

fn file_name_equals(
    file: &ScannedFile,
    target: &str,
) -> bool {
    file
        .path
        .file_name()
        .and_then(
            |value| {
                value.to_str()
            }
        )
        .map(
            |value| {
                value
                    .eq_ignore_ascii_case(
                        target
                    )
            }
        )
        .unwrap_or(
            false
        )
}


fn path_contains_ci(
    path: &Path,
    term: &str,
) -> bool {
    path
        .to_string_lossy()
        .to_ascii_lowercase()
        .contains(
            &term
                .to_ascii_lowercase()
        )
}


#[derive(Debug, Default)]
struct ExecutableSignatureSnapshot {
    ue5_release: bool,
    ue4_release: bool,
    unreal_engine_5: bool,
    unreal_engine_4: bool,
    d3d12: bool,
    d3d11: bool,
    d3d9: bool,
    vulkan: bool,
    opengl: bool,
    denuvo: bool,
    denuvo_anti_tamper: bool,
}


fn scan_executable_signatures(
    executable: &ExecutableInfo,
) -> ExecutableSignatureSnapshot {
    /*
     * FAST PATH ONLY.
     *
     * Do not scan arbitrary portions of large game executables during the
     * normal local-installation inspection. In debug/Tauri development
     * builds, byte-by-byte case-insensitive string scanning of a 50–100+ MiB
     * executable can stall the UI for tens of seconds.
     *
     * The normal technical profile instead relies on:
     * - PE headers for architecture
     * - installation file/folder evidence for engines and integrations
     * - PCGamingWiki metadata as the frontend fallback for engine/API
     * - lightweight local DLL/file evidence such as Vulkan loader files
     *
     * A future explicit "Deep Scan" can use a proper PE import parser or
     * background worker without blocking normal game selection.
     */
    let _ =
        executable;

    ExecutableSignatureSnapshot::default()
}



fn detect_engine(
    root: &Path,
    files: &[ScannedFile],
    executable: &ExecutableInfo,
    signatures: &ExecutableSignatureSnapshot,
) -> (
    Option<String>,
    Option<String>,
    Vec<String>,
) {
    let mut notes =
        Vec::new();

    let unity_player =
        find_named_file(
            files,
            &[
                "UnityPlayer.dll",
            ],
        );

    if let Some(path) =
        unity_player
    {
        let version =
            file_version(
                &path
            );

        notes.push(
            "UnityPlayer.dll was found in the game installation."
                .to_string()
        );

        return (
            Some(
                "Unity"
                    .to_string()
            ),
            version,
            notes,
        );
    }

    let unreal_path_evidence =
        files
            .iter()
            .any(
                |file| {
                    path_contains_ci(
                        &file.path,
                        "\\engine\\binaries\\"
                    )
                        || path_contains_ci(
                            &file.path,
                            "/engine/binaries/"
                        )
                }
            );

    let ue4_named =
        files
            .iter()
            .any(
                |file| {
                    file_name_equals(
                        file,
                        "UE4PrereqSetup_x64.exe"
                    )
                        || path_contains_ci(
                            &file.path,
                            "ue4"
                        )
                }
            );

    let ue5_named =
        files
            .iter()
            .any(
                |file| {
                    path_contains_ci(
                        &file.path,
                        "ue5"
                    )
                        || file_name_equals(
                            file,
                            "UnrealEditor.exe"
                        )
                }
            );

    let unreal_version =
        if signatures.ue5_release
            || signatures.unreal_engine_5
        {
            Some(
                "Unreal Engine 5"
                    .to_string()
            )
        } else if signatures.ue4_release
            || signatures.unreal_engine_4
        {
            Some(
                "Unreal Engine 4"
                    .to_string()
            )
        } else {
            None
        };

    if unreal_path_evidence
        || ue4_named
        || ue5_named
        || unreal_version.is_some()
    {
        notes.push(
            "Unreal Engine directory or executable signatures were detected."
                .to_string()
        );

        let version =
            unreal_version
                .or_else(
                    || {
                        if ue5_named {
                            Some(
                                "Unreal Engine 5"
                                    .to_string()
                            )
                        } else if ue4_named {
                            Some(
                                "Unreal Engine 4"
                                    .to_string()
                            )
                        } else {
                            None
                        }
                    }
                );

        return (
            Some(
                "Unreal Engine"
                    .to_string()
            ),
            version,
            notes,
        );
    }

    let re_engine =
        files
            .iter()
            .any(
                |file| {
                    let name =
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

                    name.starts_with(
                        "re_chunk_"
                    )
                        && name
                            .ends_with(
                                ".pak"
                            )
                }
            );

    if re_engine {
        notes.push(
            "RE Engine package naming was detected."
                .to_string()
        );

        return (
            Some(
                "RE Engine"
                    .to_string()
            ),
            None,
            notes,
        );
    }

    let source2 =
        files
            .iter()
            .any(
                |file| {
                    file_name_equals(
                        file,
                        "engine2.dll"
                    )
                        || path_contains_ci(
                            &file.path,
                            "\\game\\bin\\win64\\"
                        )
                            && file_name_equals(
                                file,
                                "tier0.dll"
                            )
                }
            );

    if source2 {
        notes.push(
            "Source 2 engine binaries were detected."
                .to_string()
        );

        return (
            Some(
                "Source 2"
                    .to_string()
            ),
            None,
            notes,
        );
    }

    let source =
        find_named_file(
            files,
            &[
                "engine.dll",
            ],
        )
        .is_some()
        && find_named_file(
            files,
            &[
                "tier0.dll",
            ],
        )
        .is_some();

    if source {
        notes.push(
            "Source engine.dll and tier0.dll were detected."
                .to_string()
        );

        return (
            Some(
                "Source"
                    .to_string()
            ),
            None,
            notes,
        );
    }

    let _ =
        root;

    (
        None,
        None,
        notes,
    )
}


fn detect_graphics_apis(
    files: &[ScannedFile],
    signatures: &ExecutableSignatureSnapshot,
) -> (
    Vec<String>,
    Vec<String>,
) {
    let mut apis =
        Vec::new();

    let mut notes =
        Vec::new();

    for (
        detected,
        api,
    ) in [
        (
            signatures.d3d12,
            "DirectX 12",
        ),
        (
            signatures.d3d11,
            "DirectX 11",
        ),
        (
            signatures.d3d9,
            "DirectX 9",
        ),
        (
            signatures.vulkan,
            "Vulkan",
        ),
        (
            signatures.opengl,
            "OpenGL",
        ),
    ] {
        if detected {
            apis.push(
                api.to_string()
            );
        }
    }

    if !apis.is_empty() {
        notes.push(
            "Graphics API imports/signatures were found in the selected game executable."
                .to_string()
        );
    }

    /*
     * Vulkan loader files shipped with a title are useful secondary
     * evidence when executable string/import scanning is inconclusive.
     */
    if find_named_file(
        files,
        &[
            "vulkan-1.dll",
        ],
    )
    .is_some()
        && !apis
            .iter()
            .any(
                |value| {
                    value == "Vulkan"
                }
            )
    {
        apis.push(
            "Vulkan"
                .to_string()
        );

        notes.push(
            "A Vulkan loader DLL was found in the installation."
                .to_string()
        );
    }

    apis.sort();

    (
        apis,
        notes,
    )
}


fn detect_anti_cheat(
    files: &[ScannedFile],
) -> Vec<String> {
    let mut detected =
        Vec::new();

    let checks =
        [
            (
                "Easy Anti-Cheat",
                &[
                    "EasyAntiCheat.exe",
                    "EasyAntiCheat_EOS.exe",
                    "EasyAntiCheat_x64.dll",
                    "EasyAntiCheat_x86.dll",
                ][..],
            ),
            (
                "BattlEye",
                &[
                    "BEService.exe",
                    "BEClient_x64.dll",
                    "BEClient.dll",
                ][..],
            ),
            (
                "XIGNCODE3",
                &[
                    "x3.xem",
                    "xigncode3.dll",
                ][..],
            ),
            (
                "nProtect GameGuard",
                &[
                    "GameMon.des",
                    "GameGuard.des",
                ][..],
            ),
            (
                "PunkBuster",
                &[
                    "pbcl.dll",
                    "pbsvc.exe",
                ][..],
            ),
        ];

    for (
        label,
        names,
    ) in checks
    {
        if find_named_file(
            files,
            names,
        )
        .is_some()
        {
            detected.push(
                label.to_string()
            );
        }
    }

    detected
}


fn detect_drm(
    files: &[ScannedFile],
    signatures: &ExecutableSignatureSnapshot,
) -> (
    Vec<String>,
    Vec<String>,
) {
    let mut detected =
        Vec::new();

    let mut notes =
        Vec::new();

    if signatures.denuvo
        || signatures.denuvo_anti_tamper
    {
        detected.push(
            "Denuvo Anti-Tamper"
                .to_string()
        );

        notes.push(
            "Denuvo text signatures were found in the selected executable."
                .to_string()
        );
    }

    if find_named_file(
        files,
        &[
            "steam_api64.dll",
            "steam_api.dll",
        ],
    )
    .is_some()
    {
        detected.push(
            "Steamworks integration"
                .to_string()
        );

        notes.push(
            "Steamworks API files are present; this does not by itself prove Steam DRM is enabled."
                .to_string()
        );
    }

    if find_named_file(
        files,
        &[
            "uplay_r1_loader64.dll",
            "uplay_r1_loader.dll",
        ],
    )
    .is_some()
    {
        detected.push(
            "Ubisoft Connect integration"
                .to_string()
        );
    }

    if find_named_file(
        files,
        &[
            "EOSSDK-Win64-Shipping.dll",
            "EOSSDK-Win32-Shipping.dll",
        ],
    )
    .is_some()
    {
        detected.push(
            "Epic Online Services integration"
                .to_string()
        );

        notes.push(
            "EOS SDK presence is platform/service evidence, not proof of DRM."
                .to_string()
        );
    }

    if find_named_file(
        files,
        &[
            "Galaxy64.dll",
            "Galaxy.dll",
        ],
    )
    .is_some()
    {
        detected.push(
            "GOG Galaxy integration"
                .to_string()
        );

        notes.push(
            "GOG Galaxy integration is not equivalent to DRM."
                .to_string()
        );
    }

    (
        detected,
        notes,
    )
}


fn detect_technical_details(
    root: &Path,
    files: &[ScannedFile],
    executable: &ExecutableInfo,
    signatures: &ExecutableSignatureSnapshot,
) -> TechnicalDetailsInfo {
    let (
        engine,
        engine_version,
        mut detection_notes,
    ) =
        detect_engine(
            root,
            files,
            executable,
            signatures,
        );

    let (
        graphics_apis,
        api_notes,
    ) =
        detect_graphics_apis(
            files,
            signatures,
        );

    detection_notes.extend(
        api_notes
    );

    let anti_cheat =
        detect_anti_cheat(
            files
        );

    let (
        drm,
        drm_notes,
    ) =
        detect_drm(
            files,
            signatures,
        );

    detection_notes.extend(
        drm_notes
    );

    TechnicalDetailsInfo {
        engine,
        engine_version,
        graphics_apis,

        executable_architecture:
            executable
                .architecture
                .clone(),

        anti_cheat,
        drm,
        detection_notes,
    }
}


fn directory_storage_info(
    raw_path: Option<&str>,
    install_path: &Path,
) -> DirectoryStorageInfo {
    let Some(raw_path) =
        raw_path
            .map(str::trim)
            .filter(
                |value| {
                    !value.is_empty()
                }
            )
    else {
        return DirectoryStorageInfo {
            available:
                false,
            resolved_path:
                None,
            size_bytes:
                None,
            file_count:
                None,
            truncated:
                false,
        };
    };

    let install_path_text =
        install_path
            .to_string_lossy()
            .to_string();

    let resolved =
        match crate::local_paths::resolve_game_path(
            raw_path,
            Some(
                install_path_text
                    .as_str()
            ),
        ) {
            Ok(path) =>
                path,

            Err(_) =>
                return DirectoryStorageInfo {
                    available:
                        false,
                    resolved_path:
                        None,
                    size_bytes:
                        None,
                    file_count:
                        None,
                    truncated:
                        false,
                },
        };

    const MAX_AUX_FILES: usize =
        50_000;

    const MAX_AUX_DEPTH: usize =
        12;

    let mut stack =
        vec![
            (
                resolved.clone(),
                0usize,
            ),
        ];

    let mut file_count =
        0usize;

    let mut size_bytes =
        0u64;

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
            > MAX_AUX_DEPTH
        {
            truncated =
                true;

            continue;
        }

        let Ok(entries) =
            fs::read_dir(
                &directory
            )
        else {
            continue;
        };

        for entry in
            entries.flatten()
        {
            if file_count
                >= MAX_AUX_FILES
            {
                truncated =
                    true;

                break;
            }

            let Ok(metadata) =
                entry.metadata()
            else {
                continue;
            };

            let path =
                entry.path();

            if metadata.is_dir() {
                stack.push(
                    (
                        path,
                        depth + 1,
                    )
                );

                continue;
            }

            if metadata.is_file() {
                file_count +=
                    1;

                size_bytes =
                    size_bytes
                        .saturating_add(
                            metadata.len()
                        );
            }
        }

        if truncated
            && file_count
                >= MAX_AUX_FILES
        {
            break;
        }
    }

    DirectoryStorageInfo {
        available:
            true,

        resolved_path:
            Some(
                path_string(
                    &resolved
                )
            ),

        size_bytes:
            Some(
                size_bytes
            ),

        file_count:
            Some(
                file_count
            ),

        truncated,
    }
}


#[cfg(target_os = "windows")]
fn windows_drive_space(
    path: &Path,
) -> (
    Option<String>,
    Option<u64>,
    Option<u64>,
) {
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetDiskFreeSpaceExW(
            lp_directory_name:
                *const u16,
            lp_free_bytes_available_to_caller:
                *mut u64,
            lp_total_number_of_bytes:
                *mut u64,
            lp_total_number_of_free_bytes:
                *mut u64,
        ) -> i32;
    }

    let path_text =
        path
            .to_string_lossy()
            .to_string();

    let drive_root =
        if path_text.len()
            >= 2
            && path_text
                .as_bytes()
                .get(1)
                == Some(
                    &b':'
                )
        {
            Some(
                format!(
                    "{}:\\",
                    &path_text[
                        0..1
                    ]
                )
            )
        } else {
            None
        };

    let query_path =
        drive_root
            .as_deref()
            .unwrap_or(
                path_text
                    .as_str()
            );

    let wide =
        std::ffi::OsStr::new(
            query_path
        )
        .encode_wide()
        .chain(
            std::iter::once(
                0
            )
        )
        .collect::<Vec<_>>();

    let mut available =
        0u64;

    let mut total =
        0u64;

    let mut total_free =
        0u64;

    let ok =
        unsafe {
            GetDiskFreeSpaceExW(
                wide.as_ptr(),
                &mut available,
                &mut total,
                &mut total_free,
            )
        };

    if ok == 0 {
        return (
            drive_root,
            None,
            None,
        );
    }

    (
        drive_root,
        Some(
            available
        ),
        Some(
            total
        ),
    )
}


#[cfg(not(target_os = "windows"))]
fn windows_drive_space(
    _path: &Path,
) -> (
    Option<String>,
    Option<u64>,
    Option<u64>,
) {
    (
        None,
        None,
        None,
    )
}


fn build_storage_details(
    root: &Path,
    scan: &ScanResult,
    executable: &ExecutableInfo,
    save_path: Option<&str>,
    config_path: Option<&str>,
) -> StorageDetailsInfo {
    let install_size_bytes =
        scan
            .files
            .iter()
            .fold(
                0u64,
                |total, file| {
                    total
                        .saturating_add(
                            file.size_bytes
                        )
                }
            );

    let mut largest_files =
        scan
            .files
            .iter()
            .map(
                |file| {
                    let relative_path =
                        file
                            .path
                            .strip_prefix(
                                root
                            )
                            .unwrap_or(
                                &file.path
                            )
                            .to_string_lossy()
                            .to_string();

                    let file_name =
                        file
                            .path
                            .file_name()
                            .map(
                                |value| {
                                    value
                                        .to_string_lossy()
                                        .to_string()
                                }
                            )
                            .unwrap_or_else(
                                || {
                                    relative_path
                                        .clone()
                                }
                            );

                    LargestFileInfo {
                        file_name,
                        relative_path,
                        size_bytes:
                            file.size_bytes,
                    }
                }
            )
            .collect::<Vec<_>>();

    largest_files.sort_by(
        |left, right| {
            right
                .size_bytes
                .cmp(
                    &left
                        .size_bytes
                )
        }
    );

    largest_files.truncate(
        5
    );

    let (
        drive_root,
        drive_free_bytes,
        drive_total_bytes,
    ) =
        windows_drive_space(
            root
        );

    StorageDetailsInfo {
        install_size_bytes,

        install_file_count:
            scan.files.len(),

        install_size_complete:
            !scan.truncated,

        drive_root,

        drive_free_bytes,

        drive_total_bytes,

        executable_size_bytes:
            executable
                .size_bytes,

        save_data:
            directory_storage_info(
                save_path,
                root,
            ),

        config_data:
            directory_storage_info(
                config_path,
                root,
            ),

        largest_files,
    }
}


fn is_screenshot_extension(
    path: &Path,
) -> bool {
    path
        .extension()
        .and_then(
            |value| {
                value.to_str()
            }
        )
        .map(
            |value| {
                matches!(
                    value
                        .to_ascii_lowercase()
                        .as_str(),
                    "png"
                        | "jpg"
                        | "jpeg"
                        | "bmp"
                        | "webp"
                )
            }
        )
        .unwrap_or(
            false
        )
}


fn inspect_screenshot_folder(
    folder: &Path,
    source: &str,
) -> Option<ScreenshotInfo> {
    if !folder.is_dir() {
        return None;
    }

    let mut screenshot_count =
        0usize;

    let mut newest_path:
        Option<PathBuf> =
        None;

    let mut newest_modified_unix:
        Option<u64> =
        None;

    let Ok(entries) =
        fs::read_dir(
            folder
        )
    else {
        return None;
    };

    for entry in
        entries.flatten()
    {
        let path =
            entry.path();

        let Ok(metadata) =
            entry.metadata()
        else {
            continue;
        };

        if !metadata.is_file()
            || !is_screenshot_extension(
                &path
            )
        {
            continue;
        }

        screenshot_count +=
            1;

        let modified =
            metadata
                .modified()
                .ok()
                .and_then(
                    |time| {
                        time
                            .duration_since(
                                std::time::UNIX_EPOCH
                            )
                            .ok()
                    }
                )
                .map(
                    |duration| {
                        duration.as_secs()
                    }
                );

        let is_newer =
            match (
                modified,
                newest_modified_unix,
            ) {
                (
                    Some(candidate),
                    Some(current),
                ) =>
                    candidate
                        > current,

                (
                    Some(_),
                    None,
                ) =>
                    true,

                _ =>
                    newest_path
                        .is_none(),
            };

        if is_newer {
            newest_modified_unix =
                modified;

            newest_path =
                Some(
                    path
                );
        }
    }

    if screenshot_count
        == 0
    {
        return None;
    }

    let newest_file_name =
        newest_path
            .as_deref()
            .and_then(
                |path| {
                    path
                        .file_name()
                }
            )
            .map(
                |value| {
                    value
                        .to_string_lossy()
                        .to_string()
                }
            );

    Some(
        ScreenshotInfo {
            found:
                true,

            source:
                Some(
                    source
                        .to_string()
                ),

            folder_path:
                Some(
                    path_string(
                        folder
                    )
                ),

            screenshot_count,

            newest_path:
                newest_path
                    .as_deref()
                    .map(
                        path_string
                    ),

            newest_modified_unix,

            newest_file_name,
        }
    )
}


#[cfg(target_os = "windows")]
fn steam_roots() -> Vec<PathBuf> {
    let mut roots =
        Vec::new();

    for variable in [
        "PROGRAMFILES(X86)",
        "PROGRAMFILES",
    ] {
        if let Ok(program_files) =
            env::var(
                variable
            )
        {
            roots.push(
                PathBuf::from(
                    program_files
                )
                .join(
                    "Steam"
                )
            );
        }
    }

    if let Ok(local_app_data) =
        env::var(
            "LOCALAPPDATA"
        )
    {
        roots.push(
            PathBuf::from(
                local_app_data
            )
            .join(
                "Steam"
            )
        );
    }

    roots.sort();

    roots.dedup();

    roots
}


#[cfg(not(target_os = "windows"))]
fn steam_roots() -> Vec<PathBuf> {
    Vec::new()
}


fn detect_steam_screenshots(
    app_id: &str,
) -> Option<ScreenshotInfo> {
    let app_id =
        app_id
            .trim();

    if app_id.is_empty() {
        return None;
    }

    let mut best:
        Option<ScreenshotInfo> =
        None;

    for steam_root in
        steam_roots()
    {
        let userdata =
            steam_root
                .join(
                    "userdata"
                );

        let Ok(users) =
            fs::read_dir(
                userdata
            )
        else {
            continue;
        };

        for user in
            users.flatten()
        {
            let screenshot_folder =
                user
                    .path()
                    .join(
                        "760"
                    )
                    .join(
                        "remote"
                    )
                    .join(
                        app_id
                    )
                    .join(
                        "screenshots"
                    );

            let Some(info) =
                inspect_screenshot_folder(
                    &screenshot_folder,
                    "Steam",
                )
            else {
                continue;
            };

            let replace =
                best
                    .as_ref()
                    .map(
                        |current| {
                            info
                                .newest_modified_unix
                                .unwrap_or(
                                    0
                                )
                                > current
                                    .newest_modified_unix
                                    .unwrap_or(
                                        0
                                    )
                        }
                    )
                    .unwrap_or(
                        true
                    );

            if replace {
                best =
                    Some(
                        info
                    );
            }
        }
    }

    best
}


fn detect_common_screenshot_folder(
    game_name: &str,
    root: &Path,
) -> Option<ScreenshotInfo> {
    let common_install_candidates =
        [
            root.join(
                "Screenshots"
            ),
            root.join(
                "screenshots"
            ),
            root.join(
                "ScreenShots"
            ),
            root.join(
                "Screenshot"
            ),
            root.join(
                "Captures"
            ),
        ];

    for candidate in
        common_install_candidates
    {
        if let Some(info) =
            inspect_screenshot_folder(
                &candidate,
                "Game folder",
            )
        {
            return Some(
                info
            );
        }
    }

    let Ok(user_profile) =
        env::var(
            "USERPROFILE"
        )
    else {
        return None;
    };

    let safe_game_name =
        game_name
            .trim();

    if safe_game_name.is_empty() {
        return None;
    }

    let user_root =
        PathBuf::from(
            user_profile
        );

    let candidates =
        [
            user_root
                .join(
                    "Pictures"
                )
                .join(
                    safe_game_name
                ),
            user_root
                .join(
                    "Pictures"
                )
                .join(
                    safe_game_name
                )
                .join(
                    "Screenshots"
                ),
            user_root
                .join(
                    "Documents"
                )
                .join(
                    safe_game_name
                )
                .join(
                    "Screenshots"
                ),
        ];

    for candidate in
        candidates
    {
        if let Some(info) =
            inspect_screenshot_folder(
                &candidate,
                "Common folder",
            )
        {
            return Some(
                info
            );
        }
    }

    None
}


fn detect_screenshots(
    game_name: &str,
    store: Option<&str>,
    launcher_id: Option<&str>,
    root: &Path,
) -> ScreenshotInfo {
    let is_steam =
        store
            .map(
                |value| {
                    value
                        .eq_ignore_ascii_case(
                            "steam"
                        )
                }
            )
            .unwrap_or(
                false
            );

    if is_steam {
        if let Some(app_id) =
            launcher_id
        {
            if let Some(info) =
                detect_steam_screenshots(
                    app_id
                )
            {
                return info;
            }
        }
    }

    if let Some(info) =
        detect_common_screenshot_folder(
            game_name,
            root,
        )
    {
        return info;
    }

    ScreenshotInfo {
        found:
            false,
        source:
            None,
        folder_path:
            None,
        screenshot_count:
            0,
        newest_path:
            None,
        newest_modified_unix:
            None,
        newest_file_name:
            None,
    }
}



#[tauri::command]
pub fn inspect_local_installation(
    game_name: String,
    install_path: String,
    save_path: Option<String>,
    config_path: Option<String>,
    store: Option<String>,
    launcher_id: Option<String>,
) -> Result<LocalInstallationInfo, String> {
    let total_started =
        Instant::now();

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

    let scan_started =
        Instant::now();

    let scan =
        scan_directory(
            &root
        )?;

    let scan_elapsed =
        scan_started.elapsed();

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

    let special_k =
        detect_special_k(
            &scan.files
        );

    let cheat_engine =
        detect_cheat_engine_tables(
            &scan.files
        );

    let signature_started =
        Instant::now();

    let executable_signatures =
        scan_executable_signatures(
            &executable
        );

    let signature_elapsed =
        signature_started.elapsed();

    let technical_details =
        detect_technical_details(
            &root,
            &scan.files,
            &executable,
            &executable_signatures,
        );

    let storage_details =
        build_storage_details(
            &root,
            &scan,
            &executable,
            save_path
                .as_deref(),
            config_path
                .as_deref(),
        );

    let screenshots =
        detect_screenshots(
            &game_name,
            store
                .as_deref(),
            launcher_id
                .as_deref(),
            &root,
        );

    println!(
        "[LOCAL INSPECTOR] Files visited: {}, truncated: {}",
        scan.visited,
        scan.truncated
    );

    println!(
        "[PERFORMANCE] Local directory scan: {} ms",
        scan_elapsed.as_millis()
    );

    println!(
        "[PERFORMANCE] Executable signature fast path: {} ms",
        signature_elapsed.as_millis()
    );

    println!(
        "[PERFORMANCE] Local installation analysis: {} ms",
        total_started.elapsed().as_millis()
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
            special_k,
            cheat_engine,
            technical_details,
            storage_details,
            screenshots,

            files_scanned:
                scan.visited,

            scan_truncated:
                scan.truncated,
        }
    )
}
