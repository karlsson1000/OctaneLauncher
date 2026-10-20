use super::*;

pub fn cache_path(instance_dir: &std::path::Path) -> std::path::PathBuf {
    instance_dir.join(".mod_cache.json")
}

pub fn invalidate_content_cache(instance_name: &str, cache_kind: &str) {
    let instance_dir = get_instance_dir(instance_name);
    let path = instance_dir.join(format!(".{}_cache.json", cache_kind));
    if path.exists() {
        let _ = std::fs::remove_file(&path);
    }
}

pub fn invalidate_mod_cache(instance_name: &str) {
    invalidate_content_cache(instance_name, "mod");
}

#[derive(Serialize, Deserialize)]
pub struct CacheEntry {
    pub mtime: u128,
    pub size: u64,
    pub sha1_hash: String,
    pub metadata: Option<ModFileWithMetadata>,
}

#[derive(Serialize, Deserialize)]
pub struct ModFile {
    pub filename: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModHash {
    pub filename: String,
    pub size: u64,
    pub disabled: bool,
    pub sha1_hash: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModFileWithMetadata {
    pub filename: String,
    pub size: u64,
    pub project_id: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub author: Option<String>,
    pub downloads: Option<u64>,
    pub disabled: bool,
    pub current_version_id: Option<String>,
}

pub fn collect_mod_hashes(instance_dir: &std::path::Path) -> Result<Vec<ModHash>, String> {
    let mods_dir = instance_dir.join("mods");

    if !mods_dir.exists() {
        return Ok(Vec::new());
    }

    let mut disk_cache = load_cache(&instance_dir);
    let mut mods = Vec::new();
    let mut changed = false;

    for entry in std::fs::read_dir(&mods_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() { continue; }

        let filename = match path.file_name().and_then(|n| n.to_str()) {
            Some(f) if f.ends_with(".jar") || f.ends_with(".jar.disabled") => f.to_string(),
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
        let disabled = filename.ends_with(".disabled");

        let sha1_hash = match disk_cache.get(&filename) {
            Some(entry) if entry.mtime == mtime && entry.size == size => {
                entry.sha1_hash.clone()
            }
            _ => {
                changed = true;
                match std::fs::read(&path) {
                    Ok(bytes) => crate::utils::hash::sha1_hex(&bytes),
                    Err(_) => continue,
                }
            }
        };

        let existing_metadata = disk_cache.get(&filename).and_then(|e| e.metadata.clone());
        disk_cache.insert(filename.clone(), CacheEntry {
            mtime,
            size,
            sha1_hash: sha1_hash.clone(),
            metadata: existing_metadata,
        });

        mods.push(ModHash {
            filename,
            size,
            disabled,
            sha1_hash,
        });
    }

    let current_filenames: std::collections::HashSet<String> = mods.iter().map(|m| m.filename.clone()).collect();
    disk_cache.retain(|k, _| current_filenames.contains(k));

    if changed {
        save_cache(&instance_dir, &disk_cache);
    }

    mods.sort_by(|a, b| a.filename.to_lowercase().cmp(&b.filename.to_lowercase()));
    Ok(mods)
}

fn load_cache(instance_dir: &std::path::Path) -> HashMap<String, CacheEntry> {
    let cache_file = cache_path(instance_dir);
    if cache_file.exists() {
        std::fs::read_to_string(&cache_file)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        HashMap::new()
    }
}

fn save_cache(instance_dir: &std::path::Path, cache: &HashMap<String, CacheEntry>) {
    if let Ok(json) = serde_json::to_string(cache) {
        let _ = std::fs::write(cache_path(instance_dir), json);
    }
}
