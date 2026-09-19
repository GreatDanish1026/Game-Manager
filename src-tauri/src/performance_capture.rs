use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
use sha2::{Digest, Sha256};

use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "windows")]
use std::{io::Read, os::windows::process::CommandExt};

#[cfg(target_os = "linux")]
use std::{
    io::{Read, Write},
    os::{linux::net::SocketAddrExt, unix::net::UnixStream},
};

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
#[cfg(target_os = "linux")]
const LINUX_PROVIDER_NAME: &str = "MangoHud";

static CAPTURE_ACTIVE: AtomicBool = AtomicBool::new(false);
#[cfg(target_os = "linux")]
static CAPTURE_CANCEL_REQUESTED: AtomicBool = AtomicBool::new(false);
static HISTORY_LOCK: Mutex<()> = Mutex::new(());
const HISTORY_LIMIT: usize = 50;

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
    pub history_id: Option<String>,
    pub history_saved: bool,
    pub scene_label: Option<String>,
    pub created_unix: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceHistoryEntry {
    pub id: String,
    pub created_unix: u64,
    pub scene_label: String,
    pub requested_duration_seconds: u32,
    pub measured_duration_seconds: f64,
    pub frame_count: usize,
    pub average_fps: f64,
    pub one_percent_low_fps: f64,
    pub average_frame_time_ms: f64,
    pub p95_frame_time_ms: f64,
    pub p99_frame_time_ms: f64,
    pub spike_threshold_ms: f64,
    pub spike_count: usize,
    pub spike_percent: f64,
    pub average_cpu_busy_ms: Option<f64>,
    pub average_gpu_time_ms: Option<f64>,
    pub present_runtime: Option<String>,
    pub present_mode: Option<String>,
    pub provider: String,
    pub data_file: String,
    pub data_directory: String,
    #[serde(default, skip_serializing)]
    pub is_baseline: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceCaptureHistory {
    pub supported: bool,
    pub entries: Vec<PerformanceHistoryEntry>,
    pub history_limit: usize,
    pub history_directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PerformanceHistoryFile {
    schema_version: u32,
    #[serde(default)]
    baselines: HashMap<String, String>,
    #[serde(default)]
    entries: Vec<PerformanceHistoryEntry>,
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

struct CaptureGuard;

impl Drop for CaptureGuard {
    fn drop(&mut self) {
        CAPTURE_ACTIVE.store(false, Ordering::Release);
    }
}

fn unix_now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn sanitize_component(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | ' ') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches('.')
        .to_string();
    if cleaned.is_empty() {
        "Unknown Game".to_string()
    } else {
        cleaned
    }
}

fn clean_scene_label(value: Option<&str>) -> String {
    let clean = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("General gameplay")
        .chars()
        .filter(|character| !character.is_control())
        .take(80)
        .collect::<String>();
    if clean.is_empty() {
        "General gameplay".to_string()
    } else {
        clean
    }
}

fn scene_key(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn history_directory(
    app: &tauri::AppHandle,
    game_name: &str,
    game_id: Option<&str>,
) -> Result<PathBuf, String> {
    let mut folder = sanitize_component(game_name);
    if let Some(id) = game_id
        .map(sanitize_component)
        .filter(|value| !value.is_empty())
    {
        folder.push_str(" [");
        folder.push_str(&id);
        folder.push(']');
    }
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve performance history storage: {error}"))?
        .join("performance-history")
        .join(folder))
}

fn history_path(directory: &Path) -> PathBuf {
    directory.join("history.json")
}

fn read_history(directory: &Path) -> Result<PerformanceHistoryFile, String> {
    let path = history_path(directory);
    if !path.exists() {
        return Ok(PerformanceHistoryFile {
            schema_version: 1,
            baselines: HashMap::new(),
            entries: Vec::new(),
        });
    }
    let text = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read performance history: {error}"))?;
    let history: PerformanceHistoryFile = serde_json::from_str(&text)
        .map_err(|error| format!("Performance history is invalid: {error}"))?;
    if history.schema_version != 1 {
        return Err("Performance history uses an unsupported format.".to_string());
    }
    Ok(history)
}

fn write_history(directory: &Path, history: &PerformanceHistoryFile) -> Result<(), String> {
    fs::create_dir_all(directory)
        .map_err(|error| format!("Could not create performance history storage: {error}"))?;
    let json = serde_json::to_string_pretty(history)
        .map_err(|error| format!("Could not serialize performance history: {error}"))?;
    let path = history_path(directory);
    let staged = directory.join("history.json.new");
    let previous = directory.join("history.json.previous");
    fs::write(&staged, json)
        .map_err(|error| format!("Could not stage performance history: {error}"))?;

    if previous.exists() {
        fs::remove_file(&previous)
            .map_err(|error| format!("Could not clear old history recovery data: {error}"))?;
    }
    if path.exists() {
        fs::rename(&path, &previous)
            .map_err(|error| format!("Could not preserve current performance history: {error}"))?;
    }
    if let Err(error) = fs::rename(&staged, &path) {
        if previous.exists() {
            let _ = fs::rename(&previous, &path);
        }
        return Err(format!("Could not update performance history: {error}"));
    }
    if previous.exists() {
        let _ = fs::remove_file(previous);
    }
    Ok(())
}

fn decorate_history(mut history: PerformanceHistoryFile) -> Vec<PerformanceHistoryEntry> {
    for entry in &mut history.entries {
        entry.is_baseline = history
            .baselines
            .get(&scene_key(&entry.scene_label))
            .is_some_and(|id| id == &entry.id);
    }
    history.entries.sort_by(|left, right| {
        right
            .created_unix
            .cmp(&left.created_unix)
            .then_with(|| right.id.cmp(&left.id))
    });
    history.entries
}

fn store_capture_history(
    app: &tauri::AppHandle,
    game_name: &str,
    game_id: Option<&str>,
    scene_label: Option<&str>,
    report: &PerformanceCaptureReport,
) -> Result<PerformanceHistoryEntry, String> {
    let _guard = HISTORY_LOCK
        .lock()
        .map_err(|_| "Performance history lock is unavailable.".to_string())?;
    let directory = history_directory(app, game_name, game_id)?;
    let mut history = read_history(&directory)?;
    let label = clean_scene_label(scene_label);
    let created_unix = unix_now_millis();
    let id = format!("capture-{created_unix}");
    let key = scene_key(&label);
    let mut entry = PerformanceHistoryEntry {
        id: id.clone(),
        created_unix,
        scene_label: label,
        requested_duration_seconds: report.requested_duration_seconds,
        measured_duration_seconds: report.measured_duration_seconds,
        frame_count: report.frame_count,
        average_fps: report.average_fps,
        one_percent_low_fps: report.one_percent_low_fps,
        average_frame_time_ms: report.average_frame_time_ms,
        p95_frame_time_ms: report.p95_frame_time_ms,
        p99_frame_time_ms: report.p99_frame_time_ms,
        spike_threshold_ms: report.spike_threshold_ms,
        spike_count: report.spike_count,
        spike_percent: report.spike_percent,
        average_cpu_busy_ms: report.average_cpu_busy_ms,
        average_gpu_time_ms: report.average_gpu_time_ms,
        present_runtime: report.present_runtime.clone(),
        present_mode: report.present_mode.clone(),
        provider: report.provider.clone(),
        data_file: report.data_file.clone(),
        data_directory: report.data_directory.clone(),
        is_baseline: false,
    };
    if !history.baselines.contains_key(&key) {
        history.baselines.insert(key, id);
        entry.is_baseline = true;
    }
    history.entries.push(entry.clone());
    history.entries.sort_by(|left, right| {
        right
            .created_unix
            .cmp(&left.created_unix)
            .then_with(|| right.id.cmp(&left.id))
    });
    if history.entries.len() > HISTORY_LIMIT {
        history.entries.truncate(HISTORY_LIMIT);
        let retained = history
            .entries
            .iter()
            .map(|item| item.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        history
            .baselines
            .retain(|_, id| retained.contains(id.as_str()));
    }
    write_history(&directory, &history)?;
    Ok(entry)
}

fn valid_history_id(value: &str) -> bool {
    value.starts_with("capture-")
        && value.len() <= 40
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
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

fn value_at<'a>(values: &'a [String], index: Option<usize>) -> Option<&'a str> {
    values
        .get(index?)
        .map(String::as_str)
        .filter(|value| !value.is_empty() && !value.eq_ignore_ascii_case("NA"))
}

fn numeric_at(values: &[String], index: Option<usize>) -> Option<f64> {
    value_at(values, index)?.parse::<f64>().ok()
}

#[cfg(target_os = "windows")]
fn average(values: impl Iterator<Item = f64>) -> Option<f64> {
    let values = values.collect::<Vec<_>>();
    (!values.is_empty()).then(|| values.iter().sum::<f64>() / values.len() as f64)
}

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
        history_id: None,
        history_saved: false,
        scene_label: None,
        created_unix: None,
    })
}

