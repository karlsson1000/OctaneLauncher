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
use services::chat::ChatService;
use models::FriendStatus;

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
    update_specific_user_status,
    register_user_in_friends_system,
    send_chat_message,
    get_chat_messages,
    get_unread_message_counts,
    mark_messages_as_read,
    cleanup_chat_messages,
    search_gifs,
    get_trending_gifs,
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
    create_launcher_snapshot,
    get_launcher_snapshots,
    restore_launcher_snapshot,
    delete_launcher_snapshot,
    export_launcher_snapshot,
    import_launcher_snapshot,
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
        .manage(discord_rpc.clone())
        .setup(move |app| {
            use crate::services::settings::SettingsManager;
            let should_enable_rpc = SettingsManager::load()
                .map(|s| s.discord_rpc_enabled)
                .unwrap_or(true);

            if should_enable_rpc {
                let rpc: tauri::State<Arc<DiscordRpc>> = app.state();
                rpc.set_activity("Playing Minecraft", None, "grass", "Minecraft");
            }

            Ok(())
        })
        .on_window_event(|_window, event| {
            if matches!(
                event,
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
            ) {
                if let Ok(runtime) = tokio::runtime::Runtime::new() {
                    runtime.block_on(async {
                        if let Ok(accounts) = AccountManager::get_all_accounts() {
                            if let Ok(service) = FriendsService::new() {
                                for account in &accounts {
                                    let _ = service
                                        .update_status(&account.uuid, FriendStatus::Offline, None)
                                        .await;
                                }
                            }
                        }

                        if let Ok(Some(active)) = AccountManager::get_active_account() {
                            if let Ok(chat) = ChatService::new() {
                                let _ = chat.cleanup_messages_if_both_offline(&active.uuid).await;
                            }
                        }
                    });
                }
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
            update_specific_user_status,
            register_user_in_friends_system,
            send_chat_message,
            get_chat_messages,
            get_unread_message_counts,
            mark_messages_as_read,
            cleanup_chat_messages,
            search_gifs,
            get_trending_gifs,
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
            create_launcher_snapshot,
            get_launcher_snapshots,
            restore_launcher_snapshot,
            delete_launcher_snapshot,
            export_launcher_snapshot,
            import_launcher_snapshot,
            open_url,
            get_system_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}