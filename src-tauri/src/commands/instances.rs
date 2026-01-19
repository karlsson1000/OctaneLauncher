use crate::services::instance::InstanceManager;
use crate::services::installer::MinecraftInstaller;
use crate::services::fabric::FabricInstaller;
use crate::services::accounts::AccountManager;
use crate::models::Instance;
use crate::utils::*;
use std::sync::Mutex;
use tauri::State;
use crate::commands::validation::sanitize_instance_name;
use tauri::Emitter;
use base64::{Engine as _, engine::general_purpose};

#[tauri::command]
pub async fn create_instance(
    instance_name: String,
    version: String,
    loader: Option<String>,
    loader_version: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    if !version.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err("Invalid version format".to_string());
    }
    
    if let Some(ref loader_type) = loader {
        if loader_type != "fabric" && loader_type != "vanilla" && loader_type != "neoforge" {
            return Err("Invalid loader type".to_string());
        }
    }
    
    if let Some(ref lv) = loader_version {
        if !lv.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
            return Err("Invalid loader version format".to_string());
        }
    }

    let _ = app_handle.emit("creation-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 0,
        "stage": "Starting instance creation..."
    }));

    let _ = app_handle.emit("creation-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 10,
        "stage": format!("Checking Minecraft {}...", version)
    }));

    let meta_dir = get_meta_dir();
    let installer = MinecraftInstaller::new(meta_dir.clone());
    
    let needs_installation = !installer.check_version_installed(&version);
    
    if needs_installation {
        let _ = app_handle.emit("creation-progress", serde_json::json!({
            "instance": safe_name,
            "progress": 20,
            "stage": format!("Installing Minecraft {}...", version)
        }));

        installer
            .install_version(&version)
            .await
            .map_err(|e| e.to_string())?;
    }

    let _ = app_handle.emit("creation-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 60,
        "stage": "Minecraft version ready"
    }));

    let final_version = if let Some(loader_type) = &loader {
        if loader_type == "fabric" {
            if let Some(fabric_version) = &loader_version {
                let _ = app_handle.emit("creation-progress", serde_json::json!({
                    "instance": safe_name,
                    "progress": 70,
                    "stage": format!("Installing Fabric {}...", fabric_version)
                }));

                let fabric_installer = FabricInstaller::new(meta_dir.clone());
                
                fabric_installer
                    .install_fabric(&version, fabric_version)
                    .await
                    .map_err(|e| e.to_string())?
            } else {
                return Err("Fabric loader version not specified".to_string());
            }
        } else if loader_type == "neoforge" {
    if let Some(neoforge_version) = &loader_version {
        let _ = app_handle.emit("creation-progress", serde_json::json!({
            "instance": safe_name,
            "progress": 70,
            "stage": format!("Downloading NeoForge installer {}...", neoforge_version)
        }));

        let neoforge_installer = crate::services::neoforge::NeoForgeInstaller::new(meta_dir.clone());

        let app_handle_clone = app_handle.clone();
        let safe_name_clone = safe_name.clone();
        let progress_task = tauri::async_runtime::spawn(async move {
            for i in 0..20 {
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                let progress = 75 + (i * 1).min(10);
                let _ = app_handle_clone.emit("creation-progress", serde_json::json!({
                    "instance": safe_name_clone,
                    "progress": progress,
                    "stage": "Running NeoForge installer (this may take a minute)..."
                }));
            }
        });
        
        let version_id = neoforge_installer
            .install_neoforge(&version, neoforge_version)
            .await
            .map_err(|e| e.to_string())?;
        
        progress_task.abort();
            
        let _ = app_handle.emit("creation-progress", serde_json::json!({
            "instance": safe_name,
            "progress": 85,
            "stage": "NeoForge installation complete"
        }));
        
        version_id
    } else {
        return Err("NeoForge loader version not specified".to_string());
    }
} else {
            version.clone()
        }
    } else {
        version.clone()
    };

    let _ = app_handle.emit("creation-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 90,
        "stage": "Creating instance structure..."
    }));

    InstanceManager::create(&safe_name, &final_version, loader.clone(), loader_version.clone())
        .map_err(|e| e.to_string())?;

    let _ = app_handle.emit("creation-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 100,
        "stage": "Instance created successfully!"
    }));

    Ok(format!("Successfully created instance '{}'", safe_name))
}

