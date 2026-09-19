use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, path::Path};

#[cfg(target_os = "windows")]
use std::{os::windows::process::CommandExt, process::Command};

#[cfg(target_os = "linux")]
use std::process::Command;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const LOOKBACK_DAYS: u32 = 30;
const MAX_MATCHED_EVENTS: usize = 20;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashEvent {
    pub occurred_at: String,
    pub event_id: u32,
    pub event_type: String,
    pub provider: String,
    pub application_name: String,
    pub application_path: Option<String>,
    pub faulting_module: Option<String>,
    pub exception_code: Option<String>,
    pub report_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashFinding {
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashDetectiveReport {
    pub supported: bool,
    pub platform: String,
    pub lookback_days: u32,
    pub searched_names: Vec<String>,
    pub events: Vec<CrashEvent>,
    pub findings: Vec<CrashFinding>,
    pub summary: String,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawCrashEvent {
    time_created: Option<String>,
    event_id: Option<u32>,
    provider: Option<String>,
    application_name: Option<String>,
    application_path: Option<String>,
    faulting_module: Option<String>,
    exception_code: Option<String>,
    report_id: Option<String>,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone, Deserialize)]
struct RawLinuxCrashEvent {
    time: u64,
    pid: u32,
    sig: u32,
    exe: Option<String>,
}

fn clean(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

fn normalized_executable_name(value: &str) -> String {
    let file_name = Path::new(value)
        .file_name()
        .and_then(|part| part.to_str())
        .unwrap_or(value)
        .trim()
        .to_ascii_lowercase();

    file_name
        .strip_suffix(".exe")
        .unwrap_or(&file_name)
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect()
}

fn normalized_exception_code(value: Option<&str>) -> Option<String> {
    value.map(|code| code.trim().trim_start_matches("0x").to_ascii_lowercase())
}

fn exception_explanation(code: Option<&str>) -> Option<(&'static str, &'static str)> {
    match normalized_exception_code(code).as_deref() {
        Some("c0000005") => Some((
            "Access violation recorded",
            "The game tried to read or write invalid memory. Mods, overlays, unstable drivers, damaged files, and game defects can all produce this code.",
        )),
        Some("c0000409") => Some((
            "Fast-fail termination recorded",
            "Windows stopped the process after detecting a serious runtime consistency or security check failure.",
        )),
        Some("c000001d") => Some((
            "Illegal instruction recorded",
            "The process attempted a CPU instruction that was unavailable or invalid. Check CPU requirements, overclocking stability, and modified binaries.",
        )),
        Some("e06d7363") => Some((
            "C++ exception recorded",
            "The game or one of its native components raised an unhandled C++ exception. This code alone does not identify the responsible component.",
        )),
        Some("80000003") => Some((
            "Breakpoint exception recorded",
            "The process encountered a breakpoint. This may be produced by debugging, anti-cheat, injected tools, or the game itself.",
        )),
        _ => None,
    }
}

fn linux_signal_explanation(signal: u32) -> Option<(&'static str, &'static str)> {
    match signal {
        4 => Some((
            "Illegal instruction recorded",
            "Linux stopped the process after it attempted an unavailable or invalid CPU instruction. Modified binaries, CPU requirements, and unstable hardware can all contribute.",
        )),
        6 => Some((
            "Process abort recorded",
            "The process deliberately aborted after a failed assertion, runtime check, or fatal internal error. Game and Proton logs near the same timestamp may contain the preceding message.",
        )),
        9 => Some((
            "Forced termination recorded",
            "The process received SIGKILL. This can result from an out-of-memory action, an administrator or tool stopping it, or another external termination and is not proof of an application defect.",
        )),
        11 => Some((
            "Segmentation fault recorded",
            "The process accessed invalid memory. Game defects, mods, overlays, graphics drivers, Proton components, and unstable hardware can all produce this signal.",
        )),
        _ => None,
    }
}

fn module_guidance(module: Option<&str>) -> Option<(&'static str, &'static str, &'static str)> {
    let lower = module?.to_ascii_lowercase();

    if [
        "nvwgf2umx",
        "nvlddmkm",
        "atidxx",
        "amdxx",
        "amdxc",
        "igc64",
        "igd10iumd",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
    {
        return Some((
            "Graphics-driver module appears in the latest crash",
            "The recorded faulting module belongs to a graphics-driver stack. The module name is evidence, but it does not prove the driver is the root cause.",
            "Review Graphics Driver Diagnostics, disable graphics injectors or overlays for a test, and consider a clean driver reinstall if crashes began after a driver change.",
        ));
    }

    if ["rtsshooks", "gameoverlayrenderer", "discordhook", "reshade"]
        .iter()
        .any(|needle| lower.contains(needle))
    {
        return Some((
            "Overlay or graphics-injector module appears in the latest crash",
            "The faulting module is commonly associated with an overlay, monitoring tool, or graphics injector.",
            "Use Clean Launch or temporarily disable the related overlay or injector, then test the game again.",
        ));
    }

    if ["vcruntime", "msvcp", "ucrtbase"]
        .iter()
        .any(|needle| lower.contains(needle))
    {
        return Some((
            "Microsoft runtime module appears in the latest crash",
            "The fault was recorded in a Visual C++ or Universal C Runtime component.",
            "Verify the game files and repair the Microsoft Visual C++ redistributables required by the game before changing unrelated system settings.",
        ));
    }

    if ["d3d11", "d3d12", "dxgi", "vulkan-1"]
        .iter()
        .any(|needle| lower.contains(needle))
    {
        return Some((
            "Graphics API module appears in the latest crash",
            "The crash record names a DirectX or Vulkan component. Drivers, overlays, graphics mods, and the game renderer can all reach this layer.",
            "Test without overlays or graphics mods, verify game files, and compare another supported graphics API if the game offers one.",
        ));
    }

    if ["ntdll", "kernelbase", "kernel32"]
        .iter()
        .any(|needle| lower.contains(needle))
    {
        return Some((
            "Generic Windows module appears in the latest crash",
            "Windows recorded the failure in a core system module. This is usually where the crash surfaced, not enough evidence to identify the original cause.",
            "Start with game-file verification, recent mods or overlays, graphics drivers, and the other GameAtlas findings instead of replacing Windows system files.",
        ));
    }

    None
}

fn build_findings(
    events: &[CrashEvent],
    executable_match_available: bool,
    platform: &str,
) -> Vec<CrashFinding> {
    let is_linux = platform == "linux";
    if events.is_empty() {
        if !executable_match_available {
            return vec![CrashFinding {
                severity: "info".to_string(),
                title: "No executable was available for a confident match".to_string(),
                detail: if is_linux {
                    "GameAtlas searched using the game name only, which may not match the executable recorded by systemd-coredump.".to_string()
                } else {
                    "GameAtlas searched using the game name only, which may not match the executable recorded by Windows.".to_string()
                },
                suggestion: Some(
                    "Confirm the game's installation path so GameAtlas can identify its primary executable, then run Crash Detective again."
                        .to_string(),
                ),
            }];
        }

        return vec![CrashFinding {
            severity: "good".to_string(),
            title: if is_linux {
                "No recent Linux coredump records found".to_string()
            } else {
                "No recent Windows crash records found".to_string()
            },
            detail: if is_linux {
                format!(
                    "No matching systemd-coredump records were found in the last {} days.",
                    LOOKBACK_DAYS
                )
            } else {
                format!(
                    "No matching Application Error or Application Hang events were found in the last {} days.",
                    LOOKBACK_DAYS
                )
            },
            suggestion: None,
        }];
    }

    let latest = &events[0];
    let mut findings = vec![CrashFinding {
        severity: "warning".to_string(),
        title: format!(
            "{} recent crash or hang record{} found",
            events.len(),
            if events.len() == 1 { "" } else { "s" }
        ),
        detail: format!(
            "The latest record is a {} for {} at {}{}.",
            latest.event_type.to_ascii_lowercase(),
            latest.application_name,
            latest.occurred_at,
            latest
                .faulting_module
                .as_ref()
                .map(|module| format!(" with faulting module {module}"))
                .unwrap_or_default()
        ),
        suggestion: Some(
            if is_linux {
                "Compare the timestamp with recent driver, Proton, mod, overlay, game, or system changes. A coredump identifies the process and signal observed by Linux, not necessarily the original cause."
            } else {
                "Compare the timestamp with recent driver, mod, overlay, game, or Windows changes. A crash record identifies where Windows observed the failure, not necessarily its original cause."
            }
            .to_string(),
        ),
    }];

    if let Some((title, detail, suggestion)) = module_guidance(latest.faulting_module.as_deref()) {
        findings.push(CrashFinding {
            severity: "info".to_string(),
            title: title.to_string(),
            detail: detail.to_string(),
            suggestion: Some(suggestion.to_string()),
        });
    }

    if let Some((title, detail)) = exception_explanation(latest.exception_code.as_deref()) {
        findings.push(CrashFinding {
            severity: "info".to_string(),
            title: title.to_string(),
            detail: detail.to_string(),
            suggestion: None,
        });
    }

    if is_linux {
        if let Some((title, detail)) = linux_signal_explanation(latest.event_id) {
            findings.push(CrashFinding {
                severity: "info".to_string(),
                title: title.to_string(),
                detail: detail.to_string(),
                suggestion: None,
            });
        }
    }

    findings
}

#[cfg(target_os = "windows")]
fn hidden_powershell(script: &str) -> Result<String, String> {
    let mut command = Command::new("powershell.exe");
    command.creation_flags(CREATE_NO_WINDOW);

    let output = command
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .output()
        .map_err(|error| format!("Could not start Windows event-log query: {error}"))?;

    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            "Windows event-log query did not complete successfully.".to_string()
        } else {
            detail
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(target_os = "windows")]
fn query_raw_events() -> Result<Vec<RawCrashEvent>, String> {
    let script = r#"
$start = (Get-Date).AddDays(-30)
$events = Get-WinEvent -FilterHashtable @{ LogName='Application'; Id=1000,1002; StartTime=$start } -ErrorAction SilentlyContinue | Select-Object -First 250
$rows = @($events | ForEach-Object {
  $xml = [xml]$_.ToXml()
  $data = @{}
  $values = @($xml.Event.EventData.Data | ForEach-Object { [string]$_ })
  foreach ($node in $xml.Event.EventData.Data) {
    if ($node -is [System.Xml.XmlElement]) {
      $name = $node.GetAttribute('Name')
      if ($name) { $data[[string]$name] = [string]$node.InnerText }
    }
  }
  $applicationName = $data['AppName']
  if (-not $applicationName) { $applicationName = $data['ExeFileName'] }
  if (-not $applicationName) { $applicationName = $values[0] }
  $applicationPath = $data['AppPath']
  $faultingModule = $data['ModuleName']
  $exceptionCode = $data['ExceptionCode']
  $reportId = $data['ReportId']
  if ($_.Id -eq 1000) {
    if (-not $applicationPath) { $applicationPath = $values[10] }
    if (-not $faultingModule) { $faultingModule = $values[3] }
    if (-not $exceptionCode) { $exceptionCode = $values[6] }
    if (-not $reportId) { $reportId = $values[12] }
  } elseif ($_.Id -eq 1002) {
    if (-not $applicationPath) { $applicationPath = $values[5] }
    if (-not $reportId) { $reportId = $values[6] }
  }
  [pscustomobject]@{
    timeCreated = $_.TimeCreated.ToUniversalTime().ToString('o')
    eventId = [int]$_.Id
    provider = [string]$_.ProviderName
    applicationName = [string]$applicationName
    applicationPath = [string]$applicationPath
    faultingModule = [string]$faultingModule
    exceptionCode = [string]$exceptionCode
    reportId = [string]$reportId
  }
})
ConvertTo-Json -InputObject $rows -Compress -Depth 3
"#;

    let text = hidden_powershell(script)?;

    if text.is_empty() || text == "null" {
        return Ok(Vec::new());
    }

    serde_json::from_str::<Vec<RawCrashEvent>>(&text)
        .map_err(|error| format!("Windows crash records could not be decoded: {error}"))
}

#[cfg(target_os = "windows")]
fn build_crash_detective_report(
    game_name: String,
    executable_names: Vec<String>,
) -> Result<CrashDetectiveReport, String> {
    let executable_match_available = executable_names
        .iter()
        .any(|name| !normalized_executable_name(name).is_empty());

    let mut searched_names = BTreeSet::new();
    let executable_keys = executable_names
        .iter()
        .filter_map(|name| {
            let key = normalized_executable_name(name);
            if key.is_empty() {
                None
            } else {
                searched_names.insert(name.trim().to_string());
                Some(key)
            }
        })
        .collect::<BTreeSet<_>>();

    let game_key = normalized_executable_name(&game_name);
    if !game_name.trim().is_empty() {
        searched_names.insert(game_name.trim().to_string());
    }

    let mut events = query_raw_events()?
        .into_iter()
        .filter_map(|raw| {
            let application_name = clean(raw.application_name)?;
            let application_key = normalized_executable_name(&application_name);

            let executable_match = executable_keys.contains(&application_key);
            let exact_game_name_match = !game_key.is_empty() && application_key == game_key;

            if !executable_match && !exact_game_name_match {
                return None;
            }

            let event_id = raw.event_id.unwrap_or(1000);

            Some(CrashEvent {
                occurred_at: clean(raw.time_created).unwrap_or_else(|| "Unknown time".to_string()),
                event_id,
                event_type: if event_id == 1002 {
                    "Application hang".to_string()
                } else {
                    "Application crash".to_string()
                },
                provider: clean(raw.provider)
                    .unwrap_or_else(|| "Windows Application log".to_string()),
                application_name,
                application_path: clean(raw.application_path),
                faulting_module: clean(raw.faulting_module),
                exception_code: clean(raw.exception_code),
                report_id: clean(raw.report_id),
            })
        })
        .take(MAX_MATCHED_EVENTS)
        .collect::<Vec<_>>();

    events.sort_by(|left, right| right.occurred_at.cmp(&left.occurred_at));
    events.dedup_by(|left, right| {
        left.occurred_at == right.occurred_at
            && left.event_id == right.event_id
            && left
                .application_name
                .eq_ignore_ascii_case(&right.application_name)
    });

    let findings = build_findings(&events, executable_match_available, "windows");
    let summary = if events.is_empty() {
        if executable_match_available {
            format!(
                "No matching crash or hang records were found in the last {} days.",
                LOOKBACK_DAYS
            )
        } else {
            "No primary executable was available for a confident event-log match.".to_string()
        }
    } else {
        format!(
            "{} matching Windows crash or hang record{} found in the last {} days.",
            events.len(),
            if events.len() == 1 { "" } else { "s" },
            LOOKBACK_DAYS
        )
    };

    Ok(CrashDetectiveReport {
        supported: true,
        platform: "windows".to_string(),
        lookback_days: LOOKBACK_DAYS,
        searched_names: searched_names.into_iter().collect(),
        events,
        findings,
        summary,
    })
}

#[cfg(target_os = "linux")]
fn command_output(program: &str, arguments: &[&str], host: bool) -> Result<String, String> {
    let mut command = if host {
        let mut command = Command::new("distrobox-host-exec");
        command.arg(program);
        command
    } else {
        Command::new(program)
    };
    let output = command
        .args(arguments)
        .output()
        .map_err(|error| format!("Could not start {program}: {error}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            format!("{program} did not complete successfully.")
        } else {
            detail
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(target_os = "linux")]
fn query_linux_coredumps() -> Result<Vec<RawLinuxCrashEvent>, String> {
    let arguments = ["--no-pager", "--json=short", "--since=-30days", "list"];
    let text = command_output("coredumpctl", &arguments, false)
        .or_else(|_| command_output("coredumpctl", &arguments, true))?;
    if text.is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str(&text)
        .map_err(|error| format!("Linux coredump records could not be decoded: {error}"))
}

#[cfg(target_os = "linux")]
fn unix_micros_to_iso(micros: u64) -> String {
    let seconds = (micros / 1_000_000) as i64;
    let days = seconds.div_euclid(86_400);
    let seconds_in_day = seconds.rem_euclid(86_400);
    let shifted_days = days + 719_468;
    let era = if shifted_days >= 0 {
        shifted_days
    } else {
        shifted_days - 146_096
    } / 146_097;
    let day_of_era = shifted_days - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_part = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_part + 2) / 5 + 1;
    let month = month_part + if month_part < 10 { 3 } else { -9 };
    year += if month <= 2 { 1 } else { 0 };
    let hour = seconds_in_day / 3_600;
    let minute = (seconds_in_day % 3_600) / 60;
    let second = seconds_in_day % 60;
    let milliseconds = (micros % 1_000_000) / 1_000;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{milliseconds:03}Z")
}

#[cfg(target_os = "linux")]
fn linux_signal(signal: u32) -> (&'static str, &'static str) {
    match signal {
        4 => ("Illegal instruction", "SIGILL"),
        6 => ("Aborted process", "SIGABRT"),
        7 => ("Bus error", "SIGBUS"),
        8 => ("Floating-point exception", "SIGFPE"),
        9 => ("Killed process", "SIGKILL"),
        11 => ("Segmentation fault", "SIGSEGV"),
        31 => ("Bad system call", "SIGSYS"),
        _ => ("Process crash", "Linux signal"),
    }
}

#[cfg(target_os = "linux")]
fn linux_name_matches(recorded: &str, wanted: &BTreeSet<String>) -> bool {
    let recorded = normalized_executable_name(recorded);
    if recorded.is_empty() {
        return false;
    }
    wanted.iter().any(|candidate| {
        candidate == &recorded
            || (candidate.len() >= 5
                && recorded.len() >= 5
                && (candidate.starts_with(&recorded) || recorded.starts_with(candidate)))
    })
}

#[cfg(target_os = "linux")]
fn build_linux_crash_detective_report(
    game_name: String,
    executable_names: Vec<String>,
) -> Result<CrashDetectiveReport, String> {
    let executable_match_available = executable_names
        .iter()
        .any(|name| !normalized_executable_name(name).is_empty());
    let mut searched_names = BTreeSet::new();
    let executable_keys = executable_names
        .iter()
        .filter_map(|name| {
            let key = normalized_executable_name(name);
            if key.is_empty() {
                None
            } else {
                searched_names.insert(name.trim().to_string());
                Some(key)
            }
        })
        .collect::<BTreeSet<_>>();
    let game_key = normalized_executable_name(&game_name);
    if !game_name.trim().is_empty() {
        searched_names.insert(game_name.trim().to_string());
    }

    let mut events = query_linux_coredumps()?
        .into_iter()
        .filter_map(|raw| {
            let executable = clean(raw.exe)?;
            let matches_executable = linux_name_matches(&executable, &executable_keys);
            let matches_game =
                !game_key.is_empty() && normalized_executable_name(&executable) == game_key;
            if !matches_executable && !matches_game {
                return None;
            }
            let application_name = Path::new(&executable)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or(&executable)
                .to_string();
            let (event_type, signal_name) = linux_signal(raw.sig);
            Some(CrashEvent {
                occurred_at: unix_micros_to_iso(raw.time),
                event_id: raw.sig,
                event_type: event_type.to_string(),
                provider: "systemd-coredump".to_string(),
                application_name,
                application_path: Some(executable),
                faulting_module: None,
                exception_code: Some(format!("{signal_name} ({})", raw.sig)),
                report_id: Some(raw.pid.to_string()),
            })
        })
        .collect::<Vec<_>>();
    events.sort_by(|left, right| right.occurred_at.cmp(&left.occurred_at));
    events.dedup_by(|left, right| {
        left.occurred_at == right.occurred_at
            && left.event_id == right.event_id
            && left
                .application_name
                .eq_ignore_ascii_case(&right.application_name)
    });
    events.truncate(MAX_MATCHED_EVENTS);

    let findings = build_findings(&events, executable_match_available, "linux");
    let summary = if events.is_empty() {
        if executable_match_available {
            format!(
                "No matching Linux coredump records were found in the last {} days.",
                LOOKBACK_DAYS
            )
        } else {
            "No primary executable was available for a confident coredump match.".to_string()
        }
    } else {
        format!(
            "{} matching Linux coredump record{} found in the last {} days.",
            events.len(),
            if events.len() == 1 { "" } else { "s" },
            LOOKBACK_DAYS
        )
    };

    Ok(CrashDetectiveReport {
        supported: true,
        platform: "linux".to_string(),
        lookback_days: LOOKBACK_DAYS,
        searched_names: searched_names.into_iter().collect(),
        events,
        findings,
        summary,
    })
}

#[tauri::command]
pub async fn get_crash_detective_report(
    game_name: String,
    executable_names: Vec<String>,
) -> Result<CrashDetectiveReport, String> {
    #[cfg(target_os = "windows")]
    {
        return tauri::async_runtime::spawn_blocking(move || {
            build_crash_detective_report(game_name, executable_names)
        })
        .await
        .map_err(|error| format!("Crash Detective worker failed: {error}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        return tauri::async_runtime::spawn_blocking(move || {
            build_linux_crash_detective_report(game_name, executable_names)
        })
        .await
        .map_err(|error| format!("Crash Detective worker failed: {error}"))?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = (game_name, executable_names);

        Ok(CrashDetectiveReport {
            supported: false,
            platform: std::env::consts::OS.to_string(),
            lookback_days: LOOKBACK_DAYS,
            searched_names: Vec::new(),
            events: Vec::new(),
            findings: Vec::new(),
            summary: "Crash Detective is currently available only on Windows.".to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{
        exception_explanation, linux_signal_explanation, module_guidance,
        normalized_executable_name,
    };

    #[cfg(target_os = "linux")]
    use super::{linux_name_matches, unix_micros_to_iso, RawLinuxCrashEvent};

    #[cfg(target_os = "linux")]
    use std::collections::BTreeSet;

    #[test]
    fn executable_names_are_normalized_for_matching() {
        assert_eq!(
            normalized_executable_name(r#"C:\Games\Example Game\Example-Win64.exe"#),
            "examplewin64"
        );
    }

    #[test]
    fn known_exception_codes_have_cautious_explanations() {
        let (title, detail) = exception_explanation(Some("0xC0000005")).unwrap();
        assert!(title.contains("Access violation"));
        assert!(detail.contains("can all produce"));
    }

    #[test]
    fn graphics_driver_modules_receive_driver_guidance() {
        let (title, _, suggestion) = module_guidance(Some("nvwgf2umx.dll")).unwrap();
        assert!(title.contains("Graphics-driver"));
        assert!(suggestion.contains("driver"));
    }

    #[test]
    fn linux_signals_have_cautious_explanations() {
        let (title, detail) = linux_signal_explanation(11).unwrap();
        assert!(title.contains("Segmentation fault"));
        assert!(detail.contains("can all produce"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_coredump_json_is_decoded() {
        let records = serde_json::from_str::<Vec<RawLinuxCrashEvent>>(
            r#"[{"time":1700000000123000,"pid":4242,"uid":1000,"gid":1000,"sig":11,"corefile":"present","exe":"ExampleGame-Win64.exe","size":4096}]"#,
        )
        .unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].pid, 4242);
        assert_eq!(records[0].sig, 11);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_timestamps_are_formatted_as_utc() {
        assert_eq!(
            unix_micros_to_iso(1_700_000_000_123_000),
            "2023-11-14T22:13:20.123Z"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn truncated_linux_process_names_can_match_executables() {
        let names = BTreeSet::from([normalized_executable_name("ExampleGame-Win64.exe")]);
        assert!(linux_name_matches("examplegamewin", &names));
        assert!(!linux_name_matches("wine-preloader", &names));
    }
}
