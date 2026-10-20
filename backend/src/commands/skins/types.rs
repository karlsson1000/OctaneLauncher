use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
pub(super) struct ProfileResponse {
    pub(super) id: String,
    pub(super) skins: Vec<SkinInfo>,
    pub(super) capes: Option<Vec<CapeInfo>>,
}

#[derive(Deserialize, Debug)]
pub(super) struct SkinInfo {
    pub(super) state: String,
    pub(super) url: String,
    pub(super) variant: String,
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
pub(super) struct SessionProfileResponse {
    pub(super) properties: Vec<ProfileProperty>,
}

#[derive(Deserialize, Debug)]
pub(super) struct ProfileProperty {
    pub(super) name: String,
    pub(super) value: String,
}

#[derive(Deserialize, Debug)]
pub(super) struct TexturesData {
    pub(super) textures: Textures,
}

#[derive(Deserialize, Debug)]
pub(super) struct Textures {
    #[serde(rename = "SKIN")]
    pub(super) skin: Option<SkinTexture>,
    #[serde(rename = "CAPE")]
    pub(super) cape: Option<CapeTexture>,
}

#[derive(Deserialize, Debug)]
pub(super) struct SkinTexture {
    pub(super) url: String,
    pub(super) metadata: Option<SkinMetadata>,
}

#[derive(Deserialize, Debug)]
pub(super) struct SkinMetadata {
    pub(super) model: Option<String>,
}

#[derive(Deserialize, Debug)]
pub(super) struct CapeTexture {
    pub(super) url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RecentSkin {
    pub url: String,
    pub variant: String,
    pub timestamp: u64,
}