lazy_static::lazy_static! {
    pub static ref RUNNING_PROCESSES: Mutex<std::collections::HashMap<String, u32>> = Mutex::new(std::collections::HashMap::new());
}

#[tauri::command]
pub async fn kill_instance(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let pid = {
        let processes = RUNNING_PROCESSES.lock().unwrap();
        processes.get(&safe_name).copied()
    };
    
    if let Some(pid) = pid {
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            let _ = Command::new("taskkill")
                .args(&["/F", "/PID", &pid.to_string()])
                .output();
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            unsafe {
                libc::kill(pid as i32, libc::SIGTERM);
            }
        }
        
        let mut processes = RUNNING_PROCESSES.lock().unwrap();
        processes.remove(&safe_name);
        
        Ok(())
    } else {
        Err("Instance is not running".to_string())
    }
}

#[tauri::command]
pub async fn get_instances() -> Result<Vec<Instance>, String> {
    InstanceManager::get_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_instance(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    InstanceManager::delete(&safe_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_instance(old_name: String, new_name: String) -> Result<(), String> {
    let safe_old_name = sanitize_instance_name(&old_name)?;
    let safe_new_name = sanitize_instance_name(&new_name)?;
    
    if safe_old_name == safe_new_name {
        return Ok(());
    }
    
    let instances_dir = get_instances_dir();
    let old_path = instances_dir.join(&safe_old_name);
    let new_path = instances_dir.join(&safe_new_name);
    
    if !old_path.exists() {
        return Err(format!("Instance '{}' does not exist", safe_old_name));
    }
    
    if new_path.exists() {
        return Err(format!("Instance '{}' already exists", safe_new_name));
    }
    
    std::fs::rename(&old_path, &new_path)
        .map_err(|e| e.to_string())?;
    
    let instance_json_path = new_path.join("instance.json");
    if instance_json_path.exists() {
        let content = std::fs::read_to_string(&instance_json_path)
            .map_err(|e| e.to_string())?;
        
        let mut instance: Instance = serde_json::from_str(&content)
            .map_err(|e| e.to_string())?;
        
        instance.name = safe_new_name.clone();
        
        let updated_json = serde_json::to_string_pretty(&instance)
            .map_err(|e| e.to_string())?;
        
        std::fs::write(&instance_json_path, updated_json)
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn launch_instance_with_active_account(
    instance_name: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;

    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account")?;

    let access_token = AccountManager::get_valid_token(&active_account.uuid)
        .await
        .map_err(|e| e.to_string())?;

    crate::services::instance::InstanceManager::launch(
        &safe_name,
        &active_account.username,
        &active_account.uuid,
        &access_token,
        app_handle,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn launch_instance(
    instance_name: String,
    username: String,
    uuid: String,
    access_token: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    if !username.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err("Invalid username format".to_string());
    }
    
    if !uuid.chars().all(|c| c.is_alphanumeric() || c == '-') || uuid.len() > 36 {
        return Err("Invalid UUID format".to_string());
    }
    
    InstanceManager::launch(&safe_name, &username, &uuid, &access_token, app_handle)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_instance_icon(
    instance_name: String,
    image_data: String,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    
    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }
    
    let image_bytes = general_purpose::STANDARD
        .decode(&image_data)
        .map_err(|e| e.to_string())?;
    
    if image_bytes.len() > 2 * 1024 * 1024 {
        return Err("Image too large (max 2MB)".to_string());
    }
    
    let format = image::guess_format(&image_bytes)
        .map_err(|e| e.to_string())?;
    
    match format {
        image::ImageFormat::Png | 
        image::ImageFormat::Jpeg | 
        image::ImageFormat::WebP => {},
        _ => return Err("Unsupported image format. Use PNG, JPEG, or WebP".to_string()),
    }
    
    let img = image::load_from_memory(&image_bytes)
        .map_err(|e| e.to_string())?;
    
    let resized = img.resize_exact(256, 256, image::imageops::FilterType::Lanczos3);
    
    let icon_path = instance_dir.join("icon.png");
    resized.save(&icon_path)
        .map_err(|e| e.to_string())?;
    
    let instance_json = instance_dir.join("instance.json");
    let content = std::fs::read_to_string(&instance_json)
        .map_err(|e| e.to_string())?;
    
    let mut instance: Instance = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;
    
    instance.icon_path = Some("icon.png".to_string());
    
    let updated_json = serde_json::to_string_pretty(&instance)
        .map_err(|e| e.to_string())?;
    
    std::fs::write(&instance_json, updated_json)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn remove_instance_icon(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    
    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }
    
    let icon_path = instance_dir.join("icon.png");
    if icon_path.exists() {
        std::fs::remove_file(&icon_path)
            .map_err(|e| e.to_string())?;
    }
    
    let instance_json = instance_dir.join("instance.json");
    let content = std::fs::read_to_string(&instance_json)
        .map_err(|e| e.to_string())?;
    
    let mut instance: Instance = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;
    
    instance.icon_path = None;
    
    let updated_json = serde_json::to_string_pretty(&instance)
        .map_err(|e| e.to_string())?;
    
    std::fs::write(&instance_json, updated_json)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_instance_icon(instance_name: String) -> Result<Option<String>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    
    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }
    
    let icon_path = instance_dir.join("icon.png");
    
    if !icon_path.exists() {
        return Ok(None);
    }
    
    let canonical_icon = icon_path.canonicalize()
        .map_err(|_| "Icon file not found".to_string())?;
    
    let canonical_instance = instance_dir.canonicalize()
        .map_err(|_| "Instance directory not found".to_string())?;
    
    if !canonical_icon.starts_with(&canonical_instance) {
        return Err("Invalid icon path".to_string());
    }
    
    let image_bytes = std::fs::read(&icon_path)
        .map_err(|e| e.to_string())?;
    
    let base64_data = general_purpose::STANDARD.encode(&image_bytes);
    
    Ok(Some(format!("data:image/png;base64,{}", base64_data)))
}

#[tauri::command]
pub async fn duplicate_instance(
    instance_name: String,
    new_name: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let safe_old_name = sanitize_instance_name(&instance_name)?;
    let safe_new_name = sanitize_instance_name(&new_name)?;
    
    if safe_old_name == safe_new_name {
        return Err("Source and destination names cannot be the same".to_string());
    }
    
    let instances_dir = get_instances_dir();
    let source_path = instances_dir.join(&safe_old_name);
    let dest_path = instances_dir.join(&safe_new_name);
    
    if !source_path.exists() {
        return Err(format!("Instance '{}' does not exist", safe_old_name));
    }
    
    if dest_path.exists() {
        return Err(format!("Instance '{}' already exists", safe_new_name));
    }
    
    let _ = app_handle.emit("duplication-progress", serde_json::json!({
        "instance": safe_new_name,
        "progress": 0,
        "stage": "Calculating size..."
    }));
    
    let total_files = count_files(&source_path)
        .map_err(|e| e.to_string())?;
    
    let copied_files = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    copy_dir_recursive_with_progress(
        &source_path,
        &dest_path,
        total_files,
        copied_files.clone(),
        &safe_new_name,
        &app_handle,
    )
    .map_err(|e| e.to_string())?;
    
    let _ = app_handle.emit("duplication-progress", serde_json::json!({
        "instance": safe_new_name,
        "progress": 90,
        "stage": "Updating metadata..."
    }));
    
    let instance_json_path = dest_path.join("instance.json");
    if instance_json_path.exists() {
        let content = std::fs::read_to_string(&instance_json_path)
            .map_err(|e| e.to_string())?;
        
        let mut instance: Instance = serde_json::from_str(&content)
            .map_err(|e| e.to_string())?;
        
        instance.name = safe_new_name.clone();
        instance.created_at = chrono::Utc::now().to_rfc3339();
        instance.last_played = None;
        
        let updated_json = serde_json::to_string_pretty(&instance)
            .map_err(|e| e.to_string())?;
        
        std::fs::write(&instance_json_path, updated_json)
            .map_err(|e| e.to_string())?;
    }
    
    let _ = app_handle.emit("duplication-progress", serde_json::json!({
        "instance": safe_new_name,
        "progress": 100,
        "stage": "Complete!"
    }));
    
    Ok(())
}

fn count_files(path: &std::path::Path) -> std::io::Result<usize> {
    use std::fs;
    
    let mut count = 0;
    
    if path.is_file() {
        return Ok(1);
    }
    
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        
        if entry.file_name() == "natives" {
            continue;
        }
        
        if entry_path.is_dir() {
            count += count_files(&entry_path)?;
        } else {
            count += 1;
        }
    }
    
    Ok(count)
}

fn copy_dir_recursive_with_progress(
    src: &std::path::Path,
    dst: &std::path::Path,
    total_files: usize,
    copied_files: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    instance_name: &str,
    app_handle: &tauri::AppHandle,
) -> std::io::Result<()> {
    use std::fs;
    use std::sync::atomic::Ordering;
    
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if file_type.is_dir() {
            if entry.file_name() == "natives" {
                continue;
            }
            copy_dir_recursive_with_progress(
                &src_path,
                &dst_path,
                total_files,
                copied_files.clone(),
                instance_name,
                app_handle,
            )?;
        } else if file_type.is_file() {
            fs::copy(&src_path, &dst_path)?;
            
            let current = copied_files.fetch_add(1, Ordering::Relaxed) + 1;
            let progress = ((current as f64 / total_files as f64) * 85.0) as u32;
            
            if current % 10 == 0 || progress >= 85 {
                let file_name = src_path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("file");
                
                let _ = app_handle.emit("duplication-progress", serde_json::json!({
                    "instance": instance_name,
                    "progress": progress,
                    "stage": format!("Copying files... ({}/{})", current, total_files),
                    "current_file": file_name
                }));
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_launcher_directory() -> String {
    get_launcher_dir().to_string_lossy().to_string()
}

#[tauri::command]
pub fn open_instance_folder(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);

    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }

    open_folder(instance_dir).map_err(|e| e.to_string())
}

use sysinfo::System;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SystemInfo {
    pub total_memory_mb: u64,
    pub available_memory_mb: u64,
    pub recommended_max_memory_mb: u64,
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_memory();
    
    let total_mb = sys.total_memory() / 1024 / 1024;
    let available_mb = sys.available_memory() / 1024 / 1024;
    let recommended_max_mb = total_mb * 80 / 100;
    
    Ok(SystemInfo {
        total_memory_mb: total_mb,
        available_memory_mb: available_mb,
        recommended_max_memory_mb: recommended_max_mb,
    })
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_worlds_folder(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let saves_dir = get_instance_dir(&safe_name).join("saves");

    if !saves_dir.exists() {
        std::fs::create_dir_all(&saves_dir)
            .map_err(|e| e.to_string())?;
    }

    open_folder(saves_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_world_folder(instance_name: String, folder_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    if folder_name.contains("..") || folder_name.contains("/") || folder_name.contains("\\") {
        return Err("Invalid folder name".to_string());
    }
    
    let world_dir = get_instance_dir(&safe_name).join("saves").join(&folder_name);

    if !world_dir.exists() {
        return Err(format!("World folder '{}' does not exist", folder_name));
    }

    open_folder(world_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_world(instance_name: String, folder_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    if folder_name.contains("..") || folder_name.contains("/") || folder_name.contains("\\") {
        return Err("Invalid folder name".to_string());
    }
    
    let world_dir = get_instance_dir(&safe_name).join("saves").join(&folder_name);

    if !world_dir.exists() {
        return Err(format!("World folder '{}' does not exist", folder_name));
    }

    std::fs::remove_dir_all(&world_dir)
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct World {
    pub name: String,
    pub folder_name: String,
    pub size: u64,
    pub last_played: Option<i64>,
    pub game_mode: Option<String>,
    pub version: Option<String>,
    pub icon: Option<String>,
    pub created: Option<i64>,
}

#[tauri::command]
pub fn get_instance_worlds(instance_name: String) -> Result<Vec<World>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let saves_dir = get_instance_dir(&safe_name).join("saves");

    if !saves_dir.exists() {
        return Ok(Vec::new());
    }

    let mut worlds = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&saves_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            
            if path.is_dir() {
                let folder_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();

                let size = calculate_dir_size(&path).unwrap_or(0);

                let created = path.metadata()
                    .ok()
                    .and_then(|m| m.created().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64);

                let icon = read_world_icon(&path);

                worlds.push(World {
                    name: folder_name.clone(),
                    folder_name,
                    size,
                    last_played: None,
                    game_mode: None,
                    version: None,
                    icon,
                    created,
                });
            }
        }
    }

    worlds.sort_by(|a, b| {
        match (a.created, b.created) {
            (Some(a_time), Some(b_time)) => b_time.cmp(&a_time),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.folder_name.cmp(&b.folder_name),
        }
    });

    Ok(worlds)
}

fn read_world_icon(world_path: &std::path::Path) -> Option<String> {
    let icon_path = world_path.join("icon.png");
    
    if !icon_path.exists() {
        return None;
    }
    
    if let Ok(image_bytes) = std::fs::read(&icon_path) {
        let base64_data = base64::engine::general_purpose::STANDARD.encode(&image_bytes);
        Some(format!("data:image/png;base64,{}", base64_data))
    } else {
        None
    }
}

fn calculate_dir_size(path: &std::path::Path) -> std::io::Result<u64> {
    let mut size = 0u64;
    
    if path.is_file() {
        return Ok(path.metadata()?.len());
    }
    
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        
        if entry_path.is_dir() {
            size += calculate_dir_size(&entry_path)?;
        } else {
            size += entry.metadata()?.len();
        }
    }
    
    Ok(size)
}

#[tauri::command]
pub async fn update_instance_fabric_loader(
    instance_name: String,
    fabric_version: String,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    if !fabric_version.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err("Invalid fabric version format".to_string());
    }
    
    let instance_dir = get_instance_dir(&safe_name);
    
    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }
    
    let instance_json_path = instance_dir.join("instance.json");
    let content = std::fs::read_to_string(&instance_json_path)
        .map_err(|e| e.to_string())?;
    
    let mut instance: Instance = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;
    
    if instance.loader != Some("fabric".to_string()) {
        return Err("This instance is not using Fabric loader".to_string());
    }
    
    let minecraft_version = if instance.version.contains("fabric-loader") {
        let parts: Vec<&str> = instance.version.split('-').collect();
        if let Some(mc_version) = parts.last() {
            mc_version.to_string()
        } else {
            return Err("Could not determine Minecraft version".to_string());
        }
    } else {
        instance.version.clone()
    };
    
    let meta_dir = get_meta_dir();
    let fabric_installer = FabricInstaller::new(meta_dir);
    
    let new_fabric_version_id = fabric_installer
        .install_fabric(&minecraft_version, &fabric_version)
        .await
        .map_err(|e| e.to_string())?;
    
    instance.version = new_fabric_version_id;
    instance.loader_version = Some(fabric_version);
    
    let updated_json = serde_json::to_string_pretty(&instance)
        .map_err(|e| e.to_string())?;
    
    std::fs::write(&instance_json_path, updated_json)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn update_instance_minecraft_version(
    instance_name: String,
    new_minecraft_version: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    if !new_minecraft_version.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err("Invalid Minecraft version format".to_string());
    }
    
    let instance_dir = get_instance_dir(&safe_name);
    
    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }
    
    let instance_json_path = instance_dir.join("instance.json");
    let content = std::fs::read_to_string(&instance_json_path)
        .map_err(|e| e.to_string())?;
    
    let mut instance: Instance = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;
    
    let is_fabric = instance.loader == Some("fabric".to_string());
    
    if is_fabric {
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": format!("Installing Minecraft {}...", new_minecraft_version)
        }));
        
        let meta_dir = get_meta_dir();
        let installer = MinecraftInstaller::new(meta_dir.clone());
        
        let needs_installation = !installer.check_version_installed(&new_minecraft_version);
        
        if needs_installation {
            installer
                .install_version(&new_minecraft_version)
                .await
                .map_err(|e| e.to_string())?;
        }
        
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": "Finding compatible Fabric loader..."
        }));
        
        let fabric_installer = FabricInstaller::new(meta_dir.clone());
        let compatible_loader = fabric_installer
            .get_compatible_loader_for_minecraft(&new_minecraft_version)
            .await
            .map_err(|e| e.to_string())?;
        
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": format!("Installing Fabric loader {}...", compatible_loader)
        }));
        
        let new_fabric_version_id = fabric_installer
            .install_fabric(&new_minecraft_version, &compatible_loader)
            .await
            .map_err(|e| e.to_string())?;
        
        instance.version = new_fabric_version_id;
        instance.loader_version = Some(compatible_loader);
    } else {
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": format!("Installing Minecraft {}...", new_minecraft_version)
        }));
        
        let meta_dir = get_meta_dir();
        let installer = MinecraftInstaller::new(meta_dir);
        
        let needs_installation = !installer.check_version_installed(&new_minecraft_version);
        
        if needs_installation {
            installer
                .install_version(&new_minecraft_version)
                .await
                .map_err(|e| e.to_string())?;
        }
        
        instance.version = new_minecraft_version.clone();
    }
    
    let _ = app_handle.emit("version-update-progress", serde_json::json!({
        "instance": safe_name,
        "stage": "Updating instance metadata..."
    }));
    
    let natives_dir = instance_dir.join("natives");
    if natives_dir.exists() {
        std::fs::remove_dir_all(&natives_dir)
            .map_err(|e| e.to_string())?;
    }
    
    let updated_json = serde_json::to_string_pretty(&instance)
        .map_err(|e| e.to_string())?;
    
    std::fs::write(&instance_json_path, updated_json)
        .map_err(|e| e.to_string())?;
    
    let _ = app_handle.emit("version-update-progress", serde_json::json!({
        "instance": safe_name,
        "stage": "Complete!"
    }));
    
    Ok(())
}

