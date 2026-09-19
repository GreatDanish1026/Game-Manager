use serde::Serialize;

#[cfg(any(target_os = "windows", target_os = "linux"))]
use std::{
    env, fs,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
};

#[cfg(target_os = "windows")]
use std::cmp::Ordering;

#[cfg(target_os = "linux")]
use std::process::Command;

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
    pub platform: String,
    pub executable_name: Option<String>,
    pub architecture: Option<String>,
    pub checks: Vec<DependencyCheck>,
    pub findings: Vec<DependencyFinding>,
    pub bundled_installers: Vec<String>,
    pub summary: String,
    pub scan_limited: bool,
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
#[derive(Debug, Default)]
struct BinaryRequirements {
    vc_runtime_dlls: Vec<String>,
    directx_dlls: Vec<String>,
    openal: bool,
    dotnet_framework: bool,
    xna: bool,
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
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

#[cfg(any(target_os = "windows", target_os = "linux"))]
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

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn contains_ascii(haystack: &[u8], needle: &str) -> bool {
    let needle = needle.as_bytes();
    haystack.windows(needle.len()).any(|window| {
        window
            .iter()
            .zip(needle)
            .all(|(left, right)| left.to_ascii_lowercase() == right.to_ascii_lowercase())
    })
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
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

#[cfg(any(target_os = "windows", target_os = "linux"))]
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

#[cfg(any(target_os = "windows", target_os = "linux"))]
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
        platform: "windows".to_string(),
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

#[cfg(target_os = "linux")]
fn read_elf_architecture(path: &Path) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let mut header = [0u8; 20];
    file.read_exact(&mut header).ok()?;
    if &header[0..4] != b"\x7fELF" {
        return None;
    }
    let class = match header[4] {
        1 => "32-bit",
        2 => "64-bit",
        _ => "Unknown class",
    };
    let machine = if header[5] == 2 {
        u16::from_be_bytes([header[18], header[19]])
    } else {
        u16::from_le_bytes([header[18], header[19]])
    };
    let machine = match machine {
        0x0003 => "x86",
        0x003e => "x86_64",
        0x0028 => "ARM",
        0x00b7 => "ARM64",
        0x00f3 => "RISC-V",
        _ => "Unknown",
    };
    Some(format!("{class} ({machine})"))
}

#[cfg(target_os = "linux")]
fn command_text(program: &str, arguments: &[&str], host: bool) -> Result<String, String> {
    let mut command = if host {
        let mut command = Command::new("distrobox-host-exec");
        command.arg(program);
        command
    } else {
        Command::new(program)
    };
    command
        .args(arguments)
        .env_remove("LD_LIBRARY_PATH")
        .env_remove("PYTHONHOME")
        .env_remove("PYTHONPATH");
    let output = command
        .output()
        .map_err(|error| format!("Could not start {program}: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let text = format!("{}\n{}", stdout, stderr).trim().to_string();
    let lower = text.to_ascii_lowercase();
    if output.status.success()
        || lower.contains("statically linked")
        || lower.contains("not a dynamic executable")
    {
        Ok(text)
    } else {
        Err(if text.is_empty() {
            format!("{program} did not return dependency information.")
        } else {
            text
        })
    }
}

#[cfg(target_os = "linux")]
fn linux_command_text(program: &str, arguments: &[&str]) -> Result<String, String> {
    command_text(program, arguments, false).or_else(|_| command_text(program, arguments, true))
}

#[cfg(target_os = "linux")]
fn parse_elf_interpreter(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let marker = "Requesting program interpreter:";
        let (_, value) = line.split_once(marker)?;
        Some(value.trim().trim_end_matches(']').to_string())
    })
}

#[cfg(target_os = "linux")]
fn missing_ldd_libraries(output: &str) -> Vec<String> {
    output
        .lines()
        .map(str::trim)
        .filter(|line| line.contains("=> not found"))
        .filter_map(|line| line.split_whitespace().next().map(str::to_string))
        .collect()
}

#[cfg(target_os = "linux")]
fn executable_in_path(program: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    env::split_paths(&path)
        .map(|directory| directory.join(program))
        .find(|candidate| candidate.is_file())
}

#[cfg(target_os = "linux")]
fn case_insensitive_file(directory: &Path, name: &str) -> Option<PathBuf> {
    let exact = directory.join(name);
    if exact.is_file() {
        return Some(exact);
    }
    fs::read_dir(directory)
        .ok()?
        .flatten()
        .find(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .eq_ignore_ascii_case(name)
        })
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
}

