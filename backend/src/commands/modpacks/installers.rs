use super::*;
use super::common::{
    extract_minecraft_version, fetch_and_set_cf_pack_icon, install_minecraft_and_loader,
    set_icon_from_file,
};
use crate::utils::copy::copy_dir_recursive;

pub(super) async fn install_from_mrpack(
    extract_dir: std::path::PathBuf,
    safe_name: String,
    preferred_game_version: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let manifest_path = extract_dir.join("modrinth.index.json");
    let manifest_content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| e.to_string())?;

    let manifest: serde_json::Value = serde_json::from_str(&manifest_content)
        .map_err(|e| e.to_string())?;

    let dependencies = manifest.get("dependencies")
        .and_then(|d| d.as_object())
        .ok_or("Invalid manifest: missing dependencies")?;

    let game_version = if let Some(ref preferred) = preferred_game_version {
        preferred.clone()
    } else {
        dependencies.get("minecraft")
            .and_then(|v| v.as_str())
            .ok_or("No Minecraft version found in manifest")?
            .to_string()
    };

    let dep_version = |key: &str| -> Option<String> {
        dependencies
            .get(key)
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(String::from)
    };

    if dep_version("quilt-loader").is_some() {
        return Err("Quilt modpacks are not supported by this launcher yet".to_string());
    }

    let (loader, pinned_loader_version): (&str, Option<String>) =
        if dep_version("fabric-loader").is_some() {
            ("fabric", dep_version("fabric-loader"))
        } else if dep_version("forge").is_some() {
            ("forge", dep_version("forge"))
        } else if dep_version("neoforge").is_some() {
            ("neoforge", dep_version("neoforge"))
        } else {
            ("vanilla", None)
        };

    let final_version = install_minecraft_and_loader(
        &safe_name,
        &game_version,
        loader,
        pinned_loader_version.as_deref(),
        &app_handle,
    )
    .await?;

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 50,
        "stage": "Creating instance..."
    }));

    InstanceManager::create(
        &safe_name,
        &final_version,
        if loader == "vanilla" { None } else { Some(loader.to_string()) },
        None,
    )
    .map_err(|e| e.to_string())?;

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 55,
        "stage": "Setting modpack icon..."
    }));

    let icon_path = extract_dir.join("icon.png");
    if icon_path.exists() {
        set_icon_from_file(&safe_name, &icon_path).await;
    }

    let instance_dir = get_instance_dir(&safe_name);

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 60,
        "stage": "Copying overrides..."
    }));

    let overrides_dir = extract_dir.join("overrides");
    if overrides_dir.exists() {
        copy_dir_recursive(&overrides_dir, &instance_dir)
            .map_err(|e| e.to_string())?;
    }

    if let Some(files) = manifest.get("files").and_then(|f| f.as_array()) {
        struct PendingDownload {
            url: String,
            dest: std::path::PathBuf,
            label: String,
            expected_sha1: Option<String>,
        }

        let mut pending: Vec<PendingDownload> = Vec::new();

        for file in files.iter() {
            let client_unsupported = file
                .get("env")
                .and_then(|e| e.get("client"))
                .and_then(|c| c.as_str())
                .map(|s| s == "unsupported")
                .unwrap_or(false);
            if client_unsupported {
                continue;
            }

            let downloads = file.get("downloads")
                .and_then(|d| d.as_array())
                .ok_or("Invalid file entry in manifest")?;

            let download_url = downloads.first()
                .and_then(|u| u.as_str())
                .ok_or("No download URL found")?;

            let path = file.get("path")
                .and_then(|p| p.as_str())
                .ok_or("No path found in file entry")?;

            let relative = std::path::Path::new(path);
            if path.is_empty()
                || relative.is_absolute()
                || relative.components().any(|c| c == std::path::Component::ParentDir)
            {
                return Err(format!("Unsafe file path in modpack: {}", path));
            }

            let dest_path = instance_dir.join(path);

            if let Some(parent) = dest_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| e.to_string())?;
            }

            let expected_sha1 = file
                .get("hashes")
                .and_then(|h| h.get("sha1"))
                .and_then(|v| v.as_str())
                .map(String::from);

            if let Some(expected) = &expected_sha1 {
                if let Ok(existing) = std::fs::read(&dest_path) {
                    if crate::utils::hash::sha1_hex(&existing) == *expected {
                        continue;
                    }
                }
            }

            validate_download_url(download_url)?;

            pending.push(PendingDownload {
                url: download_url.to_string(),
                dest: dest_path,
                label: path.to_string(),
                expected_sha1,
            });
        }

        let total_pending = pending.len();
        if total_pending > 0 {
            let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
                "instance": safe_name,
                "progress": 70,
                "stage": format!("Downloading {} mods...", total_pending)
            }));

            const MAX_CONCURRENT_MOD_DOWNLOADS: usize = 16;

            let semaphore =
                std::sync::Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_MOD_DOWNLOADS));
            let completed = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

            let mut handles = Vec::new();
            for entry in pending {
                let permit = semaphore
                    .clone()
                    .acquire_owned()
                    .await
                    .map_err(|e| e.to_string())?;
                let app_handle = app_handle.clone();
                let safe_name = safe_name.clone();
                let completed = completed.clone();

                handles.push(tokio::spawn(async move {
                    let result = crate::utils::download::download_file_verified(
                        &entry.url,
                        &entry.dest,
                        entry.expected_sha1.as_deref(),
                    )
                    .await;

                    drop(permit);

                    let done = completed.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                    let progress = 70 + (done * 25 / total_pending) as u32;
                    let _ = app_handle.emit(
                        "modpack-install-progress",
                        serde_json::json!({
                            "instance": safe_name,
                            "progress": progress,
                            "stage": format!("Downloading mods... ({}/{})", done, total_pending)
                        }),
                    );

                    result.map_err(|e| format!("{}: {}", entry.label, e))
                }));
            }

            let mut first_error: Option<String> = None;
            for handle in handles {
                let outcome = handle
                    .await
                    .map_err(|e| format!("Download task failed: {}", e))?;
                if let Err(e) = outcome {
                    if first_error.is_none() {
                        first_error = Some(e);
                    }
                }
            }

            if let Some(error) = first_error {
                return Err(error);
            }
        }
    }

    let _ = std::fs::remove_dir_all(&extract_dir);

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 100,
        "stage": "Installation complete!"
    }));

    Ok(())
}

