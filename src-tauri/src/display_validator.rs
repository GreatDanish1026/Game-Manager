use serde::Serialize;

#[cfg(target_os = "windows")]
use std::{mem::size_of, path::Path};

#[cfg(target_os = "linux")]
use std::{fs, process::Command};

#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Devices::Display::{
        DisplayConfigGetDeviceInfo, GetDisplayConfigBufferSizes, QueryDisplayConfig,
        DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO,
        DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME, DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
        DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO, DISPLAYCONFIG_MODE_INFO,
        DISPLAYCONFIG_MODE_INFO_TYPE_SOURCE, DISPLAYCONFIG_OUTPUT_TECHNOLOGY_DISPLAYPORT_EMBEDDED,
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_DISPLAYPORT_EXTERNAL,
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_DISPLAYPORT_USB_TUNNEL,
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_DVI, DISPLAYCONFIG_OUTPUT_TECHNOLOGY_HD15,
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_HDMI, DISPLAYCONFIG_OUTPUT_TECHNOLOGY_INTERNAL,
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_LVDS, DISPLAYCONFIG_OUTPUT_TECHNOLOGY_MIRACAST,
        DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_SOURCE_DEVICE_NAME,
        DISPLAYCONFIG_TARGET_DEVICE_NAME, QDC_ONLY_ACTIVE_PATHS,
    },
    Foundation::{ERROR_INSUFFICIENT_BUFFER, ERROR_SUCCESS},
    Graphics::Gdi::{EnumDisplaySettingsW, DEVMODEW, ENUM_CURRENT_SETTINGS},
};