#[cfg(target_os = "linux")]
fn proton_dll(
    executable: &Path,
    prefix: Option<&Path>,
    architecture: &str,
    name: &str,
) -> Option<PathBuf> {
    if let Some(local) = executable
        .parent()
        .and_then(|directory| case_insensitive_file(directory, name))
    {
        return Some(local);
    }
    let prefix = prefix?;
    let windows = prefix.join("drive_c").join("windows");
    let system = if architecture.eq_ignore_ascii_case("x86") {
        windows.join("syswow64")
    } else {
        windows.join("system32")
    };
    case_insensitive_file(&system, name)
}

#[cfg(target_os = "linux")]
fn build_proton_report(
    install_path: &str,
    executable: &Path,
    architecture_hint: Option<String>,
    proton_prefix: Option<String>,
) -> Result<RuntimeDependencyReport, String> {
    let architecture = read_pe_architecture(executable).or_else(|| {
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
    let requirements = binary_requirements(executable)?;
    let prefix = proton_prefix
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from);
    let prefix_supplied = prefix.is_some();
    let prefix_available = prefix.as_ref().is_some_and(|path| path.is_dir());
    let install_root = PathBuf::from(install_path.trim());
    let (bundled_installers, scan_limited) = if install_root.is_dir() {
        collect_bundled_installers(&install_root)
    } else {
        (Vec::new(), false)
    };
    let mut checks = Vec::new();
    let mut findings = Vec::new();

    checks.push(dependency_check(
        "proton-prefix",
        "Proton / Wine prefix",
        "Compatibility runtime",
        prefix_supplied,
        prefix_available,
        None,
        architecture.clone(),
        if prefix_available {
            format!("The game prefix is available at {}.", prefix.as_ref().unwrap().display())
        } else if prefix_supplied {
            "The configured Proton or Wine prefix path does not currently exist.".to_string()
        } else {
            "The launcher did not provide a Proton or Wine prefix path, so prefix-installed dependencies cannot be verified.".to_string()
        },
        prefix
            .as_ref()
            .map(|path| path.to_string_lossy().to_string())
            .into_iter()
            .collect(),
        (prefix_supplied && !prefix_available).then_some("Launch the game once through its configured launcher to create the prefix, then run this check again."),
    ));
    if prefix_supplied && !prefix_available {
        findings.push(finding(
            "warning",
            "Proton or Wine prefix was not found",
            "GameAtlas can inspect the executable, but cannot confirm prefix-installed Windows runtimes without the game's prefix.",
            Some("Launch the game once through its configured launcher, then run Runtime and Dependency Doctor again."),
        ));
    } else if !prefix_supplied {
        findings.push(finding(
            "info",
            "Compatibility prefix could not be inspected",
            "The launcher did not expose this game's Wine or Proton prefix path, so prefix-installed Windows components are reported as unverified rather than missing.",
            Some("If the launcher exposes a per-game prefix path, add it to the library entry before relying on prefix dependency results."),
        ));
    }

    let mut add_import_check = |id: &str,
                                name: &str,
                                category: &str,
                                imports: Vec<String>,
                                suggestion: &'static str| {
        let required = !imports.is_empty();
        let missing = imports
            .iter()
            .filter(|dll| {
                proton_dll(executable, prefix.as_deref(), &architecture_value, dll).is_none()
            })
            .cloned()
            .collect::<Vec<_>>();
        let available = required && missing.is_empty();
        let mut check = dependency_check(
            id,
            name,
            category,
            required,
            available,
            None,
            architecture.clone(),
            if required {
                if available {
                    "Every recognized imported DLL was found beside the game or in the game's prefix.".to_string()
                } else {
                    format!("The executable imports {}, but these files were not found beside the game or in its prefix: {}.", imports.join(", "), missing.join(", "))
                }
            } else {
                format!("No recognized {name} import was found in the primary executable. Secondary DLLs may still require it.")
            },
            imports.clone(),
            (required && !available && prefix_available).then_some(suggestion),
        );
        if required && !available && !prefix_available {
            check.status = "not verified".to_string();
            check.severity = "info".to_string();
            check.detail = format!("The executable imports {}, but the compatibility prefix was unavailable for inspection.", imports.join(", "));
        }
        checks.push(check);
        if required && !available && prefix_available {
            findings.push(finding(
                "warning",
                format!("{name} files may be missing from the prefix"),
                missing.join(", "),
                Some(suggestion),
            ));
        }
    };

    add_import_check(
        "visual-cpp",
        "Microsoft Visual C++ runtime",
        "Proton Windows runtime",
        requirements.vc_runtime_dlls,
        "Verify the game files first. If the game still reports a missing DLL, use its bundled redistributable or protontricks for this specific prefix.",
    );
    add_import_check(
        "directx-legacy",
        "DirectX legacy components",
        "Proton graphics and input",
        requirements.directx_dlls,
        "Verify the game files first, then use the game's DirectX installer or the matching protontricks component only if the launch error names the missing DLL.",
    );
    add_import_check(
        "openal",
        "OpenAL",
        "Proton audio runtime",
        requirements
            .openal
            .then(|| vec!["OpenAL32.dll".to_string()])
            .unwrap_or_default(),
        "Verify the game files or run the game's bundled OpenAL installer inside this prefix.",
    );
    let managed_roots = prefix
        .as_ref()
        .map(|prefix| prefix.join("drive_c").join("windows"));
    let dotnet_evidence = managed_roots.as_ref().and_then(|windows| {
        [
            windows.join("Microsoft.NET/Framework/v4.0.30319/mscorwks.dll"),
            windows.join("Microsoft.NET/Framework64/v4.0.30319/mscorwks.dll"),
            windows.join("Microsoft.NET/Framework/v2.0.50727/mscorwks.dll"),
            windows.join("mono/mono-2.0/bin/mono.dll"),
        ]
        .into_iter()
        .find(|path| path.is_file())
    });
    let dotnet_available = dotnet_evidence.is_some();
    let mut dotnet_check = dependency_check(
        "dotnet-framework",
        ".NET Framework / Wine Mono",
        "Proton managed runtime",
        requirements.dotnet_framework,
        dotnet_available,
        None,
        architecture.clone(),
        if requirements.dotnet_framework {
            if dotnet_available {
                "The executable contains managed-runtime evidence and the prefix contains a .NET Framework or Wine Mono runtime file.".to_string()
            } else {
                "The executable contains managed-runtime evidence, but the prefix does not show a .NET Framework or Wine Mono installation.".to_string()
            }
        } else {
            "No direct managed-runtime loader import was found in the primary executable.".to_string()
        },
        dotnet_evidence
            .map(|path| path.to_string_lossy().to_string())
            .into_iter()
            .collect(),
        (requirements.dotnet_framework && !dotnet_available && prefix_available).then_some("Confirm the game supports Proton, then install only the required .NET version into this prefix using the launcher's tools or protontricks."),
    );
    if requirements.dotnet_framework && !dotnet_available && !prefix_available {
        dotnet_check.status = "not verified".to_string();
        dotnet_check.severity = "info".to_string();
        dotnet_check.detail = "The executable contains managed-runtime evidence, but the compatibility prefix was unavailable for inspection.".to_string();
    }
    checks.push(dotnet_check);
    if requirements.dotnet_framework && !dotnet_available && prefix_available {
        findings.push(finding(
            "warning",
            "Managed runtime may be missing from the prefix",
            "The primary executable references the Windows managed loader, but no .NET Framework or Wine Mono runtime evidence was found.",
            Some("Check the game's documented Proton requirements before installing the matching .NET component into this prefix."),
        ));
    }

    let xna_evidence = managed_roots.as_ref().and_then(|windows| {
        let path = windows
            .join("assembly")
            .join("GAC_MSIL")
            .join("Microsoft.Xna.Framework");
        path.is_dir().then_some(path)
    });
    let xna_available = xna_evidence.is_some()
        || executable.parent().is_some_and(|directory| {
            case_insensitive_file(directory, "Microsoft.Xna.Framework.dll").is_some()
        });
    let mut xna_check = dependency_check(
        "xna",
        "Microsoft XNA Framework",
        "Proton legacy managed runtime",
        requirements.xna,
        xna_available,
        None,
        architecture.clone(),
        if requirements.xna {
            if xna_available {
                "The executable contains XNA evidence and an XNA assembly was found locally or in the prefix.".to_string()
            } else {
                "The executable contains XNA evidence, but no XNA assembly was found locally or in the prefix.".to_string()
            }
        } else {
            "No XNA Framework reference was found in the primary executable.".to_string()
        },
        xna_evidence
            .map(|path| path.to_string_lossy().to_string())
            .into_iter()
            .collect(),
        (requirements.xna && !xna_available && prefix_available).then_some("Use the game's bundled XNA installer or the appropriate protontricks component for this prefix."),
    );
    if requirements.xna && !xna_available && !prefix_available {
        xna_check.status = "not verified".to_string();
        xna_check.severity = "info".to_string();
        xna_check.detail = "The executable contains XNA evidence, but the compatibility prefix was unavailable for inspection.".to_string();
    }
    checks.push(xna_check);
    if requirements.xna && !xna_available && prefix_available {
        findings.push(finding(
            "warning",
            "XNA Framework may be missing from the prefix",
            "The primary executable contains XNA evidence, but no matching assembly was found.",
            Some("Use the game's bundled XNA installer or the appropriate protontricks component for this prefix."),
        ));
    }

    let protontricks = executable_in_path("protontricks");
    checks.push(dependency_check(
        "protontricks",
        "Protontricks",
        "Repair tooling",
        false,
        protontricks.is_some(),
        None,
        None,
        if protontricks.is_some() {
            "Protontricks is available for targeted prefix repair when a specific dependency is confirmed.".to_string()
        } else {
            "Protontricks was not found. It is optional and should not be installed solely because this inventory entry is absent.".to_string()
        },
        protontricks
            .map(|path| path.to_string_lossy().to_string())
            .into_iter()
            .collect(),
        None,
    ));

    if !bundled_installers.is_empty() {
        findings.push(finding(
            "info",
            "Bundled prerequisite installers found",
            format!("The game includes {} Windows prerequisite installer{} that may be useful inside its prefix.", bundled_installers.len(), if bundled_installers.len() == 1 { "" } else { "s" }),
            Some("Prefer launcher Verify/Repair first. Run a bundled installer only when a matching dependency check or launch error indicates it is needed."),
        ));
    }
    let warning_count = findings
        .iter()
        .filter(|item| item.severity == "warning")
        .count();
    if warning_count == 0 {
        findings.insert(0, finding(
            "good",
            "No confirmed Proton runtime dependency problem found",
            "Recognized imports from the selected executable were found locally or in the game's prefix.",
            None,
        ));
    }
    Ok(RuntimeDependencyReport {
        supported: true,
        platform: "linux".to_string(),
        executable_name: executable
            .file_name()
            .and_then(|name| name.to_str())
            .map(str::to_string),
        architecture,
        checks,
        findings,
        bundled_installers,
        summary: if warning_count == 0 {
            "No confirmed Proton runtime dependency problem found.".to_string()
        } else {
            format!(
                "Found {warning_count} possible Proton runtime dependency problem{}.",
                if warning_count == 1 { "" } else { "s" }
            )
        },
        scan_limited,
    })
}

