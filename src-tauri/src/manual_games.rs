use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualGameExecutableSelection {
    path: String,
    install_path: String,
    suggested_name: String,
}

#[tauri::command]
pub fn pick_manual_game_executable() -> Result<Option<ManualGameExecutableSelection>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter("Game executable", &["exe", "bat", "cmd"])
        .set_title("Select game executable")
        .pick_file();

    let Some(path) = picked else {
        return Ok(None);
    };

    build_selection(path).map(Some)
}

fn build_selection(path: PathBuf) -> Result<ManualGameExecutableSelection, String> {
    let install_path = path
        .parent()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_default();

    let suggested_name = path
        .file_stem()
        .map(|value| value.to_string_lossy().replace(['_', '-'], " "))
        .unwrap_or_else(|| "Manual Game".to_string());

    Ok(ManualGameExecutableSelection {
        path: path.to_string_lossy().to_string(),
        install_path,
        suggested_name,
    })
}
