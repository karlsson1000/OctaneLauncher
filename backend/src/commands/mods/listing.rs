use super::*;

#[tauri::command]
pub async fn get_installed_mods(instance_name: String) -> Result<Vec<ModFile>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let mods_dir = instance_dir.join("mods");
    
    if !mods_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut mods = Vec::new();
    
    match std::fs::read_dir(&mods_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                
                if !path.starts_with(&mods_dir) {
                    continue;
                }
                
                if path.is_file() {
                    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                        if filename.ends_with(".jar") || filename.ends_with(".jar.disabled") {
                            if let Ok(metadata) = std::fs::metadata(&path) {
                                mods.push(ModFile {
                                    filename: filename.to_string(),
                                    size: metadata.len(),
                                });
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Err(e.to_string());
        }
    }
    
    mods.sort_by(|a, b| a.filename.to_lowercase().cmp(&b.filename.to_lowercase()));
    
    Ok(mods)
}

#[tauri::command]
pub async fn get_installed_mods_with_metadata(instance_name: String) -> Result<Vec<ModFileWithMetadata>, String> {
    get_installed_content_with_metadata(instance_name, "mods", "mod", &[".jar", ".jar.disabled"], true).await
}

pub async fn get_installed_content_with_metadata(
    instance_name: String,
    folder: &str,
    cache_kind: &str,
    allowed_extensions: &[&str],
    supports_disabled: bool,
) -> Result<Vec<ModFileWithMetadata>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let instance_dir = get_instance_dir(&safe_name);
    let content_dir = instance_dir.join(folder);

    if !content_dir.exists() {
        return Ok(Vec::new());
    }

    let cache_file = instance_dir.join(format!(".{}_cache.json", cache_kind));
    let mut disk_cache: HashMap<String, CacheEntry> = if cache_file.exists() {
        std::fs::read_to_string(&cache_file)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        HashMap::new()
    };

    let mut items = Vec::new();
    let mut hashes_needing_metadata: Vec<String> = Vec::new();

    for entry in std::fs::read_dir(&content_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() { continue; }

        let filename = match path.file_name().and_then(|n| n.to_str()) {
            Some(f) if allowed_extensions.iter().any(|ext| f.ends_with(ext)) => f.to_string(),
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
        let disabled = supports_disabled && filename.ends_with(".disabled");

        let (_, metadata) = match disk_cache.get(&filename) {
            Some(entry) if entry.mtime == mtime && entry.size == size => {
                let hash = entry.sha1_hash.clone();
                let meta = entry.metadata.clone();
                (hash, meta)
            }
            _ => {
                let hash = match std::fs::read(&path) {
                    Ok(bytes) => crate::utils::hash::sha1_hex(&bytes),
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

        items.push(ModFileWithMetadata {
            filename: filename.clone(),
            size,
            project_id: metadata.as_ref().and_then(|m| m.project_id.clone()),
            name: metadata.as_ref().and_then(|m| m.name.clone()),
            description: metadata.as_ref().and_then(|m| m.description.clone()),
            icon_url: metadata.as_ref().and_then(|m| m.icon_url.clone()),
            author: metadata.as_ref().and_then(|m| m.author.clone()),
            downloads: metadata.as_ref().and_then(|m| m.downloads),
            disabled,
            current_version_id: metadata.as_ref().and_then(|m| m.current_version_id.clone()),
        });
    }

    if !hashes_needing_metadata.is_empty() {
        match enrich_with_modrinth_metadata(&mut disk_cache, &mut items, &mut hashes_needing_metadata).await {
            Ok(()) => {
                if let Ok(json) = serde_json::to_string(&disk_cache) {
                    let _ = std::fs::write(&cache_file, json);
                }
            }
            Err(e) => eprintln!("Failed to fetch Modrinth metadata for {} items: {}", hashes_needing_metadata.len(), e),
        }
    }

    items.sort_by(|a, b| a.filename.to_lowercase().cmp(&b.filename.to_lowercase()));
    Ok(items)
}

async fn enrich_with_modrinth_metadata(
    disk_cache: &mut HashMap<String, CacheEntry>,
    items: &mut [ModFileWithMetadata],
    hashes_needing_metadata: &mut [String],
) -> Result<(), String> {
    let client = ModrinthClient::new().map_err(|e| e.to_string())?;
    let mut project_ids: Vec<String> = Vec::new();
    let mut hash_to_version_and_project: HashMap<String, (String, String)> = HashMap::new();

    for chunk in hashes_needing_metadata.chunks(100) {
        let version_files = client
            .get_version_files_by_hashes(chunk)
            .await
            .map_err(|e| e.to_string())?;
        for (hash, vf) in &version_files {
            hash_to_version_and_project.insert(hash.clone(), (vf.project_id.clone(), vf.id.clone()));
            if !project_ids.contains(&vf.project_id) {
                project_ids.push(vf.project_id.clone());
            }
        }
    }

    if project_ids.is_empty() {
        return Ok(());
    }

    let projects = client
        .get_projects_batch(&project_ids)
        .await
        .map_err(|e| e.to_string())?;
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

            for item in items.iter_mut() {
                if disk_cache.get(&item.filename)
                    .map(|e| e.sha1_hash == *hash)
                    .unwrap_or(false)
                {
                    item.project_id = Some(proj_id.clone());
                    item.name = Some(project.title.clone());
                    item.description = Some(project.description.clone());
                    item.icon_url = project.icon_url.clone();
                    item.author = None;
                    item.downloads = Some(project.downloads);
                    item.current_version_id = Some(version_id.clone());
                }
            }
        }
    }

    Ok(())
}
