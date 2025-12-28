use crate::models::*;
use crate::utils::get_current_os;
use sha1::{Digest, Sha1};
use std::{fs, path::PathBuf, sync::Arc, time::Duration};
use tokio::sync::Semaphore;

const VERSION_MANIFEST_URL: &str = "https://launchermeta.mojang.com/mc/game/version_manifest.json";
const MAX_CONCURRENT_DOWNLOADS: usize = 32;

type DownloadError = Box<dyn std::error::Error + Send + Sync>;

pub struct MinecraftInstaller {
    http_client: reqwest::Client,
    launcher_dir: PathBuf,
}

impl MinecraftInstaller {
    pub fn new(launcher_dir: PathBuf) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .pool_max_idle_per_host(MAX_CONCURRENT_DOWNLOADS * 2)
            .pool_idle_timeout(Duration::from_secs(90))
            .tcp_keepalive(Duration::from_secs(60))
            .http2_keep_alive_interval(Duration::from_secs(30))
            .http2_keep_alive_timeout(Duration::from_secs(10))
            .build()
            .unwrap();

        Self {
            http_client,
            launcher_dir,
        }
    }

    async fn download_file(
        &self,
        url: &str,
        path: &PathBuf,
    ) -> Result<(), DownloadError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let response = self.http_client.get(url).send().await?;
        let bytes = response.bytes().await?;
        fs::write(path, bytes)?;

        Ok(())
    }

    /// Fast existence check
    fn file_needs_download(path: &PathBuf, expected_sha1: Option<&str>) -> bool {
        if !path.exists() {
            return true;
        }

        // If no SHA1 provided, assume file is good if it exists
        let Some(expected_sha1) = expected_sha1 else {
            return false;
        };

        // Only validate SHA1 if we really need to
        if let Ok(contents) = fs::read(path) {
            let mut hasher = Sha1::new();
            hasher.update(&contents);
            let hash = format!("{:x}", hasher.finalize());
            hash != expected_sha1
        } else {
            true
        }
    }

    async fn download_file_with_sha1(
        &self,
        url: &str,
        path: &PathBuf,
        expected_sha1: &str,
    ) -> Result<bool, DownloadError> {
        if !Self::file_needs_download(path, Some(expected_sha1)) {
            return Ok(false); // File already exists with correct hash
        }

        self.download_file(url, path).await?;
        Ok(true) // File was downloaded
    }

    /// Get all versions (releases, snapshots, and pre-releases)
    pub async fn get_versions(&self) -> Result<Vec<String>, DownloadError> {
        let response = self.http_client.get(VERSION_MANIFEST_URL).send().await?;
        let manifest: VersionManifest = response.json().await?;

        let versions: Vec<String> = manifest
            .versions
            .iter()
            .take(500)
            .map(|v| v.id.clone())
            .collect();

        Ok(versions)
    }

    /// Get versions with metadata (includes version type)
    pub async fn get_versions_with_metadata(&self) -> Result<Vec<MinecraftVersion>, DownloadError> {
        let response = self.http_client.get(VERSION_MANIFEST_URL).send().await?;
        let manifest: VersionManifest = response.json().await?;

        let versions: Vec<MinecraftVersion> = manifest
            .versions
            .into_iter()
            .take(500)
            .collect();

        Ok(versions)
    }

    /// Get versions by type (release, snapshot, old_beta, old_alpha)
    pub async fn get_versions_by_type(&self, version_type: &str) -> Result<Vec<String>, DownloadError> {
        let response = self.http_client.get(VERSION_MANIFEST_URL).send().await?;
        let manifest: VersionManifest = response.json().await?;

        let versions: Vec<String> = manifest
            .versions
            .iter()
            .filter(|v| v.r#type == version_type)
            .take(500)
            .map(|v| v.id.clone())
            .collect();

        Ok(versions)
    }

    pub async fn install_version(
        &self,
        version_id: &str,
    ) -> Result<(), DownloadError> {
        println!("=== Installing Minecraft {} ===", version_id);

        let manifest_response = self.http_client.get(VERSION_MANIFEST_URL).send().await?;
        let manifest: VersionManifest = manifest_response.json().await?;

        let version_info = manifest
            .versions
            .iter()
            .find(|v| v.id == version_id)
            .ok_or_else(|| format!("Version {} not found", version_id))?;

        println!("✓ Found version info (type: {})", version_info.r#type);

        let version_details: VersionDetails = self
            .http_client
            .get(&version_info.url)
            .send()
            .await?
            .json()
            .await?;

        println!("✓ Downloaded version details");

        // Create directories
        let versions_dir = self.launcher_dir.join("versions").join(version_id);
        let libraries_dir = self.launcher_dir.join("libraries");
        let assets_dir = self.launcher_dir.join("assets");
        let objects_dir = assets_dir.join("objects");

        fs::create_dir_all(&versions_dir)?;
        fs::create_dir_all(&libraries_dir)?;
        fs::create_dir_all(&objects_dir)?;

        println!("Downloading client JAR...");
        let jar_path = versions_dir.join(format!("{}.jar", version_id));
        self.download_file_with_sha1(
            &version_details.downloads.client.url,
            &jar_path,
            &version_details.downloads.client.sha1,
        )
        .await?;
        println!("✓ Client JAR downloaded");

        let json_path = versions_dir.join(format!("{}.json", version_id));
        let json_content = serde_json::to_string_pretty(&version_details)?;
        fs::write(json_path, json_content)?;

        // Download libraries (including natives) in parallel
        println!("Downloading libraries and natives...");
        let current_os = get_current_os();
        println!("Detected OS: {}", current_os);
        
        let mut library_tasks = Vec::new();
        let mut native_count = 0;
        let mut regular_count = 0;
        
        for library in &version_details.libraries {
            // Check if this is a native library
            let is_native = library.name.contains(":natives-");
            
            if is_native {
                // Extract the platform from the library name
                let platform_suffix = if library.name.contains(":natives-windows") {
                    "windows"
                } else if library.name.contains(":natives-linux") {
                    "linux"
                } else if library.name.contains(":natives-macos") || library.name.contains(":natives-osx") {
                    "osx"
                } else {
                    ""
                };
                
                // Only download natives for current OS
                if platform_suffix == current_os {
                    if let Some(downloads) = &library.downloads {
                        if let Some(artifact) = &downloads.artifact {
                            // Check OS rules if they exist
                            let should_include = if let Some(rules) = &library.rules {
                                should_include_library(rules, &current_os)
                            } else {
                                true
                            };
                            
                            if should_include {
                                native_count += 1;
                                library_tasks.push((
                                    artifact.url.clone(),
                                    libraries_dir.join(&artifact.path),
                                    artifact.sha1.clone(),
                                    format!("NATIVE: {}", library.name),
                                ));
                            }
                        }
                    }
                }
            } else {
                // Regular library (not a native)
                if let Some(downloads) = &library.downloads {
                    if let Some(artifact) = &downloads.artifact {
                        // Check OS rules if they exist
                        let should_include = if let Some(rules) = &library.rules {
                            should_include_library(rules, &current_os)
                        } else {
                            true
                        };

                        if should_include {
                            regular_count += 1;
                            library_tasks.push((
                                artifact.url.clone(),
                                libraries_dir.join(&artifact.path),
                                artifact.sha1.clone(),
                                format!("regular: {}", library.name),
                            ));
                        }
                    }
                }
            }
        }

        println!("Total downloads queued: {} regular libraries + {} natives = {}", 
                 regular_count, native_count, library_tasks.len());

        if native_count == 0 {
            println!("WARNING: NO NATIVE LIBRARIES QUEUED FOR {}! This will cause launch failures!", current_os);
            println!("This usually means OS detection is wrong or the version manifest has no natives.");
        }

        let downloaded = self.download_parallel_with_types(library_tasks).await?;
        println!("✓ Downloaded {} files", downloaded);

        // Download asset index
        println!("Downloading assets...");
        let asset_index_path = assets_dir
            .join("indexes")
            .join(format!("{}.json", version_details.asset_index.id));
        fs::create_dir_all(asset_index_path.parent().unwrap())?;

        self.download_file_with_sha1(
            &version_details.asset_index.url,
            &asset_index_path,
            &version_details.asset_index.sha1,
        )
        .await?;

        let asset_index_data: AssetIndexData =
            serde_json::from_str(&fs::read_to_string(&asset_index_path)?)?;
        let total_assets = asset_index_data.objects.len();

        // Prepare asset download tasks
        let mut asset_tasks = Vec::new();
        for (_, asset) in asset_index_data.objects {
            let hash_prefix = &asset.hash[0..2];
            let asset_path = objects_dir.join(hash_prefix).join(&asset.hash);
            let asset_url = format!(
                "https://resources.download.minecraft.net/{}/{}",
                hash_prefix, asset.hash
            );

            asset_tasks.push((asset_url, asset_path, asset.hash));
        }

        let downloaded_assets = self.download_parallel_fast(asset_tasks).await?;
        println!("✓ Downloaded {} assets ({} skipped)", downloaded_assets, total_assets - downloaded_assets);

        println!("=== Installation Complete ===");
        println!("✓ Minecraft {} installed successfully", version_id);
        Ok(())
    }

    async fn download_parallel_with_types(
        &self,
        tasks: Vec<(String, PathBuf, String, String)>,
    ) -> Result<usize, DownloadError> {
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_DOWNLOADS));
        let client = Arc::new(self.http_client.clone());
        let mut handles = Vec::new();
        let downloaded_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));

        for (url, path, sha1, label) in tasks {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let client = client.clone();
            let downloaded_count = downloaded_count.clone();

            let handle = tokio::spawn(async move {
                let result = Self::download_with_client_labeled(&client, &url, &path, &sha1, &label).await;
                drop(permit);
                
                if let Ok(true) = result {
                    downloaded_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                }
                
                result
            });

            handles.push(handle);
        }

        for handle in handles {
            handle.await??;
        }

        Ok(downloaded_count.load(std::sync::atomic::Ordering::Relaxed))
    }

    async fn download_parallel_fast(
        &self,
        tasks: Vec<(String, PathBuf, String)>,
    ) -> Result<usize, DownloadError> {
        let total = tasks.len();
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_DOWNLOADS));
        let client = Arc::new(self.http_client.clone());
        let downloaded_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let progress_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        
        println!("Starting download of {} assets...", total);
        
        // Spawn all tasks at once without chunking
        let mut handles = Vec::new();
        
        for (url, path, sha1) in tasks {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let client = client.clone();
            let url = url.clone();
            let path = path.clone();
            let sha1 = sha1.clone();
            let downloaded_count = downloaded_count.clone();
            let progress_count = progress_count.clone();
            let total_copy = total;

            let handle = tokio::spawn(async move {
                let result = Self::download_with_client_fast(&client, &url, &path, &sha1).await;
                drop(permit);
                
                if let Ok(downloaded) = result {
                    if downloaded {
                        downloaded_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    }
                    
                    // Update progress every 100 files
                    let completed = progress_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                    if completed % 100 == 0 || completed == total_copy {
                        let dl_count = downloaded_count.load(std::sync::atomic::Ordering::Relaxed);
                        println!("  Progress: {}/{} assets (downloaded: {}, skipped: {})", 
                                 completed, total_copy, dl_count, completed - dl_count);
                    }
                }
                
                result
            });

            handles.push(handle);
        }

        // Wait for all downloads to complete
        for handle in handles {
            handle.await??;
        }

        Ok(downloaded_count.load(std::sync::atomic::Ordering::Relaxed))
    }

    #[allow(dead_code)]
    async fn download_parallel(
        &self,
        tasks: Vec<(String, PathBuf, String)>,
    ) -> Result<usize, DownloadError> {
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_DOWNLOADS));
        let client = Arc::new(self.http_client.clone());
        let mut handles = Vec::new();
        let downloaded_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));

        for (url, path, sha1) in tasks {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let client = client.clone();
            let downloaded_count = downloaded_count.clone();

            let handle = tokio::spawn(async move {
                let result = Self::download_with_client(&client, &url, &path, &sha1).await;
                drop(permit);
                
                if let Ok(true) = result {
                    downloaded_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                }
                
                result
            });

            handles.push(handle);
        }

        for handle in handles {
            handle.await??;
        }

        Ok(downloaded_count.load(std::sync::atomic::Ordering::Relaxed))
    }

    #[allow(dead_code)]
    async fn download_parallel_chunked(
        &self,
        tasks: Vec<(String, PathBuf, String)>,
        chunk_size: usize,
    ) -> Result<usize, DownloadError> {
        let total = tasks.len();
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_DOWNLOADS));
        let client = Arc::new(self.http_client.clone());
        let total_downloaded = Arc::new(std::sync::atomic::AtomicUsize::new(0));

        for (chunk_idx, chunk) in tasks.chunks(chunk_size).enumerate() {
            let mut handles = Vec::new();

            for (url, path, sha1) in chunk {
                let permit = semaphore.clone().acquire_owned().await.unwrap();
                let client = client.clone();
                let url = url.clone();
                let path = path.clone();
                let sha1 = sha1.clone();
                let total_downloaded = total_downloaded.clone();

                let handle = tokio::spawn(async move {
                    let result = Self::download_with_client(&client, &url, &path, &sha1).await;
                    drop(permit);
                    
                    if let Ok(true) = result {
                        total_downloaded.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    }
                    
                    result
                });

                handles.push(handle);
            }

            for handle in handles {
                handle.await??;
            }

            let completed = (chunk_idx + 1) * chunk_size.min(total);
            let downloaded = total_downloaded.load(std::sync::atomic::Ordering::Relaxed);
            println!(
                "  Progress: {}/{} assets (downloaded: {})",
                completed.min(total),
                total,
                downloaded
            );
        }

        Ok(total_downloaded.load(std::sync::atomic::Ordering::Relaxed))
    }

    async fn download_with_client_labeled(
        client: &reqwest::Client,
        url: &str,
        path: &PathBuf,
        expected_sha1: &str,
        label: &str,
    ) -> Result<bool, DownloadError> {
        // Fast check without SHA1 validation
        if !Self::file_needs_download(path, Some(expected_sha1)) {
            if label.starts_with("NATIVE:") {
                println!("  ✓ {} already exists", label);
            }
            return Ok(false);
        }

        // Create parent directories
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Download file
        if label.starts_with("NATIVE:") {
            println!("  ⬇ Downloading: {}", label);
        }
        let response = client.get(url).send().await?;
        
        if !response.status().is_success() {
            return Err(format!("Failed to download {}: HTTP {}", label, response.status()).into());
        }
        
        let bytes = response.bytes().await?;
        fs::write(path, bytes)?;
        
        if label.starts_with("NATIVE:") {
            println!("  ✓ Downloaded: {}", label);
        }

        Ok(true)
    }

    /// NEW: Optimized download without excessive logging
    async fn download_with_client_fast(
        client: &reqwest::Client,
        url: &str,
        path: &PathBuf,
        expected_sha1: &str,
    ) -> Result<bool, DownloadError> {
        // Fast existence check
        if !Self::file_needs_download(path, Some(expected_sha1)) {
            return Ok(false);
        }

        // Create parent directories
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Download file
        let response = client.get(url).send().await?;
        
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()).into());
        }
        
        let bytes = response.bytes().await?;
        fs::write(path, bytes)?;

        Ok(true)
    }

    async fn download_with_client(
        client: &reqwest::Client,
        url: &str,
        path: &PathBuf,
        expected_sha1: &str,
    ) -> Result<bool, DownloadError> {
        if path.exists() {
            if let Ok(contents) = fs::read(path) {
                let mut hasher = Sha1::new();
                hasher.update(&contents);
                let hash = format!("{:x}", hasher.finalize());

                if hash == expected_sha1 {
                    return Ok(false);
                }
            }
        }

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let response = client.get(url).send().await?;
        let bytes = response.bytes().await?;
        fs::write(path, bytes)?;

        Ok(true)
    }

    pub fn check_version_installed(&self, version: &str) -> bool {
        let jar_path = self
            .launcher_dir
            .join("versions")
            .join(version)
            .join(format!("{}.jar", version));

        jar_path.exists()
    }
}

pub fn should_include_library(rules: &[Rule], current_os: &str) -> bool {
    let mut allowed = false;

    for rule in rules {
        let matches = if let Some(os) = &rule.os {
            os.name.as_deref() == Some(current_os)
        } else {
            true
        };

        if rule.action == "allow" && matches {
            allowed = true;
        } else if rule.action == "disallow" && matches {
            return false;
        }
    }

    allowed || rules.iter().all(|r| r.action != "allow")
}