use serde::Serialize;

#[cfg(target_os = "windows")]
use std::{
    cmp::Ordering,
    env, fs,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
};

#[cfg(target_os = "windows")]
use winreg::{
    enums::{HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY},
    RegKey,
};

const MAX_BINARY_BYTES: u64 = 64 * 1024 * 1024;
const MAX_INSTALLER_ENTRIES: usize = 6000;
const MAX_INSTALLER_DEPTH: usize = 4;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyCheck {
    pub id: String,
    pub name: String,
    pub category: String,
    pub status: String,
    pub severity: String,
    pub required: bool,
    pub version: Option<String>,
    pub architecture: Option<String>,
    pub detail: String,
    pub evidence: Vec<String>,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyFinding {
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDependencyReport {
    pub supported: bool,
    pub executable_name: Option<String>,
    pub architecture: Option<String>,
    pub checks: Vec<DependencyCheck>,
    pub findings: Vec<DependencyFinding>,
    pub bundled_installers: Vec<String>,
    pub summary: String,
    pub scan_limited: bool,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Default)]
struct BinaryRequirements {
    vc_runtime_dlls: Vec<String>,
    directx_dlls: Vec<String>,
    openal: bool,
    dotnet_framework: bool,
    xna: bool,
}

#[cfg(target_os = "windows")]
fn finding(
    severity: &str,
    title: impl Into<String>,
    detail: impl Into<String>,
    suggestion: Option<&str>,
) -> DependencyFinding {
    DependencyFinding {
        severity: severity.to_string(),
        title: title.into(),
        detail: detail.into(),
        suggestion: suggestion.map(str::to_string),
    }
}

#[cfg(target_os = "windows")]
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

#[cfg(target_os = "windows")]
fn contains_ascii(haystack: &[u8], needle: &str) -> bool {
    let needle = needle.as_bytes();
    haystack.windows(needle.len()).any(|window| {
        window
            .iter()
            .zip(needle)
            .all(|(left, right)| left.to_ascii_lowercase() == right.to_ascii_lowercase())
    })
}

#[cfg(target_os = "windows")]
fn binary_requirements(path: &Path) -> Result<BinaryRequirements, String> {
    let file = fs::File::open(path)
        .map_err(|error| format!("Could not open the selected executable: {error}"))?;
    let mut bytes = Vec::new();
    file.take(MAX_BINARY_BYTES)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not inspect the selected executable: {error}"))?;

    let mut requirements = BinaryRequirements::default();
    for name in [
        "vcruntime140.dll",
        "vcruntime140_1.dll",
        "msvcp140.dll",
        "concrt140.dll",
        "vcomp140.dll",
        "msvcr120.dll",
        "msvcp120.dll",
        "msvcr110.dll",
        "msvcp110.dll",
        "msvcr100.dll",
        "msvcp100.dll",
        "msvcr90.dll",
        "msvcp90.dll",
        "msvcr80.dll",
        "msvcp80.dll",
    ] {
        if contains_ascii(&bytes, name) {
            requirements.vc_runtime_dlls.push(name.to_string());
        }
    }

    for name in [
        "d3dx9_43.dll",
        "d3dcompiler_43.dll",
        "d3dcompiler_42.dll",
        "xinput1_3.dll",
        "x3daudio1_7.dll",
        "xaudio2_7.dll",
    ] {
        if contains_ascii(&bytes, name) {
            requirements.directx_dlls.push(name.to_string());
        }
    }

    requirements.openal = contains_ascii(&bytes, "openal32.dll");
    requirements.dotnet_framework =
        contains_ascii(&bytes, "mscoree.dll") || contains_ascii(&bytes, "Microsoft.NETFramework");
    requirements.xna = contains_ascii(&bytes, "Microsoft.Xna.Framework");
    Ok(requirements)
}

#[cfg(target_os = "windows")]
fn windows_directory() -> PathBuf {
    env::var_os("WINDIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Windows"))
}

