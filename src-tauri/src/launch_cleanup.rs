use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    process::Command,
    sync::{Mutex, OnceLock},
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "linux")]
use std::{
    collections::BTreeSet,
    fs,
    os::unix::fs::MetadataExt,
    path::Path,
    thread,
    time::{Duration, Instant},
};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchProcess {
    pid: u32,
    name: String,
    path: String,
    started_at: String,
    dedicated_bytes: Option<u64>,
    shared_bytes: Option<u64>,
    gpu_label: Option<String>,
    ram_bytes: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloseTarget {
    pid: u32,
    path: String,
    started_at: String,
    force: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloseResult {
    stopped: Vec<String>,
    failures: Vec<String>,
    restorable_count: usize,
}

fn restore_state() -> &'static Mutex<Vec<PathBuf>> {
    static STATE: OnceLock<Mutex<Vec<PathBuf>>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(Vec::new()))
}

fn protected_process(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "gamemanager.exe"
            | "gameatlas.exe"
            | "steam.exe"
            | "epicgameslauncher.exe"
            | "eadesktop.exe"
            | "gog galaxy.exe"
            | "ubisoftconnect.exe"
            | "explorer.exe"
            | "dwm.exe"
            | "csrss.exe"
            | "winlogon.exe"
            | "services.exe"
            | "lsass.exe"
            | "system"
            | "init"
            | "systemd"
            | "gnome-shell"
            | "kwin_wayland"
            | "plasmashell"
            | "xorg"
            | "xwayland"
            | "gamemanager"
            | "gameatlas"
            | "steam"
            | "heroic"
            | "lutris"
            | "gamescope"
            | "pipewire"
            | "wireplumber"
            | "dbus-daemon"
            | "dbus-broker"
    )
}

#[cfg(target_os = "windows")]
fn powershell(script: &str, envs: &[(&str, String)]) -> Result<String, String> {
    let mut command = Command::new("powershell.exe");
    command
        .creation_flags(0x08000000)
        .args(["-NoProfile", "-NonInteractive", "-Command", script]);
    for (key, value) in envs {
        command.env(key, value);
    }
    let output = command.output().map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(target_os = "windows")]
fn snapshot() -> Result<Vec<LaunchProcess>, String> {
    let script = r#"
$ErrorActionPreference = 'Stop'
$usage = @{}
try {
  $samples = (Get-Counter -Counter '\GPU Process Memory(*)\Dedicated Usage','\GPU Process Memory(*)\Shared Usage' -ErrorAction Stop).CounterSamples
  foreach ($sample in $samples) {
    if ($sample.InstanceName -match 'pid_(\d+)') {
      $id = [uint32]$Matches[1]
      if (-not $usage.ContainsKey($id)) { $usage[$id] = @{ dedicated = 0; shared = 0; adapters = @() } }
      if ($sample.InstanceName -match 'phys_(\d+)') { $usage[$id].adapters += $Matches[1] }
      if ($sample.Path -match 'Dedicated Usage$') { $usage[$id].dedicated += [math]::Max(0, $sample.CookedValue) }
      if ($sample.Path -match 'Shared Usage$') { $usage[$id].shared += [math]::Max(0, $sample.CookedValue) }
    }
  }
} catch { }
$session = (Get-Process -Id $PID).SessionId
$items = @(Get-CimInstance Win32_Process | Where-Object { $_.SessionId -eq $session -and $_.ExecutablePath -and $_.ProcessId -ne $PID } | ForEach-Object {
  $memory = $usage[[uint32]$_.ProcessId]
  [PSCustomObject]@{
    pid = [uint32]$_.ProcessId; name = [string]$_.Name; path = [string]$_.ExecutablePath
    startedAt = $_.CreationDate.ToUniversalTime().ToString('o')
    dedicatedBytes = if ($memory) { [uint64]$memory.dedicated } else { $null }
    sharedBytes = if ($memory) { [uint64]$memory.shared } else { $null }
    gpuLabel = if ($memory -and $memory.adapters.Count) { 'GPU adapter ' + (($memory.adapters | Sort-Object -Unique) -join ', ') } else { $null }
    ramBytes = if ($_.WorkingSetSize) { [uint64]$_.WorkingSetSize } else { $null }
  }
})
ConvertTo-Json -InputObject $items -Compress -Depth 3
"#;
    let output = powershell(script, &[])?;
    let processes: Vec<LaunchProcess> =
        serde_json::from_str(&output).map_err(|error| error.to_string())?;
    Ok(processes
        .into_iter()
        .filter(|process| process.pid != std::process::id() && !protected_process(&process.name))
        .collect())
}