#[tauri::command]
pub async fn export_instance(
    instance_name: String,
    output_path: String,
    export_format: String,
    include_worlds: bool,
    include_resource_packs: bool,
    include_shader_packs: bool,
    include_mods: bool,
    include_config: bool,
) -> Result<(), String> {
    use std::io::Write;
    use zip::write::SimpleFileOptions;
    
    let safe_name = sanitize_instance_name(&instance_name)?;
    let instance_dir = get_instance_dir(&safe_name);
    
    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }
    
    let output_path_obj = std::path::Path::new(&output_path);
    if let Some(parent) = output_path_obj.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create output directory: {}", e))?;
        }
    }
    
    let file = std::fs::File::create(&output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;
    
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    if export_format == "mrpack" {
        export_as_mrpack(
            &mut zip,
            &safe_name,
            &instance_dir,
            options,
            include_worlds,
            include_resource_packs,
            include_shader_packs,
            include_mods,
            include_config,
        )?;
    } else {
        export_as_zip(
            &mut zip,
            &safe_name,
            &instance_dir,
            options,
            include_worlds,
            include_resource_packs,
            include_shader_packs,
            include_mods,
            include_config,
        )?;
    }
    
    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;
    
    Ok(())
}

fn export_as_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    instance_name: &str,
    instance_dir: &std::path::Path,
    options: zip::write::SimpleFileOptions,
    include_worlds: bool,
    include_resource_packs: bool,
    include_shader_packs: bool,
    include_mods: bool,
    include_config: bool,
) -> Result<(), String> {
    let instance_json = instance_dir.join("instance.json");
    if instance_json.exists() {
        add_file_to_zip(zip, &instance_json, "instance.json", options)?;
    }
    
    let icon_path = instance_dir.join("icon.png");
    if icon_path.exists() {
        add_file_to_zip(zip, &icon_path, "icon.png", options)?;
    }

    if include_worlds {
        let saves_dir = instance_dir.join("saves");
        if saves_dir.exists() {
            add_dir_to_zip(zip, &saves_dir, "saves", options)?;
        }
    }
    
    if include_resource_packs {
        let resourcepacks_dir = instance_dir.join("resourcepacks");
        if resourcepacks_dir.exists() {
            add_dir_to_zip(zip, &resourcepacks_dir, "resourcepacks", options)?;
        }
    }
    
    if include_shader_packs {
        let shaderpacks_dir = instance_dir.join("shaderpacks");
        if shaderpacks_dir.exists() {
            add_dir_to_zip(zip, &shaderpacks_dir, "shaderpacks", options)?;
        }
    }
    
    if include_mods {
        let mods_dir = instance_dir.join("mods");
        if mods_dir.exists() {
            add_dir_to_zip(zip, &mods_dir, "mods", options)?;
        }
    }
    
    if include_config {
        let config_dir = instance_dir.join("config");
        if config_dir.exists() {
            add_dir_to_zip(zip, &config_dir, "config", options)?;
        }

        let options_txt = instance_dir.join("options.txt");
        if options_txt.exists() {
            add_file_to_zip(zip, &options_txt, "options.txt", options)?;
        }
        
        let optionsof_txt = instance_dir.join("optionsof.txt");
        if optionsof_txt.exists() {
            add_file_to_zip(zip, &optionsof_txt, "optionsof.txt", options)?;
        }
        
        let optionsshaders_txt = instance_dir.join("optionsshaders.txt");
        if optionsshaders_txt.exists() {
            add_file_to_zip(zip, &optionsshaders_txt, "optionsshaders.txt", options)?;
        }
    }
    
    Ok(())
}

