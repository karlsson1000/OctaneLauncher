use crate::models::Instance;
use crate::services::instance::InstanceManager;
use crate::services::installer::MinecraftInstaller;
use crate::services::fabric::FabricInstaller;
use crate::utils::modrinth::ModrinthClient;
use crate::utils::*;
use crate::commands::validation::{sanitize_instance_name, sanitize_mod_filename, validate_download_url};
use crate::utils::curseforge::CurseforgeClient;
use tauri::Emitter;

pub(crate) mod common;
mod installers;
mod local;
mod modrinth;

pub use local::*;
pub use modrinth::*;