#[cfg(target_os = "windows")]
use winreg::{enums::HKEY_CURRENT_USER, RegKey};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplaySnapshot {
    pub name: String,
    pub device_name: String,
    pub primary: bool,
    pub width: u32,
    pub height: u32,
    pub refresh_hz: f64,
    pub max_refresh_hz_at_resolution: Option<f64>,
    pub connection: String,
    pub hdr_supported: Option<bool>,
    pub hdr_enabled: Option<bool>,
    pub bits_per_color_channel: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayFinding {
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayValidationReport {
    pub supported: bool,
    pub platform: String,
    pub displays: Vec<DisplaySnapshot>,
    pub findings: Vec<DisplayFinding>,
    pub gpu_preference: Option<String>,
    pub summary: String,
}

fn finding(
    severity: &str,
    title: &str,
    detail: String,
    suggestion: Option<&str>,
) -> DisplayFinding {
    DisplayFinding {
        severity: severity.to_string(),
        title: title.to_string(),
        detail,
        suggestion: suggestion.map(str::to_string),
    }
}

#[cfg(target_os = "windows")]
fn utf16_text(value: &[u16]) -> String {
    let end = value
        .iter()
        .position(|character| *character == 0)
        .unwrap_or(value.len());
    String::from_utf16_lossy(&value[..end]).trim().to_string()
}

#[cfg(target_os = "windows")]
fn connection_name(value: i32) -> &'static str {
    match value {
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_HDMI => "HDMI",
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_DISPLAYPORT_EXTERNAL => "DisplayPort",
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_DISPLAYPORT_EMBEDDED => "Embedded DisplayPort",
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_DISPLAYPORT_USB_TUNNEL => "DisplayPort over USB-C",
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_DVI => "DVI",
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_HD15 => "VGA",
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_LVDS | DISPLAYCONFIG_OUTPUT_TECHNOLOGY_INTERNAL => {
            "Internal display"
        }
        DISPLAYCONFIG_OUTPUT_TECHNOLOGY_MIRACAST => "Wireless display",
        _ => "Other / unknown",
    }
}

#[cfg(target_os = "windows")]
fn device_modes(
    device_name: &str,
    width: u32,
    height: u32,
) -> (Option<f64>, Option<(u32, u32, f64)>) {
    let mut wide: Vec<u16> = device_name.encode_utf16().collect();
    wide.push(0);

    let mut current = DEVMODEW::default();
    current.dmSize = size_of::<DEVMODEW>() as u16;
    let current_mode =
        unsafe { EnumDisplaySettingsW(wide.as_ptr(), ENUM_CURRENT_SETTINGS, &mut current) };
    let fallback = (current_mode != 0).then_some((
        current.dmPelsWidth,
        current.dmPelsHeight,
        current.dmDisplayFrequency as f64,
    ));

    let mut index = 0;
    let mut max_refresh = None::<f64>;
    loop {
        let mut mode = DEVMODEW::default();
        mode.dmSize = size_of::<DEVMODEW>() as u16;
        if unsafe { EnumDisplaySettingsW(wide.as_ptr(), index, &mut mode) } == 0 {
            break;
        }
        if mode.dmPelsWidth == width && mode.dmPelsHeight == height && mode.dmDisplayFrequency > 1 {
            max_refresh = Some(
                max_refresh
                    .unwrap_or_default()
                    .max(mode.dmDisplayFrequency as f64),
            );
        }
        index += 1;
    }

    (max_refresh, fallback)
}

#[cfg(target_os = "windows")]
fn gpu_preference(executable_path: Option<&str>) -> Option<String> {
    let path = executable_path?.trim();
    if path.is_empty() || !Path::new(path).is_file() {
        return None;
    }

    let key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey("Software\\Microsoft\\DirectX\\UserGpuPreferences")
        .ok()?;
    let value: String = key.get_value(path).ok()?;
    let lower = value.to_ascii_lowercase();
    if lower.contains("gpupreference=2") {
        Some("High performance".to_string())
    } else if lower.contains("gpupreference=1") {
        Some("Power saving".to_string())
    } else {
        Some("Let Windows decide".to_string())
    }
}

#[cfg(target_os = "windows")]
fn query_displays() -> Result<Vec<DisplaySnapshot>, String> {
    for _ in 0..3 {
        let mut path_count = 0;
        let mut mode_count = 0;
        let result = unsafe {
            GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count)
        };
        if result != ERROR_SUCCESS {
            return Err(format!(
                "Windows could not size the active display configuration ({result})."
            ));
        }

        let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); path_count as usize];
        let mut modes = vec![DISPLAYCONFIG_MODE_INFO::default(); mode_count as usize];
        let result = unsafe {
            QueryDisplayConfig(
                QDC_ONLY_ACTIVE_PATHS,
                &mut path_count,
                paths.as_mut_ptr(),
                &mut mode_count,
                modes.as_mut_ptr(),
                std::ptr::null_mut(),
            )
        };
        if result == ERROR_INSUFFICIENT_BUFFER {
            continue;
        }
        if result != ERROR_SUCCESS {
            return Err(format!(
                "Windows could not read the active display configuration ({result})."
            ));
        }
        paths.truncate(path_count as usize);
        modes.truncate(mode_count as usize);

        let mut displays = Vec::new();
        for (index, path) in paths.iter().enumerate() {
            let source_index = unsafe { path.sourceInfo.Anonymous.modeInfoIdx } as usize;
            let source = modes
                .get(source_index)
                .filter(|mode| mode.infoType == DISPLAYCONFIG_MODE_INFO_TYPE_SOURCE)
                .map(|mode| unsafe { mode.Anonymous.sourceMode });

            let mut source_name = DISPLAYCONFIG_SOURCE_DEVICE_NAME::default();
            source_name.header.r#type = DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME;
            source_name.header.size = size_of::<DISPLAYCONFIG_SOURCE_DEVICE_NAME>() as u32;
            source_name.header.adapterId = path.sourceInfo.adapterId;
            source_name.header.id = path.sourceInfo.id;
            let device_name = if unsafe { DisplayConfigGetDeviceInfo(&mut source_name.header) } == 0
            {
                utf16_text(&source_name.viewGdiDeviceName)
            } else {
                String::new()
            };

            let mut target_name = DISPLAYCONFIG_TARGET_DEVICE_NAME::default();
            target_name.header.r#type = DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME;
            target_name.header.size = size_of::<DISPLAYCONFIG_TARGET_DEVICE_NAME>() as u32;
            target_name.header.adapterId = path.targetInfo.adapterId;
            target_name.header.id = path.targetInfo.id;
            let name = if unsafe { DisplayConfigGetDeviceInfo(&mut target_name.header) } == 0 {
                utf16_text(&target_name.monitorFriendlyDeviceName)
            } else {
                String::new()
            };

            let mut advanced = DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO::default();
            advanced.header.r#type = DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO;
            advanced.header.size = size_of::<DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO>() as u32;
            advanced.header.adapterId = path.targetInfo.adapterId;
            advanced.header.id = path.targetInfo.id;
            let advanced_ok = unsafe { DisplayConfigGetDeviceInfo(&mut advanced.header) } == 0;
            let advanced_flags = advanced_ok.then(|| unsafe { advanced.Anonymous.value });

            let mut width = source.map(|mode| mode.width).unwrap_or_default();
            let mut height = source.map(|mode| mode.height).unwrap_or_default();
            let denominator = path.targetInfo.refreshRate.Denominator;
            let mut refresh_hz = if denominator > 0 {
                path.targetInfo.refreshRate.Numerator as f64 / denominator as f64
            } else {
                0.0
            };
            let (max_refresh_hz_at_resolution, fallback) =
                device_modes(&device_name, width, height);
            if let Some((fallback_width, fallback_height, fallback_refresh)) = fallback {
                if width == 0 || height == 0 {
                    width = fallback_width;
                    height = fallback_height;
                }
                if refresh_hz <= 1.0 {
                    refresh_hz = fallback_refresh;
                }
            }

            displays.push(DisplaySnapshot {
                name: if name.is_empty() {
                    format!("Display {}", index + 1)
                } else {
                    name
                },
                device_name,
                primary: index == 0,
                width,
                height,
                refresh_hz,
                max_refresh_hz_at_resolution,
                connection: connection_name(path.targetInfo.outputTechnology).to_string(),
                hdr_supported: advanced_flags.map(|flags| flags & 1 != 0),
                hdr_enabled: advanced_flags.map(|flags| flags & 2 != 0),
                bits_per_color_channel: advanced_ok.then_some(advanced.bitsPerColorChannel),
            });
        }
        return Ok(displays);
    }
    Err(
        "The display configuration changed repeatedly while it was being read. Please try again."
            .to_string(),
    )
}

