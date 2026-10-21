use super::*;

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
    let fabric_installer = FabricInstaller::new(meta_dir)
        .map_err(|e| e.to_string())?;
    
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
pub async fn update_instance_neoforge_loader(
    instance_name: String,
    neoforge_version: String,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;

    if !neoforge_version.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err("Invalid NeoForge version format".to_string());
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

    if instance.loader != Some("neoforge".to_string()) {
        return Err("This instance is not using NeoForge loader".to_string());
    }

    let meta_dir = get_meta_dir();
    let neoforge_installer = crate::services::neoforge::NeoForgeInstaller::new(meta_dir)
        .map_err(|e| e.to_string())?;

    let new_version_id = neoforge_installer
        .install_neoforge(&neoforge_version)
        .await
        .map_err(|e| e.to_string())?;

    instance.version = new_version_id;
    instance.loader_version = Some(neoforge_version);

    let updated_json = serde_json::to_string_pretty(&instance)
        .map_err(|e| e.to_string())?;

    std::fs::write(&instance_json_path, updated_json)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_instance_forge_loader(
    instance_name: String,
    forge_full_version: String,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;

    if !forge_full_version.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err("Invalid Forge version format".to_string());
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

    if instance.loader != Some("forge".to_string()) {
        return Err("This instance is not using Forge loader".to_string());
    }

    let meta_dir = get_meta_dir();
    let forge_installer = crate::services::forge::ForgeInstaller::new(meta_dir)
        .map_err(|e| e.to_string())?;

    let new_version_id = forge_installer
        .install_forge(&forge_full_version)
        .await
        .map_err(|e| e.to_string())?;

    instance.version = new_version_id;
    instance.loader_version = Some(forge_full_version);

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
    let is_neoforge = instance.loader == Some("neoforge".to_string());
    let is_forge = instance.loader == Some("forge".to_string());

    if is_fabric {
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": format!("Installing Minecraft {}...", new_minecraft_version)
        }));
        
        let meta_dir = get_meta_dir();
        let installer = MinecraftInstaller::new(meta_dir.clone())
            .map_err(|e| e.to_string())?;
        
        installer
            .install_version(&new_minecraft_version)
            .await
            .map_err(|e| e.to_string())?;
        
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": "Finding compatible Fabric loader..."
        }));
        
        let fabric_installer = FabricInstaller::new(meta_dir.clone())
            .map_err(|e| e.to_string())?;
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
    } else if is_neoforge {
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": format!("Installing Minecraft {}...", new_minecraft_version)
        }));
        
        let meta_dir = get_meta_dir();
        let installer = MinecraftInstaller::new(meta_dir.clone())
            .map_err(|e| e.to_string())?;
        
        installer
            .install_version(&new_minecraft_version)
            .await
            .map_err(|e| e.to_string())?;
        
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": "Finding compatible NeoForge loader..."
        }));
        
        let neoforge_installer = crate::services::neoforge::NeoForgeInstaller::new(meta_dir.clone())
            .map_err(|e| e.to_string())?;
        let compatible_loader = neoforge_installer
            .get_compatible_loader_for_minecraft(&new_minecraft_version)
            .await
            .map_err(|e| e.to_string())?;
        
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": format!("Installing NeoForge loader {}...", compatible_loader)
        }));
        
        let new_version_id = neoforge_installer
            .install_neoforge(&compatible_loader)
            .await
            .map_err(|e| e.to_string())?;
        
        instance.version = new_version_id;
        instance.loader_version = Some(compatible_loader);
    } else if is_forge {
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": format!("Installing Minecraft {}...", new_minecraft_version)
        }));
        
        let meta_dir = get_meta_dir();
        let installer = MinecraftInstaller::new(meta_dir.clone())
            .map_err(|e| e.to_string())?;
        
        installer
            .install_version(&new_minecraft_version)
            .await
            .map_err(|e| e.to_string())?;
        
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": "Finding compatible Forge loader..."
        }));
        
        let forge_installer = crate::services::forge::ForgeInstaller::new(meta_dir.clone())
            .map_err(|e| e.to_string())?;
        let compatible_forge_ver = forge_installer
            .get_compatible_loader_for_minecraft(&new_minecraft_version)
            .await
            .map_err(|e| e.to_string())?;
        
        let full_version = format!("{}-{}", new_minecraft_version, compatible_forge_ver);
        
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": format!("Installing Forge loader {}...", compatible_forge_ver)
        }));
        
        let new_version_id = forge_installer
            .install_forge(&full_version)
            .await
            .map_err(|e| e.to_string())?;
        
        instance.version = new_version_id;
        instance.loader_version = Some(full_version);
    } else {
        let _ = app_handle.emit("version-update-progress", serde_json::json!({
            "instance": safe_name,
            "stage": format!("Installing Minecraft {}...", new_minecraft_version)
        }));
        
        let meta_dir = get_meta_dir();
        let installer = MinecraftInstaller::new(meta_dir)
            .map_err(|e| e.to_string())?;
        
        installer
            .install_version(&new_minecraft_version)
            .await
            .map_err(|e| e.to_string())?;
        
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
