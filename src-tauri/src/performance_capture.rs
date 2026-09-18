use serde::Serialize;

#[cfg(target_os = "windows")]
use sha2::{Digest, Sha256};

#[cfg(target_os = "windows")]
use std::{
    collections::HashMap,
    fs,
    io::Read,
    os::windows::process::CommandExt,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicBool, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "windows")]
use tauri::Manager;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
#[cfg(target_os = "windows")]
const PROVIDER_FILE: &str = "PresentMon-2.5.1-x64.exe";
#[cfg(target_os = "windows")]
const PROVIDER_VERSION: &str = "2.5.1";
#[cfg(target_os = "windows")]
const PROVIDER_SHA256: &str = "9bec3083069f58f911e6a512f4806db51a27bd096103087bc1d05ef54c80a191";
#[cfg(target_os = "windows")]
const SESSION_NAME: &str = "GameAtlasPerformanceCapture";

#[cfg(target_os = "windows")]
static CAPTURE_ACTIVE: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceCaptureStatus {
    pub supported: bool,
    pub provider_ready: bool,
    pub provider_name: String,
    pub provider_version: Option<String>,
    pub executable_name: Option<String>,
    pub game_running: bool,
    pub capture_active: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceFinding {
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceCaptureReport {
    pub process_name: String,
    pub requested_duration_seconds: u32,
    pub measured_duration_seconds: f64,
    pub frame_count: usize,
    pub average_fps: f64,
    pub one_percent_low_fps: f64,
    pub average_frame_time_ms: f64,
    pub median_frame_time_ms: f64,
    pub p95_frame_time_ms: f64,
    pub p99_frame_time_ms: f64,
    pub spike_threshold_ms: f64,
    pub spike_count: usize,
    pub spike_percent: f64,
    pub average_cpu_busy_ms: Option<f64>,
    pub average_gpu_time_ms: Option<f64>,
    pub present_runtime: Option<String>,
    pub present_mode: Option<String>,
    pub frame_time_metric: String,
    pub frame_times_ms: Vec<f64>,
    pub findings: Vec<PerformanceFinding>,
    pub data_file: String,
    pub data_directory: String,
    pub provider: String,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
struct FrameRow {
    frame_time: f64,
    cpu_busy: Option<f64>,
    gpu_time: Option<f64>,
    runtime: Option<String>,
    present_mode: Option<String>,
}

#[cfg(target_os = "windows")]
struct CaptureGuard;

#[cfg(target_os = "windows")]
impl Drop for CaptureGuard {
    fn drop(&mut self) {
        CAPTURE_ACTIVE.store(false, Ordering::Release);
    }
}

#[cfg(target_os = "windows")]
fn provider_candidates(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(
            resource_dir
                .join("resources")
                .join("tools")
                .join(PROVIDER_FILE),
        );
        candidates.push(resource_dir.join("tools").join(PROVIDER_FILE));
        candidates.push(resource_dir.join(PROVIDER_FILE));
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("tools")
            .join(PROVIDER_FILE),
    );
    candidates
}

#[cfg(target_os = "windows")]
fn file_sha256(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Could not open the capture provider: {error}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Could not verify the capture provider: {error}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

#[cfg(target_os = "windows")]
fn provider_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = provider_candidates(app)
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| "The bundled PresentMon capture provider is missing.".to_string())?;
    let hash = file_sha256(&path)?;
    if hash != PROVIDER_SHA256 {
        return Err(
            "The bundled PresentMon capture provider failed its integrity check.".to_string(),
        );
    }
    Ok(path)
}

#[cfg(target_os = "windows")]
fn executable_name(path: Option<&str>) -> Option<String> {
    Path::new(path?.trim())
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .filter(|name| !name.is_empty())
}

#[cfg(target_os = "windows")]
fn process_is_running(name: &str) -> bool {
    let output = Command::new("tasklist.exe")
        .args(["/NH", "/FI", &format!("IMAGENAME eq {name}")])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    output
        .ok()
        .map(|result| {
            String::from_utf8_lossy(&result.stdout)
                .to_ascii_lowercase()
                .contains(&name.to_ascii_lowercase())
        })
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn csv_line(line: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut value = String::new();
    let mut quoted = false;
    let mut chars = line.chars().peekable();
    while let Some(character) = chars.next() {
        match character {
            '"' if quoted && chars.peek() == Some(&'"') => {
                value.push('"');
                chars.next();
            }
            '"' => quoted = !quoted,
            ',' if !quoted => {
                values.push(value.trim().to_string());
                value.clear();
            }
            _ => value.push(character),
        }
    }
    values.push(value.trim().to_string());
    values
}

#[cfg(target_os = "windows")]
fn header_index(headers: &[String], names: &[&str]) -> Option<usize> {
    names.iter().find_map(|name| {
        headers.iter().position(|header| {
            header
                .trim_start_matches('\u{feff}')
                .eq_ignore_ascii_case(name)
        })
    })
}

#[cfg(target_os = "windows")]
fn value_at<'a>(values: &'a [String], index: Option<usize>) -> Option<&'a str> {
    values
        .get(index?)
        .map(String::as_str)
        .filter(|value| !value.is_empty() && !value.eq_ignore_ascii_case("NA"))
}