#[cfg(target_os = "linux")]
fn executable_in_path(program: &str) -> Option<PathBuf> {
    env::var_os("PATH")
        .into_iter()
        .flat_map(|path| env::split_paths(&path).collect::<Vec<_>>())
        .chain([PathBuf::from("/usr/bin"), PathBuf::from("/usr/local/bin")])
        .map(|directory| directory.join(program))
        .find(|candidate| candidate.is_file())
}

#[cfg(target_os = "linux")]
fn linux_tool_available(program: &str) -> bool {
    executable_in_path(program).is_some()
        || executable_in_path("distrobox-host-exec")
            .and_then(|host| {
                Command::new(host)
                    .args(["sh", "-lc", &format!("command -v -- {program}")])
                    .output()
                    .ok()
            })
            .is_some_and(|output| output.status.success() && !output.stdout.is_empty())
}

#[cfg(target_os = "linux")]
fn linux_tool_output(program: &str, arguments: &[&str]) -> Result<std::process::Output, String> {
    if let Some(path) = executable_in_path(program) {
        return Command::new(path)
            .args(arguments)
            .output()
            .map_err(|error| format!("Could not run {program}: {error}"));
    }
    if let Some(host) = executable_in_path("distrobox-host-exec") {
        return Command::new(host)
            .arg(program)
            .args(arguments)
            .output()
            .map_err(|error| format!("Could not run {program} on the host: {error}"));
    }
    Err(format!("{program} is not installed."))
}

