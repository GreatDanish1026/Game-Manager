use serde::Serialize;
use std::{
    env,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtonToolActions {
    pub supported: bool,
    pub can_open_paths: bool,
    pub protontricks_available: bool,
    pub winetricks_available: bool,
    pub protontricks_backend: Option<String>,
    pub winetricks_backend: Option<String>,
}

#[cfg(target_os = "linux")]
fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME").map(PathBuf::from)
}

#[cfg(target_os = "linux")]
fn executable_candidates(program: &str) -> Vec<PathBuf> {
    let mut results = Vec::new();

    for prefix in ["/usr/bin", "/usr/local/bin", "/bin", "/var/usrlocal/bin"] {
        let path = Path::new(prefix).join(program);
        if path.exists() {
            results.push(path);
        }
    }

    if let Some(home) = home_dir() {
        for path in [
            home.join(".local/bin").join(program),
            home.join("bin").join(program),
        ] {
            if path.exists() {
                results.push(path);
            }
        }
    }

    results.push(PathBuf::from(program));
    results
}

#[cfg(target_os = "linux")]
fn can_spawn(program: &Path, args: &[&str]) -> bool {
    Command::new(program)
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
fn native_command(program: &str) -> Option<PathBuf> {
    for candidate in executable_candidates(program) {
        if Command::new(&candidate)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok()
        {
            return Some(candidate);
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn flatpak_available(app_id: &str) -> bool {
    let flatpak = Path::new("/usr/bin/flatpak");

    if !flatpak.exists() {
        return false;
    }

    can_spawn(flatpak, &["info", app_id])
}

#[cfg(target_os = "linux")]
fn spawn_detached(
    program: &Path,
    args: &[String],
    environment: &[(&str, &str)],
) -> Result<(), String> {
    let mut command = Command::new(program);

    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    for (key, value) in environment {
        command.env(key, value);
    }

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to launch {}: {}", program.to_string_lossy(), error))
}

#[tauri::command]
pub fn get_proton_tool_actions() -> Result<ProtonToolActions, String> {
    #[cfg(not(target_os = "linux"))]
    {
        return Ok(ProtonToolActions {
            supported: false,
            can_open_paths: false,
            protontricks_available: false,
            winetricks_available: false,
            protontricks_backend: None,
            winetricks_backend: None,
        });
    }

    #[cfg(target_os = "linux")]
    {
        let native_protontricks = native_command("protontricks");
        let native_winetricks = native_command("winetricks");

        let flatpak_protontricks = flatpak_available("com.github.Matoking.protontricks");

        Ok(ProtonToolActions {
            supported: true,
            can_open_paths: true,
            protontricks_available: native_protontricks.is_some() || flatpak_protontricks,
            winetricks_available: native_winetricks.is_some(),
            protontricks_backend: native_protontricks
                .map(|path| path.to_string_lossy().to_string())
                .or_else(|| {
                    flatpak_protontricks
                        .then(|| "Flatpak com.github.Matoking.protontricks".to_string())
                }),
            winetricks_backend: native_winetricks.map(|path| path.to_string_lossy().to_string()),
        })
    }
}

#[tauri::command]
pub fn open_proton_toolbox_path(app: AppHandle, path: String) -> Result<(), String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, path);

        return Err("This action is available on Linux.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let target = Path::new(path.trim());

        if !target.exists() {
            return Err(format!("Path does not exist: {}", target.display()));
        }

        app.opener()
            .open_path(target.to_string_lossy().to_string(), None::<&str>)
            .map_err(|error| format!("Failed to open {}: {}", target.display(), error))
    }
}

#[tauri::command]
pub fn launch_protontricks_gui() -> Result<(), String> {
    #[cfg(not(target_os = "linux"))]
    {
        return Err("Protontricks integration is available on Linux.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(program) = native_command("protontricks") {
            return spawn_detached(&program, &["--gui".to_string()], &[]);
        }

        if flatpak_available("com.github.Matoking.protontricks") {
            return spawn_detached(
                Path::new("/usr/bin/flatpak"),
                &[
                    "run".to_string(),
                    "com.github.Matoking.protontricks".to_string(),
                    "--gui".to_string(),
                ],
                &[],
            );
        }

        Err("Protontricks was not detected. Install Protontricks and try again.".to_string())
    }
}

#[tauri::command]
pub fn launch_steam_winecfg(steam_app_id: String) -> Result<(), String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = steam_app_id;
        return Err("Steam Proton tools are available on Linux.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let app_id = steam_app_id.trim();

        if app_id.is_empty() || !app_id.chars().all(|character| character.is_ascii_digit()) {
            return Err("A valid Steam App ID is required.".to_string());
        }

        if let Some(program) = native_command("protontricks") {
            return spawn_detached(&program, &[app_id.to_string(), "winecfg".to_string()], &[]);
        }

        if flatpak_available("com.github.Matoking.protontricks") {
            return spawn_detached(
                Path::new("/usr/bin/flatpak"),
                &[
                    "run".to_string(),
                    "com.github.Matoking.protontricks".to_string(),
                    app_id.to_string(),
                    "winecfg".to_string(),
                ],
                &[],
            );
        }

        Err(
            "Protontricks was not detected. Wine configuration for Steam Proton games requires Protontricks."
                .to_string(),
        )
    }
}

#[tauri::command]
pub fn launch_winetricks_gui(prefix_path: String) -> Result<(), String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = prefix_path;
        return Err("Winetricks integration is available on Linux.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let prefix = Path::new(prefix_path.trim());

        if !prefix.exists() {
            return Err(format!(
                "Prefix does not exist: {}",
                prefix.to_string_lossy()
            ));
        }

        let Some(program) = native_command("winetricks") else {
            return Err(
                "Winetricks was not detected in the current Linux environment.".to_string(),
            );
        };

        spawn_detached(
            &program,
            &["--gui".to_string()],
            &[("WINEPREFIX", prefix.to_string_lossy().as_ref())],
        )
    }
}
