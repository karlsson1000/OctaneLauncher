use crate::models::ImportableInstance;
use crate::services::fabric::FabricInstaller;
use crate::services::forge::ForgeInstaller;
use crate::services::instance::InstanceManager;
use crate::services::installer::MinecraftInstaller;
use crate::services::neoforge::NeoForgeInstaller;
use crate::utils::*;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Emitter;
use zip::ZipArchive;

#[derive(Clone)]
struct ModrinthAppEntry {
    name: Option<String>,
    game_version: String,
    loader: Option<String>,
    loader_version: Option<String>,
    icon_path: Option<String>,
}

pub struct InstanceImporter;

mod infer;
mod install;
mod modrinth_db;
mod parse;
mod scan;
