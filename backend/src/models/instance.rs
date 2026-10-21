use super::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Instance {
    pub name: String,
    pub version: String,
    pub created_at: String,
    pub last_played: Option<String>,
    pub loader: Option<String>,
    pub loader_version: Option<String>,
    pub settings_override: Option<LauncherSettings>,
    #[serde(default)]
    pub icon_path: Option<String>,
    #[serde(default)]
    pub total_playtime_seconds: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportableInstance {
    pub source: String,
    pub name: String,
    pub path: String,
    pub mc_version: Option<String>,
    pub loader: Option<String>,
    pub loader_version: Option<String>,
    pub size_bytes: u64,
    #[serde(default)]
    pub icon_path: Option<String>,
}