pub(super) async fn install_from_standard_zip(
    extract_dir: std::path::PathBuf,
    safe_name: String,
    preferred_game_version: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let instance_json_path = extract_dir.join("instance.json");
    let instance_content = std::fs::read_to_string(&instance_json_path)
        .map_err(|e| e.to_string())?;

    let instance: Instance = serde_json::from_str(&instance_content)
        .map_err(|e| e.to_string())?;

    let game_version = if let Some(ref preferred) = preferred_game_version {
        preferred.clone()
    } else {
        extract_minecraft_version(&instance.version, None)
    };

    let loader = instance.loader.clone();
    let loader_version = instance.loader_version.clone();

    let final_version = install_minecraft_and_loader(
        &safe_name,
        &game_version,
        loader.as_deref().unwrap_or("vanilla"),
        loader_version.as_deref(),
        &app_handle,
    )
    .await?;

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 50,
        "stage": "Creating instance..."
    }));

    InstanceManager::create(
        &safe_name,
        &final_version,
        loader,
        loader_version,
    )
    .map_err(|e| e.to_string())?;

    let instance_dir = get_instance_dir(&safe_name);

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 60,
        "stage": "Copying instance data..."
    }));

    let entries_to_copy = vec!["saves", "resourcepacks", "shaderpacks", "mods", "config"];

    for entry_name in entries_to_copy {
        let source_dir = extract_dir.join(entry_name);
        if source_dir.exists() {
            let dest_dir = instance_dir.join(entry_name);
            copy_dir_recursive(&source_dir, &dest_dir)
                .map_err(|e| e.to_string())?;
        }
    }

    let options_files = vec![
        "options.txt",
        "optionsof.txt",
        "optionsshaders.txt",
        "servers.dat",
        "servers.dat_old",
    ];
    for file_name in options_files {
        let source_file = extract_dir.join(file_name);
        if source_file.exists() {
            let dest_file = instance_dir.join(file_name);
            std::fs::copy(&source_file, &dest_file)
                .map_err(|e| e.to_string())?;
        }
    }

    let icon_path = extract_dir.join("icon.png");
    if icon_path.exists() {
        set_icon_from_file(&safe_name, &icon_path).await;
    }

    let _ = std::fs::remove_dir_all(&extract_dir);

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 100,
        "stage": "Installation complete!"
    }));

    Ok(())
}

