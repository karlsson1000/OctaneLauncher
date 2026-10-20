use crate::services::accounts::AccountManager;
use crate::models::AppConfig;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const MINECRAFT_SKIN_URL: &str = "https://api.minecraftservices.com/minecraft/profile/skins";
const MINECRAFT_SKIN_RESET_URL: &str = "https://api.minecraftservices.com/minecraft/profile/skins/active";
const MINECRAFT_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";
const MINECRAFT_SESSION_URL: &str = "https://sessionserver.mojang.com/session/minecraft/profile";

#[derive(Deserialize, Debug)]
struct ProfileResponse {
    id: String,
    skins: Vec<SkinInfo>,
    capes: Option<Vec<CapeInfo>>,
}

#[derive(Deserialize, Debug)]
struct SkinInfo {
    state: String,
    url: String,
    variant: String,
}

#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct CapeInfo {
    pub id: String,
    pub state: String,
    pub url: String,
    pub alias: String,
}

#[derive(Serialize)]
pub struct CurrentSkin {
    pub url: String,
    pub variant: String,
    pub cape_url: Option<String>,
}

#[derive(Serialize)]
pub struct UserCapesResponse {
    pub capes: Vec<CapeInfo>,
}

#[derive(Deserialize, Debug)]
struct SessionProfileResponse {
    properties: Vec<ProfileProperty>,
}

#[derive(Deserialize, Debug)]
struct ProfileProperty {
    name: String,
    value: String,
}

#[derive(Deserialize, Debug)]
struct TexturesData {
    textures: Textures,
}

#[derive(Deserialize, Debug)]
struct Textures {
    #[serde(rename = "SKIN")]
    skin: Option<SkinTexture>,
    #[serde(rename = "CAPE")]
    cape: Option<CapeTexture>,
}

#[derive(Deserialize, Debug)]
struct SkinTexture {
    url: String,
    metadata: Option<SkinMetadata>,
}

#[derive(Deserialize, Debug)]
struct SkinMetadata {
    model: Option<String>,
}

#[derive(Deserialize, Debug)]
struct CapeTexture {
    url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RecentSkin {
    pub url: String,
    pub variant: String,
    pub timestamp: u64,
}

mod capes;
mod profile;
mod recent;
mod upload;

pub use capes::*;
pub use profile::*;
pub use recent::*;
pub use upload::*;
