use serde::Serialize;
use std::path::Path;
use std::process::Command;

const RHI_PATH: &str = r"C:\Program Files\ReShade HDR Installer\RHI.exe";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RhiStatus {
    pub installed: bool,
    pub path: String,
}

#[tauri::command]
pub fn get_rhi_status() -> RhiStatus {
    let installed = Path::new(RHI_PATH).is_file();

    println!("[RHI] Installed: {}", installed);

    println!("[RHI] Path: {}", RHI_PATH);

    RhiStatus {
        installed,
        path: RHI_PATH.to_string(),
    }
}

#[tauri::command]
pub fn launch_rhi() -> Result<(), String> {
    if !Path::new(RHI_PATH).is_file() {
        return Err(format!(
            "ReShade HDR Installer was not found at {}",
            RHI_PATH
        ));
    }

    println!("[RHI] Launching {}", RHI_PATH);

    Command::new(RHI_PATH)
        .spawn()
        .map_err(|error| format!("Failed to launch ReShade HDR Installer: {}", error))?;

    Ok(())
}