#[cfg(target_os = "windows")]
fn numeric_at(values: &[String], index: Option<usize>) -> Option<f64> {
    value_at(values, index)?.parse::<f64>().ok()
}

#[cfg(target_os = "windows")]
fn average(values: impl Iterator<Item = f64>) -> Option<f64> {
    let values = values.collect::<Vec<_>>();
    (!values.is_empty()).then(|| values.iter().sum::<f64>() / values.len() as f64)
}

#[cfg(target_os = "windows")]
fn percentile(sorted: &[f64], percentile: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let index = ((sorted.len() - 1) as f64 * percentile).round() as usize;
    sorted[index.min(sorted.len() - 1)]
}

#[cfg(target_os = "windows")]
fn most_common(values: impl Iterator<Item = String>) -> Option<String> {
    let mut counts = HashMap::<String, usize>::new();
    for value in values.filter(|value| !value.trim().is_empty()) {
        *counts.entry(value).or_default() += 1;
    }
    counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(value, _)| value)
}

#[cfg(target_os = "windows")]
fn downsample(values: &[f64], limit: usize) -> Vec<f64> {
    if values.len() <= limit {
        return values.to_vec();
    }
    let bucket = values.len() as f64 / limit as f64;
    (0..limit)
        .map(|index| {
            let start = (index as f64 * bucket).floor() as usize;
            let end = (((index + 1) as f64 * bucket).ceil() as usize).min(values.len());
            values[start..end].iter().copied().fold(0.0, f64::max)
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn performance_finding(
    severity: &str,
    title: &str,
    detail: String,
    suggestion: Option<&str>,
) -> PerformanceFinding {
    PerformanceFinding {
        severity: severity.to_string(),
        title: title.to_string(),
        detail,
        suggestion: suggestion.map(str::to_string),
    }
}

#[cfg(target_os = "windows")]
fn parse_capture(
    path: &Path,
    process_name: String,
    requested_duration_seconds: u32,
) -> Result<PerformanceCaptureReport, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("Could not read the captured frame data: {error}"))?;
    let mut lines = text.lines();
    let headers = csv_line(
        lines
            .next()
            .ok_or_else(|| "PresentMon returned an empty capture file.".to_string())?,
    );

    let frame_candidates = [
        "DisplayedTime",
        "MsBetweenDisplayChange",
        "MsBetweenPresents",
    ];
    let (frame_time_index, frame_time_metric) = frame_candidates
        .iter()
        .find_map(|name| header_index(&headers, &[*name]).map(|index| (index, *name)))
        .ok_or_else(|| "The capture did not include a supported frame-time metric.".to_string())?;
    let pid_index = header_index(&headers, &["ProcessID"]);
    let swap_index = header_index(&headers, &["SwapChainAddress"]);
    let cpu_index = header_index(&headers, &["MsCPUBusy", "CPUBusy"]);
    let gpu_index = header_index(&headers, &["MsGPUTime", "GPUTime"]);
    let runtime_index = header_index(&headers, &["PresentRuntime"]);
    let mode_index = header_index(&headers, &["PresentMode"]);

    let mut groups = HashMap::<String, Vec<FrameRow>>::new();
    for line in lines {
        let values = csv_line(line);
        let Some(frame_time) = numeric_at(&values, Some(frame_time_index)) else {
            continue;
        };
        if !frame_time.is_finite() || frame_time <= 0.0 || frame_time > 5000.0 {
            continue;
        }
        let key = format!(
            "{}:{}",
            value_at(&values, pid_index).unwrap_or("unknown"),
            value_at(&values, swap_index).unwrap_or("default")
        );
        groups.entry(key).or_default().push(FrameRow {
            frame_time,
            cpu_busy: numeric_at(&values, cpu_index),
            gpu_time: numeric_at(&values, gpu_index),
            runtime: value_at(&values, runtime_index).map(str::to_string),
            present_mode: value_at(&values, mode_index).map(str::to_string),
        });
    }

    let rows = groups
        .into_values()
        .max_by_key(Vec::len)
        .ok_or_else(|| {
            "No presented frames were captured. Confirm the game is running and rendering, then try again."
                .to_string()
        })?;
    if rows.len() < 30 {
        return Err(format!(
            "Only {} valid frames were captured. Keep the game actively rendering during the capture.",
            rows.len()
        ));
    }

    let frame_times = rows.iter().map(|row| row.frame_time).collect::<Vec<_>>();
    let mut sorted = frame_times.clone();
    sorted.sort_by(f64::total_cmp);
    let average_frame_time_ms = sorted.iter().sum::<f64>() / sorted.len() as f64;
    let median_frame_time_ms = percentile(&sorted, 0.50);
    let p95_frame_time_ms = percentile(&sorted, 0.95);
    let p99_frame_time_ms = percentile(&sorted, 0.99);
    let worst_count = ((sorted.len() as f64 * 0.01).ceil() as usize).max(1);
    let worst_average = sorted.iter().rev().take(worst_count).sum::<f64>() / worst_count as f64;
    let average_fps = 1000.0 / average_frame_time_ms;
    let one_percent_low_fps = 1000.0 / worst_average;
    let spike_threshold_ms = (median_frame_time_ms * 2.0).max(33.3);
    let spike_count = frame_times
        .iter()
        .filter(|value| **value > spike_threshold_ms)
        .count();
    let spike_percent = spike_count as f64 / frame_times.len() as f64 * 100.0;
    let average_cpu_busy_ms = average(rows.iter().filter_map(|row| row.cpu_busy));
    let average_gpu_time_ms = average(rows.iter().filter_map(|row| row.gpu_time));
    let present_runtime = most_common(rows.iter().filter_map(|row| row.runtime.clone()));
    let present_mode = most_common(rows.iter().filter_map(|row| row.present_mode.clone()));

    let mut findings = Vec::new();
    let low_ratio = one_percent_low_fps / average_fps;
    if low_ratio < 0.65 {
        findings.push(performance_finding(
            "warning",
            "Frame delivery was inconsistent",
            format!(
                "The 1% low was {:.1} FPS compared with a {:.1} FPS average ({:.0}% of the average).",
                one_percent_low_fps,
                average_fps,
                low_ratio * 100.0
            ),
            Some("Repeat the same gameplay segment after checking overlays, shader compilation, background activity, and graphics settings."),
        ));
    } else {
        findings.push(performance_finding(
            "good",
            "Frame delivery was reasonably consistent",
            format!(
                "The 1% low remained {:.0}% of the {:.1} FPS average during this sample.",
                low_ratio * 100.0,
                average_fps
            ),
            None,
        ));
    }

    if spike_percent > 1.0 {
        findings.push(performance_finding(
            "warning",
            "Frequent frame-time spikes detected",
            format!(
                "{} frames ({:.1}%) exceeded the {:.1} ms spike threshold.",
                spike_count, spike_percent, spike_threshold_ms
            ),
            Some("Capture the same repeatable scene again after one change at a time to identify the contributor."),
        ));
    } else {
        findings.push(performance_finding(
            "good",
            "Few large frame-time spikes detected",
            format!(
                "{} frames ({:.1}%) exceeded the {:.1} ms spike threshold.",
                spike_count, spike_percent, spike_threshold_ms
            ),
            None,
        ));
    }

    if let (Some(cpu), Some(gpu)) = (average_cpu_busy_ms, average_gpu_time_ms) {
        if gpu > cpu * 1.25 {
            findings.push(performance_finding(
                "info",
                "Capture leans toward GPU workload pressure",
                format!("Average GPU frame work was {:.2} ms versus {:.2} ms of CPU busy time. This is an indicator, not a definitive bottleneck diagnosis.", gpu, cpu),
                Some("For a like-for-like retest, reduce resolution or GPU-heavy effects before changing CPU-oriented settings."),
            ));
        } else if cpu > gpu * 1.25 {
            findings.push(performance_finding(
                "info",
                "Capture leans toward CPU workload pressure",
                format!("Average CPU busy time was {:.2} ms versus {:.2} ms of GPU frame work. This is an indicator, not a definitive bottleneck diagnosis.", cpu, gpu),
                Some("For a like-for-like retest, reduce simulation, crowd, view-distance, or other CPU-heavy settings."),
            ));
        }
    }

    if requested_duration_seconds < 30 {
        findings.push(performance_finding(
            "info",
            "Short capture",
            "Short samples are useful for quick comparisons but may miss intermittent traversal or shader-compilation stutter.".to_string(),
            Some("Use a 30- or 60-second capture for a more representative result."),
        ));
    }

    Ok(PerformanceCaptureReport {
        process_name,
        requested_duration_seconds,
        measured_duration_seconds: frame_times.iter().sum::<f64>() / 1000.0,
        frame_count: frame_times.len(),
        average_fps,
        one_percent_low_fps,
        average_frame_time_ms,
        median_frame_time_ms,
        p95_frame_time_ms,
        p99_frame_time_ms,
        spike_threshold_ms,
        spike_count,
        spike_percent,
        average_cpu_busy_ms,
        average_gpu_time_ms,
        present_runtime,
        present_mode,
        frame_time_metric: frame_time_metric.to_string(),
        frame_times_ms: downsample(&frame_times, 180),
        findings,
        data_file: path.to_string_lossy().to_string(),
        data_directory: path.parent().unwrap_or(path).to_string_lossy().to_string(),
        provider: format!("PresentMon {PROVIDER_VERSION}"),
    })
}

#[tauri::command]
pub fn get_performance_capture_status(
    app: tauri::AppHandle,
    executable_path: Option<String>,
) -> PerformanceCaptureStatus {
    #[cfg(target_os = "windows")]
    {
        let name = executable_name(executable_path.as_deref());
        let provider = provider_path(&app);
        let running = name.as_deref().map(process_is_running).unwrap_or(false);
        return PerformanceCaptureStatus {
            supported: true,
            provider_ready: provider.is_ok(),
            provider_name: "Intel PresentMon".to_string(),
            provider_version: Some(PROVIDER_VERSION.to_string()),
            executable_name: name,
            game_running: running,
            capture_active: CAPTURE_ACTIVE.load(Ordering::Acquire),
            detail: provider.err().unwrap_or_else(|| {
                if running {
                    "Capture provider and game process are ready.".to_string()
                } else {
                    "Launch the game before starting a performance capture.".to_string()
                }
            }),
        };
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, executable_path);
        PerformanceCaptureStatus {
            supported: false,
            provider_ready: false,
            provider_name: "PresentMon".to_string(),
            provider_version: None,
            executable_name: None,
            game_running: false,
            capture_active: false,
            detail: "Performance Capture is currently available on Windows.".to_string(),
        }
    }
}

