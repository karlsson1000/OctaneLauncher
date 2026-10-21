use super::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LauncherSettings {
    pub java_path: Option<String>,
    #[serde(default = "default_memory")]
    pub memory_mb: u32,
    #[serde(default = "default_auto_navigate_to_console")]
    pub auto_navigate_to_console: bool,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_tab")]
    pub default_tab: String,
    #[serde(default)]
    pub cat_mode: bool,
    #[serde(default)]
    pub java_args: Option<String>,
    #[serde(default = "default_discord_rpc")]
    pub discord_rpc: bool,
    #[serde(default = "default_background_darkness")]
    pub background_darkness: u8,
    #[serde(default = "default_background_blur")]
    pub background_blur: u8,
}

fn default_memory() -> u32 { 4096 }
fn default_auto_navigate_to_console() -> bool { true }
fn default_discord_rpc() -> bool { true }
fn default_background_darkness() -> u8 { 80 }
fn default_background_blur() -> u8 { 0 }
fn default_theme() -> String { "octane".to_string() }
fn default_tab() -> String { "home".to_string() }

impl Default for LauncherSettings {
    fn default() -> Self {
        Self {
            java_path: None,
            memory_mb: 4096,
            auto_navigate_to_console: true,
            theme: default_theme(),
            default_tab: default_tab(),
            cat_mode: false,
            java_args: None,
            discord_rpc: true,
            background_darkness: 80,
            background_blur: 0,
        }
    }
}
