use crate::models::*;
use crate::utils::{get_current_os, library_maven_path, library_maven_url};
use std::{fs, path::PathBuf};

const VERSION_MANIFEST_URL: &str = "https://launchermeta.mojang.com/mc/game/version_manifest.json";
const MAX_CONCURRENT_DOWNLOADS: usize = 32;

type DownloadError = Box<dyn std::error::Error + Send + Sync>;

pub struct MinecraftInstaller {
    http_client: reqwest::Client,
    launcher_dir: PathBuf,
}

impl MinecraftInstaller {
    pub fn new(launcher_dir: PathBuf) -> Result<Self, DownloadError> {
        Ok(Self {
            http_client: crate::utils::http::get_client(),
            launcher_dir,
        })
    }
}

mod install;
mod rules;
mod versions;

pub use rules::*;
