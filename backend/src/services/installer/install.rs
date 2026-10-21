use super::*;
use crate::utils::download::{
    download_if_needed, download_many, is_file_valid, write_bytes_atomic, DownloadTask,
};

impl MinecraftInstaller {
    pub async fn install_version(&self, version_id: &str) -> Result<(), DownloadError> {
        crate::services::loader_common::ensure_launcher_profile(&self.launcher_dir)?;

        let manifest_response = self.http_client.get(VERSION_MANIFEST_URL).send().await?;
        let manifest: VersionManifest = manifest_response.json().await?;

        let version_info = manifest
            .versions
            .iter()
            .find(|v| v.id == version_id)
            .ok_or_else(|| format!("Version {} not found", version_id))?;

        let version_details: VersionDetails = self
            .http_client
            .get(&version_info.url)
            .send()
            .await?
            .json()
            .await?;

        let versions_dir = self.launcher_dir.join("versions").join(version_id);
        let libraries_dir = self.launcher_dir.join("libraries");
        let assets_dir = self.launcher_dir.join("assets");
        let objects_dir = assets_dir.join("objects");

        fs::create_dir_all(&versions_dir)?;
        fs::create_dir_all(&libraries_dir)?;
        fs::create_dir_all(&objects_dir)?;

        let jar_path = versions_dir.join(format!("{}.jar", version_id));
        download_if_needed(
            &version_details.downloads.client.url,
            &jar_path,
            Some(&version_details.downloads.client.sha1),
            Some(version_details.downloads.client.size),
        )
        .await?;

        let json_path = versions_dir.join(format!("{}.json", version_id));
        let json_content = serde_json::to_string_pretty(&version_details)?;
        write_bytes_atomic(&json_path, json_content.as_bytes())?;

        let current_os = get_current_os();
        let mut library_tasks = Vec::new();
        let mut native_count = 0;

        for library in &version_details.libraries {
            let is_native_name = library.name.contains(":natives-");
            let should_include = if let Some(rules) = &library.rules {
                should_include_library(rules, &current_os)
            } else {
                true
            };

            if !should_include {
                continue;
            }

            if is_native_name {
                let platform_suffix = if library.name.contains(":natives-windows") {
                    "windows"
                } else if library.name.contains(":natives-linux") {
                    "linux"
                } else {
                    ""
                };

                if platform_suffix == current_os {
                    let mut queued_from_artifact = false;
                    if let Some(downloads) = &library.downloads {
                        if let Some(artifact) = &downloads.artifact {
                            queued_from_artifact = true;
                            native_count += 1;
                            library_tasks.push(
                                DownloadTask::new(
                                    &artifact.url,
                                    libraries_dir.join(&artifact.path),
                                )
                                .with_sha1(&artifact.sha1)
                                .with_size(artifact.size),
                            );
                        }
                    }
                    if !queued_from_artifact {
                        let path = library_maven_path(&libraries_dir, &library.name);
                        if !is_file_valid(&path, None, None) {
                            let url = library_maven_url(&library.name);
                            if !url.is_empty() {
                                native_count += 1;
                                library_tasks.push(DownloadTask::new(&url, path));
                            }
                        }
                    }
                }
                continue;
            }

            if let Some(downloads) = &library.downloads {
                if let Some(classifiers) = &downloads.classifiers {
                    for (key, artifact) in classifiers {
                        let platform_suffix = if key.contains("natives-windows") {
                            "windows"
                        } else if key.contains("natives-linux") {
                            "linux"
                        } else {
                            continue;
                        };

                        if platform_suffix != current_os {
                            continue;
                        }

                        native_count += 1;
                        library_tasks.push(
                            DownloadTask::new(&artifact.url, libraries_dir.join(&artifact.path))
                                .with_sha1(&artifact.sha1)
                                .with_size(artifact.size),
                        );
                    }
                }

                if let Some(artifact) = &downloads.artifact {
                    library_tasks.push(
                        DownloadTask::new(&artifact.url, libraries_dir.join(&artifact.path))
                            .with_sha1(&artifact.sha1)
                            .with_size(artifact.size),
                    );
                } else {
                    let path = library_maven_path(&libraries_dir, &library.name);
                    if !is_file_valid(&path, None, None) {
                        let url = library_maven_url(&library.name);
                        if !url.is_empty() {
                            library_tasks.push(DownloadTask::new(&url, path));
                        }
                    }
                }
            } else {
                let path = library_maven_path(&libraries_dir, &library.name);
                if !is_file_valid(&path, None, None) {
                    let url = library_maven_url(&library.name);
                    if !url.is_empty() {
                        library_tasks.push(DownloadTask::new(&url, path));
                    }
                }
            }
        }

        if native_count == 0 {
            return Err(format!("No native libraries found for {}", current_os).into());
        }

        download_many(library_tasks, MAX_CONCURRENT_DOWNLOADS).await?;

        let asset_index_path = assets_dir
            .join("indexes")
            .join(format!("{}.json", version_details.asset_index.id));
        fs::create_dir_all(
            asset_index_path.parent().ok_or_else(|| {
                format!("Invalid asset index path: {}", asset_index_path.display())
            })?,
        )?;

        download_if_needed(
            &version_details.asset_index.url,
            &asset_index_path,
            Some(&version_details.asset_index.sha1),
            Some(version_details.asset_index.size),
        )
        .await?;

        let asset_index_data: AssetIndexData =
            serde_json::from_str(&fs::read_to_string(&asset_index_path)?)?;

        let mut asset_tasks = Vec::new();
        for (_, asset) in asset_index_data.objects {
            let hash_prefix = asset
                .hash
                .get(0..2)
                .ok_or_else(|| format!("Invalid asset hash: {}", asset.hash))?
                .to_string();
            let asset_path = objects_dir.join(&hash_prefix).join(&asset.hash);
            let asset_url = format!(
                "https://resources.download.minecraft.net/{}/{}",
                hash_prefix, asset.hash
            );

            asset_tasks.push(
                DownloadTask::new(&asset_url, asset_path)
                    .with_sha1(&asset.hash)
                    .with_size(asset.size),
            );
        }

        download_many(asset_tasks, MAX_CONCURRENT_DOWNLOADS).await?;

        Ok(())
    }
}
