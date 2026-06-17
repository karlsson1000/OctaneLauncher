use crate::commands::mods::{CacheEntry, ModFileWithMetadata};
use crate::commands::validation::{sanitize_instance_name, sanitize_resourcepack_filename, sanitize_shaderpack_filename, validate_download_url};
use crate::utils::{get_instance_dir, open_folder};
use crate::utils::modrinth::{ModrinthClient, ModrinthProjectDetails};
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::time::UNIX_EPOCH;

// Resource Packs

#[tauri::command]
pub async fn get_installed_resourcepacks(instance_name: String) -> Result<Vec<String>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let resourcepacks_dir = instance_dir.join("resourcepacks");
    
    if !resourcepacks_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut packs = Vec::new();
    
    match std::fs::read_dir(&resourcepacks_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                
                if !path.starts_with(&resourcepacks_dir) {
                    continue;
                }
                
                if path.is_file() {
                    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                        // Accept both .zip and .jar files
                        if filename.ends_with(".zip") || filename.ends_with(".jar") {
                            packs.push(filename.to_string());
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Err(e.to_string());
        }
    }
    
    packs.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    
    Ok(packs)
}

#[tauri::command]
pub async fn download_resourcepack(
    instance_name: String,
    download_url: String,
    filename: String,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let safe_filename = sanitize_resourcepack_filename(&filename)?;
    
    let _ = validate_download_url(&download_url)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let resourcepacks_dir = instance_dir.join("resourcepacks");

    if !resourcepacks_dir.exists() {
        std::fs::create_dir_all(&resourcepacks_dir)
            .map_err(|e| e.to_string())?;
    }

    let destination = resourcepacks_dir.join(&safe_filename);
    
    if !destination.starts_with(&resourcepacks_dir) {
        return Err("Invalid destination path".to_string());
    }

    let client = ModrinthClient::new().map_err(|e| e.to_string())?;
    client
        .download_mod_file(&download_url, &destination)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_resourcepack(instance_name: String, filename: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let safe_filename = sanitize_resourcepack_filename(&filename)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let resourcepacks_dir = instance_dir.join("resourcepacks");
    let pack_path = resourcepacks_dir.join(&safe_filename);
    
    let canonical_pack_path = pack_path.canonicalize()
        .map_err(|_| format!("Resource pack '{}' not found", safe_filename))?;
    
    let canonical_resourcepacks_dir = resourcepacks_dir.canonicalize()
        .map_err(|_| "Resource packs directory not found".to_string())?;
    
    if !canonical_pack_path.starts_with(&canonical_resourcepacks_dir) {
        return Err("Invalid resource pack path".to_string());
    }
    
    if !canonical_pack_path.is_file() {
        return Err(format!("Resource pack '{}' not found", safe_filename));
    }
    
    std::fs::remove_file(&canonical_pack_path)
        .map_err(|e| e.to_string())?;

    invalidate_resourcepack_cache(&safe_name);

    Ok(())
}

#[tauri::command]
pub fn open_resourcepacks_folder(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let resourcepacks_dir = instance_dir.join("resourcepacks");
    
    if !resourcepacks_dir.exists() {
        std::fs::create_dir_all(&resourcepacks_dir)
            .map_err(|e| e.to_string())?;
    }
    
    open_folder(resourcepacks_dir)
        .map_err(|e| e.to_string())
}

// Shader Packs

#[tauri::command]
pub async fn get_installed_shaderpacks(instance_name: String) -> Result<Vec<String>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let shaderpacks_dir = instance_dir.join("shaderpacks");
    
    if !shaderpacks_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut packs = Vec::new();
    
    match std::fs::read_dir(&shaderpacks_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                
                if !path.starts_with(&shaderpacks_dir) {
                    continue;
                }
                
                if path.is_file() {
                    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                        // Accept both .zip and .jar files
                        if filename.ends_with(".zip") || filename.ends_with(".jar") {
                            packs.push(filename.to_string());
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Err(e.to_string());
        }
    }
    
    packs.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    
    Ok(packs)
}

#[tauri::command]
pub async fn download_shaderpack(
    instance_name: String,
    download_url: String,
    filename: String,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let safe_filename = sanitize_shaderpack_filename(&filename)?;
    
    let _ = validate_download_url(&download_url)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let shaderpacks_dir = instance_dir.join("shaderpacks");

    if !shaderpacks_dir.exists() {
        std::fs::create_dir_all(&shaderpacks_dir)
            .map_err(|e| e.to_string())?;
    }

    let destination = shaderpacks_dir.join(&safe_filename);
    
    if !destination.starts_with(&shaderpacks_dir) {
        return Err("Invalid destination path".to_string());
    }

    let client = ModrinthClient::new().map_err(|e| e.to_string())?;
    client
        .download_mod_file(&download_url, &destination)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_shaderpack(instance_name: String, filename: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let safe_filename = sanitize_shaderpack_filename(&filename)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let shaderpacks_dir = instance_dir.join("shaderpacks");
    let pack_path = shaderpacks_dir.join(&safe_filename);
    
    let canonical_pack_path = pack_path.canonicalize()
        .map_err(|_| format!("Shader pack '{}' not found", safe_filename))?;
    
    let canonical_shaderpacks_dir = shaderpacks_dir.canonicalize()
        .map_err(|_| "Shader packs directory not found".to_string())?;
    
    if !canonical_pack_path.starts_with(&canonical_shaderpacks_dir) {
        return Err("Invalid shader pack path".to_string());
    }
    
    if !canonical_pack_path.is_file() {
        return Err(format!("Shader pack '{}' not found", safe_filename));
    }
    
    std::fs::remove_file(&canonical_pack_path)
        .map_err(|e| e.to_string())?;

    invalidate_shaderpack_cache(&safe_name);

    Ok(())
}

#[tauri::command]
pub fn open_shaderpacks_folder(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let shaderpacks_dir = instance_dir.join("shaderpacks");
    
    if !shaderpacks_dir.exists() {
        std::fs::create_dir_all(&shaderpacks_dir)
            .map_err(|e| e.to_string())?;
    }
    
    open_folder(shaderpacks_dir)
        .map_err(|e| e.to_string())
}

// --- Cache helpers for pack metadata ---

fn resourcepack_cache_path(instance_dir: &std::path::Path) -> std::path::PathBuf {
    instance_dir.join(".resourcepack_cache.json")
}

fn shaderpack_cache_path(instance_dir: &std::path::Path) -> std::path::PathBuf {
    instance_dir.join(".shaderpack_cache.json")
}

fn invalidate_resourcepack_cache(instance_name: &str) {
    let instance_dir = get_instance_dir(instance_name);
    let path = resourcepack_cache_path(&instance_dir);
    if path.exists() {
        let _ = std::fs::remove_file(&path);
    }
}

fn invalidate_shaderpack_cache(instance_name: &str) {
    let instance_dir = get_instance_dir(instance_name);
    let path = shaderpack_cache_path(&instance_dir);
    if path.exists() {
        let _ = std::fs::remove_file(&path);
    }
}

fn load_pack_cache(cache_file: &std::path::Path) -> HashMap<String, CacheEntry> {
    if cache_file.exists() {
        std::fs::read_to_string(cache_file)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        HashMap::new()
    }
}

fn save_pack_cache(cache_file: &std::path::Path, cache: &HashMap<String, CacheEntry>) {
    if let Ok(json) = serde_json::to_string(cache) {
        let _ = std::fs::write(cache_file, json);
    }
}

#[tauri::command]
pub async fn get_installed_resourcepacks_with_metadata(instance_name: String) -> Result<Vec<ModFileWithMetadata>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let instance_dir = get_instance_dir(&safe_name);
    let resourcepacks_dir = instance_dir.join("resourcepacks");

    if !resourcepacks_dir.exists() {
        return Ok(Vec::new());
    }

    let cache_file = resourcepack_cache_path(&instance_dir);
    let mut disk_cache = load_pack_cache(&cache_file);

    let mut packs = Vec::new();
    let mut hashes_needing_metadata: Vec<String> = Vec::new();

    for entry in std::fs::read_dir(&resourcepacks_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() { continue; }

        let filename = match path.file_name().and_then(|n| n.to_str()) {
            Some(f) if f.ends_with(".zip") || f.ends_with(".jar") => f.to_string(),
            _ => continue,
        };

        let meta = match std::fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let size = meta.len();
        let mtime = meta.modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_nanos())
            .unwrap_or(0);

        let (_, metadata) = match disk_cache.get(&filename) {
            Some(entry) if entry.mtime == mtime && entry.size == size => {
                let hash = entry.sha1_hash.clone();
                let meta = entry.metadata.clone();
                (hash, meta)
            }
            _ => {
                let hash = match std::fs::read(&path) {
                    Ok(bytes) => format!("{:x}", Sha1::digest(&bytes)),
                    Err(_) => continue,
                };
                hashes_needing_metadata.push(hash.clone());
                let existing_meta = disk_cache.get(&filename).and_then(|e| e.metadata.clone());
                disk_cache.insert(filename.clone(), CacheEntry {
                    mtime,
                    size,
                    sha1_hash: hash.clone(),
                    metadata: existing_meta.clone(),
                });
                (hash, existing_meta)
            }
        };

        packs.push(ModFileWithMetadata {
            filename: filename.clone(),
            size,
            project_id: metadata.as_ref().and_then(|m| m.project_id.clone()),
            name: metadata.as_ref().and_then(|m| m.name.clone()),
            description: metadata.as_ref().and_then(|m| m.description.clone()),
            icon_url: metadata.as_ref().and_then(|m| m.icon_url.clone()),
            author: metadata.as_ref().and_then(|m| m.author.clone()),
            downloads: metadata.as_ref().and_then(|m| m.downloads),
            disabled: false,
            current_version_id: metadata.as_ref().and_then(|m| m.current_version_id.clone()),
        });
    }

    if !hashes_needing_metadata.is_empty() {
        let client = ModrinthClient::new().map_err(|e| e.to_string())?;
        let mut project_ids: Vec<String> = Vec::new();
        let mut hash_to_version_and_project: HashMap<String, (String, String)> = HashMap::new();

        for chunk in hashes_needing_metadata.chunks(100) {
            if let Ok(version_files) = client.get_version_files_by_hashes(chunk).await {
                for (hash, vf) in &version_files {
                    hash_to_version_and_project.insert(hash.clone(), (vf.project_id.clone(), vf.id.clone()));
                    if !project_ids.contains(&vf.project_id) {
                        project_ids.push(vf.project_id.clone());
                    }
                }
            }
        }

        if !project_ids.is_empty() {
            if let Ok(projects) = client.get_projects_batch(&project_ids).await {
                let project_map: HashMap<String, ModrinthProjectDetails> =
                    projects.into_iter().map(|p| (p.id.clone(), p)).collect();

                for (hash, (proj_id, version_id)) in &hash_to_version_and_project {
                    if let Some(project) = project_map.get(proj_id) {
                        let metadata = ModFileWithMetadata {
                            filename: String::new(),
                            size: 0,
                            project_id: Some(proj_id.clone()),
                            name: Some(project.title.clone()),
                            description: Some(project.description.clone()),
                            icon_url: project.icon_url.clone(),
                            author: None,
                            downloads: Some(project.downloads),
                            disabled: false,
                            current_version_id: Some(version_id.clone()),
                        };

                        for entry in disk_cache.values_mut() {
                            if entry.sha1_hash == *hash {
                                entry.metadata = Some(ModFileWithMetadata {
                                    filename: String::new(),
                                    size: entry.size,
                                    ..metadata.clone()
                                });
                            }
                        }

                        for pack_entry in packs.iter_mut() {
                            if disk_cache.get(&pack_entry.filename)
                                .map(|e| e.sha1_hash == *hash)
                                .unwrap_or(false)
                            {
                                pack_entry.project_id = Some(proj_id.clone());
                                pack_entry.name = Some(project.title.clone());
                                pack_entry.description = Some(project.description.clone());
                                pack_entry.icon_url = project.icon_url.clone();
                                pack_entry.author = None;
                                pack_entry.downloads = Some(project.downloads);
                                pack_entry.current_version_id = Some(version_id.clone());
                            }
                        }
                    }
                }
            }
        }

        save_pack_cache(&cache_file, &disk_cache);
    }

    packs.sort_by(|a, b| a.filename.to_lowercase().cmp(&b.filename.to_lowercase()));
    Ok(packs)
}

