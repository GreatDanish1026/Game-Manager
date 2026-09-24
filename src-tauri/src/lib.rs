mod background_conflicts;
mod clean_launch;
mod configuration_validator;
mod controller_conflicts;
mod crash_detective;
mod diagnostics;
mod display_validator;
mod ea_games;
mod fluffy;
mod game_file_utilities;
mod game_launcher;
mod game_version;
mod graphics_driver_diagnostics;
mod heroic_games;
mod installed_games;
mod launch_failure_analyzer;
mod launch_profiles;
mod linux_mod_deployment;
mod linux_performance;
mod linux_steam;
mod local_installation;
mod local_paths;
mod logging;
mod lutris_games;
mod manual_games;
mod mod_conflict_inspector;
mod nexus_integration;
mod pcgamingwiki;
mod pcgw_issues;
mod performance_capture;
mod platform;
mod renodx;
mod rhi;
mod runtime_dependency_doctor;
mod save_backups;
mod save_browser;
mod shader_cache;
mod steam_keyvalues;
mod steam_launch_options;
mod steam_launch_store;
mod steam_rating;
mod steam_artwork;
mod system_hardware;
mod updater_metadata;
mod vortex;
mod windows_performance_diagnostics;
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
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        use tauri::Manager;

        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            #[cfg(target_os = "linux")]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                app.deep_link().register_all()?;

                if let Some(urls) = app.deep_link().get_current()? {
                    for url in urls {
                        nexus_integration::queue_nxm_link(app.handle(), url.as_str());
                    }
                }

                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        nexus_integration::queue_nxm_link(&handle, url.as_str());
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            background_conflicts::get_background_conflict_report,
            clean_launch::get_clean_launch_status,
            clean_launch::prepare_clean_launch,
            clean_launch::restore_clean_launch_apps,
            linux_mod_deployment::get_linux_mod_deployment_status,
            linux_mod_deployment::pick_linux_mod_source,
            linux_mod_deployment::prepare_linux_staged_mod,
            linux_mod_deployment::deploy_linux_mod,
            linux_mod_deployment::set_linux_mod_enabled,
            linux_mod_deployment::move_linux_mod_priority,
            linux_mod_deployment::update_linux_mod_metadata,
            linux_mod_deployment::upgrade_linux_mod,
            linux_mod_deployment::create_linux_mod_profile,
            linux_mod_deployment::rename_linux_mod_profile,
            linux_mod_deployment::delete_linux_mod_profile,
            linux_mod_deployment::activate_linux_mod_profile,
            linux_mod_deployment::verify_linux_mod_library,
            linux_mod_deployment::purge_linux_mod_library,
            linux_mod_deployment::redeploy_linux_mod_library,
            linux_mod_deployment::repair_linux_mod_library,
            linux_mod_deployment::remove_linux_mod_deployment,
            configuration_validator::get_game_configuration_validation_report,
            configuration_validator::get_game_configuration_backup_status,
            configuration_validator::create_game_configuration_backup,
            configuration_validator::safely_reset_game_configuration,
            configuration_validator::restore_game_configuration_backup,
            shader_cache::get_shader_cache_report,
            shader_cache::clear_shader_cache_targets,
            graphics_driver_diagnostics::get_graphics_driver_diagnostics,
            controller_conflicts::get_controller_conflict_report,
            crash_detective::get_crash_detective_report,
            display_validator::get_display_validation_report,
            runtime_dependency_doctor::get_runtime_dependency_report,
            performance_capture::get_performance_capture_status,
            performance_capture::run_performance_capture,
            performance_capture::cancel_performance_capture,
            performance_capture::get_performance_capture_history,
            performance_capture::set_performance_capture_baseline,
            performance_capture::remove_performance_capture_history_entry,
            windows_performance_diagnostics::get_windows_performance_diagnostics,
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
            steam_artwork::find_steam_app_id_for_artwork,
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
            launch_failure_analyzer::monitor_game_launch,
            launch_failure_analyzer::cancel_launch_failure_monitor,
            mod_conflict_inspector::inspect_mod_conflicts,
            nexus_integration::get_nexus_account_status,
            nexus_integration::connect_nexus_account,
            nexus_integration::refresh_nexus_account,
            nexus_integration::disconnect_nexus_account,
            nexus_integration::lookup_nexus_mod,
            nexus_integration::download_nexus_file,
            nexus_integration::cancel_nexus_download,
            nexus_integration::check_nexus_mod_updates,
            nexus_integration::inspect_nxm_link,
            nexus_integration::get_pending_nxm_links,
            nexus_integration::dismiss_nxm_link,
            launch_profiles::get_installed_proton_tools,
            game_launcher::get_launcher_status,
            local_installation::inspect_local_installation,
            platform::get_platform_info,
            linux_performance::get_linux_performance_capabilities,
            steam_launch_options::get_steam_launch_options,
            steam_launch_options::set_steam_launch_options,
            linux_steam::get_linux_steam_games,
            heroic_games::get_heroic_installed_games,
            lutris_games::get_lutris_installed_games,
            system_hardware::get_system_hardware,
            updater_metadata::get_updater_version_status,
            pcgw_issues::get_pcgw_known_issues,
            diagnostics::export_diagnostics_text,
            diagnostics::create_diagnostics_support_bundle
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
