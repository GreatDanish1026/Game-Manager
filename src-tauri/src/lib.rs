mod installed_games;
mod pcgamingwiki;
mod renodx;
mod rhi;
mod vortex;
mod fluffy;
mod local_paths;
mod save_backups;
mod game_launcher;
mod local_installation;


#[cfg_attr(
    mobile,
    tauri::mobile_entry_point
)]
pub fn run() {
    tauri::Builder::default()

        .plugin(
            tauri_plugin_opener::init()
        )

        .plugin(
            tauri_plugin_process::init()
        )

        .plugin(
            tauri_plugin_updater::Builder::new()
                .build()
        )

        .invoke_handler(
            tauri::generate_handler![
                installed_games::get_installed_games,

                pcgamingwiki::get_pcgw_game_data,

                renodx::get_renodx_mod_status,

                rhi::get_rhi_status,
                rhi::launch_rhi,

                vortex::get_vortex_support,

                fluffy::get_fluffy_support,

                local_paths::open_game_path,

                save_backups::get_save_backup_status,
                save_backups::create_save_backup,
                save_backups::restore_save_backup,

                game_launcher::launch_game,

                local_installation::inspect_local_installation
            ]
        )

        .run(
            tauri::generate_context!()
        )

        .expect(
            "error while running tauri application"
        );
}
