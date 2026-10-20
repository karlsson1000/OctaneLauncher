use super::*;

impl MinecraftInstaller {
    pub(super) fn ensure_launcher_profile(&self) -> Result<(), DownloadError> {
        crate::services::loader_common::ensure_launcher_profile(&self.launcher_dir)
            .map_err(|e| -> DownloadError { e.into() })
    }

    async fn download_file(
        &self,
        url: &str,
        path: &PathBuf,
        expected_sha1: Option<&str>,
    ) -> Result<(), DownloadError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let response = self.http_client.get(url).send().await?;

        if !response.status().is_success() {
            return Err(format!("HTTP {} downloading {}", response.status(), url).into());
        }

        let bytes = response.bytes().await?;
        Self::verify_sha1(&bytes, expected_sha1)
            .map_err(|e| format!("{}: {}", url, e))?;
        fs::write(path, bytes)?;

        Ok(())
    }

    fn verify_sha1(bytes: &[u8], expected_sha1: Option<&str>) -> Result<(), DownloadError> {
        let Some(expected) = expected_sha1.filter(|s| !s.is_empty()) else {
            return Ok(());
        };

        if crate::utils::hash::sha1_hex(bytes) != expected {
            return Err("SHA-1 checksum mismatch".into());
        }

        Ok(())
    }

    pub(super) fn file_needs_download(path: &PathBuf, expected_sha1: Option<&str>) -> bool {
        if !path.exists() {
            return true;
        }

        let Some(expected_sha1) = expected_sha1.filter(|s| !s.is_empty()) else {
            return false;
        };

        if let Ok(contents) = fs::read(path) {
            crate::utils::hash::sha1_hex(&contents) != expected_sha1
        } else {
            true
        }
    }

    pub(super) async fn download_file_with_sha1(
        &self,
        url: &str,
        path: &PathBuf,
        expected_sha1: &str,
    ) -> Result<bool, DownloadError> {
        if !Self::file_needs_download(path, Some(expected_sha1)) {
            return Ok(false);
        }

        self.download_file(url, path, Some(expected_sha1)).await?;
        Ok(true)
    }

    pub(super) async fn download_parallel(
        &self,
        tasks: Vec<(String, PathBuf, String)>,
    ) -> Result<usize, DownloadError> {
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_DOWNLOADS));
        let client = Arc::new(self.http_client.clone());
        let downloaded_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let mut handles = Vec::new();

        for (url, path, sha1) in tasks {
            let permit = semaphore.clone().acquire_owned().await?;
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

    async fn download_with_client(
        client: &reqwest::Client,
        url: &str,
        path: &PathBuf,
        expected_sha1: &str,
    ) -> Result<bool, DownloadError> {
        if !Self::file_needs_download(path, Some(expected_sha1)) {
            return Ok(false);
        }

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        let response = client.get(url).send().await?;
        
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()).into());
        }
        
        let bytes = response.bytes().await?;
        Self::verify_sha1(&bytes, Some(expected_sha1))
            .map_err(|e| format!("{}: {}", url, e))?;
        fs::write(path, bytes)?;

        Ok(true)
    }
}