#[cfg(target_os = "linux")]
fn mangohud_version() -> Option<String> {
    let output = linux_tool_output("mangohud", &["--version"]).ok()?;
    let text = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    text.split_whitespace()
        .find(|part| part.starts_with('v') && part[1..].chars().any(|value| value.is_ascii_digit()))
        .map(str::to_string)
}

#[cfg(target_os = "linux")]
fn linux_executable_name(path: Option<&str>) -> Option<String> {
    Path::new(path?.trim())
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .filter(|name| !name.is_empty())
}

#[cfg(target_os = "linux")]
fn matching_linux_processes(name: &str) -> Vec<u32> {
    let wanted = name.to_ascii_lowercase();
    let stem = Path::new(name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(name)
        .to_ascii_lowercase();
    let Ok(entries) = fs::read_dir("/proc") else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter_map(|entry| entry.file_name().to_string_lossy().parse::<u32>().ok())
        .filter(|pid| {
            fs::read(format!("/proc/{pid}/cmdline"))
                .ok()
                .map(|bytes| String::from_utf8_lossy(&bytes).to_ascii_lowercase())
                .is_some_and(|command| command.contains(&wanted) || command.contains(&stem))
        })
        .collect()
}

#[cfg(target_os = "linux")]
fn process_has_mangohud(pid: u32) -> bool {
    let mapped = fs::read_to_string(format!("/proc/{pid}/maps"))
        .map(|maps| {
            let lower = maps.to_ascii_lowercase();
            lower.contains("libmangohud") || lower.contains("libmangoapp")
        })
        .unwrap_or(false);
    if mapped {
        return true;
    }

    fs::read(format!("/proc/{pid}/environ"))
        .map(|environment| {
            environment.split(|byte| *byte == 0).any(|variable| {
                variable == b"MANGOHUD=1"
                    || variable.starts_with(b"MANGOHUD_CONFIG=")
                    || variable.starts_with(b"MANGOHUD_CONFIGFILE=")
            })
        })
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
fn capture_csv_files(directory: &Path) -> HashMap<PathBuf, SystemTime> {
    fs::read_dir(directory)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            (path.extension().and_then(|value| value.to_str()) == Some("csv"))
                .then(|| {
                    entry
                        .metadata()
                        .ok()
                        .and_then(|metadata| metadata.modified().ok())
                        .map(|modified| (path, modified))
                })
                .flatten()
        })
        .collect()
}