#[cfg(target_os = "windows")]
fn close_one(target: &CloseTarget) -> Result<String, String> {
    let script = r#"
$ErrorActionPreference = 'Stop'
$id = [uint32]$env:GA_CLOSE_PID
$record = Get-CimInstance Win32_Process -Filter "ProcessId = $id"
if (-not $record -or $record.ExecutablePath -ine $env:GA_CLOSE_PATH -or $record.CreationDate.ToUniversalTime().ToString('o') -ne $env:GA_CLOSE_START) { throw 'Process identity changed; nothing was closed.' }
if ($record.SessionId -ne (Get-Process -Id $PID).SessionId) { throw 'The process belongs to another session and was left untouched.' }
$process = Get-Process -Id $id -ErrorAction Stop
if ($env:GA_CLOSE_FORCE -eq '1') { $process.Kill() }
elseif (-not $process.CloseMainWindow()) { throw 'This app did not accept a normal close request. Force-close is not enabled.' }
if (-not $process.WaitForExit(3000)) { throw 'The app is still running after the close request.' }
$record.Name
"#;
    powershell(
        script,
        &[
            ("GA_CLOSE_PID", target.pid.to_string()),
            ("GA_CLOSE_PATH", target.path.clone()),
            ("GA_CLOSE_START", target.started_at.clone()),
            (
                "GA_CLOSE_FORCE",
                if target.force { "1" } else { "0" }.to_string(),
            ),
        ],
    )
}

#[cfg(target_os = "linux")]
fn start_time(pid: u32) -> Option<String> {
    let stat = fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    Some(
        stat.get(stat.rfind(") ")? + 2..)?
            .split_whitespace()
            .nth(19)?
            .to_string(),
    )
}

#[cfg(target_os = "linux")]
fn ram_bytes(pid: u32) -> Option<u64> {
    let status = fs::read_to_string(format!("/proc/{pid}/status")).ok()?;
    let value = status
        .lines()
        .find_map(|line| line.strip_prefix("VmRSS:"))?;
    value
        .split_whitespace()
        .next()?
        .parse::<u64>()
        .ok()?
        .checked_mul(1024)
}

#[cfg(target_os = "linux")]
fn vram_bytes(pid: u32) -> (Option<u64>, Option<String>) {
    let Ok(entries) = fs::read_dir(format!("/proc/{pid}/fdinfo")) else {
        return (None, None);
    };
    let mut seen = BTreeSet::new();
    let mut devices = BTreeSet::new();
    let mut total = 0u64;
    let mut found = false;
    for entry in entries.flatten() {
        let Ok(contents) = fs::read_to_string(entry.path()) else {
            continue;
        };
        let client = contents
            .lines()
            .find_map(|line| line.strip_prefix("drm-client-id:"))
            .map(str::trim);
        let Some(client) = client else { continue };
        let device = contents
            .lines()
            .find_map(|line| line.strip_prefix("drm-pdev:"))
            .map(str::trim)
            .unwrap_or("");
        if !seen.insert(format!("{device}:{client}")) {
            continue;
        }
        if !device.is_empty() {
            devices.insert(device.to_string());
        }
        let value = contents.lines().find_map(|line| {
            line.strip_prefix("drm-resident-vram:")
                .or_else(|| line.strip_prefix("drm-memory-vram:"))
        });
        if let Some(value) = value {
            let mut fields = value.split_whitespace();
            if let Some(number) = fields.next().and_then(|value| value.parse::<u64>().ok()) {
                let factor = match fields.next() {
                    Some("KiB") => 1024,
                    Some("MiB") => 1024 * 1024,
                    _ => 1,
                };
                total = total.saturating_add(number.saturating_mul(factor));
                found = true;
            }
        }
    }
    let label = (!devices.is_empty())
        .then(|| format!("GPU {}", devices.into_iter().collect::<Vec<_>>().join(", ")));
    (found.then_some(total), label)
}

#[cfg(target_os = "linux")]
fn snapshot() -> Result<Vec<LaunchProcess>, String> {
    let uid = fs::metadata("/proc/self")
        .map_err(|error| error.to_string())?
        .uid();
    let mut processes = Vec::new();
    for entry in fs::read_dir("/proc")
        .map_err(|error| error.to_string())?
        .flatten()
    {
        let Ok(pid) = entry.file_name().to_string_lossy().parse::<u32>() else {
            continue;
        };
        if pid == std::process::id()
            || fs::metadata(entry.path()).map(|value| value.uid()).ok() != Some(uid)
        {
            continue;
        }
        let Some(started_at) = start_time(pid) else {
            continue;
        };
        let Ok(path) = fs::read_link(entry.path().join("exe")) else {
            continue;
        };
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        if protected_process(&name) {
            continue;
        }
        let (dedicated_bytes, gpu_label) = vram_bytes(pid);
        processes.push(LaunchProcess {
            pid,
            name,
            path: path.to_string_lossy().to_string(),
            started_at,
            dedicated_bytes,
            shared_bytes: None,
            gpu_label,
            ram_bytes: ram_bytes(pid),
        });
    }
    Ok(processes)
}