#[tauri::command]
pub async fn get_installed_shaderpacks_with_metadata(instance_name: String) -> Result<Vec<ModFileWithMetadata>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let instance_dir = get_instance_dir(&safe_name);
    let shaderpacks_dir = instance_dir.join("shaderpacks");

    if !shaderpacks_dir.exists() {
        return Ok(Vec::new());
    }

    let cache_file = shaderpack_cache_path(&instance_dir);
    let mut disk_cache = load_pack_cache(&cache_file);

    let mut packs = Vec::new();
    let mut hashes_needing_metadata: Vec<String> = Vec::new();

    for entry in std::fs::read_dir(&shaderpacks_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() { continue; }

        let filename = match path.file_name().and_then(|n| n.to_str()) {
            Some(f) if f.ends_with(".zip") || f.ends_with(".jar") => f.to_string(),
            _ => continue,
        };

        let meta = match std::fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let size = meta.len();
        let mtime = meta.modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_nanos())
            .unwrap_or(0);

        let (_, metadata) = match disk_cache.get(&filename) {
            Some(entry) if entry.mtime == mtime && entry.size == size => {
                let hash = entry.sha1_hash.clone();
                let meta = entry.metadata.clone();
                (hash, meta)
            }
            _ => {
                let hash = match std::fs::read(&path) {
                    Ok(bytes) => format!("{:x}", Sha1::digest(&bytes)),
                    Err(_) => continue,
                };
                hashes_needing_metadata.push(hash.clone());
                let existing_meta = disk_cache.get(&filename).and_then(|e| e.metadata.clone());
                disk_cache.insert(filename.clone(), CacheEntry {
                    mtime,
                    size,
                    sha1_hash: hash.clone(),
                    metadata: existing_meta.clone(),
                });
                (hash, existing_meta)
            }
        };

        packs.push(ModFileWithMetadata {
            filename: filename.clone(),
            size,
            project_id: metadata.as_ref().and_then(|m| m.project_id.clone()),
            name: metadata.as_ref().and_then(|m| m.name.clone()),
            description: metadata.as_ref().and_then(|m| m.description.clone()),
            icon_url: metadata.as_ref().and_then(|m| m.icon_url.clone()),
            author: metadata.as_ref().and_then(|m| m.author.clone()),
            downloads: metadata.as_ref().and_then(|m| m.downloads),
            disabled: false,
            current_version_id: metadata.as_ref().and_then(|m| m.current_version_id.clone()),
        });
    }

    if !hashes_needing_metadata.is_empty() {
        let client = ModrinthClient::new().map_err(|e| e.to_string())?;
        let mut project_ids: Vec<String> = Vec::new();
        let mut hash_to_version_and_project: HashMap<String, (String, String)> = HashMap::new();

        for chunk in hashes_needing_metadata.chunks(100) {
            if let Ok(version_files) = client.get_version_files_by_hashes(chunk).await {
                for (hash, vf) in &version_files {
                    hash_to_version_and_project.insert(hash.clone(), (vf.project_id.clone(), vf.id.clone()));
                    if !project_ids.contains(&vf.project_id) {
                        project_ids.push(vf.project_id.clone());
                    }
                }
            }
        }

        if !project_ids.is_empty() {
            if let Ok(projects) = client.get_projects_batch(&project_ids).await {
                let project_map: HashMap<String, ModrinthProjectDetails> =
                    projects.into_iter().map(|p| (p.id.clone(), p)).collect();

                for (hash, (proj_id, version_id)) in &hash_to_version_and_project {
                    if let Some(project) = project_map.get(proj_id) {
                        let metadata = ModFileWithMetadata {
                            filename: String::new(),
                            size: 0,
                            project_id: Some(proj_id.clone()),
                            name: Some(project.title.clone()),
                            description: Some(project.description.clone()),
                            icon_url: project.icon_url.clone(),
                            author: None,
                            downloads: Some(project.downloads),
                            disabled: false,
                            current_version_id: Some(version_id.clone()),
                        };

                        for entry in disk_cache.values_mut() {
                            if entry.sha1_hash == *hash {
                                entry.metadata = Some(ModFileWithMetadata {
                                    filename: String::new(),
                                    size: entry.size,
                                    ..metadata.clone()
                                });
                            }
                        }

                        for pack_entry in packs.iter_mut() {
                            if disk_cache.get(&pack_entry.filename)
                                .map(|e| e.sha1_hash == *hash)
                                .unwrap_or(false)
                            {
                                pack_entry.project_id = Some(proj_id.clone());
                                pack_entry.name = Some(project.title.clone());
                                pack_entry.description = Some(project.description.clone());
                                pack_entry.icon_url = project.icon_url.clone();
                                pack_entry.author = None;
                                pack_entry.downloads = Some(project.downloads);
                                pack_entry.current_version_id = Some(version_id.clone());
                            }
                        }
                    }
                }
            }
        }

        save_pack_cache(&cache_file, &disk_cache);
    }

    packs.sort_by(|a, b| a.filename.to_lowercase().cmp(&b.filename.to_lowercase()));
    Ok(packs)
}