#[cfg(target_os = "linux")]
fn newest_capture_file(
    directory: &Path,
    previous: &HashMap<PathBuf, SystemTime>,
) -> Option<PathBuf> {
    capture_csv_files(directory)
        .into_iter()
        .filter(|(path, modified)| previous.get(path).is_none_or(|before| modified > before))
        .max_by_key(|(_, modified)| *modified)
        .map(|(path, _)| path)
}

#[cfg(target_os = "linux")]
fn mangohud_control_names() -> Vec<String> {
    fs::read_to_string("/proc/net/unix")
        .map(|sockets| {
            sockets
                .lines()
                .filter_map(|line| line.split_whitespace().last())
                .filter_map(|name| name.strip_prefix('@').or(Some(name)))
                .filter(|name| *name == "mangohud" || name.starts_with("mangohud-"))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(target_os = "linux")]
fn send_mangohud_logging(socket_name: &str, enabled: bool) -> Result<(), String> {
    let address = std::os::unix::net::SocketAddr::from_abstract_name(socket_name.as_bytes())
        .map_err(|error| format!("Could not address the MangoHud control endpoint: {error}"))?;
    let mut stream = UnixStream::connect_addr(&address)
        .map_err(|error| format!("Could not connect to the MangoHud control endpoint: {error}"))?;
    stream
        .set_read_timeout(Some(std::time::Duration::from_millis(250)))
        .map_err(|error| format!("Could not configure the MangoHud control connection: {error}"))?;
    stream
        .set_write_timeout(Some(std::time::Duration::from_secs(1)))
        .map_err(|error| format!("Could not configure the MangoHud control connection: {error}"))?;

    // MangoHud sends protocol, device, and version headers immediately after
    // connection. Drain them before sending the logging command so repeated
    // captures cannot fill the socket's receive buffer.
    let mut headers = [0u8; 4096];
    let _ = stream.read(&mut headers);
    let command = if enabled {
        b":logging=1;".as_slice()
    } else {
        b":logging=0;".as_slice()
    };
    stream
        .write_all(command)
        .and_then(|_| stream.flush())
        .map_err(|error| format!("Could not send the MangoHud logging command: {error}"))
}

#[cfg(target_os = "linux")]
fn mangohud_control_targets(preferred_pids: &[u32]) -> Result<Vec<String>, String> {
    let available = mangohud_control_names();
    let mut targets = available
        .iter()
        .filter(|name| {
            preferred_pids
                .iter()
                .any(|pid| name.as_str() == format!("mangohud-{pid}"))
        })
        .cloned()
        .collect::<Vec<_>>();
    if targets.is_empty() {
        targets = available;
    }
    targets.sort();
    targets.dedup();
    if targets.is_empty() {
        return Err(
            "No MangoHud control endpoint was found. Save the current Linux Performance launch options to Steam, fully exit the game, and relaunch it."
                .to_string(),
        );
    }

    // A game can leave helper render processes behind. Avoid creating an
    // unbounded number of control workers when PID matching is unavailable.
    targets.truncate(16);
    Ok(targets)
}

#[cfg(target_os = "linux")]
fn set_mangohud_logging(enabled: bool, targets: &[String]) -> Result<(), String> {
    let (sender, receiver) = std::sync::mpsc::channel();
    for target in targets {
        let sender = sender.clone();
        let target = target.clone();
        std::thread::spawn(move || {
            let result = send_mangohud_logging(&target, enabled);
            let _ = sender.send((target, result));
        });
    }
    drop(sender);

    let mut errors = Vec::new();
    let mut sent = 0usize;
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
    while sent + errors.len() < targets.len() {
        let Some(remaining) = deadline.checked_duration_since(std::time::Instant::now()) else {
            break;
        };
        match receiver.recv_timeout(remaining) {
            Ok((_target, Ok(()))) => sent += 1,
            Ok((target, Err(error))) => errors.push(format!("{target}: {error}")),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => break,
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    if sent > 0 {
        Ok(())
    } else {
        Err(format!(
            "Could not control any MangoHud render process: {}",
            if errors.is_empty() {
                "the control request timed out".to_string()
            } else {
                errors.join("; ")
            }
        ))
    }
}

#[cfg(target_os = "linux")]
fn parse_mangohud_capture(
    path: &Path,
    process_name: String,
    requested_duration_seconds: u32,
) -> Result<PerformanceCaptureReport, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("Could not read the MangoHud capture: {error}"))?;
    let mut frame_times = Vec::new();
    let mut timestamps = Vec::new();

    for line in text.lines() {
        let values = csv_line(line);
        let Some(fps) = numeric_at(&values, Some(0)) else {
            continue;
        };
        if fps.is_finite() && fps > 0.0 && fps <= 10_000.0 {
            frame_times.push(1000.0 / fps);
            if let Some(timestamp) = numeric_at(&values, Some(3)).filter(|value| value.is_finite())
            {
                timestamps.push(timestamp);
            }
        }
    }

    if frame_times.len() < 30 {
        return Err(format!(
            "Only {} valid MangoHud samples were captured. Confirm MangoHud is enabled for this game and keep it actively rendering during the capture.",
            frame_times.len()
        ));
    }

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
    let low_ratio = one_percent_low_fps / average_fps;
    let mut findings = vec![performance_finding(
        if low_ratio < 0.65 { "warning" } else { "good" },
        if low_ratio < 0.65 {
            "Frame delivery was inconsistent"
        } else {
            "Frame delivery was reasonably consistent"
        },
        format!(
            "The 1% low was {:.1} FPS compared with a {:.1} FPS average ({:.0}% of the average).",
            one_percent_low_fps,
            average_fps,
            low_ratio * 100.0
        ),
        (low_ratio < 0.65).then_some(
            "Repeat the same scene after checking shader compilation, overlays, background activity, and graphics settings.",
        ),
    )];
    findings.push(performance_finding(
        if spike_percent > 1.0 { "warning" } else { "good" },
        if spike_percent > 1.0 {
            "Frequent frame-time spikes detected"
        } else {
            "Few large frame-time spikes detected"
        },
        format!(
            "{} samples ({:.1}%) exceeded the {:.1} ms spike threshold.",
            spike_count, spike_percent, spike_threshold_ms
        ),
        (spike_percent > 1.0).then_some(
            "Capture the same repeatable scene again after one change at a time to identify the contributor.",
        ),
    ));
    if requested_duration_seconds < 30 {
        findings.push(performance_finding(
            "info",
            "Short capture",
            "Short samples may miss intermittent traversal or shader-compilation stutter."
                .to_string(),
            Some("Use a 30- or 60-second capture for a more representative result."),
        ));
    }

    let measured_duration_seconds = timestamps
        .first()
        .zip(timestamps.last())
        .map(|(first, last)| (last - first).max(0.0))
        .filter(|duration| *duration > 0.0)
        .map(|duration| {
            let average_step = duration / timestamps.len().saturating_sub(1).max(1) as f64;
            if average_step > 1_000.0 {
                duration / 1_000_000.0
            } else {
                duration / 1_000.0
            }
        })
        .unwrap_or(requested_duration_seconds as f64);

    Ok(PerformanceCaptureReport {
        process_name,
        requested_duration_seconds,
        measured_duration_seconds,
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
        average_cpu_busy_ms: None,
        average_gpu_time_ms: None,
        present_runtime: Some("Vulkan/OpenGL".to_string()),
        present_mode: None,
        frame_time_metric: "MangoHud FPS samples".to_string(),
        frame_times_ms: downsample(&frame_times, 180),
        findings,
        data_file: path.to_string_lossy().to_string(),
        data_directory: path.parent().unwrap_or(path).to_string_lossy().to_string(),
        provider: format!(
            "{} {}",
            LINUX_PROVIDER_NAME,
            mangohud_version().unwrap_or_default()
        )
        .trim()
        .to_string(),
        history_id: None,
        history_saved: false,
        scene_label: None,
        created_unix: None,
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

    #[cfg(target_os = "linux")]
    {
        let _ = app
            .path()
            .app_data_dir()
            .map(|directory| fs::create_dir_all(directory.join("performance-captures")));
        let name = linux_executable_name(executable_path.as_deref());
        let processes = name
            .as_deref()
            .map(matching_linux_processes)
            .unwrap_or_default();
        let running = !processes.is_empty();
        let mango_loaded = processes.into_iter().any(process_has_mangohud);
        let control_ready = !mangohud_control_names().is_empty();
        let tools_ready = linux_tool_available("mangohud");
        let provider_ready = tools_ready;
        return PerformanceCaptureStatus {
            supported: true,
            provider_ready,
            provider_name: LINUX_PROVIDER_NAME.to_string(),
            provider_version: mangohud_version(),
            executable_name: name,
            game_running: running,
            capture_active: CAPTURE_ACTIVE.load(Ordering::Acquire),
            detail: if !tools_ready {
                "MangoHud is required for Linux performance capture.".to_string()
            } else if !running {
                "Enable MangoHud in Linux Performance, save the launch options, then launch the game."
                    .to_string()
            } else if !control_ready {
                "The game is running without the MangoHud control endpoint. Save the current Linux Performance launch options and relaunch it."
                    .to_string()
            } else if !mango_loaded {
                "Game process found. MangoHud will be verified when the capture starts.".to_string()
            } else {
                "MangoHud and the game process are ready for capture.".to_string()
            },
        };
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
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
            detail: "Performance Capture is not available on this platform.".to_string(),
        }
    }
}

#[tauri::command]
pub async fn run_performance_capture(
    app: tauri::AppHandle,
    executable_path: String,
    duration_seconds: u32,
    game_name: String,
    game_id: Option<String>,
    scene_label: Option<String>,
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

        let mut report = parse_capture(&output_path, process_name, duration_seconds)?;
        match store_capture_history(
            &app,
            &game_name,
            game_id.as_deref(),
            scene_label.as_deref(),
            &report,
        ) {
            Ok(entry) => {
                report.history_id = Some(entry.id);
                report.history_saved = true;
                report.scene_label = Some(entry.scene_label);
                report.created_unix = Some(entry.created_unix);
            }
            Err(error) => {
                report.findings.push(performance_finding(
                    "warning",
                    "Capture history could not be saved",
                    error,
                    Some("The raw CSV is still available. Try another capture after checking GameAtlas data-folder permissions."),
                ));
            }
        }
        return Ok(report);
    }

    #[cfg(target_os = "linux")]
    {
        let duration_seconds = duration_seconds.clamp(10, 120);
        let process_name = linux_executable_name(Some(&executable_path))
            .ok_or_else(|| "The selected game's executable is unavailable.".to_string())?;
        let processes = matching_linux_processes(&process_name);
        if processes.is_empty() {
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
        CAPTURE_CANCEL_REQUESTED.store(false, Ordering::Release);

        let capture_root = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("Could not resolve the capture storage folder: {error}"))?
            .join("performance-captures");
        fs::create_dir_all(&capture_root)
            .map_err(|error| format!("Could not create the capture storage folder: {error}"))?;
        let previous = capture_csv_files(&capture_root);
        let worker_root = capture_root.clone();
        let worker_pids = processes;
        let source_path = tauri::async_runtime::spawn_blocking(move || {
            std::thread::sleep(std::time::Duration::from_secs(3));
            let control_targets = mangohud_control_targets(&worker_pids)?;
            set_mangohud_logging(true, &control_targets)?;
            let started = std::time::Instant::now();
            while started.elapsed() < std::time::Duration::from_secs(duration_seconds as u64)
                && !CAPTURE_CANCEL_REQUESTED.load(Ordering::Acquire)
            {
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
            let stop_result = set_mangohud_logging(false, &control_targets);
            for _ in 0..50 {
                if let Some(path) = newest_capture_file(&worker_root, &previous) {
                    // A stop acknowledgement can time out after MangoHud has
                    // already closed and flushed a perfectly valid capture.
                    return Ok(path);
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            stop_result?;
            Err("MangoHud did not create a capture file. Confirm the GameAtlas launch options include its output folder."
                .to_string())
        })
        .await
        .map_err(|error| format!("Performance capture worker failed: {error}"))??;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let safe_name = sanitize_component(&process_name).replace(' ', "_");
        let output_path =
            capture_root.join(format!("{safe_name}-{timestamp}-{duration_seconds}s.csv"));
        let final_path = if source_path == output_path {
            source_path
        } else if fs::rename(&source_path, &output_path).is_ok() {
            output_path
        } else {
            source_path
        };

        let mut report = parse_mangohud_capture(&final_path, process_name, duration_seconds)?;
        match store_capture_history(
            &app,
            &game_name,
            game_id.as_deref(),
            scene_label.as_deref(),
            &report,
        ) {
            Ok(entry) => {
                report.history_id = Some(entry.id);
                report.history_saved = true;
                report.scene_label = Some(entry.scene_label);
                report.created_unix = Some(entry.created_unix);
            }
            Err(error) => report.findings.push(performance_finding(
                "warning",
                "Capture history could not be saved",
                error,
                Some("The raw CSV is still available. Check the GameAtlas data-folder permissions before trying again."),
            )),
        }
        return Ok(report);
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = (
            app,
            executable_path,
            duration_seconds,
            game_name,
            game_id,
            scene_label,
        );
        Err("Performance Capture is not available on this platform.".to_string())
    }
}

#[tauri::command]
pub fn get_performance_capture_history(
    app: tauri::AppHandle,
    game_name: String,
    game_id: Option<String>,
) -> Result<PerformanceCaptureHistory, String> {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        let _guard = HISTORY_LOCK
            .lock()
            .map_err(|_| "Performance history lock is unavailable.".to_string())?;
        let directory = history_directory(&app, &game_name, game_id.as_deref())?;
        let entries = decorate_history(read_history(&directory)?);
        return Ok(PerformanceCaptureHistory {
            supported: true,
            entries,
            history_limit: HISTORY_LIMIT,
            history_directory: directory.to_string_lossy().to_string(),
        });
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = (app, game_name, game_id);
        Ok(PerformanceCaptureHistory {
            supported: false,
            entries: Vec::new(),
            history_limit: 0,
            history_directory: String::new(),
        })
    }
}

#[tauri::command]
pub fn set_performance_capture_baseline(
    app: tauri::AppHandle,
    game_name: String,
    game_id: Option<String>,
    capture_id: String,
) -> Result<PerformanceCaptureHistory, String> {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        if !valid_history_id(&capture_id) {
            return Err("Invalid performance capture identifier.".to_string());
        }
        let _guard = HISTORY_LOCK
            .lock()
            .map_err(|_| "Performance history lock is unavailable.".to_string())?;
        let directory = history_directory(&app, &game_name, game_id.as_deref())?;
        let mut history = read_history(&directory)?;
        let entry = history
            .entries
            .iter()
            .find(|entry| entry.id == capture_id)
            .ok_or_else(|| {
                "The selected performance capture is no longer in history.".to_string()
            })?;
        history
            .baselines
            .insert(scene_key(&entry.scene_label), capture_id);
        write_history(&directory, &history)?;
        let entries = decorate_history(history);
        return Ok(PerformanceCaptureHistory {
            supported: true,
            entries,
            history_limit: HISTORY_LIMIT,
            history_directory: directory.to_string_lossy().to_string(),
        });
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = (app, game_name, game_id, capture_id);
        Err("Performance Capture History is not available on this platform.".to_string())
    }
}

#[tauri::command]
pub fn remove_performance_capture_history_entry(
    app: tauri::AppHandle,
    game_name: String,
    game_id: Option<String>,
    capture_id: String,
) -> Result<PerformanceCaptureHistory, String> {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        if !valid_history_id(&capture_id) {
            return Err("Invalid performance capture identifier.".to_string());
        }
        let _guard = HISTORY_LOCK
            .lock()
            .map_err(|_| "Performance history lock is unavailable.".to_string())?;
        let directory = history_directory(&app, &game_name, game_id.as_deref())?;
        let mut history = read_history(&directory)?;
        let removed = history
            .entries
            .iter()
            .find(|entry| entry.id == capture_id)
            .cloned()
            .ok_or_else(|| {
                "The selected performance capture is no longer in history.".to_string()
            })?;
        history.entries.retain(|entry| entry.id != capture_id);
        let key = scene_key(&removed.scene_label);
        if history
            .baselines
            .get(&key)
            .is_some_and(|id| id == &capture_id)
        {
            if let Some(replacement) = history
                .entries
                .iter()
                .filter(|entry| scene_key(&entry.scene_label) == key)
                .max_by_key(|entry| entry.created_unix)
            {
                history.baselines.insert(key, replacement.id.clone());
            } else {
                history.baselines.remove(&key);
            }
        }
        write_history(&directory, &history)?;
        let entries = decorate_history(history);
        return Ok(PerformanceCaptureHistory {
            supported: true,
            entries,
            history_limit: HISTORY_LIMIT,
            history_directory: directory.to_string_lossy().to_string(),
        });
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = (app, game_name, game_id, capture_id);
        Err("Performance Capture History is not available on this platform.".to_string())
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

    #[cfg(target_os = "linux")]
    {
        let _ = app;
        if !CAPTURE_ACTIVE.load(Ordering::Acquire) {
            return Ok(false);
        }
        CAPTURE_CANCEL_REQUESTED.store(true, Ordering::Release);
        let control_targets = mangohud_control_targets(&[])?;
        set_mangohud_logging(false, &control_targets)?;
        return Ok(true);
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = app;
        Ok(false)
    }
}

#[cfg(all(test, target_os = "linux"))]
mod linux_tests {
    use super::*;

    #[test]
    fn mangohud_parser_calculates_frame_summary() {
        let path = std::env::temp_dir().join(format!(
            "gameatlas-mangohud-parser-{}.csv",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let mut csv = String::from(
            "os,cpu,gpu,ram,kernel,driver\nLinux,Test CPU,Test GPU,1024,6.0,Test Driver\n",
        );
        for index in 0..120 {
            let fps = if index == 119 { 20.0 } else { 60.0 };
            csv.push_str(&format!("{fps},25,80,{}\n", index * 16_667));
        }
        fs::write(&path, csv).expect("write fixture");
        let report =
            parse_mangohud_capture(&path, "game.exe".to_string(), 30).expect("parse capture");
        let _ = fs::remove_file(&path);

        assert_eq!(report.frame_count, 120);
        assert!(report.average_fps > 58.0 && report.average_fps < 60.0);
        assert!(report.one_percent_low_fps < report.average_fps);
        assert_eq!(report.spike_count, 1);
        assert_eq!(report.frame_time_metric, "MangoHud FPS samples");
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

    #[test]
    fn history_roundtrips_and_decorates_scene_baseline() {
        let directory = std::env::temp_dir().join(format!(
            "gameatlas-performance-history-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let entry = PerformanceHistoryEntry {
            id: "capture-12345".to_string(),
            created_unix: 12345,
            scene_label: "Built-in benchmark".to_string(),
            requested_duration_seconds: 30,
            measured_duration_seconds: 30.0,
            frame_count: 1800,
            average_fps: 60.0,
            one_percent_low_fps: 48.0,
            average_frame_time_ms: 16.67,
            p95_frame_time_ms: 20.0,
            p99_frame_time_ms: 25.0,
            spike_threshold_ms: 33.3,
            spike_count: 2,
            spike_percent: 0.1,
            average_cpu_busy_ms: Some(5.0),
            average_gpu_time_ms: Some(10.0),
            present_runtime: Some("DXGI".to_string()),
            present_mode: Some("Hardware: Independent Flip".to_string()),
            provider: "PresentMon 2.5.1".to_string(),
            data_file: "capture.csv".to_string(),
            data_directory: "captures".to_string(),
            is_baseline: false,
        };
        let mut baselines = HashMap::new();
        baselines.insert(scene_key(&entry.scene_label), entry.id.clone());
        let history = PerformanceHistoryFile {
            schema_version: 1,
            baselines,
            entries: vec![entry],
        };

        write_history(&directory, &history).expect("write history");
        let entries = decorate_history(read_history(&directory).expect("read history"));
        let _ = fs::remove_dir_all(&directory);

        assert_eq!(entries.len(), 1);
        assert!(entries[0].is_baseline);
        assert_eq!(entries[0].scene_label, "Built-in benchmark");
    }

    #[test]
    fn scene_labels_and_history_ids_are_sanitized() {
        assert_eq!(clean_scene_label(Some("  City route  ")), "City route");
        assert_eq!(clean_scene_label(Some("   ")), "General gameplay");
        assert!(valid_history_id("capture-123456"));
        assert!(!valid_history_id("../capture-123456"));
    }
}