#[cfg(target_os = "linux")]
fn close_one(target: &CloseTarget) -> Result<String, String> {
    let root = PathBuf::from(format!("/proc/{}", target.pid));
    let uid = fs::metadata("/proc/self")
        .map_err(|error| error.to_string())?
        .uid();
    if fs::metadata(&root).map(|value| value.uid()).ok() != Some(uid)
        || start_time(target.pid).as_deref() != Some(target.started_at.as_str())
        || fs::read_link(root.join("exe")).ok().as_deref() != Some(Path::new(&target.path))
    {
        return Err("Process identity changed; nothing was closed.".to_string());
    }
    let signal = if target.force { "-KILL" } else { "-TERM" };
    let result = Command::new("kill")
        .args([signal, "--", &target.pid.to_string()])
        .output()
        .map_err(|error| error.to_string())?;
    if !result.status.success() {
        return Err(String::from_utf8_lossy(&result.stderr).trim().to_string());
    }
    let deadline = Instant::now() + Duration::from_secs(3);
    while Instant::now() < deadline
        && start_time(target.pid).as_deref() == Some(target.started_at.as_str())
    {
        thread::sleep(Duration::from_millis(60));
    }
    if start_time(target.pid).as_deref() == Some(target.started_at.as_str()) {
        return Err("The app is still running after the close request.".to_string());
    }
    Ok(Path::new(&target.path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string())
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn snapshot() -> Result<Vec<LaunchProcess>, String> {
    Ok(Vec::new())
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn close_one(_target: &CloseTarget) -> Result<String, String> {
    Err("Launch cleanup is available only on Windows and Linux.".to_string())
}

#[tauri::command]
pub async fn get_launch_processes() -> Result<Vec<LaunchProcess>, String> {
    tauri::async_runtime::spawn_blocking(snapshot)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn close_launch_processes(targets: Vec<CloseTarget>) -> Result<CloseResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut stopped = Vec::new();
        let mut failures = Vec::new();
        if targets.len() > 30 { failures.push("Only the first 30 selected processes were considered; narrow the selection and retry.".to_string()); }
        for target in targets.into_iter().take(30) {
            let path = PathBuf::from(&target.path);
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            #[cfg(target_os = "windows")]
            let is_system_path = std::env::var("WINDIR").ok().map(|root| target.path.to_ascii_lowercase().starts_with(&format!("{}\\", root.to_ascii_lowercase()))).unwrap_or(false);
            #[cfg(not(target_os = "windows"))]
            let is_system_path = false;
            if target.pid == std::process::id() || !path.is_absolute() || protected_process(&name) || is_system_path {
                failures.push(format!("{name}: protected or invalid target"));
                continue;
            }
            match close_one(&target) {
                Ok(_) => {
                    stopped.push(name);
                    if let Ok(mut state) = restore_state().lock() { if !state.contains(&path) { state.push(path); } }
                }
                Err(error) => failures.push(format!("{name}: {error}")),
            }
        }
        let restorable_count = restore_state().lock().map(|state| state.len()).unwrap_or(0);
        CloseResult { stopped, failures, restorable_count }
    }).await.map_err(|error| error.to_string())
}

fn restore_launch_apps_inner() -> CloseResult {
    let paths = restore_state()
        .lock()
        .map(|mut state| std::mem::take(&mut *state))
        .unwrap_or_default();
    let running = snapshot().unwrap_or_default();
    let mut stopped = Vec::new();
    let mut failures = Vec::new();
    let mut retry = Vec::new();
    for path in paths {
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        if running
            .iter()
            .any(|process| process.path.eq_ignore_ascii_case(&path.to_string_lossy()))
        {
            stopped.push(name);
        } else if !path.is_file() || Command::new(&path).spawn().is_err() {
            failures.push(format!("{name}: could not reopen the application"));
            retry.push(path);
        } else {
            stopped.push(name);
        }
    }
    let restorable_count = if let Ok(mut state) = restore_state().lock() {
        state.extend(retry);
        state.len()
    } else {
        0
    };
    CloseResult {
        stopped,
        failures,
        restorable_count,
    }
}

#[tauri::command]
pub async fn restore_launch_apps() -> Result<CloseResult, String> {
    tauri::async_runtime::spawn_blocking(restore_launch_apps_inner)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_launch_restore_count() -> usize {
    restore_state().lock().map(|state| state.len()).unwrap_or(0)
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    #[test]
    #[ignore = "requires a local Windows process list"]
    fn snapshot_reads_running_apps() {
        let rows = super::snapshot().expect("process snapshot should parse");
        println!(
            "{} processes; {} with GPU-memory readings; {} with RAM readings",
            rows.len(),
            rows.iter()
                .filter(|row| row.dedicated_bytes.is_some())
                .count(),
            rows.iter().filter(|row| row.ram_bytes.is_some()).count()
        );
        assert!(!rows.is_empty());
        assert!(rows
            .iter()
            .all(|row| !row.path.is_empty() && row.started_at.len() > 5));
    }

    #[test]
    #[ignore = "requires a local Windows process list"]
    fn mismatched_identity_cannot_close_a_process() {
        let row = super::snapshot()
            .expect("process snapshot should parse")
            .into_iter()
            .next()
            .expect("running process");
        let target = super::CloseTarget {
            pid: row.pid,
            path: format!("{}.not-the-same-app", row.path),
            started_at: row.started_at,
            force: true,
        };
        assert!(super::close_one(&target).is_err());
    }
}