#[cfg(target_os = "linux")]
fn build_native_linux_report(executable: &Path) -> Result<RuntimeDependencyReport, String> {
    let architecture = read_elf_architecture(executable)
        .ok_or_else(|| "The selected file is not a supported Linux ELF executable.".to_string())?;
    let executable_text = executable.to_string_lossy().to_string();
    let readelf = linux_command_text("readelf", &["-l", &executable_text]).unwrap_or_default();
    let interpreter = parse_elf_interpreter(&readelf);
    let interpreter_available = interpreter
        .as_deref()
        .map(Path::new)
        .is_some_and(Path::is_file);
    let ldd = linux_command_text("ldd", &[&executable_text])?;
    let missing = missing_ldd_libraries(&ldd);
    let static_binary = ldd.to_ascii_lowercase().contains("statically linked");
    let dependency_evidence = ldd
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(24)
        .map(str::to_string)
        .collect::<Vec<_>>();
    let mut checks = Vec::new();
    let mut findings = Vec::new();

    checks.push(dependency_check(
        "elf-interpreter",
        "ELF dynamic loader",
        "Native Linux runtime",
        interpreter.is_some(),
        interpreter.is_none() || interpreter_available,
        None,
        Some(architecture.clone()),
        match interpreter.as_deref() {
            Some(value) if interpreter_available => format!("The executable requests {value}, and that loader is available."),
            Some(value) => format!("The executable requests {value}, but that loader was not found on the host."),
            None if static_binary => "The executable appears to be statically linked and does not request a dynamic loader.".to_string(),
            None => "No ELF interpreter was reported.".to_string(),
        },
        interpreter.clone().into_iter().collect(),
        (interpreter.is_some() && !interpreter_available).then_some("Install the matching Linux architecture runtime. For a 32-bit game on Bazzite, ensure the required 32-bit runtime is available through Steam Linux Runtime or the host."),
    ));
    if interpreter.is_some() && !interpreter_available {
        findings.push(finding(
            "warning",
            "Required ELF loader appears to be missing",
            interpreter.clone().unwrap_or_default(),
            Some("Use Steam Linux Runtime when supported, or install the matching host architecture runtime."),
        ));
    }

    checks.push(dependency_check(
        "shared-libraries",
        "Native shared libraries",
        "Native Linux runtime",
        !static_binary,
        missing.is_empty(),
        None,
        Some(architecture.clone()),
        if static_binary {
            "The executable reports that it is statically linked.".to_string()
        } else if missing.is_empty() {
            "The host dynamic loader resolved every library reported for the primary executable.".to_string()
        } else {
            format!("The host dynamic loader could not resolve: {}.", missing.join(", "))
        },
        dependency_evidence,
        (!missing.is_empty()).then_some("Verify the game files and use the game's intended Steam Linux Runtime or container before adding host packages. Host ldd results may differ from the launcher's runtime container."),
    ));
    if !missing.is_empty() {
        findings.push(finding(
            "warning",
            "Native shared libraries appear unresolved",
            missing.join(", "),
            Some("Verify the game files and confirm the intended Steam Linux Runtime is selected. Install host libraries only when the game is designed to use the host runtime."),
        ));
    }

    let loader_inventory = linux_command_text("ldconfig", &["-p"]).unwrap_or_default();
    for (id, name, needle, category) in [
        (
            "vulkan-loader",
            "Vulkan loader",
            "libvulkan.so",
            "Graphics runtime",
        ),
        (
            "opengl-loader",
            "OpenGL loader",
            "libGL.so",
            "Graphics runtime",
        ),
        (
            "sdl2",
            "SDL 2",
            "libSDL2",
            "Input, window, and audio runtime",
        ),
    ] {
        let available = loader_inventory.contains(needle);
        checks.push(dependency_check(
            id,
            name,
            category,
            false,
            available,
            None,
            Some(architecture.clone()),
            if available {
                format!("The host library cache contains {needle}.")
            } else {
                format!("{needle} was not found in the host library cache. The game may bundle it or obtain it from Steam Linux Runtime.")
            },
            Vec::new(),
            None,
        ));
    }

    if findings.is_empty() {
        findings.push(finding(
            "good",
            "No confirmed native Linux dependency problem found",
            "The ELF loader and directly linked libraries do not show an unresolved dependency.",
            None,
        ));
    }
    let warning_count = findings
        .iter()
        .filter(|item| item.severity == "warning")
        .count();
    Ok(RuntimeDependencyReport {
        supported: true,
        platform: "linux".to_string(),
        executable_name: executable
            .file_name()
            .and_then(|name| name.to_str())
            .map(str::to_string),
        architecture: Some(architecture),
        checks,
        findings,
        bundled_installers: Vec::new(),
        summary: if warning_count == 0 {
            "No confirmed native Linux dependency problem found.".to_string()
        } else {
            format!(
                "Found {warning_count} possible native Linux dependency problem{}.",
                if warning_count == 1 { "" } else { "s" }
            )
        },
        scan_limited: false,
    })
}

