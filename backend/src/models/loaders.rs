use super::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FabricProfileJson {
    pub id: String,
    #[serde(rename = "inheritsFrom")]
    pub inherits_from: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub time: String,
    #[serde(rename = "type")]
    pub profile_type: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub arguments: Option<FabricArguments>,
    pub libraries: Vec<FabricProfileLibrary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FabricArguments {
    pub game: Vec<serde_json::Value>,
    #[serde(default)]
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FabricProfileLibrary {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FabricLoaderVersion {
    pub separator: String,
    pub build: u32,
    pub maven: String,
    pub version: String,
    pub stable: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ForgeVersion {
    pub minecraft_version: String,
    pub forge_version: String,
    pub full_version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ForgeProfileJson {
    pub id: String,
    #[serde(rename = "inheritsFrom")]
    pub inherits_from: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub time: String,
    #[serde(rename = "type")]
    pub profile_type: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub arguments: Option<ForgeArguments>,
    pub libraries: Vec<ForgeProfileLibrary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ForgeArguments {
    pub game: Vec<serde_json::Value>,
    #[serde(default)]
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ForgeProfileLibrary {
    pub name: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub downloads: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeoForgeVersion {
    pub minecraft_version: String,
    pub neoforge_version: String,
    pub full_version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeoForgeProfileJson {
    pub id: String,
    #[serde(rename = "inheritsFrom")]
    pub inherits_from: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub time: String,
    #[serde(rename = "type")]
    pub profile_type: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub arguments: Option<NeoForgeArguments>,
    pub libraries: Vec<NeoForgeProfileLibrary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeoForgeArguments {
    pub game: Vec<serde_json::Value>,
    #[serde(default)]
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeoForgeProfileLibrary {
    pub name: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub downloads: Option<serde_json::Value>,
}
