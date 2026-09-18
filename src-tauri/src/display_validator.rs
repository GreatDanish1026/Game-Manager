use serde::Serialize;

#[cfg(target_os = "windows")]
use std::{mem::size_of, path::Path};

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
        displays,
        findings,
        gpu_preference: preference,
        summary,
    })
}

#[tauri::command]
pub fn get_display_validation_report(
    executable_path: Option<String>,
) -> Result<DisplayValidationReport, String> {
    #[cfg(target_os = "windows")]
    {
        return build_report(executable_path);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = executable_path;
        Ok(DisplayValidationReport {
            supported: false,
            displays: Vec::new(),
            findings: Vec::new(),
            gpu_preference: None,
            summary: "Display validation is currently available on Windows.".to_string(),
        })
    }
}
