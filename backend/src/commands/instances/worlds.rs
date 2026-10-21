use super::*;

fn resolve_world_dir(instance_name: &str, folder_name: &str) -> Result<PathBuf, String> {
    let safe_name = sanitize_instance_name(instance_name)?;

    if folder_name.is_empty()
        || folder_name.starts_with('.')
        || folder_name.contains("..")
        || folder_name.contains('/')
        || folder_name.contains('\\')
    {
        return Err("Invalid world folder name".to_string());
    }

    let saves_dir = get_instance_dir(&safe_name).join("saves");
    let world_dir = saves_dir.join(folder_name);

    let canonical_world = world_dir
        .canonicalize()
        .map_err(|_| format!("World folder '{}' does not exist", folder_name))?;
    let canonical_saves = saves_dir
        .canonicalize()
        .map_err(|e| e.to_string())?;

    if canonical_world.parent() != Some(canonical_saves.as_path()) {
        return Err("Invalid world folder name".to_string());
    }

    Ok(world_dir)
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct World {
    pub name: String,
    pub folder_name: String,
    pub size: u64,
    pub last_played: Option<i64>,
    pub game_mode: Option<String>,
    pub version: Option<String>,
    pub icon_path: Option<String>,
    pub created: Option<i64>,
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
    let world_dir = resolve_world_dir(&instance_name, &folder_name)?;

    open_folder(world_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_world(instance_name: String, folder_name: String) -> Result<(), String> {
    let world_dir = resolve_world_dir(&instance_name, &folder_name)?;

    std::fs::remove_dir_all(&world_dir)
        .map_err(|e| e.to_string())
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

                let icon_path = read_world_icon(&path);

                worlds.push(World {
                    name: folder_name.clone(),
                    folder_name,
                    size,
                    last_played: None,
                    game_mode: None,
                    version: None,
                    icon_path,
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

    Some(icon_path.to_string_lossy().into_owned())
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
