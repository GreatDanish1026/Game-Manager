mod diagnostics;
mod ea_games;
mod fluffy;
mod game_file_utilities;
mod game_launcher;
mod game_version;
mod heroic_games;
mod installed_games;
mod launch_profiles;
mod linux_steam;
mod local_installation;
mod local_paths;
mod logging;
mod lutris_games;
mod manual_games;
mod pcgamingwiki;
mod pcgw_issues;
mod platform;
mod renodx;
mod rhi;
mod save_backups;
mod save_browser;
mod steam_rating;
mod system_hardware;
mod vortex;
mod xbox_games;

mod proton_prefix_maintenance;
mod proton_runtime_overrides;
mod proton_toolbox;
mod proton_tools;
mod proton_troubleshooting;
mod renodx_installer;
mod renodx_manager;
mod reshade_manager;
mod reshade_windows;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            reshade_windows::install_reshade_addons_windows,
            renodx_installer::get_renodx_package_info,
            renodx_installer::install_renodx_package_linux,
                renodx_installer::uninstall_renodx_package_linux,
                renodx_installer::get_latest_renodx_backup,
                renodx_installer::restore_latest_renodx_backup_linux,
                renodx_installer::get_renodx_update_status_linux,
            reshade_manager::install_reshade_addons_direct_linux,
            reshade_manager::get_reshade_addon_installer_info,
            reshade_manager::download_reshade_addon_installer,
            renodx_manager::get_renodx_readiness,
            proton_troubleshooting::get_proton_troubleshooting_info,
            proton_troubleshooting::save_last_known_working_runtime,
            proton_prefix_maintenance::get_prefix_maintenance_info,
            proton_prefix_maintenance::create_prefix_backup,
            proton_prefix_maintenance::restore_prefix_backup,
            proton_prefix_maintenance::reset_prefix,
            proton_runtime_overrides::set_proton_runtime_override,
            proton_runtime_overrides::clear_proton_runtime_override,
            proton_tools::get_proton_tool_actions,
            proton_tools::open_proton_toolbox_path,
            proton_tools::launch_protontricks_gui,
            proton_tools::launch_steam_winecfg,
            proton_tools::launch_winetricks_gui,
            proton_toolbox::get_proton_toolbox_info,
            game_version::inspect_game_version,
            ea_games::get_ea_installed_games,
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
            local_paths::open_game_path_with_context,
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
            launch_profiles::get_installed_proton_tools,
            game_launcher::get_launcher_status,
            local_installation::inspect_local_installation,
            platform::get_platform_info,
            linux_steam::get_linux_steam_games,
            heroic_games::get_heroic_installed_games,
            lutris_games::get_lutris_installed_games,
            system_hardware::get_system_hardware,
            pcgw_issues::get_pcgw_known_issues,
            diagnostics::export_diagnostics_text,
            diagnostics::create_diagnostics_support_bundle
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
