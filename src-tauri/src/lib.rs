mod auth;
mod commands;
mod services;
mod utils;
mod models;
mod discord_rpc;

use discord_rpc::DiscordRpc;
use tauri::Manager;
use std::sync::Arc;
use tauri_plugin_updater::UpdaterExt;
use services::accounts::AccountManager;
use services::friends::FriendsService;
use models::{AppConfig, FriendStatus};
use tauri_plugin_store::StoreExt;

use commands::{
    microsoft_login,
    microsoft_login_and_store,
    get_accounts,
    get_active_account,
    switch_account,
    remove_account,
    send_friend_request,
    get_friend_requests,
    accept_friend_request,
    reject_friend_request,
    get_friends,
    remove_friend,
    update_user_status,
    register_user_in_friends_system,
    create_instance,
    get_instances,
    delete_instance,
    rename_instance,
    duplicate_instance,
    launch_instance,
    kill_instance,
    launch_instance_with_active_account,
    get_launch_token,
    refresh_account_token,
    set_instance_icon,
    remove_instance_icon,
    get_instance_icon,
    get_launcher_directory,
    open_instance_folder,
    open_worlds_folder,
    open_world_folder,
    get_instance_worlds,
    delete_world,
    update_instance_fabric_loader,
    update_instance_minecraft_version,
    export_instance,
    get_all_screenshots,
    get_screenshot_data,
    delete_screenshot,
    open_screenshot,
    open_screenshots_folder,
    get_minecraft_versions,
    get_minecraft_versions_with_metadata,
    get_minecraft_versions_by_type,
    get_supported_game_versions,
    install_minecraft,
    check_version_installed,
    get_fabric_versions,
    install_fabric,
    get_neoforge_versions,
    get_neoforge_supported_game_versions,
    install_neoforge,
    get_installed_mods,
    delete_mod,
    open_mods_folder,
    toggle_mod,
    search_mods,
    get_mod_details,
    get_mod_versions,
    download_mod,
    get_project_details,
    get_modpack_versions,
    install_modpack,
    get_modpack_manifest,
    get_modpack_game_versions,
    install_modpack_from_file,
    get_modpack_name_from_file,
    get_installed_resourcepacks,
    download_resourcepack,
    delete_resourcepack,
    open_resourcepacks_folder,
    get_installed_shaderpacks,
    download_shaderpack,
    delete_shaderpack,
    open_shaderpacks_folder,
    get_servers,
    add_server,
    delete_server,
    update_server_status,
    launch_server,
    get_settings,
    save_settings,
    get_instance_settings,
    save_instance_settings,
    detect_java_installations,
    set_sidebar_background,
    get_sidebar_background,
    remove_sidebar_background,
    create_template,
    get_templates,
    get_template,
    update_template,
    delete_template,
    create_template_from_instance,
    apply_template_to_instance,
    create_instance_from_template,
    export_template,
    import_template,
    upload_skin,
    reset_skin,
    get_current_skin,
    get_user_capes,
    equip_cape,
    remove_cape,
    load_recent_skins,
    save_recent_skin,
    get_system_info,
    open_url,
};