pub(super) async fn install_from_curseforge_manifest(
    extract_dir: std::path::PathBuf,
    safe_name: String,
    preferred_game_version: Option<String>,
    project_id: Option<u32>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let manifest_path = extract_dir.join("manifest.json");
    let manifest_content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| e.to_string())?;

    let manifest: serde_json::Value = serde_json::from_str(&manifest_content)
        .map_err(|e| e.to_string())?;

    let minecraft_obj = manifest.get("minecraft")
        .and_then(|m| m.as_object())
        .ok_or("Invalid CurseForge manifest: missing minecraft section")?;

    let game_version = if let Some(ref preferred) = preferred_game_version {
        preferred.clone()
    } else {
        minecraft_obj.get("version")
            .and_then(|v| v.as_str())
            .ok_or("No Minecraft version found in manifest")?
            .to_string()
    };

    let mod_loaders = minecraft_obj.get("modLoaders")
        .and_then(|l| l.as_array())
        .ok_or("Invalid manifest: missing modLoaders")?;

    let primary_loader = mod_loaders.iter()
        .find(|l| l.get("primary").and_then(|p| p.as_bool()).unwrap_or(false))
        .or_else(|| mod_loaders.first())
        .and_then(|l| l.get("id").and_then(|id| id.as_str()))
        .ok_or("No mod loader found in manifest")?;

    let (loader, pinned_loader_version) = if primary_loader.starts_with("forge-") {
        ("forge".to_string(), Some(primary_loader.trim_start_matches("forge-").to_string()))
    } else if primary_loader.starts_with("fabric-") {
        ("fabric".to_string(), Some(primary_loader.trim_start_matches("fabric-").to_string()))
    } else if primary_loader.starts_with("neoforge-") {
        ("neoforge".to_string(), Some(primary_loader.trim_start_matches("neoforge-").to_string()))
    } else if primary_loader.starts_with("quilt-") {
        return Err("Quilt modpacks are not supported by this launcher yet".to_string());
    } else {
        ("vanilla".to_string(), None)
    };

    let final_version = install_minecraft_and_loader(
        &safe_name,
        &game_version,
        &loader,
        pinned_loader_version.as_deref(),
        &app_handle,
    )
    .await?;

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 50,
        "stage": "Creating instance..."
    }));

    InstanceManager::create(
        &safe_name,
        &final_version,
        if loader == "vanilla" { None } else { Some(loader) },
        None,
    )
    .map_err(|e| e.to_string())?;

    let instance_dir = get_instance_dir(&safe_name);

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 60,
        "stage": "Copying overrides..."
    }));

    let overrides_dir = extract_dir.join("overrides");
    if overrides_dir.exists() {
        copy_dir_recursive(&overrides_dir, &instance_dir)
            .map_err(|e| e.to_string())?;
    }

    let mut failed_mods: Vec<String> = Vec::new();

    if let Some(files) = manifest.get("files").and_then(|f| f.as_array()) {
        let curseforge_files: Vec<(&serde_json::Value, u32, u32)> = files.iter()
            .filter_map(|f| {
                let project_id = f.get("projectID").and_then(|p| p.as_u64()).map(|p| p as u32)?;
                let file_id = f.get("fileID").and_then(|p| p.as_u64()).map(|p| p as u32)?;
                Some((f, project_id, file_id))
            })
            .collect();

        let total_files = curseforge_files.len();
        if total_files > 0 {
            let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
                "instance": safe_name,
                "progress": 70,
                "stage": format!("Downloading {} mods...", total_files)
            }));

            let api_key = crate::commands::curseforge_api_key(&app_handle)?;
            let cf_client = CurseforgeClient::new(api_key).map_err(|e| e.to_string())?;

            let mods_dir = instance_dir.join("mods");
            std::fs::create_dir_all(&mods_dir)
                .map_err(|e| e.to_string())?;

            let mut resolved: std::collections::HashMap<(u32, u32), crate::utils::curseforge::CurseforgeFile> =
                std::collections::HashMap::new();
            let file_ids: Vec<u32> = curseforge_files.iter().map(|&(_, _, fid)| fid).collect();
            for chunk in file_ids.chunks(100) {
                match cf_client.get_files_by_ids(chunk).await {
                    Ok(result) => {
                        for f in result.data {
                            resolved.insert((f.mod_id, f.id), f);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to batch-resolve CurseForge files: {}", e);
                    }
                }
            }

            struct PendingCfDownload {
                url: String,
                dest_path: std::path::PathBuf,
                label: String,
                expected_sha1: Option<String>,
            }

            let mut pending: Vec<PendingCfDownload> = Vec::new();
            for &(_file_entry, project_id, file_id) in curseforge_files.iter() {
                match resolved.get(&(project_id, file_id)) {
                    Some(cf_file) => match cf_file.download_url.clone() {
                        Some(download_url) => {
                            let safe_filename = match sanitize_mod_filename(&cf_file.file_name) {
                                Ok(f) => f,
                                Err(e) => {
                                    failed_mods.push(format!("{} (unsafe filename: {})", cf_file.file_name, e));
                                    continue;
                                }
                            };
                            let dest_path = mods_dir.join(&safe_filename);
                            if !dest_path.starts_with(&mods_dir) {
                                failed_mods.push(format!("{} (unsafe path)", cf_file.file_name));
                                continue;
                            }

                            pending.push(PendingCfDownload {
                                url: download_url,
                                dest_path,
                                label: cf_file.file_name.clone(),
                                expected_sha1: crate::utils::curseforge::extract_sha1(&cf_file.hashes).map(String::from),
                            });
                        }
                        None => {
                            failed_mods.push(format!(
                                "{} (blocked from third-party downloads)",
                                cf_file.file_name
                            ));
                        }
                    },
                    None => {
                        failed_mods.push(format!(
                            "CurseForge project {} file {} (could not be resolved)",
                            project_id, file_id
                        ));
                    }
                }
            }

            if !pending.is_empty() {
                const MAX_CONCURRENT_CF_DOWNLOADS: usize = 16;

                let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_CF_DOWNLOADS));
                let completed = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

                let mut handles = Vec::new();
                for entry in pending {
                    let permit = semaphore
                        .clone()
                        .acquire_owned()
                        .await
                        .map_err(|e| e.to_string())?;
                    let app_handle = app_handle.clone();
                    let safe_name = safe_name.clone();
                    let completed = completed.clone();

                    handles.push(tokio::spawn(async move {
                        let result = crate::utils::download::download_file_verified(
                            &entry.url,
                            &entry.dest_path,
                            entry.expected_sha1.as_deref(),
                        )
                        .await;

                        let done = completed.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                        let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
                            "instance": safe_name,
                            "progress": 70 + (done * 25 / total_files) as u32,
                            "stage": format!("Downloading mods... ({}/{})", done, total_files)
                        }));

                        drop(permit);
                        match result {
                            Ok(()) => None,
                            Err(e) => {
                                eprintln!("Failed to download {}: {}", entry.label, e);
                                Some(entry.label)
                            }
                        }
                    }));
                }

                for handle in handles {
                    match handle.await {
                        Ok(Some(label)) => failed_mods.push(label),
                        Ok(None) => {}
                        Err(e) => eprintln!("CurseForge download task panicked: {}", e),
                    }
                }
            }

            for failed in &failed_mods {
                let _ = app_handle.emit("console-log", serde_json::json!({
                    "instance": safe_name,
                    "message": format!(
                        "WARNING: Could not download {}. It may be blocked from third-party distribution - download it manually into this instance's mods folder.",
                        failed
                    ),
                    "type": "stderr"
                }));
            }

            if !failed_mods.is_empty() {
                let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
                    "instance": safe_name,
                    "progress": 99,
                    "stage": format!(
                        "{} mod(s) could not be downloaded - check the Console",
                        failed_mods.len()
                    )
                }));
            }
        }
    }

    if let Some(project_id) = project_id {
        fetch_and_set_cf_pack_icon(&app_handle, &safe_name, project_id).await;
    }

    let icon_path = extract_dir.join("icon.png");
    if icon_path.exists() {
        set_icon_from_file(&safe_name, &icon_path).await;
    }

    let _ = std::fs::remove_dir_all(&extract_dir);

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 100,
        "stage": if failed_mods.is_empty() {
            "Installation complete!".to_string()
        } else {
            format!(
                "Completed - {} mod(s) need manual download (see Console)",
                failed_mods.len()
            )
        }
    }));

    Ok(())
}