#[cfg(target_os = "linux")]
fn build_linux_script_report(executable: &Path) -> Result<RuntimeDependencyReport, String> {
    use std::os::unix::fs::PermissionsExt;

    let file = fs::File::open(executable)
        .map_err(|error| format!("Could not read the launcher script: {error}"))?;
    let mut text = String::new();
    file.take(8 * 1024)
        .read_to_string(&mut text)
        .map_err(|error| format!("Could not decode the launcher script: {error}"))?;
    let shebang = text
        .lines()
        .next()
        .and_then(|line| line.strip_prefix("#!"))
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .ok_or_else(|| {
            "The selected file is not an ELF executable or launcher script.".to_string()
        })?;
    let mut parts = shebang.split_whitespace();
    let launcher = parts.next().unwrap_or_default();
    let interpreter = if launcher.ends_with("/env") {
        parts.next().unwrap_or_default()
    } else {
        launcher
    };
    let interpreter_path = if interpreter.contains('/') {
        let path = PathBuf::from(interpreter);
        path.is_file().then_some(path)
    } else {
        executable_in_path(interpreter)
    };
    let executable_permission = fs::metadata(executable)
        .map(|metadata| metadata.permissions().mode() & 0o111 != 0)
        .unwrap_or(false);
    let mut checks = vec![dependency_check(
        "script-interpreter",
        "Launcher script interpreter",
        "Native Linux launcher",
        true,
        interpreter_path.is_some(),
        None,
        Some("Script".to_string()),
        interpreter_path
            .as_ref()
            .map(|path| {
                format!(
                    "The launcher requests {shebang}, resolved to {}.",
                    path.display()
                )
            })
            .unwrap_or_else(|| {
                format!(
                    "The launcher requests {shebang}, but its interpreter could not be resolved."
                )
            }),
        interpreter_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string())
            .into_iter()
            .collect(),
        interpreter_path
            .is_none()
            .then_some("Install the requested script interpreter or repair the game installation."),
    )];
    checks.push(dependency_check(
        "script-permission",
        "Executable permission",
        "Native Linux launcher",
        true,
        executable_permission,
        None,
        Some("Script".to_string()),
        if executable_permission {
            "The launcher script has an executable permission bit.".to_string()
        } else {
            "The launcher script does not have an executable permission bit.".to_string()
        },
        vec![executable.to_string_lossy().to_string()],
        (!executable_permission).then_some("Verify or repair the game installation so the launcher script's executable permission is restored."),
    ));
    let findings = if interpreter_path.is_some() && executable_permission {
        vec![finding(
            "good",
            "No confirmed launcher-script dependency problem found",
            "The requested interpreter is available and the script is executable.",
            None,
        )]
    } else {
        vec![finding(
            "warning",
            "Launcher script cannot be executed as configured",
            "The script interpreter or executable permission is unavailable.",
            Some("Repair the game installation before changing unrelated system libraries."),
        )]
    };
    Ok(RuntimeDependencyReport {
        supported: true,
        platform: "linux".to_string(),
        executable_name: executable
            .file_name()
            .and_then(|name| name.to_str())
            .map(str::to_string),
        architecture: Some("Script".to_string()),
        checks,
        findings,
        bundled_installers: Vec::new(),
        summary: if interpreter_path.is_some() && executable_permission {
            "No confirmed launcher-script dependency problem found.".to_string()
        } else {
            "Found a launcher-script dependency problem.".to_string()
        },
        scan_limited: false,
    })
}

