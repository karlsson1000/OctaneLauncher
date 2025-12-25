use crate::models::LauncherSettings;
use crate::utils::get_launcher_dir;
use std::fs;

pub struct SettingsManager;

impl SettingsManager {
    fn get_settings_path() -> std::path::PathBuf {
        get_launcher_dir().join("settings.json")
    }

    pub fn load() -> Result<LauncherSettings, Box<dyn std::error::Error>> {
        let settings_path = Self::get_settings_path();
        
        if !settings_path.exists() {
            let default_settings = LauncherSettings::default();
            Self::save(&default_settings)?;
            return Ok(default_settings);
        }

        let content = fs::read_to_string(&settings_path)?;
        let settings: LauncherSettings = serde_json::from_str(&content)?;
        Ok(settings)
    }

    pub fn save(settings: &LauncherSettings) -> Result<(), Box<dyn std::error::Error>> {
        let settings_path = Self::get_settings_path();
        
        if let Some(parent) = settings_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let json = serde_json::to_string_pretty(settings)?;
        fs::write(&settings_path, json)?;
        
        Ok(())
    }
}