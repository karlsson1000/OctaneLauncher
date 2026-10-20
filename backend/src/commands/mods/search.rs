use super::*;

#[tauri::command]
pub async fn search_mods(
    query: String,
    facets: Option<String>,
    index: Option<String>,
    offset: Option<u32>,
    limit: Option<u32>,
) -> Result<ModrinthSearchResult, String> {
    if query.len() > 200 {
        return Err("Search query too long (max 200 characters)".to_string());
    }
    
    let safe_limit = limit.unwrap_or(20).min(100);
    
    let client = ModrinthClient::new().map_err(|e| e.to_string())?;
    client
        .search_projects(
            &query,
            facets.as_deref(),
            index.as_deref(),
            offset,
            Some(safe_limit),
        )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_project_details(id_or_slug: String) -> Result<ModrinthProjectDetails, String> {
    if !id_or_slug.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err("Invalid project ID or slug format".to_string());
    }
    
    if id_or_slug.len() > 100 {
        return Err("Project ID or slug too long".to_string());
    }
    
    let client = ModrinthClient::new().map_err(|e| e.to_string())?;
    client
        .get_project(&id_or_slug)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_mod_versions(
    id_or_slug: String,
    loaders: Option<Vec<String>>,
    game_versions: Option<Vec<String>>,
) -> Result<Vec<ModrinthVersion>, String> {
    if !id_or_slug.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err("Invalid mod ID or slug format".to_string());
    }
    
    if id_or_slug.len() > 100 {
        return Err("Mod ID or slug too long".to_string());
    }
    
    if let Some(ref loader_list) = loaders {
        for loader in loader_list {
            if !loader.chars().all(|c| c.is_alphanumeric() || c == '-') {
                return Err("Invalid loader name".to_string());
            }
        }
    }
    
    if let Some(ref version_list) = game_versions {
        for version in version_list {
            if !version.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
                return Err("Invalid game version".to_string());
            }
        }
    }
    
    let client = ModrinthClient::new().map_err(|e| e.to_string())?;
    client
        .get_project_versions(&id_or_slug, loaders, game_versions)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Debug, Serialize)]
pub struct ModUpdate {
    pub filename: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "latestVersion")]
    pub latest_version: LatestVersionInfo,
}

#[derive(Debug, Serialize)]
pub struct LatestVersionInfo {
    pub id: String,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
    pub filename: String,
    #[serde(rename = "sha1")]
    pub sha1: String,
}

#[tauri::command]
pub async fn check_mod_updates(
    instance_name: String,
    loader: String,
    game_version: String,
) -> Result<Vec<ModUpdate>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;

    if !loader.chars().all(|c| c.is_alphanumeric() || c == '-') {
        return Err("Invalid loader name".to_string());
    }
    if !game_version.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err("Invalid game version".to_string());
    }

    let instance_dir = get_instance_dir(&safe_name);
    let installed = tauri::async_runtime::spawn_blocking(move || collect_mod_hashes(&instance_dir))
        .await
        .map_err(|e| e.to_string())??;

    let eligible: Vec<ModHash> = installed.into_iter().filter(|m| !m.disabled).collect();
    if eligible.is_empty() {
        return Ok(Vec::new());
    }

    let hashes: Vec<String> = eligible.iter().map(|m| m.sha1_hash.clone()).collect();
    let client = ModrinthClient::new().map_err(|e| e.to_string())?;
    let latest = client
        .get_latest_version_files_by_hashes(&hashes, Some(vec![game_version]), Some(vec![loader]))
        .await
        .map_err(|e| e.to_string())?;

    let mut updates = Vec::new();
    for mh in &eligible {
        let Some(resp) = latest.get(&mh.sha1_hash) else { continue };
        if resp.files.iter().any(|f| f.hashes.sha1 == mh.sha1_hash) {
            continue;
        }
        let Some(file) = resp.files.iter().find(|f| f.primary).or_else(|| resp.files.first()) else { continue };
        updates.push(ModUpdate {
            filename: mh.filename.clone(),
            project_id: resp.project_id.clone(),
            latest_version: LatestVersionInfo {
                id: resp.id.clone(),
                download_url: file.url.clone(),
                filename: file.filename.clone(),
                sha1: file.hashes.sha1.clone(),
            },
        });
    }

    Ok(updates)
}
