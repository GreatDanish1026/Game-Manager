use serde::Serialize;
use std::path::Path;

#[cfg(any(target_os = "windows", target_os = "linux"))]
use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "windows")]
use std::mem::size_of;

#[cfg(target_os = "linux")]
use std::fs;

#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE},
    System::{
        Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        },
        Threading::{GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION},
    },
};

#[cfg(any(target_os = "windows", target_os = "linux"))]
static MONITOR_ACTIVE: AtomicBool = AtomicBool::new(false);
#[cfg(any(target_os = "windows", target_os = "linux"))]
static MONITOR_CANCEL: AtomicBool = AtomicBool::new(false);

const APPEAR_TIMEOUT_SECONDS: u64 = 45;
const STABLE_SECONDS: u64 = 20;
const POLL_MILLISECONDS: u64 = 250;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchMonitorReport {
    pub supported: bool,
    pub outcome: String,
    pub process_name: Option<String>,
    pub process_id: Option<u32>,
    pub process_detected: bool,
    pub appeared_after_seconds: Option<f64>,
    pub survived_seconds: Option<f64>,
    pub exit_code: Option<String>,
    pub stable_threshold_seconds: u64,
    pub started_at_unix_ms: u64,
    pub finished_at_unix_ms: u64,
    pub detail: String,
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
struct MonitorGuard;

#[cfg(any(target_os = "windows", target_os = "linux"))]
impl Drop for MonitorGuard {
    fn drop(&mut self) {
        MONITOR_CANCEL.store(false, Ordering::Release);
        MONITOR_ACTIVE.store(false, Ordering::Release);
    }
}

#[cfg(target_os = "windows")]
struct ProcessHandle(HANDLE);

#[cfg(target_os = "windows")]
impl ProcessHandle {
    fn open(pid: u32) -> Option<Self> {
        let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        (!handle.is_null()).then_some(Self(handle))
    }

    fn exit_code(&self) -> Option<String> {
        let mut code = 0u32;
        let success = unsafe { GetExitCodeProcess(self.0, &mut code) } != 0;
        success.then(|| format!("0x{code:08X}"))
    }
}

#[cfg(target_os = "windows")]
impl Drop for ProcessHandle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn unix_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn executable_name(path: &str) -> Option<String> {
    Path::new(path.trim().trim_matches('"'))
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

#[cfg(target_os = "linux")]
fn argument_file_name(argument: &[u8]) -> Option<String> {
    let normalized = String::from_utf8_lossy(argument).replace('\\', "/");
    Path::new(&normalized)
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::to_string)
}

#[cfg(target_os = "linux")]
fn linux_process_matches(pid: u32, wanted: &str) -> bool {
    if fs::read_link(format!("/proc/{pid}/exe"))
        .ok()
        .and_then(|path| path.file_name().map(|value| value.to_os_string()))
        .and_then(|value| value.to_str().map(str::to_string))
        .is_some_and(|value| value.eq_ignore_ascii_case(wanted))
    {
        return true;
    }

    if fs::read_to_string(format!("/proc/{pid}/comm"))
        .ok()
        .is_some_and(|value| value.trim().eq_ignore_ascii_case(wanted))
    {
        return true;
    }

    fs::read(format!("/proc/{pid}/cmdline"))
        .ok()
        .is_some_and(|cmdline| {
            cmdline
                .split(|byte| *byte == 0)
                .filter_map(argument_file_name)
                .any(|value| value.eq_ignore_ascii_case(wanted))
        })
}

#[cfg(target_os = "linux")]
fn process_ids(name: &str) -> Vec<u32> {
    let Ok(entries) = fs::read_dir("/proc") else {
        return Vec::new();
    };
    let mut ids = entries
        .flatten()
        .filter_map(|entry| entry.file_name().to_string_lossy().parse::<u32>().ok())
        .filter(|pid| linux_process_matches(*pid, name))
        .collect::<Vec<_>>();
    ids.sort_unstable();
    ids
}

#[cfg(target_os = "linux")]
fn linux_exit_status(pid: u32) -> Option<String> {
    let stat = fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    let fields = stat
        .get(stat.rfind(')')? + 1..)?
        .split_whitespace()
        .collect::<Vec<_>>();
    if fields.first().copied() != Some("Z") {
        return None;
    }
    let status = fields.get(49)?.parse::<i32>().ok()?;
    let signal = status & 0x7f;
    if signal != 0 {
        Some(if status & 0x80 != 0 {
            format!("signal {signal} (core dumped)")
        } else {
            format!("signal {signal}")
        })
    } else {
        Some(format!("exit {}", (status >> 8) & 0xff))
    }
}

#[cfg(target_os = "windows")]
fn wide_name(buffer: &[u16]) -> String {
    let length = buffer
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(buffer.len());
    String::from_utf16_lossy(&buffer[..length])
}

#[cfg(target_os = "windows")]
fn process_ids(name: &str) -> Vec<u32> {
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return Vec::new();
    }

    let mut entry: PROCESSENTRY32W = unsafe { std::mem::zeroed() };
    entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
    let mut ids = Vec::new();
    let mut available = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
    while available {
        if wide_name(&entry.szExeFile).eq_ignore_ascii_case(name) {
            ids.push(entry.th32ProcessID);
        }
        available = unsafe { Process32NextW(snapshot, &mut entry) } != 0;
    }
    unsafe {
        CloseHandle(snapshot);
    }
    ids
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn cancelled_report(process_name: String, started_at: u64) -> LaunchMonitorReport {
    LaunchMonitorReport {
        supported: true,
        outcome: "cancelled".to_string(),
        process_name: Some(process_name),
        process_id: None,
        process_detected: false,
        appeared_after_seconds: None,
        survived_seconds: None,
        exit_code: None,
        stable_threshold_seconds: STABLE_SECONDS,
        started_at_unix_ms: started_at,
        finished_at_unix_ms: unix_millis(),
        detail: "Launch monitoring was stopped. The game was not closed.".to_string(),
    }
}

#[cfg(target_os = "linux")]
fn monitor_blocking(executable_path: String) -> Result<LaunchMonitorReport, String> {
    let process_name = executable_name(&executable_path)
        .ok_or_else(|| "GameAtlas could not identify the executable to monitor.".to_string())?;
    if !process_ids(&process_name).is_empty() {
        return Err(format!(
            "{process_name} is already running. Close it before starting a monitored launch."
        ));
    }
    if MONITOR_ACTIVE
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("Another launch monitor is already active.".to_string());
    }
    MONITOR_CANCEL.store(false, Ordering::Release);
    let _guard = MonitorGuard;
    let started_at = unix_millis();
    let started = Instant::now();
    let appear_timeout = Duration::from_secs(APPEAR_TIMEOUT_SECONDS);
    let poll = Duration::from_millis(POLL_MILLISECONDS);

    let (mut pid, appeared_after) = loop {
        if MONITOR_CANCEL.load(Ordering::Acquire) {
            return Ok(cancelled_report(process_name, started_at));
        }
        if let Some(pid) = process_ids(&process_name).into_iter().next() {
            break (pid, started.elapsed());
        }
        if started.elapsed() >= appear_timeout {
            return Ok(LaunchMonitorReport {
                supported: true,
                outcome: "not_detected".to_string(),
                process_name: Some(process_name.clone()),
                process_id: None,
                process_detected: false,
                appeared_after_seconds: None,
                survived_seconds: None,
                exit_code: None,
                stable_threshold_seconds: STABLE_SECONDS,
                started_at_unix_ms: started_at,
                finished_at_unix_ms: unix_millis(),
                detail: format!(
                    "{process_name} did not appear within {APPEAR_TIMEOUT_SECONDS} seconds of the Steam, launcher, or direct launch request."
                ),
            });
        }
        thread::sleep(poll);
    };

    let process_started = Instant::now();
    let stable_threshold = Duration::from_secs(STABLE_SECONDS);
    loop {
        if MONITOR_CANCEL.load(Ordering::Acquire) {
            return Ok(LaunchMonitorReport {
                process_detected: true,
                process_id: Some(pid),
                appeared_after_seconds: Some(appeared_after.as_secs_f64()),
                survived_seconds: Some(process_started.elapsed().as_secs_f64()),
                ..cancelled_report(process_name, started_at)
            });
        }

        let exit_code = linux_exit_status(pid);
        let ids = process_ids(&process_name);
        if exit_code.is_some() || !ids.contains(&pid) {
            if let Some(replacement) = ids.into_iter().find(|candidate| *candidate != pid) {
                pid = replacement;
            } else {
                let survived = process_started.elapsed();
                let outcome = if survived < Duration::from_secs(3) {
                    "immediate_exit"
                } else {
                    "early_exit"
                };
                return Ok(LaunchMonitorReport {
                    supported: true,
                    outcome: outcome.to_string(),
                    process_name: Some(process_name.clone()),
                    process_id: Some(pid),
                    process_detected: true,
                    appeared_after_seconds: Some(appeared_after.as_secs_f64()),
                    survived_seconds: Some(survived.as_secs_f64()),
                    exit_code,
                    stable_threshold_seconds: STABLE_SECONDS,
                    started_at_unix_ms: started_at,
                    finished_at_unix_ms: unix_millis(),
                    detail: format!(
                        "{process_name} appeared after {:.1} seconds and exited after {:.1} seconds.",
                        appeared_after.as_secs_f64(),
                        survived.as_secs_f64()
                    ),
                });
            }
        }

        if process_started.elapsed() >= stable_threshold {
            return Ok(LaunchMonitorReport {
                supported: true,
                outcome: "stable".to_string(),
                process_name: Some(process_name.clone()),
                process_id: Some(pid),
                process_detected: true,
                appeared_after_seconds: Some(appeared_after.as_secs_f64()),
                survived_seconds: Some(process_started.elapsed().as_secs_f64()),
                exit_code: None,
                stable_threshold_seconds: STABLE_SECONDS,
                started_at_unix_ms: started_at,
                finished_at_unix_ms: unix_millis(),
                detail: format!(
                    "{process_name} remained active through the {STABLE_SECONDS}-second startup observation window."
                ),
            });
        }
        thread::sleep(poll);
    }
}

