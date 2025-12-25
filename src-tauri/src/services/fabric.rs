use crate::models::*;
use std::{fs, path::PathBuf, time::Duration};

const FABRIC_META_URL: &str = "https://meta.fabricmc.net/v2";

pub struct FabricInstaller {
    http_client: reqwest::Client,
    launcher_dir: PathBuf,
}

impl FabricInstaller {
    pub fn new(launcher_dir: PathBuf) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();

        Self {
            http_client,
            launcher_dir,
        }
    }

    pub async fn get_loader_versions(&self) -> Result<Vec<FabricLoaderVersion>, Box<dyn std::error::Error>> {
        let url = format!("{}/versions/loader", FABRIC_META_URL);
        let response = self.http_client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(format!("Failed to fetch Fabric loader versions: HTTP {}", response.status()).into());
        }

        let versions: Vec<FabricLoaderVersion> = response.json().await?;
        Ok(versions)
    }

    pub async fn get_fabric_profile(
        &self,
        minecraft_version: &str,
        loader_version: &str,
    ) -> Result<FabricProfileJson, Box<dyn std::error::Error>> {
        let url = format!(
            "{}/versions/loader/{}/{}/profile/json",
            FABRIC_META_URL, minecraft_version, loader_version
        );

        println!("Fetching Fabric profile from: {}", url);
        let response = self.http_client.get(&url).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to fetch Fabric profile: HTTP {} - {}", status, error_text).into());
        }

        let text = response.text().await?;
        println!("Received Fabric profile response (first 500 chars): {}", &text[..text.len().min(500)]);
        
        let profile: FabricProfileJson = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse Fabric profile JSON: {}. Response was: {}", e, &text[..text.len().min(200)]))?;
        
        println!("Successfully parsed Fabric profile: {}", profile.id);
        Ok(profile)
    }

    pub async fn install_fabric(
        &self,
        minecraft_version: &str,
        loader_version: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        println!("=== Installing Fabric Loader {} for Minecraft {} ===", loader_version, minecraft_version);

        let profile = self.get_fabric_profile(minecraft_version, loader_version).await?;
        
        let fabric_id = profile.id.clone();
        let versions_dir = self.launcher_dir.join("versions").join(&fabric_id);
        let libraries_dir = self.launcher_dir.join("libraries");

        // Create directories
        fs::create_dir_all(&versions_dir)?;
        fs::create_dir_all(&libraries_dir)?;

        // Download Fabric libraries
        println!("Downloading {} Fabric libraries...", profile.libraries.len());
        let mut successful_downloads = 0;
        let mut failed_downloads = 0;
        
        for lib in &profile.libraries {
            let parts: Vec<&str> = lib.name.split(':').collect();
            if parts.len() != 3 {
                println!("  ✗ Skipping invalid library format: {}", lib.name);
                continue;
            }

            let (group, artifact, version) = (parts[0], parts[1], parts[2]);
            let group_path = group.replace('.', "/");
            let jar_name = format!("{}-{}.jar", artifact, version);
            let lib_path = libraries_dir.join(&group_path).join(artifact).join(version).join(&jar_name);

            // Construct the full URL
            let base_url = if lib.url.ends_with('/') {
                lib.url.trim_end_matches('/')
            } else {
                &lib.url
            };
            let url = format!("{}/{}/{}/{}/{}", base_url, group_path, artifact, version, jar_name);

            if !lib_path.exists() {
                if let Some(parent) = lib_path.parent() {
                    fs::create_dir_all(parent)?;
                }

                match self.http_client.get(&url).send().await {
                    Ok(response) if response.status().is_success() => {
                        match response.bytes().await {
                            Ok(bytes) => {
                                match fs::write(&lib_path, bytes) {
                                    Ok(_) => {
                                        successful_downloads += 1;
                                        println!("  ✓ Downloaded: {}", jar_name);
                                    }
                                    Err(e) => {
                                        failed_downloads += 1;
                                        println!("  ✗ Failed to write {}: {}", jar_name, e);
                                    }
                                }
                            }
                            Err(e) => {
                                failed_downloads += 1;
                                println!("  ✗ Failed to read response for {}: {}", jar_name, e);
                            }
                        }
                    }
                    Ok(response) => {
                        failed_downloads += 1;
                        println!("  ✗ Failed to download {}: HTTP {}", url, response.status());
                    }
                    Err(e) => {
                        failed_downloads += 1;
                        println!("  ✗ Failed to download {}: {}", url, e);
                    }
                }
            } else {
                println!("  → Already exists: {}", jar_name);
            }
        }

        println!("✓ Fabric libraries: {} downloaded, {} failed, {} total", 
                 successful_downloads, failed_downloads, profile.libraries.len());

        if failed_downloads > 0 {
            println!("Warning: Some libraries failed to download. The instance may not work correctly.");
        }

        // Save the profile JSON directly as received from Fabric
        let profile_path = versions_dir.join(format!("{}.json", fabric_id));
        let profile_json = serde_json::to_string_pretty(&profile)?;
        fs::write(&profile_path, profile_json)?;
        println!("✓ Created profile at: {}", profile_path.display());

        println!("=== Fabric Installation Complete ===");
        println!("Fabric ID: {}", fabric_id);
        Ok(fabric_id)
    }

    #[allow(dead_code)]
    pub fn check_fabric_installed(&self, minecraft_version: &str, loader_version: &str) -> bool {
        let fabric_id = format!("fabric-loader-{}-{}", loader_version, minecraft_version);
        let profile_path = self.launcher_dir
            .join("versions")
            .join(&fabric_id)
            .join(format!("{}.json", fabric_id));
        
        profile_path.exists()
    }
}