#[tauri::command]
pub async fn run_performance_capture(
    app: tauri::AppHandle,
    executable_path: String,
    duration_seconds: u32,
) -> Result<PerformanceCaptureReport, String> {
    #[cfg(target_os = "windows")]
    {
        let duration_seconds = duration_seconds.clamp(10, 120);
        let provider = provider_path(&app)?;
        let process_name = executable_name(Some(&executable_path))
            .ok_or_else(|| "The selected game's executable is unavailable.".to_string())?;
        if !process_is_running(&process_name) {
            return Err(format!(
                "{process_name} is not running. Launch the game, reach the scene you want to test, then start the capture."
            ));
        }
        if CAPTURE_ACTIVE
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return Err("A performance capture is already running.".to_string());
        }
        let _guard = CaptureGuard;

        let capture_root = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("Could not resolve the capture storage folder: {error}"))?
            .join("performance-captures");
        fs::create_dir_all(&capture_root)
            .map_err(|error| format!("Could not create the capture storage folder: {error}"))?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let safe_name = process_name
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                    character
                } else {
                    '_'
                }
            })
            .collect::<String>();
        let output_path =
            capture_root.join(format!("{safe_name}-{timestamp}-{duration_seconds}s.csv"));

        let provider_for_worker = provider.clone();
        let process_for_worker = process_name.clone();
        let output_for_worker = output_path.clone();
        let output = tauri::async_runtime::spawn_blocking(move || {
            Command::new(provider_for_worker)
                .args([
                    "--process_name",
                    &process_for_worker,
                    "--output_file",
                    output_for_worker.to_string_lossy().as_ref(),
                    "--timed",
                    &duration_seconds.to_string(),
                    "--delay",
                    "3",
                    "--terminate_after_timed",
                    "--no_console_stats",
                    "--exclude_dropped",
                    "--no_track_input",
                    "--session_name",
                    SESSION_NAME,
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
        })
        .await
        .map_err(|error| format!("Performance capture worker failed: {error}"))?
        .map_err(|error| format!("PresentMon could not start: {error}"))?;

        if !output.status.success() && !output_path.is_file() {
            let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if detail.is_empty() {
                format!("PresentMon exited with status {}.", output.status)
            } else {
                format!("PresentMon could not complete the capture: {detail}")
            });
        }

        return parse_capture(&output_path, process_name, duration_seconds);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, executable_path, duration_seconds);
        Err("Performance Capture is currently available on Windows.".to_string())
    }
}