#[cfg(target_os = "windows")]
fn monitor_blocking(executable_path: String) -> Result<LaunchMonitorReport, String> {
    let process_name = executable_name(&executable_path)
        .ok_or_else(|| "GameAtlas could not identify the executable to monitor.".to_string())?;
    if !process_ids(&process_name).is_empty() {
        return Err(format!(
            "{process_name} is already running. Close it before starting a monitored launch."
        ));
    }
    if MONITOR_ACTIVE
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("Another launch monitor is already active.".to_string());
    }
    MONITOR_CANCEL.store(false, Ordering::Release);
    let _guard = MonitorGuard;
    let started_at = unix_millis();
    let started = Instant::now();
    let appear_timeout = Duration::from_secs(APPEAR_TIMEOUT_SECONDS);
    let poll = Duration::from_millis(POLL_MILLISECONDS);

    let (mut pid, appeared_after) = loop {
        if MONITOR_CANCEL.load(Ordering::Acquire) {
            return Ok(cancelled_report(process_name, started_at));
        }
        if let Some(pid) = process_ids(&process_name).into_iter().next() {
            break (pid, started.elapsed());
        }
        if started.elapsed() >= appear_timeout {
            return Ok(LaunchMonitorReport {
                supported: true,
                outcome: "not_detected".to_string(),
                process_name: Some(process_name.clone()),
                process_id: None,
                process_detected: false,
                appeared_after_seconds: None,
                survived_seconds: None,
                exit_code: None,
                stable_threshold_seconds: STABLE_SECONDS,
                started_at_unix_ms: started_at,
                finished_at_unix_ms: unix_millis(),
                detail: format!(
                    "{process_name} did not appear within {APPEAR_TIMEOUT_SECONDS} seconds of the launch request."
                ),
            });
        }
        thread::sleep(poll);
    };

    let mut process_handle = ProcessHandle::open(pid);
    let process_started = Instant::now();
    let stable_threshold = Duration::from_secs(STABLE_SECONDS);
    loop {
        if MONITOR_CANCEL.load(Ordering::Acquire) {
            return Ok(LaunchMonitorReport {
                process_detected: true,
                process_id: Some(pid),
                appeared_after_seconds: Some(appeared_after.as_secs_f64()),
                survived_seconds: Some(process_started.elapsed().as_secs_f64()),
                ..cancelled_report(process_name, started_at)
            });
        }

        let ids = process_ids(&process_name);
        if !ids.contains(&pid) {
            if let Some(replacement) = ids.into_iter().next() {
                pid = replacement;
                process_handle = ProcessHandle::open(pid);
            } else {
                let survived = process_started.elapsed();
                let outcome = if survived < Duration::from_secs(3) {
                    "immediate_exit"
                } else {
                    "early_exit"
                };
                return Ok(LaunchMonitorReport {
                    supported: true,
                    outcome: outcome.to_string(),
                    process_name: Some(process_name.clone()),
                    process_id: Some(pid),
                    process_detected: true,
                    appeared_after_seconds: Some(appeared_after.as_secs_f64()),
                    survived_seconds: Some(survived.as_secs_f64()),
                    exit_code: process_handle
                        .as_ref()
                        .and_then(ProcessHandle::exit_code),
                    stable_threshold_seconds: STABLE_SECONDS,
                    started_at_unix_ms: started_at,
                    finished_at_unix_ms: unix_millis(),
                    detail: format!(
                        "{process_name} appeared after {:.1} seconds and exited after {:.1} seconds.",
                        appeared_after.as_secs_f64(),
                        survived.as_secs_f64()
                    ),
                });
            }
        }

        if process_started.elapsed() >= stable_threshold {
            return Ok(LaunchMonitorReport {
                supported: true,
                outcome: "stable".to_string(),
                process_name: Some(process_name.clone()),
                process_id: Some(pid),
                process_detected: true,
                appeared_after_seconds: Some(appeared_after.as_secs_f64()),
                survived_seconds: Some(process_started.elapsed().as_secs_f64()),
                exit_code: None,
                stable_threshold_seconds: STABLE_SECONDS,
                started_at_unix_ms: started_at,
                finished_at_unix_ms: unix_millis(),
                detail: format!(
                    "{process_name} remained active through the {STABLE_SECONDS}-second startup observation window."
                ),
            });
        }
        thread::sleep(poll);
    }
}

