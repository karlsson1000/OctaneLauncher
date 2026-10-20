use sha1::{Digest, Sha1};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::AsyncWriteExt;
use tokio::sync::Semaphore;

const MAX_ATTEMPTS: usize = 4;
const RETRY_BASE_DELAY_MS: u64 = 400;
const RETRY_MAX_DELAY_MS: u64 = 5_000;

#[derive(Debug, Clone)]
pub struct DownloadTask {
    pub url: String,
    pub path: PathBuf,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

impl DownloadTask {
    pub fn new(url: &str, path: impl Into<PathBuf>) -> Self {
        Self {
            url: url.to_string(),
            path: path.into(),
            sha1: None,
            size: None,
        }
    }

    pub fn with_sha1(mut self, sha1: &str) -> Self {
        if !sha1.is_empty() {
            self.sha1 = Some(sha1.to_ascii_lowercase());
        }
        self
    }

    pub fn with_size(mut self, size: u64) -> Self {
        if size > 0 {
            self.size = Some(size);
        }
        self
    }
}

enum FetchError {
    Retryable(String),
    Fatal(String),
}

impl FetchError {
    fn into_message(self) -> String {
        match self {
            Self::Retryable(message) | Self::Fatal(message) => message,
        }
    }
}

struct StreamedFile {
    sha1: String,
    len: u64,
    looks_like_zip: bool,
}

pub fn is_file_valid(path: &Path, expected_sha1: Option<&str>, expected_size: Option<u64>) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };

    if !metadata.is_file() || metadata.len() == 0 {
        return false;
    }

    if let Some(expected) = expected_size.filter(|size| *size > 0) {
        if metadata.len() != expected {
            return false;
        }
    }

    if let Some(expected) = expected_sha1.filter(|sha1| !sha1.is_empty()) {
        let Ok(contents) = std::fs::read(path) else {
            return false;
        };
        return crate::utils::hash::sha1_hex(&contents) == expected.to_ascii_lowercase();
    }

    if is_jar_path(path) && !has_zip_magic(path) {
        return false;
    }

    true
}

pub fn has_zip_magic_bytes(bytes: &[u8]) -> bool {
    bytes.len() >= 2 && bytes[0] == b'P' && bytes[1] == b'K'
}

pub fn write_bytes_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let temp_path = temp_path_for(path);
    let result = (|| {
        let mut file = std::fs::File::create(&temp_path)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&temp_path, path)
    })();

    if result.is_err() {
        let _ = std::fs::remove_file(&temp_path);
    }

    result
}

pub async fn download_if_needed(
    url: &str,
    destination: &Path,
    expected_sha1: Option<&str>,
    expected_size: Option<u64>,
) -> Result<bool, String> {
    if is_file_valid(destination, expected_sha1, expected_size) {
        return Ok(false);
    }

    download_with_retry(url, destination, expected_sha1, expected_size).await?;
    Ok(true)
}

pub async fn download_file_verified(
    url: &str,
    destination: &Path,
    expected_sha1: Option<&str>,
) -> Result<(), String> {
    download_with_retry(url, destination, expected_sha1, None).await
}

pub async fn download_many(
    tasks: Vec<DownloadTask>,
    max_concurrent: usize,
) -> Result<usize, String> {
    if tasks.is_empty() {
        return Ok(0);
    }

    let semaphore = Arc::new(Semaphore::new(max_concurrent.max(1)));
    let mut handles = Vec::with_capacity(tasks.len());

    for task in tasks {
        let semaphore = semaphore.clone();
        handles.push(tokio::spawn(async move {
            let permit = semaphore
                .acquire_owned()
                .await
                .map_err(|e| format!("Download queue closed: {}", e))?;
            let result =
                download_if_needed(&task.url, &task.path, task.sha1.as_deref(), task.size).await;
            drop(permit);
            result.map_err(|e| format!("{} ({})", e, task.url))
        }));
    }

    let mut downloaded = 0usize;
    let mut errors = Vec::new();

    for handle in handles {
        match handle.await {
            Ok(Ok(true)) => downloaded += 1,
            Ok(Ok(false)) => {}
            Ok(Err(message)) => errors.push(message),
            Err(error) => errors.push(format!("Download task failed: {}", error)),
        }
    }

    if errors.is_empty() {
        return Ok(downloaded);
    }

    let shown: Vec<String> = errors.iter().take(8).cloned().collect();
    let mut message = format!(
        "{} download(s) failed:\n  {}",
        errors.len(),
        shown.join("\n  ")
    );
    if errors.len() > shown.len() {
        message.push_str(&format!("\n  ... and {} more", errors.len() - shown.len()));
    }

    Err(message)
}

async fn download_with_retry(
    url: &str,
    destination: &Path,
    expected_sha1: Option<&str>,
    expected_size: Option<u64>,
) -> Result<(), String> {
    let mut last_error = String::new();

    for attempt in 0..MAX_ATTEMPTS {
        if attempt > 0 {
            tokio::time::sleep(retry_delay(attempt)).await;
        }

        match fetch_once(url, destination, expected_sha1, expected_size).await {
            Ok(()) => return Ok(()),
            Err(FetchError::Fatal(message)) => return Err(message),
            Err(error) => {
                last_error = error.into_message();
                if attempt + 1 < MAX_ATTEMPTS {
                    eprintln!(
                        "[download] attempt {}/{} failed for {}: {}",
                        attempt + 1,
                        MAX_ATTEMPTS,
                        url,
                        last_error
                    );
                }
            }
        }
    }

    Err(format!(
        "Download failed after {} attempts: {}",
        MAX_ATTEMPTS, last_error
    ))
}