fn export_as_mrpack(
    zip: &mut zip::ZipWriter<std::fs::File>,
    instance_name: &str,
    instance_dir: &std::path::Path,
    options: zip::write::SimpleFileOptions,
    include_worlds: bool,
    include_resource_packs: bool,
    include_shader_packs: bool,
    include_mods: bool,
    include_config: bool,
) -> Result<(), String> {
    use std::io::Write;
    
    let instance_json_path = instance_dir.join("instance.json");
    let instance_content = std::fs::read_to_string(&instance_json_path)
        .map_err(|e| e.to_string())?;
    let instance: Instance = serde_json::from_str(&instance_content)
        .map_err(|e| e.to_string())?;
    
    let minecraft_version = extract_minecraft_version(&instance.version);
    let loader = instance.loader.clone().unwrap_or_else(|| "vanilla".to_string());
    let loader_version = instance.loader_version.clone();
    
    let mut manifest = serde_json::json!({
        "formatVersion": 1,
        "game": "minecraft",
        "versionId": format!("{}-{}", instance_name, chrono::Utc::now().timestamp()),
        "name": instance_name,
        "summary": format!("Exported from launcher - Minecraft {}", minecraft_version),
        "files": [],
        "dependencies": {
            "minecraft": minecraft_version
        }
    });
    
    if loader == "fabric" {
        if let Some(fabric_ver) = loader_version {
            manifest["dependencies"]["fabric-loader"] = serde_json::Value::String(fabric_ver);
        }
    }
    
    let mods_dir = instance_dir.join("mods");
    if include_mods && mods_dir.exists() {
        let mut mod_files = Vec::new();
        
        if let Ok(entries) = std::fs::read_dir(&mods_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |e| e == "jar") {
                    let file_name = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();
                    
                    if let Ok(file_content) = std::fs::read(&path) {
                        let hash = calculate_sha512(&file_content);
                        
                        mod_files.push(serde_json::json!({
                            "path": format!("mods/{}", file_name),
                            "hashes": {
                                "sha512": hash
                            },
                            "downloads": [],
                            "fileSize": file_content.len()
                        }));
                        
                        let zip_path = format!("overrides/mods/{}", file_name);
                        add_file_to_zip(zip, &path, &zip_path, options)?;
                    }
                }
            }
        }
        
        manifest["files"] = serde_json::Value::Array(mod_files);
    }
    
    zip.add_directory("overrides/", options)
        .map_err(|e| format!("Failed to add overrides directory: {}", e))?;
    
    if include_worlds {
        let saves_dir = instance_dir.join("saves");
        if saves_dir.exists() {
            add_dir_to_zip_with_prefix(zip, &saves_dir, "overrides/saves", options)?;
        }
    }
    
    if include_resource_packs {
        let resourcepacks_dir = instance_dir.join("resourcepacks");
        if resourcepacks_dir.exists() {
            add_dir_to_zip_with_prefix(zip, &resourcepacks_dir, "overrides/resourcepacks", options)?;
        }
    }
    
    if include_shader_packs {
        let shaderpacks_dir = instance_dir.join("shaderpacks");
        if shaderpacks_dir.exists() {
            add_dir_to_zip_with_prefix(zip, &shaderpacks_dir, "overrides/shaderpacks", options)?;
        }
    }
    
    if include_config {
        let config_dir = instance_dir.join("config");
        if config_dir.exists() {
            add_dir_to_zip_with_prefix(zip, &config_dir, "overrides/config", options)?;
        }

        let options_txt = instance_dir.join("options.txt");
        if options_txt.exists() {
            add_file_to_zip(zip, &options_txt, "overrides/options.txt", options)?;
        }
        
        let optionsof_txt = instance_dir.join("optionsof.txt");
        if optionsof_txt.exists() {
            add_file_to_zip(zip, &optionsof_txt, "overrides/optionsof.txt", options)?;
        }
        
        let optionsshaders_txt = instance_dir.join("optionsshaders.txt");
        if optionsshaders_txt.exists() {
            add_file_to_zip(zip, &optionsshaders_txt, "overrides/optionsshaders.txt", options)?;
        }
    }
    
    let icon_path = instance_dir.join("icon.png");
    if icon_path.exists() {
        add_file_to_zip(zip, &icon_path, "icon.png", options)?;
    }
    
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
    
    zip.start_file("modrinth.index.json", options)
        .map_err(|e| format!("Failed to create manifest file: {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Failed to write manifest: {}", e))?;
    
    Ok(())
}