#[tauri::command]
pub async fn monitor_game_launch(executable_path: String) -> Result<LaunchMonitorReport, String> {
    #[cfg(target_os = "windows")]
    {
        return tauri::async_runtime::spawn_blocking(move || monitor_blocking(executable_path))
            .await
            .map_err(|error| format!("Launch monitor worker failed: {error}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        return tauri::async_runtime::spawn_blocking(move || monitor_blocking(executable_path))
            .await
            .map_err(|error| format!("Launch monitor worker failed: {error}"))?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = executable_path;
        Ok(LaunchMonitorReport {
            supported: false,
            outcome: "unsupported".to_string(),
            process_name: None,
            process_id: None,
            process_detected: false,
            appeared_after_seconds: None,
            survived_seconds: None,
            exit_code: None,
            stable_threshold_seconds: STABLE_SECONDS,
            started_at_unix_ms: 0,
            finished_at_unix_ms: 0,
            detail: "Launch Failure Analyzer is not available on this platform.".to_string(),
        })
    }
}

#[tauri::command]
pub fn cancel_launch_failure_monitor() -> bool {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        if !MONITOR_ACTIVE.load(Ordering::Acquire) {
            return false;
        }
        MONITOR_CANCEL.store(true, Ordering::Release);
        return true;
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        false
    }
}

#[cfg(all(test, target_os = "linux"))]
mod linux_tests {
    use super::*;

    #[test]
    fn executable_name_is_normalized_from_linux_path() {
        assert_eq!(
            executable_name("/games/Example/game.x86_64").as_deref(),
            Some("game.x86_64")
        );
    }

    #[test]
    fn current_process_can_be_discovered() {
        let name = fs::read_to_string("/proc/self/comm").expect("read current process name");
        assert!(process_ids(name.trim()).contains(&std::process::id()));
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;

    #[test]
    fn executable_name_is_normalized_from_path() {
        assert_eq!(
            executable_name(r#"C:\Games\Example\game.exe"#).as_deref(),
            Some("game.exe")
        );
    }

    #[test]
    fn missing_executable_name_is_rejected() {
        assert_eq!(executable_name("   "), None);
    }
}
