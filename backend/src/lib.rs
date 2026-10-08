mod auth;
mod commands;
mod services;
mod utils;
mod models;

use tauri::Manager;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_updater::UpdaterExt;
use services::accounts::AccountManager;
use models::{AppConfig, FriendStatus};
use std::sync::Arc;

use commands::*;

async fn set_all_accounts_offline(app: &tauri::AppHandle) {
    let Ok(accounts) = AccountManager::get_all_accounts() else {
        return;
    };
    for account in accounts {
        if services::friends::has_live_session(&account.uuid) {
            let _ = services::friends::set_status_for_account(
                app,
                &account.uuid,
                FriendStatus::Offline,
                None,
            )
            .await;
        }
    }
}

#[tauri::command]
fn get_app_version() -> String {
    format!("{}-{}", env!("CARGO_PKG_VERSION"), env!("OCTANE_COMMIT_HASH"))
}

#[tauri::command]
fn show_window(app: tauri::AppHandle) {
    show_main_window(&app);
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

pub struct CurseforgeConfig {
    pub api_key: Arc<str>,
}

#[allow(dead_code)]
struct TrayState(std::sync::Mutex<Option<TrayIcon>>);

static USER_HID_WINDOW: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {    if let Err(e) = dotenvy::dotenv() {
        eprintln!("Warning: Could not load .env file: {}", e);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(move |app| {
            let microsoft_client_id =
                std::env::var("MICROSOFT_CLIENT_ID").unwrap_or_else(|_| env!("MICROSOFT_CLIENT_ID").to_string());

            let convex_url =
                std::env::var("CONVEX_URL").unwrap_or_else(|_| env!("CONVEX_URL").to_string());

            let client_id = microsoft_client_id.clone();
            app.manage(AppConfig {
                microsoft_client_id,
                convex_url,
            });

            let curseforge_api_key = env!("CURSEFORGE_API_KEY").to_string();
            app.manage(CurseforgeConfig {
                api_key: Arc::from(curseforge_api_key),
            });

            std::thread::spawn(|| crate::services::discord::set_in_launcher());

            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &separator, &quit_item])?;
            let tray_icon =
                tauri::image::Image::from_bytes(&include_bytes!("../icons/32x32.png")[..])?;
            let tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("Octane Launcher")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        show_main_window(app);
                    }
                    "quit" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = tokio::time::timeout(
                                tokio::time::Duration::from_secs(1),
                                set_all_accounts_offline(&app_handle),
                            )
                            .await;
                            app_handle.exit(0);
                        });
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            app.manage(TrayState(std::sync::Mutex::new(Some(tray))));

            let fallback_window = app.get_webview_window("main");
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                if USER_HID_WINDOW.load(std::sync::atomic::Ordering::SeqCst) {
                    return;
                }
                if let Some(window) = fallback_window {
                    if !window.is_visible().unwrap_or(true) {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });

            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                let _ = crate::services::trash::TrashManager::clean_old_items(30);
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
            if window.label() != "main" {
                return;
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                USER_HID_WINDOW.store(true, std::sync::atomic::Ordering::SeqCst);
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            show_window,
            check_for_updates,
            install_update,
            microsoft_login_and_store,
            get_accounts,
            switch_account,
            remove_account,
            launch_instance_with_active_account,
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
            get_fabric_versions,
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
            update_instance_neoforge_loader,
            update_instance_forge_loader,
            update_instance_minecraft_version,
            export_instance,
            get_neoforge_versions,
            get_neoforge_supported_game_versions,
            get_forge_versions,
            get_forge_supported_game_versions,
            get_all_screenshots,
            delete_screenshot,
            open_screenshot,
            open_screenshots_folder,
            set_instance_icon,
            remove_instance_icon,
            apply_saved_options,
            save_options_as_default,
            launch_world,
            kill_instance,
            get_launcher_directory,
            open_instance_folder,
            search_mods,
            get_mod_versions,
            check_mod_updates,
            download_mod,
            get_project_details,
            get_settings,
            save_settings,
            get_instance_settings,
            save_instance_settings,
            detect_java_installations,
            set_background,
            get_background,
            remove_background,
            open_directory,
            get_installed_mods,
            get_installed_mods_with_metadata,
            delete_mod,
            toggle_mod,
            install_modpack,
            install_modpack_from_file,
            get_modpack_name_from_file,
            detect_importable_instances,
            import_instance,
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
            ping_server,
            reorder_servers,
            open_url,
            get_system_info,
            get_storage_usage,
            search_curseforge_mods,
            get_curseforge_mod_files,
            get_curseforge_mod_details,
            download_curseforge_file,
            download_curseforge_file_temp,
            get_installed_resourcepacks_with_metadata,
            get_installed_shaderpacks_with_metadata,
            get_trash_size,
            get_trash_items,
            empty_trash,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}