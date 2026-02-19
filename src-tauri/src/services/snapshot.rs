use crate::utils::get_launcher_dir;
use crate::models::Snapshot;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

#[derive(Debug, Serialize, Deserialize)]
struct SnapshotManifest {
    pub version: String,
    pub created_at: String,
    pub launcher_version: String,
    pub includes: Vec<String>,
}

pub struct SnapshotManager;

impl SnapshotManager {
    fn get_snapshots_dir() -> PathBuf {
        get_launcher_dir().join("snapshots")
    }

    fn get_snapshots_index_path() -> PathBuf {
        Self::get_snapshots_dir().join("index.json")
    }

    /// Create a new snapshot of the current launcher state
    pub fn create_snapshot(name: String) -> Result<Snapshot, Box<dyn std::error::Error>> {
        let launcher_dir = get_launcher_dir();
        let snapshots_dir = Self::get_snapshots_dir();
        
        // Create snapshots directory if it doesn't exist
        fs::create_dir_all(&snapshots_dir)?;

        // Generate unique ID and filename
        let timestamp = Utc::now().timestamp();
        let id = format!("snapshot_{}", timestamp);
        let snapshot_filename = format!("{}.octsnap", id);
        let snapshot_path = snapshots_dir.join(&snapshot_filename);

        // Create the ZIP file
        let file = fs::File::create(&snapshot_path)?;
        let mut zip = zip::ZipWriter::new(file);
        let options = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o755);

        // Create manifest
        let manifest = SnapshotManifest {
            version: "1.0.0".to_string(),
            created_at: Utc::now().to_rfc3339(),
            launcher_version: env!("CARGO_PKG_VERSION").to_string(),
            includes: vec![
                "instances".to_string(),
                "settings.json".to_string(),
                "templates".to_string(),
                "servers.json".to_string(),
                "sidebar_bg.png".to_string(),
            ],
        };

        // Add manifest to ZIP
        zip.start_file("manifest.json", options)?;
        let manifest_json = serde_json::to_string_pretty(&manifest)?;
        zip.write_all(manifest_json.as_bytes())?;

        // Backup instances directory
        let instances_dir = launcher_dir.join("instances");
        if instances_dir.exists() {
            Self::add_directory_to_zip(&mut zip, &instances_dir, "instances", options)?;
        }

        // Backup templates directory
        let templates_dir = launcher_dir.join("templates");
        if templates_dir.exists() {
            Self::add_directory_to_zip(&mut zip, &templates_dir, "templates", options)?;
        }

        // Backup settings.json
        let settings_file = launcher_dir.join("settings.json");
        if settings_file.exists() {
            Self::add_file_to_zip(&mut zip, &settings_file, "settings.json", options)?;
        }

        // Backup servers.json
        let servers_file = launcher_dir.join("servers.json");
        if servers_file.exists() {
            Self::add_file_to_zip(&mut zip, &servers_file, "servers.json", options)?;
        }

        // Backup sidebar background
        let sidebar_bg = launcher_dir.join("sidebar_bg.png");
        if sidebar_bg.exists() {
            Self::add_file_to_zip(&mut zip, &sidebar_bg, "sidebar_bg.png", options)?;
        }

        zip.finish()?;

        // Get file size
        let metadata = fs::metadata(&snapshot_path)?;
        let size_bytes = metadata.len();

        // Create snapshot record
        let snapshot = Snapshot {
            id: id.clone(),
            name,
            created_at: Utc::now().to_rfc3339(),
            size_bytes,
            file_path: snapshot_filename,
        };

        // Save to index
        Self::add_to_index(&snapshot)?;

