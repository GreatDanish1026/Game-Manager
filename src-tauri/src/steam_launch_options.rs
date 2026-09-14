use crate::steam_launch_store as store;
use serde::Serialize;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamAccount {
    id: String,
    label: String,
    current: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamLaunchState {
    accounts: Vec<SteamAccount>,
    running: bool,
    write_block_reason: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamWriteResult {
    backup_path: Option<String>,
}
#[tauri::command]
pub fn get_steam_launch_options(
    app_id: String,
    install_path: String,
) -> Result<SteamLaunchState, String> {
    let accounts = store::accounts(&app_id, &install_path)?
        .into_iter()
        .map(|a| SteamAccount {
            id: a.id,
            label: a.label,
            current: a.value,
        })
        .collect();
    let (running, write_block_reason) = match store::steam_running() {
        Ok(true) => (
            true,
            Some("Exit Steam completely, then refresh to enable saving.".into()),
        ),
        Ok(false) => (false, None),
        Err(e) => (false, Some(e)),
    };
    Ok(SteamLaunchState {
        accounts,
        running,
        write_block_reason,
    })
}
#[tauri::command]
pub fn set_steam_launch_options(
    app_id: String,
    install_path: String,
    account_id: String,
    expected: Option<String>,
    value: String,
) -> Result<SteamWriteResult, String> {
    let backup = store::write(
        &app_id,
        &install_path,
        &account_id,
        expected.as_deref(),
        &value,
    )?;
    Ok(SteamWriteResult {
        backup_path: backup.map(|p| p.to_string_lossy().into_owned()),
    })
}