#[cfg(target_os = "windows")]
fn build_report(executable_path: Option<String>) -> Result<DisplayValidationReport, String> {
    let displays = query_displays()?;
    let preference = gpu_preference(executable_path.as_deref());
    let mut findings = Vec::new();

    for display in &displays {
        if let Some(maximum) = display.max_refresh_hz_at_resolution {
            if maximum > display.refresh_hz + 1.0 {
                findings.push(finding(
                    "warning",
                    "A higher refresh rate is available",
                    format!("{} is running at {:.0} Hz, but Windows reports up to {:.0} Hz at {} × {}.", display.name, display.refresh_hz, maximum, display.width, display.height),
                    Some("Open Advanced display settings and select the higher refresh rate if your cable and display support it."),
                ));
            }
        }

        match (display.hdr_supported, display.hdr_enabled) {
            (Some(true), Some(false)) => findings.push(finding(
                "info",
                "HDR is available but off",
                format!("{} reports HDR capability, while Windows HDR is currently disabled.", display.name),
                Some("Enable HDR in Windows only when you want HDR output; some SDR desktop setups look better with it off."),
            )),
            (Some(true), Some(true)) => findings.push(finding(
                "good",
                "HDR is active",
                format!("Windows HDR is enabled on {} with {} bits per color channel reported.", display.name, display.bits_per_color_channel.unwrap_or_default()),
                None,
            )),
            _ => {}
        }
    }

    if displays.len() > 1 {
        let lowest = displays
            .iter()
            .map(|display| display.refresh_hz)
            .fold(f64::INFINITY, f64::min);
        let highest = displays
            .iter()
            .map(|display| display.refresh_hz)
            .fold(0.0, f64::max);
        if highest - lowest > 5.0 {
            findings.push(finding(
                "info",
                "Mixed refresh rates detected",
                format!("Active displays range from {:.0} Hz to {:.0} Hz. This is valid, but some games and capture tools behave more consistently on one display or matching rates.", lowest, highest),
                Some("If a game stutters in borderless mode, test with the other display disabled or with matched refresh rates."),
            ));
        }
    }

    match preference.as_deref() {
        Some("Power saving") => findings.push(finding(
            "warning",
            "This game is assigned to the power-saving GPU",
            "Windows Graphics settings explicitly prefer the power-saving GPU for this executable.".to_string(),
            Some("Change the game's Graphics preference to High performance unless battery life is more important."),
        )),
        Some("High performance") => findings.push(finding(
            "good",
            "High-performance GPU preference is set",
            "Windows is configured to prefer the high-performance GPU for this executable.".to_string(),
            None,
        )),
        _ => {}
    }

    if findings.is_empty() && !displays.is_empty() {
        findings.push(finding(
            "good",
            "No obvious display configuration issue found",
            "The active resolution, refresh rate, and Windows HDR state do not show an obvious mismatch.".to_string(),
            None,
        ));
    }

    let summary = match displays.len() {
        0 => "Windows did not report an active display.".to_string(),
        1 => "Validated 1 active display.".to_string(),
        count => format!("Validated {count} active displays."),
    };

    Ok(DisplayValidationReport {
        supported: true,
        platform: "windows".to_string(),
        displays,
        findings,
        gpu_preference: preference,
        summary,
    })
}