#[tauri::command]
fn get_app_version() -> String {
    let version = env!("CARGO_PKG_VERSION");
    let commit_hash = include_str!("../commit_hash.txt").trim();
    format!("{}-{}", version, commit_hash)
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let updater = app.updater().map_err(|e| format!("Failed to get updater: {}", e))?;

    match updater.check().await {
        Ok(Some(update)) => {
            let current_version = app.package_info().version.to_string();
            Ok(Some(format!("{} -> {}", current_version, update.version)))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Failed to check for updates: {}", e)),
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| format!("Failed to get updater: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?
        .ok_or_else(|| "No update available".to_string())?;

    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|e| format!("Failed to install update: {}", e))
}

#[tauri::command]
async fn update_discord_rpc_mode(app: tauri::AppHandle) -> Result<(), String> {
    use crate::services::settings::SettingsManager;

    let settings = SettingsManager::load()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let discord_rpc: tauri::State<Arc<DiscordRpc>> = app.state();

    if settings.discord_rpc_enabled {
        discord_rpc.set_activity("Playing Minecraft", None, "grass", "Minecraft");
    } else {
        discord_rpc.clear_activity();
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Err(e) = dotenvy::dotenv() {
        eprintln!("Warning: Could not load .env file: {}", e);
    }

    let discord_rpc = Arc::new(DiscordRpc::new("1457530211968221184"));

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(discord_rpc.clone())
        .setup(move |app| {
            let store = app.store("secrets.json")?;

            let microsoft_client_id = store
                .get("microsoft_client_id")
                .and_then(|v| v.as_str().map(|s| s.to_string()))
                .or_else(|| std::env::var("MICROSOFT_CLIENT_ID").ok())
                .expect("MICROSOFT_CLIENT_ID must be set in .env file or store");

            let supabase_url = store
                .get("supabase_url")
                .and_then(|v| v.as_str().map(|s| s.to_string()))
                .or_else(|| std::env::var("SUPABASE_URL").ok())
                .expect("SUPABASE_URL must be set in .env file or store");

            let supabase_key = store
                .get("supabase_key")
                .and_then(|v| v.as_str().map(|s| s.to_string()))
                .or_else(|| std::env::var("SUPABASE_SERVICE_KEY").ok())
                .expect("SUPABASE_SERVICE_KEY must be set in .env file or store");

            let client_id = microsoft_client_id.clone();
            app.manage(AppConfig {
                microsoft_client_id,
                supabase_url,
                supabase_key,
            });

            use crate::services::settings::SettingsManager;
            let should_enable_rpc = SettingsManager::load()
                .map(|s| s.discord_rpc_enabled)
                .unwrap_or(true);

            if should_enable_rpc {
                let rpc: tauri::State<Arc<DiscordRpc>> = app.state();
                rpc.set_activity("Playing Minecraft", None, "grass", "Minecraft");
            }

            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                let account = AccountManager::get_active_account()
                    .map_err(|e| e.to_string())
                    .ok()
                    .flatten();
                if let Some(account) = account {
                    let _ = AccountManager::get_valid_token(&account.uuid, &client_id)
                        .await
                        .map_err(|e| e.to_string());
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(
                event,
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
            ) {
                let app_handle = window.app_handle();
                let config = app_handle.state::<AppConfig>();
                let supabase_url = config.supabase_url.clone();
                let supabase_key = config.supabase_key.clone();

                tauri::async_runtime::spawn(async move {
                    let accounts = AccountManager::get_all_accounts()
                        .map_err(|e| e.to_string())
                        .ok();
                    if let Some(accounts) = accounts {
                        let service = FriendsService::new(&supabase_url, &supabase_key)
                            .map_err(|e| e.to_string())
                            .ok();
                        if let Some(service) = service {
                            for account in &accounts {
                                let _ = service
                                    .update_status(&account.uuid, FriendStatus::Offline, None)
                                    .await;
                            }
                        }
                    }
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            check_for_updates,
            install_update,
            microsoft_login,
            microsoft_login_and_store,
            get_accounts,
            get_active_account,
            switch_account,
            remove_account,
            launch_instance_with_active_account,
            get_launch_token,
            refresh_account_token,
            send_friend_request,
            get_friend_requests,
            accept_friend_request,
            reject_friend_request,
            get_friends,
            remove_friend,
            update_user_status,
            register_user_in_friends_system,
            upload_skin,
            reset_skin,
            get_current_skin,
            get_user_capes,
            equip_cape,
            remove_cape,
            load_recent_skins,
            save_recent_skin,
            get_minecraft_versions,
            get_minecraft_versions_with_metadata,
            get_minecraft_versions_by_type,
            get_supported_game_versions,
            install_minecraft,
            check_version_installed,
            get_fabric_versions,
            install_fabric,
            create_instance,
            get_instances,
            delete_instance,
            rename_instance,
            duplicate_instance,
            open_worlds_folder,
            open_world_folder,
            get_instance_worlds,
            delete_world,
            update_instance_fabric_loader,
            update_instance_minecraft_version,
            export_instance,
            get_neoforge_versions,
            get_neoforge_supported_game_versions,
            install_neoforge,
            get_all_screenshots,
            get_screenshot_data,
            delete_screenshot,
            open_screenshot,
            open_screenshots_folder,
            set_instance_icon,
            remove_instance_icon,
            get_instance_icon,
            launch_instance,
            kill_instance,
            get_launcher_directory,
            open_instance_folder,
            search_mods,
            get_mod_details,
            get_mod_versions,
            download_mod,
            get_project_details,
            get_settings,
            save_settings,
            get_instance_settings,
            save_instance_settings,
            detect_java_installations,
            set_sidebar_background,
            get_sidebar_background,
            remove_sidebar_background,
            update_discord_rpc_mode,
            get_installed_mods,
            delete_mod,
            open_mods_folder,
            toggle_mod,
            get_modpack_versions,
            install_modpack,
            get_modpack_manifest,
            get_modpack_game_versions,
            install_modpack_from_file,
            get_modpack_name_from_file,
            get_installed_resourcepacks,
            download_resourcepack,
            delete_resourcepack,
            open_resourcepacks_folder,
            get_installed_shaderpacks,
            download_shaderpack,
            delete_shaderpack,
            open_shaderpacks_folder,
            get_servers,
            add_server,
            delete_server,
            update_server_status,
            launch_server,
            create_template,
            get_templates,
            get_template,
            update_template,
            delete_template,
            create_template_from_instance,
            apply_template_to_instance,
            create_instance_from_template,
            export_template,
            import_template,
            open_url,
            get_system_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}