#[cfg(target_os = "linux")]
fn build_linux_report(
    install_path: String,
    executable_path: String,
    architecture: Option<String>,
    proton_prefix: Option<String>,
) -> Result<RuntimeDependencyReport, String> {
    let executable = PathBuf::from(executable_path.trim());
    if !executable.is_file() {
        return Err("The selected game's executable could not be found.".to_string());
    }
    if read_pe_architecture(&executable).is_some() {
        build_proton_report(&install_path, &executable, architecture, proton_prefix)
    } else if read_elf_architecture(&executable).is_some() {
        build_native_linux_report(&executable)
    } else {
        build_linux_script_report(&executable)
    }
}

#[cfg(all(test, target_os = "linux"))]
mod linux_tests {
    use super::{missing_ldd_libraries, parse_elf_interpreter, read_elf_architecture};
    use std::path::Path;

    #[test]
    fn parses_elf_interpreter() {
        let output = "      [Requesting program interpreter: /lib64/ld-linux-x86-64.so.2]";
        assert_eq!(
            parse_elf_interpreter(output).as_deref(),
            Some("/lib64/ld-linux-x86-64.so.2")
        );
    }

    #[test]
    fn parses_only_unresolved_ldd_entries() {
        let output = r#"
libSDL2-2.0.so.0 => /lib64/libSDL2-2.0.so.0 (0x00007f00)
libmissing-game.so => not found
libc.so.6 => /lib64/libc.so.6 (0x00007f01)
"#;
        assert_eq!(
            missing_ldd_libraries(output),
            vec!["libmissing-game.so".to_string()]
        );
    }

    #[test]
    fn reads_current_linux_executable_architecture() {
        assert!(read_elf_architecture(Path::new("/proc/self/exe")).is_some());
    }
}

#[tauri::command]
pub async fn get_runtime_dependency_report(
    install_path: String,
    executable_path: String,
    architecture: Option<String>,
    proton_prefix: Option<String>,
) -> Result<RuntimeDependencyReport, String> {
    #[cfg(target_os = "windows")]
    {
        return tauri::async_runtime::spawn_blocking(move || {
            build_report(install_path, executable_path, architecture)
        })
        .await
        .map_err(|error| format!("Runtime dependency worker failed: {error}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        return tauri::async_runtime::spawn_blocking(move || {
            build_linux_report(install_path, executable_path, architecture, proton_prefix)
        })
        .await
        .map_err(|error| format!("Runtime dependency worker failed: {error}"))?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = (install_path, executable_path, architecture, proton_prefix);
        Ok(RuntimeDependencyReport {
            supported: false,
            platform: std::env::consts::OS.to_string(),
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