#[tauri::command]
pub async fn cancel_performance_capture(app: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        if !CAPTURE_ACTIVE.load(Ordering::Acquire) {
            return Ok(false);
        }
        let provider = provider_path(&app)?;
        let output = tauri::async_runtime::spawn_blocking(move || {
            Command::new(provider)
                .args([
                    "--terminate_existing_session",
                    "--session_name",
                    SESSION_NAME,
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
        })
        .await
        .map_err(|error| format!("Capture cancellation worker failed: {error}"))?
        .map_err(|error| format!("Could not stop PresentMon: {error}"))?;
        return Ok(output.status.success());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(false)
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;

    #[test]
    fn csv_parser_preserves_quoted_commas() {
        assert_eq!(
            csv_line("game.exe,\"Composed: Flip, test\",16.6"),
            vec!["game.exe", "Composed: Flip, test", "16.6"]
        );
    }

    #[test]
    fn capture_parser_calculates_frame_summary() {
        let path = std::env::temp_dir().join(format!(
            "gameatlas-performance-parser-{}.csv",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let mut csv = String::from(
            "Application,ProcessID,SwapChainAddress,PresentRuntime,PresentMode,MsBetweenDisplayChange,MsCPUBusy,MsGPUTime\n",
        );
        for index in 0..120 {
            let frame_time = if index == 119 { 50.0 } else { 16.6667 };
            csv.push_str(&format!(
                "game.exe,42,0x1,DXGI,Composed: Flip,{frame_time},4.0,8.0\n"
            ));
        }
        fs::write(&path, csv).expect("write fixture");
        let report = parse_capture(&path, "game.exe".to_string(), 30).expect("parse capture");
        let _ = fs::remove_file(&path);

        assert_eq!(report.frame_count, 120);
        assert!(report.average_fps > 58.0 && report.average_fps < 60.0);
        assert!(report.one_percent_low_fps < report.average_fps);
        assert_eq!(report.spike_count, 1);
        assert_eq!(report.present_runtime.as_deref(), Some("DXGI"));
    }
}