fn extract_minecraft_version(version_string: &str) -> String {
    if version_string.contains("fabric-loader") {
        let parts: Vec<&str> = version_string.split('-').collect();
        if let Some(mc_version) = parts.last() {
            return mc_version.to_string();
        }
    }
    version_string.to_string()
}

fn calculate_sha512(data: &[u8]) -> String {
    use sha2::{Sha512, Digest};
    let mut hasher = Sha512::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn add_file_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    file_path: &std::path::Path,
    zip_path: &str,
    options: zip::write::SimpleFileOptions,
) -> Result<(), String> {
    let mut file = std::fs::File::open(file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
    zip.start_file(zip_path, options)
        .map_err(|e| format!("Failed to start file in zip: {}", e))?;
    
    std::io::copy(&mut file, zip)
        .map_err(|e| format!("Failed to write file to zip: {}", e))?;
    
    Ok(())
}

fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    dir_path: &std::path::Path,
    zip_prefix: &str,
    options: zip::write::SimpleFileOptions,
) -> Result<(), String> {
    use std::io::Write;
    
    let entries = std::fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        
        let zip_path = format!("{}/{}", zip_prefix, name_str);
        
        if path.is_file() {
            add_file_to_zip(zip, &path, &zip_path, options)?;
        } else if path.is_dir() {
            zip.add_directory(&format!("{}/", zip_path), options)
                .map_err(|e| format!("Failed to add directory to zip: {}", e))?;

            add_dir_to_zip(zip, &path, &zip_path, options)?;
        }
    }
    
    Ok(())
}

fn add_dir_to_zip_with_prefix(
    zip: &mut zip::ZipWriter<std::fs::File>,
    dir_path: &std::path::Path,
    zip_prefix: &str,
    options: zip::write::SimpleFileOptions,
) -> Result<(), String> {
    add_dir_to_zip(zip, dir_path, zip_prefix, options)
}