use super::*;

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
        if loader_type != "fabric" && loader_type != "vanilla" && loader_type != "neoforge" && loader_type != "forge" {
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
    let installer = MinecraftInstaller::new(meta_dir.clone())
        .map_err(|e| e.to_string())?;
    
    let _ = app_handle.emit("creation-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 20,
        "stage": format!("Installing Minecraft {}...", version)
    }));

    installer
        .install_version(&version)
        .await
        .map_err(|e| e.to_string())?;

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

                let fabric_installer = FabricInstaller::new(meta_dir.clone())
                    .map_err(|e| e.to_string())?;
                
                fabric_installer
                    .install_fabric(&version, fabric_version)
                    .await
                    .map_err(|e| e.to_string())?
            } else {
                return Err("Fabric loader version not specified".to_string());
            }
        } else if loader_type == "forge" {
            if let Some(forge_version) = &loader_version {
                let _ = app_handle.emit("creation-progress", serde_json::json!({
                    "instance": safe_name,
                    "progress": 70,
                    "stage": format!("Downloading Forge installer {}...", forge_version)
                }));

                let forge_installer = crate::services::forge::ForgeInstaller::new(meta_dir.clone())
                    .map_err(|e| e.to_string())?;

                let app_handle_clone = app_handle.clone();
                let safe_name_clone = safe_name.clone();
                let progress_task = tauri::async_runtime::spawn(async move {
                    for i in 0..20 {
                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                        let progress = 75 + (i * 1).min(10);
                        let _ = app_handle_clone.emit("creation-progress", serde_json::json!({
                            "instance": safe_name_clone,
                            "progress": progress,
                            "stage": "Running Forge installer (this may take a minute)..."
                        }));
                    }
                });
                
                let version_id = forge_installer
                    .install_forge(forge_version)
                    .await
                    .map_err(|e| e.to_string())?;
                
                progress_task.abort();
                    
                let _ = app_handle.emit("creation-progress", serde_json::json!({
                    "instance": safe_name,
                    "progress": 85,
                    "stage": "Forge installation complete"
                }));
                
                version_id
            } else {
                return Err("Forge loader version not specified".to_string());
            }
        } else if loader_type == "neoforge" {
            if let Some(neoforge_version) = &loader_version {
                let _ = app_handle.emit("creation-progress", serde_json::json!({
                    "instance": safe_name,
                    "progress": 70,
                    "stage": format!("Downloading NeoForge installer {}...", neoforge_version)
                }));

                let neoforge_installer = crate::services::neoforge::NeoForgeInstaller::new(meta_dir.clone())
                    .map_err(|e| e.to_string())?;

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
                    .install_neoforge(neoforge_version)
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

#[tauri::command]
pub async fn kill_instance(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let pid = {
        let processes = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
        processes.get(&safe_name).copied()
    };
    
    if let Some(pid) = pid {
        if pid == 0 {
            return Err("Invalid process PID".to_string());
        }

        crate::services::loader_common::kill_process_tree(pid);

        let mut processes = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
        processes.remove(&safe_name);
        
        Ok(())
    } else {
        Err("Instance is not running".to_string())
    }
}

#[tauri::command]
pub async fn get_instances() -> Result<Vec<Instance>, String> {
    let mut instances = InstanceManager::get_all().map_err(|e| e.to_string())?;
    let instances_dir = get_instances_dir();

    for instance in &mut instances {
        if let Some(rel) = &instance.icon_path {
            let abs = instances_dir.join(&instance.name).join(rel);
            instance.icon_path = Some(abs.to_string_lossy().into_owned());
        }
    }

    Ok(instances)
}

#[tauri::command]
pub async fn delete_instance(instance_name: String, permanent: bool) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;

    tauri::async_runtime::spawn_blocking(move || {
        InstanceManager::delete(&safe_name, permanent).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
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
pub async fn save_options_as_default(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;

    let source = get_instance_dir(&safe_name).join("options.txt");
    if !source.exists() {
        return Err(format!(
            "Instance '{}' has no options.txt yet",
            safe_name
        ));
    }

    std::fs::copy(&source, get_saved_options_path()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn apply_saved_options(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;

    let default_options = get_saved_options_path();
    if !default_options.exists() {
        return Err("No default options saved yet".to_string());
    }

    std::fs::copy(&default_options, get_instance_dir(&safe_name).join("options.txt"))
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn launch_instance_with_active_account(
    instance_name: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let config = app_handle.state::<AppConfig>();

    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account")?;

    let access_token = AccountManager::get_valid_token(&active_account.uuid, &config.microsoft_client_id)
        .await
        .map_err(|e| e.to_string())?;

    let username = active_account.username.clone();
    let uuid = active_account.uuid.clone();

    tauri::async_runtime::spawn_blocking(move || {
        crate::services::instance::InstanceManager::launch(
            &safe_name,
            &username,
            &uuid,
            &access_token,
            app_handle,
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn launch_world(
    instance_name: String,
    world_name: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let config = app_handle.state::<AppConfig>();

    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account")?;

    let access_token = AccountManager::get_valid_token(&active_account.uuid, &config.microsoft_client_id)
        .await
        .map_err(|e| e.to_string())?;

    let username = active_account.username.clone();
    let uuid = active_account.uuid.clone();

    tauri::async_runtime::spawn_blocking(move || {
        crate::services::instance::InstanceManager::launch_with_world(
            &safe_name,
            &username,
            &uuid,
            &access_token,
            &world_name,
            app_handle,
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
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