#[cfg(target_os = "linux")]
fn connection_name_linux(device_name: &str) -> String {
    let upper = device_name.to_ascii_uppercase();
    if upper.starts_with("HDMI") {
        "HDMI".to_string()
    } else if upper.starts_with("DP") || upper.contains("DISPLAYPORT") {
        "DisplayPort".to_string()
    } else if upper.starts_with("EDP") {
        "Embedded DisplayPort".to_string()
    } else if upper.starts_with("DVI") {
        "DVI".to_string()
    } else if upper.starts_with("VGA") {
        "VGA".to_string()
    } else if upper.starts_with("LVDS") {
        "Internal display".to_string()
    } else {
        "Other / unknown".to_string()
    }
}

#[cfg(target_os = "linux")]
fn parse_mode(value: &str) -> Option<(u32, u32, f64)> {
    let value = value
        .split_once(':')
        .map(|(_, mode)| mode)
        .unwrap_or(value)
        .trim_matches(|character: char| matches!(character, '*' | '+' | '!' | ','));
    let (resolution, refresh) = value.split_once('@')?;
    let (width, height) = resolution.split_once('x')?;
    let refresh = refresh
        .trim_matches(|character: char| !character.is_ascii_digit() && character != '.')
        .parse::<f64>()
        .ok()?;
    Some((width.parse().ok()?, height.parse().ok()?, refresh))
}

