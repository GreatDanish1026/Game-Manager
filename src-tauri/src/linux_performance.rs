use serde::Serialize;
use std::{
    env,
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinuxPerformanceTool {
    pub available: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinuxPerformanceCapabilities {
    pub supported: bool,
    pub platform: String,
    pub mango_hud: LinuxPerformanceTool,
    pub game_mode: LinuxPerformanceTool,
    pub gamescope: LinuxPerformanceTool,
}

fn empty_tool() -> LinuxPerformanceTool {
    LinuxPerformanceTool {
        available: false,
        path: None,
        version: None,
    }
}

#[cfg(target_os = "linux")]
fn strip_ansi_escape_sequences(value: &str) -> String {
    let bytes = value.as_bytes();

    let mut output = String::with_capacity(value.len());

    let mut index = 0usize;

    while index < bytes.len() {
        if bytes[index] == 0x1B {
            index += 1;

            if index < bytes.len() && bytes[index] == b'[' {
                index += 1;

                while index < bytes.len() {
                    let byte = bytes[index];

                    index += 1;

                    if (0x40..=0x7E).contains(&byte) {
                        break;
                    }
                }

                continue;
            }

            continue;
        }

        let character = value[index..].chars().next().expect("valid UTF-8 boundary");

        output.push(character);

        index += character.len_utf8();
    }

    output
}

#[cfg(target_os = "linux")]
fn command_output_text(output: std::process::Output) -> Option<String> {
    let stdout = String::from_utf8_lossy(&output.stdout);

    let stderr = String::from_utf8_lossy(&output.stderr);

    let combined = format!("{}\n{}", stdout, stderr);

    let cleaned = strip_ansi_escape_sequences(&combined);

    let cleaned = cleaned.trim();

    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned.to_string())
    }
}

#[cfg(target_os = "linux")]
fn first_output_line(output: std::process::Output) -> Option<String> {
    if !output.status.success() {
        return None;
    }

    command_output_text(output)?
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

#[cfg(target_os = "linux")]
fn extract_version_token(value: &str) -> Option<String> {
    /*
     * Tool output varies considerably:
     *
     *   MangoHud v0.8.4
     *   gamescope version 3.16.15
     *   gamescope 3.16.15
     *
     * Gamescope can also emit colored diagnostic lines before the version.
     * Scan every cleaned line and return only a version-like token.
     */
    for raw_line in value.lines() {
        let line = raw_line.trim();

        if line.is_empty() {
            continue;
        }

        let lower = line.to_ascii_lowercase();

        /*
         * Prefer lines that look like explicit version output instead of
         * unrelated diagnostics that happen to contain numbers.
         */
        let likely_version_line = lower.contains("version")
            || lower.contains("gamescope")
            || lower.contains("mangohud")
            || lower.contains("gamemode");

        if !likely_version_line {
            continue;
        }

        for raw_token in line.split_whitespace() {
            let token = raw_token.trim_matches(|character: char| {
                !character.is_ascii_alphanumeric()
                    && character != '.'
                    && character != '-'
                    && character != '_'
            });

            let version = token
                .strip_prefix('v')
                .or_else(|| token.strip_prefix('V'))
                .unwrap_or(token);

            let mut parts = version.split('.');

            let Some(first) = parts.next() else {
                continue;
            };

            let Some(second) = parts.next() else {
                continue;
            };

            if first.chars().all(|character| character.is_ascii_digit())
                && second.chars().all(|character| character.is_ascii_digit())
            {
                let remaining_valid = parts.all(|part| {
                    !part.is_empty()
                        && part.chars().all(|character| {
                            character.is_ascii_alphanumeric()
                                || character == '-'
                                || character == '_'
                        })
                });

                if remaining_valid {
                    return Some(format!("v{}", version));
                }
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn tool_version_from_output(program: &str, output: std::process::Output) -> Option<String> {
    if !output.status.success() {
        return None;
    }

    let text = command_output_text(output)?;

    if let Some(version) = extract_version_token(&text) {
        return Some(version);
    }

    /*
     * Keep the old first-line behavior only for tools whose output is
     * already known to be clean. Gamescope diagnostics must never be
     * surfaced as a "version".
     */
    if program != "gamescope" {
        return text
            .lines()
            .map(str::trim)
            .find(|line| !line.is_empty())
            .map(str::to_string);
    }

    None
}

#[cfg(target_os = "linux")]
fn executable_in_path(program: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;

    for directory in env::split_paths(&path) {
        let candidate = directory.join(program);

        if candidate.is_file() {
            return Some(candidate);
        }
    }

    for directory in [
        "/usr/bin",
        "/usr/local/bin",
        "/var/usrlocal/bin",
        "/home/linuxbrew/.linuxbrew/bin",
    ] {
        let candidate = Path::new(directory).join(program);

        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn local_tool_version(program: &str, path: &Path) -> Option<String> {
    for arguments in [["--version"].as_slice(), ["-v"].as_slice()] {
        if let Ok(output) = Command::new(path).args(arguments).output() {
            if let Some(version) = tool_version_from_output(program, output) {
                return Some(version);
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn host_exec_available() -> bool {
    executable_in_path("distrobox-host-exec").is_some()
}

#[cfg(target_os = "linux")]
fn host_command_path(program: &str) -> Option<String> {
    if !host_exec_available() {
        return None;
    }

    let command = format!("command -v -- {}", program);

    let output = Command::new("distrobox-host-exec")
        .args(["sh", "-lc", &command])
        .output()
        .ok()?;

    first_output_line(output)
}

#[cfg(target_os = "linux")]
fn host_tool_version(program: &str, path: &str) -> Option<String> {
    if !host_exec_available() {
        return None;
    }

    for argument in ["--version", "-v"] {
        let output = Command::new("distrobox-host-exec")
            .args([path, argument])
            .output();

        if let Ok(output) = output {
            if let Some(version) = tool_version_from_output(program, output) {
                return Some(version);
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn inspect_tool(program: &str) -> LinuxPerformanceTool {
    /*
     * Production AppImage builds run on the Linux host, so check the current
     * environment first.
     *
     * Development on Bazzite runs GameAtlas inside Distrobox. In that case,
     * gaming tools such as MangoHud and Gamescope may exist only on the host.
     * Fall back to distrobox-host-exec so the development environment reports
     * the same host capabilities that the packaged application will see.
     */
    if let Some(path) = executable_in_path(program) {
        return LinuxPerformanceTool {
            available: true,
            version: local_tool_version(program, &path),
            path: Some(path.to_string_lossy().to_string()),
        };
    }

    if let Some(path) = host_command_path(program) {
        return LinuxPerformanceTool {
            available: true,
            version: host_tool_version(program, &path),
            path: Some(format!("{} (host)", path)),
        };
    }

    empty_tool()
}

#[tauri::command]
pub fn get_linux_performance_capabilities() -> LinuxPerformanceCapabilities {
    #[cfg(target_os = "linux")]
    {
        LinuxPerformanceCapabilities {
            supported: true,
            platform: "linux".to_string(),
            mango_hud: inspect_tool("mangohud"),
            game_mode: inspect_tool("gamemoderun"),
            gamescope: inspect_tool("gamescope"),
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        LinuxPerformanceCapabilities {
            supported: false,
            platform: env::consts::OS.to_string(),
            mango_hud: empty_tool(),
            game_mode: empty_tool(),
            gamescope: empty_tool(),
        }
    }
}
