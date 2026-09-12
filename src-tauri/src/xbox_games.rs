use std::process::Command;

use serde::Serialize;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct XboxInstalledGame {
    pub id: String,
    pub name: String,
    pub store: String,
    pub launcher_id: String,
    pub install_path: String,
}

#[cfg(target_os = "windows")]
fn powershell_output(script: &str) -> Result<String, String> {
    let mut command = Command::new("powershell.exe");

    command
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .creation_flags(CREATE_NO_WINDOW);

    let output = command.output().map_err(|error| {
        format!("Could not start PowerShell for Xbox / Microsoft Store discovery: {error}")
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        return Err(if stderr.is_empty() {
            format!(
                "Xbox / Microsoft Store discovery failed with exit code {:?}.",
                output.status.code()
            )
        } else {
            stderr
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(not(target_os = "windows"))]
fn powershell_output(_script: &str) -> Result<String, String> {
    Err("Xbox / Microsoft Store discovery is only available on Windows.".to_string())
}

fn clean_field(value: &str) -> String {
    value
        .replace('\r', " ")
        .replace('\n', " ")
        .replace('\t', " ")
        .trim()
        .to_string()
}

#[tauri::command]
pub fn get_xbox_installed_games() -> Result<Vec<XboxInstalledGame>, String> {
    /*
     * This intentionally targets retail GDK games rather than every AppX
     * package on Windows. GDK titles include MicrosoftGame.config, which
     * gives us a strong game signal and avoids flooding the library with
     * Windows system apps.
     *
     * Get-StartApps is used to resolve the user-facing name for the AUMID
     * whenever Windows has one registered.
     */
    let script = r#"
$ErrorActionPreference = 'SilentlyContinue'

function Clean([object]$value) {
    if ($null -eq $value) {
        return ''
    }

    return (
        [string]$value
    ).Replace(
        "`t",
        " "
    ).Replace(
        "`r",
        " "
    ).Replace(
        "`n",
        " "
    ).Trim()
}

$startNames = @{}

Get-StartApps |
    ForEach-Object {
        if (
            $_.AppID -and
            $_.Name
        ) {
            $startNames[
                [string]$_.AppID
            ] =
                [string]$_.Name
        }
    }

Get-AppxPackage |
    ForEach-Object {
        $package =
            $_

        $location =
            [string]$package.InstallLocation

        if (
            [string]::IsNullOrWhiteSpace(
                $location
            )
        ) {
            return
        }

        $configPath =
            Join-Path `
                $location `
                'MicrosoftGame.config'

        if (
            -not (
                Test-Path `
                    -LiteralPath $configPath `
                    -PathType Leaf
            )
        ) {
            return
        }

        try {
            [xml]$config =
                Get-Content `
                    -LiteralPath $configPath `
                    -Raw

            $executables =
                @(
                    $config.Game.ExecutableList.Executable
                )

            $executableId =
                ''

            foreach (
                $executable in
                $executables
            ) {
                if (
                    $executable.Id
                ) {
                    $executableId =
                        [string]$executable.Id

                    break
                }
            }

            if (
                [string]::IsNullOrWhiteSpace(
                    $executableId
                )
            ) {
                $executableId =
                    'Game'
            }

            $pfn =
                [string]$package.PackageFamilyName

            if (
                [string]::IsNullOrWhiteSpace(
                    $pfn
                )
            ) {
                return
            }

            $aumid =
                "$pfn!$executableId"

            $displayName =
                ''

            if (
                $startNames.ContainsKey(
                    $aumid
                )
            ) {
                $displayName =
                    [string]$startNames[
                        $aumid
                    ]
            }

            if (
                [string]::IsNullOrWhiteSpace(
                    $displayName
                )
            ) {
                $shellVisuals =
                    $config.Game.ShellVisuals

                if (
                    $shellVisuals -and
                    $shellVisuals.DefaultDisplayName
                ) {
                    $displayName =
                        [string]$shellVisuals.DefaultDisplayName
                }
            }

            if (
                [string]::IsNullOrWhiteSpace(
                    $displayName
                ) -or
                $displayName.StartsWith(
                    'ms-resource:'
                )
            ) {
                $displayName =
                    [string]$package.Name
            }

            @(
                Clean $displayName
                Clean $aumid
                Clean $location
            ) -join "`t"
        }
        catch {
        }
    }
"#;

    let output = powershell_output(script)?;

    let mut games = Vec::new();

    for line in output.lines() {
        let fields: Vec<&str> = line.split('\t').collect();

        if fields.len() < 3 {
            continue;
        }

        let name = clean_field(fields[0]);

        let aumid = clean_field(fields[1]);

        let install_path = clean_field(fields[2]);

        if name.is_empty() || aumid.is_empty() {
            continue;
        }

        games.push(XboxInstalledGame {
            id: format!("xbox:{}", aumid.to_ascii_lowercase()),

            name,

            store: "Xbox / Microsoft Store".to_string(),

            launcher_id: aumid,

            install_path,
        });
    }

    games.sort_by(|left, right| {
        left.name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase())
    });

    games.dedup_by(|left, right| left.launcher_id.eq_ignore_ascii_case(&right.launcher_id));

    Ok(games)
}

pub fn launch_xbox_aumid(aumid: &str) -> Result<(), String> {
    let value = aumid.trim();

    if value.is_empty() {
        return Err("Xbox / Microsoft Store launch ID is missing.".to_string());
    }

    if !value.contains('!') {
        return Err(format!(
            "Xbox / Microsoft Store launch ID is not a valid AUMID: {value}"
        ));
    }

    #[cfg(target_os = "windows")]
    {
        /*
         * Retail Store/GDK titles are registered with Windows shell by
         * AUMID. Starting the AppsFolder shell target preserves package
         * identity and lets Windows/Xbox/Gaming Services perform the
         * normal retail launch flow.
         */
        Command::new("explorer.exe")
            .arg(format!("shell:AppsFolder\\{value}"))
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|error| {
                format!("Could not hand Xbox / Microsoft Store launch to Windows: {error}")
            })?;

        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Xbox / Microsoft Store launching is only available on Windows.".to_string())
    }
}