#[cfg(target_os = "linux")]
fn strip_ansi_escape_sequences(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut output = String::with_capacity(value.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == 0x1b {
            index += 1;
            if index < bytes.len() && bytes[index] == b'[' {
                index += 1;
                while index < bytes.len() {
                    let byte = bytes[index];
                    index += 1;
                    if (0x40..=0x7e).contains(&byte) {
                        break;
                    }
                }
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
fn parse_kscreen_displays(output: &str) -> Vec<DisplaySnapshot> {
    let output = strip_ansi_escape_sequences(output);
    let mut displays = Vec::new();

    for block in output.split("Output:").skip(1) {
        let mut lines = block.lines();
        let header = lines.next().unwrap_or_default().trim();
        let header_parts = header.split_whitespace().collect::<Vec<_>>();
        let device_name = header_parts.get(1).copied().unwrap_or_default().to_string();
        if device_name.is_empty() {
            continue;
        }

        let body = lines.collect::<Vec<_>>().join("\n");
        let lower = body.to_ascii_lowercase();
        if !lower.lines().any(|line| line.trim() == "enabled")
            || lower.lines().any(|line| line.trim() == "disconnected")
        {
            continue;
        }

        let mut current = None;
        let mut modes = Vec::new();
        let mut primary = false;
        let mut hdr_supported = None;
        let mut hdr_enabled = None;
        let mut bits_per_color_channel = None;

        for line in body.lines().map(str::trim) {
            let line_lower = line.to_ascii_lowercase();
            if line_lower.starts_with("priority:") || line_lower.starts_with("priority ") {
                primary = line
                    .split(|character: char| character == ':' || character.is_whitespace())
                    .filter(|part| !part.is_empty())
                    .last()
                    == Some("1");
            } else if line_lower.starts_with("modes:") {
                for token in line.split_whitespace().skip(1) {
                    if let Some(mode) = parse_mode(token) {
                        if token.contains('*') {
                            current = Some(mode);
                        }
                        modes.push(mode);
                    }
                }
            } else if line_lower.starts_with("hdr:") {
                if line_lower.contains("enabled") {
                    hdr_supported = Some(true);
                    hdr_enabled = Some(true);
                } else if line_lower.contains("unsupported") || line_lower.contains("incapable") {
                    hdr_supported = Some(false);
                    hdr_enabled = Some(false);
                } else if line_lower.contains("disabled") {
                    // KScreen does not consistently distinguish an HDR-capable
                    // display that is off from a compositor with HDR unavailable.
                    hdr_enabled = Some(false);
                }
            } else if line_lower.starts_with("color resolution:") {
                bits_per_color_channel = line
                    .split(|character: char| !character.is_ascii_digit())
                    .filter_map(|part| part.parse::<u32>().ok())
                    .find(|bits| (6..=16).contains(bits));
            }
        }

        let Some((width, height, refresh_hz)) = current.or_else(|| modes.first().copied()) else {
            continue;
        };
        let max_refresh_hz_at_resolution = modes
            .iter()
            .filter(|(mode_width, mode_height, _)| *mode_width == width && *mode_height == height)
            .map(|(_, _, refresh)| *refresh)
            .reduce(f64::max);

        displays.push(DisplaySnapshot {
            name: device_name.clone(),
            connection: connection_name_linux(&device_name),
            device_name,
            primary,
            width,
            height,
            refresh_hz,
            max_refresh_hz_at_resolution,
            hdr_supported,
            hdr_enabled,
            bits_per_color_channel,
        });
    }

    displays
}

#[cfg(target_os = "linux")]
fn parse_xrandr_displays(output: &str) -> Vec<DisplaySnapshot> {
    let output = strip_ansi_escape_sequences(output);
    let mut displays = Vec::new();
    let lines = output.lines().collect::<Vec<_>>();
    let mut index = 0;

    while index < lines.len() {
        let line = lines[index];
        let parts = line.split_whitespace().collect::<Vec<_>>();
        if parts.get(1) != Some(&"connected") {
            index += 1;
            continue;
        }

        let device_name = parts[0].to_string();
        let primary = parts.contains(&"primary");
        let mut modes = Vec::new();
        let mut current = None;
        index += 1;
        while index < lines.len() && lines[index].starts_with(char::is_whitespace) {
            let mode_line = lines[index].trim();
            let mode_parts = mode_line.split_whitespace().collect::<Vec<_>>();
            if let Some(resolution) = mode_parts.first() {
                if resolution.contains('x') {
                    for refresh in mode_parts.iter().skip(1) {
                        let mode = format!("{}@{}", resolution, refresh);
                        if let Some(parsed) = parse_mode(&mode) {
                            if refresh.contains('*') {
                                current = Some(parsed);
                            }
                            modes.push(parsed);
                        }
                    }
                }
            }
            index += 1;
        }

        if current.is_none() {
            current = parts.iter().find_map(|part| {
                let geometry = part.split('+').next()?;
                let (width, height) = geometry.split_once('x')?;
                Some((width.parse().ok()?, height.parse().ok()?, 0.0))
            });
        }
        let Some((width, height, refresh_hz)) = current else {
            continue;
        };
        let max_refresh_hz_at_resolution = modes
            .iter()
            .filter(|(mode_width, mode_height, _)| *mode_width == width && *mode_height == height)
            .map(|(_, _, refresh)| *refresh)
            .reduce(f64::max);

        displays.push(DisplaySnapshot {
            name: device_name.clone(),
            connection: connection_name_linux(&device_name),
            device_name,
            primary,
            width,
            height,
            refresh_hz,
            max_refresh_hz_at_resolution,
            hdr_supported: None,
            hdr_enabled: None,
            bits_per_color_channel: None,
        });
    }

    displays
}

#[cfg(target_os = "linux")]
fn command_text(program: &str, arguments: &[&str]) -> Option<String> {
    let run = |host: bool| {
        let mut command = if host {
            let mut command = Command::new("distrobox-host-exec");
            command.arg(program);
            command
        } else {
            Command::new(program)
        };
        let output = command.args(arguments).output().ok()?;
        output
            .status
            .success()
            .then(|| String::from_utf8_lossy(&output.stdout).trim().to_string())
            .filter(|text| !text.is_empty())
    };

    run(false).or_else(|| run(true))
}

#[cfg(target_os = "linux")]
fn drm_displays() -> Vec<DisplaySnapshot> {
    let Ok(entries) = fs::read_dir("/sys/class/drm") else {
        return Vec::new();
    };
    let mut displays = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if fs::read_to_string(path.join("status"))
            .ok()
            .as_deref()
            .map(str::trim)
            != Some("connected")
            || fs::read_to_string(path.join("enabled"))
                .ok()
                .as_deref()
                .map(str::trim)
                == Some("disabled")
        {
            continue;
        }
        let device_name = entry.file_name().to_string_lossy().to_string();
        let connector = device_name
            .split_once('-')
            .map(|(_, name)| name.to_string())
            .unwrap_or_else(|| device_name.clone());
        let mode = fs::read_to_string(path.join("modes"))
            .ok()
            .and_then(|modes| modes.lines().next().map(str::to_string));
        let Some((width, height)) = mode.and_then(|mode| {
            let (width, height) = mode.trim().split_once('x')?;
            Some((width.parse().ok()?, height.parse().ok()?))
        }) else {
            continue;
        };

        displays.push(DisplaySnapshot {
            name: connector.clone(),
            device_name,
            primary: displays.is_empty(),
            width,
            height,
            refresh_hz: 0.0,
            max_refresh_hz_at_resolution: None,
            connection: connection_name_linux(&connector),
            hdr_supported: None,
            hdr_enabled: None,
            bits_per_color_channel: None,
        });
    }

    displays
}

#[cfg(target_os = "linux")]
fn query_linux_displays() -> Vec<DisplaySnapshot> {
    if let Some(output) = command_text("kscreen-doctor", &["-o"]) {
        let displays = parse_kscreen_displays(&output);
        if !displays.is_empty() {
            return displays;
        }
    }
    if let Some(output) = command_text("xrandr", &["--query"]) {
        let displays = parse_xrandr_displays(&output);
        if !displays.is_empty() {
            return displays;
        }
    }
    drm_displays()
}

#[cfg(target_os = "linux")]
fn build_linux_report() -> DisplayValidationReport {
    let displays = query_linux_displays();
    let mut findings = Vec::new();

    for display in &displays {
        if let Some(maximum) = display.max_refresh_hz_at_resolution {
            if display.refresh_hz > 0.0 && maximum > display.refresh_hz + 1.0 {
                findings.push(finding(
                    "warning",
                    "A higher refresh rate is available",
                    format!("{} is running at {:.0} Hz, but Linux reports up to {:.0} Hz at {} × {}.", display.name, display.refresh_hz, maximum, display.width, display.height),
                    Some("Open your desktop's display settings and select the higher refresh rate if your cable and display support it."),
                ));
            }
        }
        match (display.hdr_supported, display.hdr_enabled) {
            (Some(true), Some(false)) => findings.push(finding(
                "info",
                "HDR is available but off",
                format!(
                    "{} reports HDR capability, while HDR output is currently disabled.",
                    display.name
                ),
                Some("Enable HDR in your desktop display settings only when you want HDR output."),
            )),
            (Some(true), Some(true)) => findings.push(finding(
                "good",
                "HDR is active",
                format!(
                    "HDR output is enabled on {}{}.",
                    display.name,
                    display
                        .bits_per_color_channel
                        .map(|bits| format!(" with {bits} bits per color channel reported"))
                        .unwrap_or_default()
                ),
                None,
            )),
            _ => {}
        }
    }

    let known_refresh = displays
        .iter()
        .map(|display| display.refresh_hz)
        .filter(|refresh| *refresh > 0.0)
        .collect::<Vec<_>>();
    if known_refresh.len() > 1 {
        let lowest = known_refresh.iter().copied().fold(f64::INFINITY, f64::min);
        let highest = known_refresh.iter().copied().fold(0.0, f64::max);
        if highest - lowest > 5.0 {
            findings.push(finding(
                "info",
                "Mixed refresh rates detected",
                format!("Active displays range from {:.0} Hz to {:.0} Hz. This is valid, but some games and capture tools behave more consistently on one display or matching rates.", lowest, highest),
                Some("If a game stutters in borderless mode, test with the other display disabled or with matched refresh rates."),
            ));
        }
    }

    if findings.is_empty() && !displays.is_empty() {
        findings.push(finding(
            "good",
            "No obvious display configuration issue found",
            "The active resolution and available refresh-rate data do not show an obvious mismatch.".to_string(),
            None,
        ));
    } else if displays.is_empty() {
        findings.push(finding(
            "warning",
            "No active display could be inspected",
            "The desktop compositor and Linux DRM interface did not return an active display.".to_string(),
            Some("Run GameAtlas in your graphical desktop session and ensure kscreen-doctor (KDE) or xrandr (X11) is available."),
        ));
    }

    let summary = match displays.len() {
        0 => "Linux did not report an active display.".to_string(),
        1 => "Validated 1 active display.".to_string(),
        count => format!("Validated {count} active displays."),
    };
    DisplayValidationReport {
        supported: true,
        platform: "linux".to_string(),
        displays,
        findings,
        gpu_preference: None,
        summary,
    }
}

#[cfg(all(test, target_os = "linux"))]
mod linux_tests {
    use super::{parse_kscreen_displays, parse_xrandr_displays};

    #[test]
    fn parses_active_kscreen_output() {
        let output = r#"
\x1b[01;32mOutput: \x1b[0;0m1 DP-1 12345678-1234-1234-1234-123456789abc
        \x1b[01;32menabled\x1b[0;0m
        connected
        priority 1
        Modes: 0:\x1b[01;32m2560x1440@165*\x1b[0;0m! 1:2560x1440@144 2:1920x1080@60
        Geometry: 0,0 2560x1440
        HDR: enabled
        Color resolution: automatic (10), range: [8; 10] bits per color
Output: 2 HDMI-A-1 87654321-4321-4321-4321-cba987654321
        disabled
        connected
        Modes: 0:1920x1080@60*!
"#
        .replace(r"\x1b", "\x1b");

        let displays = parse_kscreen_displays(&output);
        assert_eq!(displays.len(), 1);
        assert_eq!(displays[0].device_name, "DP-1");
        assert!(displays[0].primary);
        assert_eq!((displays[0].width, displays[0].height), (2560, 1440));
        assert_eq!(displays[0].refresh_hz, 165.0);
        assert_eq!(displays[0].max_refresh_hz_at_resolution, Some(165.0));
        assert_eq!(displays[0].hdr_enabled, Some(true));
        assert_eq!(displays[0].bits_per_color_channel, Some(10));
    }

    #[test]
    fn parses_active_xrandr_output() {
        let output = r#"Screen 0: minimum 8 x 8, current 4480 x 1440, maximum 32767 x 32767
DP-1 connected primary 2560x1440+0+0 (normal left inverted right x axis y axis)
   2560x1440    143.97*+ 120.00   60.00
   1920x1080    120.00    60.00
HDMI-1 connected 1920x1080+2560+0 (normal left inverted right x axis y axis)
   1920x1080     60.00*+  59.94
DP-2 disconnected (normal left inverted right x axis y axis)
"#;

        let displays = parse_xrandr_displays(output);
        assert_eq!(displays.len(), 2);
        assert_eq!(displays[0].device_name, "DP-1");
        assert!(displays[0].primary);
        assert_eq!(displays[0].refresh_hz, 143.97);
        assert_eq!(displays[0].max_refresh_hz_at_resolution, Some(143.97));
        assert_eq!(displays[1].connection, "HDMI");
    }
}

#[tauri::command]
pub fn get_display_validation_report(
    executable_path: Option<String>,
) -> Result<DisplayValidationReport, String> {
    #[cfg(target_os = "windows")]
    {
        return build_report(executable_path);
    }

    #[cfg(target_os = "linux")]
    {
        let _ = executable_path;
        return Ok(build_linux_report());
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = executable_path;
        Ok(DisplayValidationReport {
            supported: false,
            platform: std::env::consts::OS.to_string(),
            displays: Vec::new(),
            findings: Vec::new(),
            gpu_preference: None,
            summary: "Display validation is currently available on Windows.".to_string(),
        })
    }
}