#[cfg(target_os = "windows")]
fn system_directory(architecture: &str) -> PathBuf {
    if architecture.eq_ignore_ascii_case("x86") {
        windows_directory().join("SysWOW64")
    } else {
        windows_directory().join("System32")
    }
}

#[cfg(target_os = "windows")]
fn local_or_system_dll(executable: &Path, architecture: &str, name: &str) -> Option<PathBuf> {
    let local = executable.parent()?.join(name);
    if local.is_file() {
        return Some(local);
    }
    let system = system_directory(architecture).join(name);
    system.is_file().then_some(system)
}

#[cfg(target_os = "windows")]
fn vc14_registry_version(architecture: &str) -> Option<String> {
    let subkey = format!(
        r"SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\{}",
        architecture.to_ascii_lowercase()
    );
    for view in [KEY_WOW64_64KEY, KEY_WOW64_32KEY] {
        let Ok(key) =
            RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey_with_flags(&subkey, KEY_READ | view)
        else {
            continue;
        };
        let installed: u32 = key.get_value("Installed").unwrap_or_default();
        if installed == 1 {
            if let Ok(version) = key.get_value::<String, _>("Version") {
                return Some(version.trim_start_matches('v').to_string());
            }
            return Some("Installed".to_string());
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn dotnet_framework_version() -> Option<String> {
    for view in [KEY_WOW64_32KEY, KEY_WOW64_64KEY] {
        let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey_with_flags(
            r"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full",
            KEY_READ | view,
        ) else {
            continue;
        };
        if let Ok(version) = key.get_value::<String, _>("Version") {
            return Some(version);
        }
        if let Ok(release) = key.get_value::<u32, _>("Release") {
            let label = match release {
                533320.. => "4.8.1 or newer",
                528040.. => "4.8",
                461808.. => "4.7.2",
                461308.. => "4.7.1",
                460798.. => "4.7",
                394802.. => "4.6.2",
                394254.. => "4.6.1",
                393295.. => "4.6",
                _ => "4.x",
            };
            return Some(label.to_string());
        }
    }

    let framework_root = windows_directory().join(r"Microsoft.NET");
    if framework_root
        .join(r"Framework64\v2.0.50727\mscorwks.dll")
        .is_file()
        || framework_root
            .join(r"Framework\v2.0.50727\mscorwks.dll")
            .is_file()
    {
        return Some("2.0/3.5 runtime files detected".to_string());
    }

    None
}

#[cfg(target_os = "windows")]
fn compare_versions(left: &str, right: &str) -> Ordering {
    let parse = |value: &str| {
        value
            .split('.')
            .map(|part| part.parse::<u32>().unwrap_or_default())
            .collect::<Vec<_>>()
    };
    parse(left).cmp(&parse(right))
}

#[cfg(target_os = "windows")]
fn newest_directory(path: &Path) -> Option<String> {
    let mut versions = fs::read_dir(path)
        .ok()?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| entry.file_name().to_str().map(str::to_string))
        .collect::<Vec<_>>();
    versions.sort_by(|left, right| compare_versions(left, right));
    versions.pop()
}

#[cfg(target_os = "windows")]
fn dotnet_desktop_runtime(architecture: &str) -> Option<String> {
    let root = if architecture.eq_ignore_ascii_case("x86") {
        env::var_os("ProgramFiles(x86)").map(PathBuf::from)
    } else {
        env::var_os("ProgramFiles").map(PathBuf::from)
    }?;
    newest_directory(&root.join(r"dotnet\shared\Microsoft.WindowsDesktop.App"))
}

#[cfg(target_os = "windows")]
fn xna_installed() -> bool {
    windows_directory()
        .join(r"Microsoft.NET\assembly\GAC_MSIL\Microsoft.Xna.Framework")
        .is_dir()
}

#[cfg(target_os = "windows")]
fn collect_bundled_installers(root: &Path) -> (Vec<String>, bool) {
    let mut found = Vec::new();
    let mut stack = vec![(root.to_path_buf(), 0usize)];
    let mut visited = 0usize;
    let mut limited = false;

    while let Some((directory, depth)) = stack.pop() {
        let Ok(entries) = fs::read_dir(directory) else {
            continue;
        };
        for entry in entries.flatten() {
            visited += 1;
            if visited > MAX_INSTALLER_ENTRIES {
                limited = true;
                break;
            }
            let path = entry.path();
            if path.is_dir() {
                if depth < MAX_INSTALLER_DEPTH {
                    stack.push((path, depth + 1));
                }
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
            let relevant = name == "dxsetup.exe"
                || name.starts_with("vc_redist") && name.ends_with(".exe")
                || name.starts_with("vcredist") && name.ends_with(".exe")
                || name.contains("xnafx") && name.ends_with(".msi")
                || name.contains("oalinst") && name.ends_with(".exe")
                || name.contains("dotnet") && name.ends_with(".exe");
            if relevant {
                found.push(path.to_string_lossy().to_string());
            }
        }
        if limited {
            break;
        }
    }
    found.sort();
    found.dedup();
    (found, limited)
}

#[cfg(target_os = "windows")]
fn dependency_check(
    id: &str,
    name: &str,
    category: &str,
    required: bool,
    available: bool,
    version: Option<String>,
    architecture: Option<String>,
    detail: String,
    evidence: Vec<String>,
    suggestion: Option<&str>,
) -> DependencyCheck {
    DependencyCheck {
        id: id.to_string(),
        name: name.to_string(),
        category: category.to_string(),
        status: if available {
            "available".to_string()
        } else if required {
            "missing".to_string()
        } else {
            "not detected".to_string()
        },
        severity: if available {
            "good".to_string()
        } else if required {
            "warning".to_string()
        } else {
            "info".to_string()
        },
        required,
        version,
        architecture,
        detail,
        evidence,
        suggestion: suggestion.map(str::to_string),
    }
}

#[cfg(target_os = "windows")]
fn build_report(
    install_path: String,
    executable_path: String,
    architecture_hint: Option<String>,
) -> Result<RuntimeDependencyReport, String> {
    let executable = PathBuf::from(executable_path.trim());
    if !executable.is_file() {
        return Err("The selected game's executable could not be found.".to_string());
    }
    let architecture = read_pe_architecture(&executable).or_else(|| {
        architecture_hint.map(|value| {
            if value.contains("32-bit") {
                "x86".to_string()
            } else if value.contains("64-bit") {
                "x64".to_string()
            } else {
                value
            }
        })
    });
    let architecture_value = architecture.clone().unwrap_or_else(|| "x64".to_string());
    let requirements = binary_requirements(&executable)?;
    let install_root = PathBuf::from(install_path.trim());
    let (bundled_installers, scan_limited) = if install_root.is_dir() {
        collect_bundled_installers(&install_root)
    } else {
        (Vec::new(), false)
    };

    let mut checks = Vec::new();
    let mut findings = Vec::new();

    let vc_required = !requirements.vc_runtime_dlls.is_empty();
    let missing_vc = requirements
        .vc_runtime_dlls
        .iter()
        .filter(|name| local_or_system_dll(&executable, &architecture_value, name).is_none())
        .cloned()
        .collect::<Vec<_>>();
    let vc_version = vc14_registry_version(&architecture_value);
    let vc_available = if vc_required {
        missing_vc.is_empty()
    } else {
        vc_version.is_some()
    };
    checks.push(dependency_check(
        "visual-cpp",
        "Microsoft Visual C++ runtime",
        "Native runtime",
        vc_required,
        vc_available,
        vc_version,
        architecture.clone(),
        if vc_required {
            if vc_available {
                "Every Visual C++ runtime DLL imported by the selected executable is available beside the game or in the matching Windows system directory.".to_string()
            } else {
                format!("The selected executable imports {}, but Windows could not find {} for the matching architecture.", requirements.vc_runtime_dlls.join(", "), missing_vc.join(", "))
            }
        } else {
            "No known Visual C++ runtime import was found in the selected executable. Other game DLLs may still use one.".to_string()
        },
        requirements.vc_runtime_dlls.clone(),
        (vc_required && !vc_available).then_some("Verify the game files, then repair the matching Microsoft Visual C++ redistributable. Use the game's bundled installer when available."),
    ));
    if vc_required && !vc_available {
        findings.push(finding(
            "warning",
            "Required Visual C++ files appear to be missing",
            format!(
                "Missing for {}: {}.",
                architecture_value,
                missing_vc.join(", ")
            ),
            Some("Repair the matching Visual C++ redistributable or verify the game files."),
        ));
    }

    let dx_required = !requirements.directx_dlls.is_empty();
    let missing_dx = requirements
        .directx_dlls
        .iter()
        .filter(|name| local_or_system_dll(&executable, &architecture_value, name).is_none())
        .cloned()
        .collect::<Vec<_>>();
    let dx_available = dx_required && missing_dx.is_empty();
    checks.push(dependency_check(
        "directx-legacy",
        "DirectX legacy components",
        "Graphics and input",
        dx_required,
        dx_available,
        None,
        architecture.clone(),
        if dx_required {
            if dx_available {
                "The legacy DirectX helper DLLs imported by the executable are available.".to_string()
            } else {
                format!("Modern Windows includes DirectX, but this game also imports optional legacy files that are not present: {}.", missing_dx.join(", "))
            }
        } else {
            "No known legacy DirectX helper import was found. DirectX 11 and 12 core components are supplied by Windows.".to_string()
        },
        requirements.directx_dlls.clone(),
        (!dx_available).then_some("Run the game's bundled DirectX setup or verify its files; Windows Update alone may not add these legacy side-by-side components."),
    ));
    if !dx_available {
        findings.push(finding(
            "warning",
            "Legacy DirectX component appears to be missing",
            missing_dx.join(", "),
            Some("Use the game's DirectX redistributable or verify the installation."),
        ));
    }

    let openal_path = local_or_system_dll(&executable, &architecture_value, "OpenAL32.dll");
    checks.push(dependency_check(
        "openal",
        "OpenAL",
        "Audio runtime",
        requirements.openal,
        openal_path.is_some(),
        None,
        architecture.clone(),
        if requirements.openal {
            openal_path.as_ref().map(|path| format!("OpenAL is available at {}.", path.display())).unwrap_or_else(|| "The executable imports OpenAL32.dll, but it was not found beside the game or in the matching Windows system directory.".to_string())
        } else {
            "The selected executable does not directly import OpenAL.".to_string()
        },
        openal_path.map(|path| path.to_string_lossy().to_string()).into_iter().collect(),
        (requirements.openal && local_or_system_dll(&executable, &architecture_value, "OpenAL32.dll").is_none()).then_some("Verify the game files or run its bundled OpenAL installer."),
    ));

    let framework_version = dotnet_framework_version();
    checks.push(dependency_check(
        "dotnet-framework",
        ".NET Framework",
        "Managed runtime",
        requirements.dotnet_framework,
        framework_version.is_some(),
        framework_version.clone(),
        architecture.clone(),
        if requirements.dotnet_framework {
            framework_version.as_ref().map(|version| format!("The executable shows managed .NET Framework evidence and Windows reports .NET Framework {version}."))
                .unwrap_or_else(|| "The executable shows managed .NET Framework evidence, but a .NET Framework 4 Full installation was not detected.".to_string())
        } else {
            "No direct .NET Framework loader import was found in the selected executable.".to_string()
        },
        Vec::new(),
        (requirements.dotnet_framework && framework_version.is_none()).then_some("Enable or repair .NET Framework through Windows Features or the game's prerequisite installer."),
    ));

    let desktop_runtime = dotnet_desktop_runtime(&architecture_value);
    checks.push(dependency_check(
        "dotnet-desktop",
        ".NET Desktop Runtime",
        "Managed runtime inventory",
        false,
        desktop_runtime.is_some(),
        desktop_runtime,
        architecture.clone(),
        "This inventory entry shows the newest architecture-matching .NET Desktop Runtime found. Native games normally do not require it.".to_string(),
        Vec::new(),
        None,
    ));

    let local_xna = executable
        .parent()
        .map(|directory| directory.join("Microsoft.Xna.Framework.dll"))
        .filter(|path| path.is_file());
    let xna_available = xna_installed() || local_xna.is_some();
    checks.push(dependency_check(
        "xna",
        "Microsoft XNA Framework",
        "Legacy managed runtime",
        requirements.xna,
        xna_available,
        None,
        architecture.clone(),
        if requirements.xna {
            if xna_available { "The executable contains XNA framework evidence and an XNA assembly is installed.".to_string() } else { "The executable contains XNA framework evidence, but GameAtlas could not find the XNA Framework assembly.".to_string() }
        } else {
            "No XNA Framework reference was found in the selected executable.".to_string()
        },
        local_xna
            .map(|path| path.to_string_lossy().to_string())
            .into_iter()
            .collect(),
        (requirements.xna && !xna_available).then_some("Run the game's bundled XNA Framework installer or verify the game files."),
    ));

    for check in &checks {
        if check.required
            && check.severity == "warning"
            && check.id != "visual-cpp"
            && check.id != "directx-legacy"
        {
            findings.push(finding(
                "warning",
                format!("{} may be unavailable", check.name),
                check.detail.clone(),
                check.suggestion.as_deref(),
            ));
        }
    }

    if !bundled_installers.is_empty() {
        findings.push(finding(
            "info",
            "Bundled prerequisite installers found",
            format!("The game includes {} redistributable installer{} that may be useful for repair.", bundled_installers.len(), if bundled_installers.len() == 1 { "" } else { "s" }),
            Some("Prefer Verify/Repair in the game launcher first. Only run a bundled installer when a relevant runtime check indicates a problem."),
        ));
    }

    let warning_count = findings
        .iter()
        .filter(|item| item.severity == "warning")
        .count();
    if warning_count == 0 {
        findings.insert(0, finding(
            "good",
            "No confirmed runtime dependency problem found",
            "Known imports from the selected executable are available, or no direct requirement was detected.",
            None,
        ));
    }

    let summary = if warning_count == 0 {
        "No confirmed runtime dependency problem found.".to_string()
    } else {
        format!(
            "Found {warning_count} possible runtime dependency problem{}.",
            if warning_count == 1 { "" } else { "s" }
        )
    };

    Ok(RuntimeDependencyReport {
        supported: true,
        executable_name: executable
            .file_name()
            .and_then(|name| name.to_str())
            .map(str::to_string),
        architecture,
        checks,
        findings,
        bundled_installers,
        summary,
        scan_limited,
    })
}

#[tauri::command]
pub async fn get_runtime_dependency_report(
    install_path: String,
    executable_path: String,
    architecture: Option<String>,
) -> Result<RuntimeDependencyReport, String> {
    #[cfg(target_os = "windows")]
    {
        return tauri::async_runtime::spawn_blocking(move || {
            build_report(install_path, executable_path, architecture)
        })
        .await
        .map_err(|error| format!("Runtime dependency worker failed: {error}"))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (install_path, executable_path, architecture);
        Ok(RuntimeDependencyReport {
            supported: false,
            executable_name: None,
            architecture: None,
            checks: Vec::new(),
            findings: Vec::new(),
            bundled_installers: Vec::new(),
            summary: "Runtime and Dependency Doctor is currently available on Windows.".to_string(),
            scan_limited: false,
        })
    }
}