async fn fetch_once(
    url: &str,
    destination: &Path,
    expected_sha1: Option<&str>,
    expected_size: Option<u64>,
) -> Result<(), FetchError> {
    let client = crate::utils::http::get_client();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| FetchError::Retryable(format!("Request failed for {}: {}", url, e)))?;

    let status = response.status();
    if !status.is_success() {
        let message = format!("HTTP {} for {}", status, url);
        return Err(if is_retryable_status(status) {
            FetchError::Retryable(message)
        } else {
            FetchError::Fatal(message)
        });
    }

    let parent = destination.parent().ok_or_else(|| {
        FetchError::Fatal(format!(
            "Invalid download destination: {}",
            destination.display()
        ))
    })?;
    tokio::fs::create_dir_all(parent)
        .await
        .map_err(|e| FetchError::Fatal(format!("Failed to create {}: {}", parent.display(), e)))?;

    let temp_path = temp_path_for(destination);
    let streamed = match stream_to_file(response, &temp_path).await {
        Ok(streamed) => streamed,
        Err(error) => {
            remove_temp_file(&temp_path).await;
            return Err(error);
        }
    };

    if let Some(expected) = expected_sha1.filter(|sha1| !sha1.is_empty()) {
        if streamed.sha1 != expected.to_ascii_lowercase() {
            remove_temp_file(&temp_path).await;
            return Err(FetchError::Retryable(format!(
                "SHA-1 mismatch for {}: expected {}, got {}",
                url, expected, streamed.sha1
            )));
        }
    } else if is_jar_path(destination) && !streamed.looks_like_zip {
        remove_temp_file(&temp_path).await;
        return Err(FetchError::Retryable(format!(
            "Downloaded file is not a valid jar ({} bytes): {}",
            streamed.len, url
        )));
    }

    if let Some(expected) = expected_size.filter(|size| *size > 0) {
        if streamed.len != expected {
            remove_temp_file(&temp_path).await;
            return Err(FetchError::Retryable(format!(
                "Size mismatch for {}: expected {}, got {}",
                url, expected, streamed.len
            )));
        }
    }

    if let Err(error) = tokio::fs::rename(&temp_path, destination).await {
        remove_temp_file(&temp_path).await;
        return Err(FetchError::Fatal(format!(
            "Failed to finalize download of {}: {}",
            url, error
        )));
    }

    Ok(())
}

async fn stream_to_file(
    mut response: reqwest::Response,
    temp_path: &Path,
) -> Result<StreamedFile, FetchError> {
    let mut hasher = Sha1::new();
    let mut file = tokio::fs::File::create(temp_path)
        .await
        .map_err(|e| FetchError::Fatal(format!("Failed to create temporary file: {}", e)))?;

    let mut len: u64 = 0;
    let mut prefix = [0u8; 4];
    let mut prefix_len = 0usize;

    loop {
        let chunk = response
            .chunk()
            .await
            .map_err(|e| FetchError::Retryable(format!("Download interrupted: {}", e)))?;
        let Some(chunk) = chunk else {
            break;
        };

        if prefix_len < prefix.len() {
            let take = (prefix.len() - prefix_len).min(chunk.len());
            prefix[prefix_len..prefix_len + take].copy_from_slice(&chunk[..take]);
            prefix_len += take;
        }

        hasher.update(&chunk);
        len += chunk.len() as u64;
        file.write_all(&chunk)
            .await
            .map_err(|e| FetchError::Fatal(format!("Failed to write download: {}", e)))?;
    }

    file.flush()
        .await
        .map_err(|e| FetchError::Fatal(format!("Failed to flush download: {}", e)))?;
    drop(file);

    Ok(StreamedFile {
        sha1: format!("{:x}", hasher.finalize()),
        len,
        looks_like_zip: prefix_len >= 2 && prefix[0] == b'P' && prefix[1] == b'K',
    })
}

fn is_retryable_status(status: reqwest::StatusCode) -> bool {
    status.as_u16() == 408
        || status.as_u16() == 425
        || status.as_u16() == 429
        || status.is_server_error()
}

fn retry_delay(attempt: usize) -> Duration {
    let exponent = (attempt.saturating_sub(1)).min(6) as u32;
    let base = RETRY_BASE_DELAY_MS
        .saturating_mul(1u64 << exponent)
        .min(RETRY_MAX_DELAY_MS);
    let jitter = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| (duration.subsec_nanos() as u64) % 250)
        .unwrap_or(0);
    Duration::from_millis(base + jitter)
}

fn is_jar_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("jar"))
        .unwrap_or(false)
}

fn has_zip_magic(path: &Path) -> bool {
    use std::io::Read;

    let Ok(mut file) = std::fs::File::open(path) else {
        return false;
    };

    let mut prefix = [0u8; 2];
    file.read_exact(&mut prefix).is_ok() && has_zip_magic_bytes(&prefix)
}

fn temp_path_for(destination: &Path) -> PathBuf {
    let file_name = destination
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "download".to_string());

    destination.with_file_name(format!(
        "{}.{}.part",
        file_name,
        uuid::Uuid::new_v4().simple()
    ))
}

async fn remove_temp_file(path: &Path) {
    let _ = tokio::fs::remove_file(path).await;
}