        Ok(snapshot)
    }

    /// Restore a snapshot by ID
    pub fn restore_snapshot(snapshot_id: String) -> Result<(), Box<dyn std::error::Error>> {
        let snapshots_dir = Self::get_snapshots_dir();
        let launcher_dir = get_launcher_dir();

        // Load index to find snapshot
        let snapshots = Self::get_all_snapshots()?;
        let snapshot = snapshots
            .iter()
            .find(|s| s.id == snapshot_id)
            .ok_or("Snapshot not found")?;

        let snapshot_path = snapshots_dir.join(&snapshot.file_path);
        if !snapshot_path.exists() {
            return Err("Snapshot file not found".into());
        }

        // Open ZIP file
        let file = fs::File::open(&snapshot_path)?;
        let mut archive = zip::ZipArchive::new(file)?;

        // Read manifest first to validate
        let manifest_content = {
            let mut manifest_file = archive.by_name("manifest.json")?;
            let mut content = String::new();
            manifest_file.read_to_string(&mut content)?;
            content
        };

        let _manifest: SnapshotManifest = serde_json::from_str(&manifest_content)?;

        // Extract all files
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let outpath = match file.enclosed_name() {
                Some(path) => path.to_owned(),
                None => continue,
            };

            // Skip manifest
            if outpath == PathBuf::from("manifest.json") {
                continue;
            }

            let full_path = launcher_dir.join(&outpath);

            if file.name().ends_with('/') {
                // Directory
                fs::create_dir_all(&full_path)?;
            } else {
                // File
                if let Some(parent) = full_path.parent() {
                    fs::create_dir_all(parent)?;
                }

                let mut outfile = fs::File::create(&full_path)?;
                std::io::copy(&mut file, &mut outfile)?;
            }
        }

        Ok(())
    }

    /// Get all snapshots
    pub fn get_all_snapshots() -> Result<Vec<Snapshot>, Box<dyn std::error::Error>> {
        let index_path = Self::get_snapshots_index_path();

        if !index_path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&index_path)?;
        let snapshots: Vec<Snapshot> = serde_json::from_str(&content)?;

        Ok(snapshots)
    }

    /// Delete a snapshot
    pub fn delete_snapshot(snapshot_id: String) -> Result<(), Box<dyn std::error::Error>> {
        let snapshots_dir = Self::get_snapshots_dir();
        let mut snapshots = Self::get_all_snapshots()?;

        // Find and remove snapshot
        let snapshot_index = snapshots
            .iter()
            .position(|s| s.id == snapshot_id)
            .ok_or("Snapshot not found")?;

        let snapshot = snapshots.remove(snapshot_index);

        // Delete file
        let snapshot_path = snapshots_dir.join(&snapshot.file_path);
        if snapshot_path.exists() {
            fs::remove_file(snapshot_path)?;
        }

        // Update index
        Self::save_index(&snapshots)?;

        Ok(())
    }

    // Helper methods

    fn add_to_index(snapshot: &Snapshot) -> Result<(), Box<dyn std::error::Error>> {
        let mut snapshots = Self::get_all_snapshots().unwrap_or_default();
        snapshots.push(snapshot.clone());
        Self::save_index(&snapshots)
    }

    fn save_index(snapshots: &[Snapshot]) -> Result<(), Box<dyn std::error::Error>> {
        let index_path = Self::get_snapshots_index_path();
        let json = serde_json::to_string_pretty(snapshots)?;
        fs::write(&index_path, json)?;
        Ok(())
    }

    fn add_file_to_zip(
        zip: &mut zip::ZipWriter<fs::File>,
        file_path: &PathBuf,
        zip_path: &str,
        options: SimpleFileOptions,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut file = fs::File::open(file_path)?;
        zip.start_file(zip_path, options)?;
        std::io::copy(&mut file, zip)?;
        Ok(())
    }

    fn add_directory_to_zip(
        zip: &mut zip::ZipWriter<fs::File>,
        dir_path: &PathBuf,
        zip_prefix: &str,
        options: SimpleFileOptions,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let entries = fs::read_dir(dir_path)?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            let name = entry.file_name();
            let name_str = name.to_string_lossy();

            let zip_path = format!("{}/{}", zip_prefix, name_str);

            if path.is_file() {
                Self::add_file_to_zip(zip, &path, &zip_path, options)?;
            } else if path.is_dir() {
                zip.add_directory(&format!("{}/", zip_path), options)?;
                Self::add_directory_to_zip(zip, &path, &zip_path, options)?;
            }
        }

        Ok(())
    }

    /// Export a snapshot to a custom location
    pub fn export_snapshot(
        snapshot_id: String,
        export_path: String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let snapshots_dir = Self::get_snapshots_dir();
        let snapshots = Self::get_all_snapshots()?;

        let snapshot = snapshots
            .iter()
            .find(|s| s.id == snapshot_id)
            .ok_or("Snapshot not found")?;

        let snapshot_path = snapshots_dir.join(&snapshot.file_path);
        if !snapshot_path.exists() {
            return Err("Snapshot file not found".into());
        }

        fs::copy(snapshot_path, export_path)?;
        Ok(())
    }

    /// Import a snapshot from a file
    pub fn import_snapshot(
        import_path: String,
        name: String,
    ) -> Result<Snapshot, Box<dyn std::error::Error>> {
        let snapshots_dir = Self::get_snapshots_dir();
        fs::create_dir_all(&snapshots_dir)?;

        // Validate it's a valid snapshot
        let file = fs::File::open(&import_path)?;
        let mut archive = zip::ZipArchive::new(file)?;

        // Check for manifest
        let manifest_content = {
            let mut manifest_file = archive.by_name("manifest.json")?;
            let mut content = String::new();
            manifest_file.read_to_string(&mut content)?;
            content
        };

        let _manifest: SnapshotManifest = serde_json::from_str(&manifest_content)?;

        // Generate new ID and copy file
        let timestamp = Utc::now().timestamp();
        let id = format!("snapshot_{}", timestamp);
        let snapshot_filename = format!("{}.octsnap", id);
        let snapshot_path = snapshots_dir.join(&snapshot_filename);

        fs::copy(&import_path, &snapshot_path)?;

        // Get file size
        let metadata = fs::metadata(&snapshot_path)?;
        let size_bytes = metadata.len();

        let snapshot = Snapshot {
            id: id.clone(),
            name,
            created_at: Utc::now().to_rfc3339(),
            size_bytes,
            file_path: snapshot_filename,
        };

        Self::add_to_index(&snapshot)?;

        Ok(snapshot)
    }
}