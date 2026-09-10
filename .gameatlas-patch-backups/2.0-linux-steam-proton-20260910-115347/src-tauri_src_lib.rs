mod game_version;
mod ea_games;
mod xbox_games;
mod logging;
mod diagnostics;
mod installed_games;
mod manual_games;
mod pcgamingwiki;
mod steam_rating;
mod renodx;
mod rhi;
mod vortex;
mod fluffy;
mod local_paths;
mod save_backups;
mod save_browser;
mod game_file_utilities;
mod game_launcher;
mod launch_profiles;
mod local_installation;
mod system_hardware;
mod platform;
mod pcgw_issues;


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
                

                
            game_version::inspect_game_version,ea_games::get_ea_installed_games,
                xbox_games::get_xbox_installed_games,
                installed_games::get_installed_games,
                manual_games::pick_manual_game_executable,

                pcgamingwiki::get_pcgw_game_data,
                steam_rating::get_steam_community_rating,

                renodx::get_renodx_mod_status,

                rhi::get_rhi_status,
                rhi::launch_rhi,

                vortex::get_vortex_support,

                fluffy::get_fluffy_support,

                local_paths::open_game_path,
                local_paths::open_game_file,

                save_backups::get_save_backup_status,
                save_browser::inspect_save_browser,
                game_file_utilities::inspect_game_utility_directories,
                save_backups::get_backup_storage_summary,
                save_backups::create_save_backup,
                save_backups::delete_save_backup,
                save_backups::restore_save_backup,

                game_launcher::launch_game,
                launch_profiles::launch_profile_executable,
                game_launcher::get_launcher_status,

                local_installation::inspect_local_installation,
                platform::get_platform_info,


                system_hardware::get_system_hardware,

                pcgw_issues::get_pcgw_known_issues,

                diagnostics::export_diagnostics_text,
                diagnostics::create_diagnostics_support_bundle
            ]
        )

        .run(
            tauri::generate_context!()
        )

        .expect(
            "error while running tauri application"
        );
}
