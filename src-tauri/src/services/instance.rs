use crate::models::Instance;
use crate::utils::*;
use chrono::Utc;
use std::fs;

pub struct InstanceManager;

impl InstanceManager {
    pub fn create(
        instance_name: &str,
        version: &str,
        loader: Option<String>,
        loader_version: Option<String>,
    ) -> Result<Instance, Box<dyn std::error::Error>> {
        let instance_dir = get_instance_dir(instance_name);

        if instance_dir.exists() {
            return Err(format!("Instance '{}' already exists!", instance_name).into());
        }

        fs::create_dir_all(&instance_dir)?;
        fs::create_dir_all(instance_dir.join("saves"))?;
        fs::create_dir_all(instance_dir.join("resourcepacks"))?;
        fs::create_dir_all(instance_dir.join("shaderpacks"))?;
        fs::create_dir_all(instance_dir.join("mods"))?;
        fs::create_dir_all(instance_dir.join("logs"))?;

        let instance = Instance {
            name: instance_name.to_string(),
            version: version.to_string(),
            created_at: Utc::now().to_rfc3339(),
            last_played: None,
            loader,
            loader_version,
            settings_override: None,
            icon_path: None,
            total_playtime_seconds: 0,
        };

        let instance_json = serde_json::to_string_pretty(&instance)?;
        fs::write(instance_dir.join("instance.json"), instance_json)?;

        Ok(instance)
    }

    pub fn get_all() -> Result<Vec<Instance>, Box<dyn std::error::Error>> {
        let instances_dir = get_instances_dir();

        if !instances_dir.exists() {
            return Ok(Vec::new());
        }

        let mut instances = Vec::new();

        let entries = fs::read_dir(&instances_dir)?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    let instance_json = path.join("instance.json");
                    if instance_json.exists() {
                        if let Ok(content) = fs::read_to_string(instance_json) {
                            if let Ok(instance) = serde_json::from_str::<Instance>(&content) {
                                instances.push(instance);
                            }
                        }
                    }
                }
            }
        }

        Ok(instances)
    }

    pub fn delete(instance_name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let instance_dir = get_instance_dir(instance_name);

        if !instance_dir.exists() {
            return Err(format!("Instance '{}' does not exist", instance_name).into());
        }

        fs::remove_dir_all(&instance_dir)?;

        Ok(())
    }

    #[allow(dead_code)]
    pub fn rename(old_name: &str, new_name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let old_dir = get_instance_dir(old_name);
        let new_dir = get_instance_dir(new_name);

        if !old_dir.exists() {
            return Err(format!("Instance '{}' does not exist", old_name).into());
        }

        if new_dir.exists() {
            return Err(format!("Instance '{}' already exists", new_name).into());
        }

        fs::rename(&old_dir, &new_dir)?;

        let instance_json = new_dir.join("instance.json");
        let mut instance: Instance = serde_json::from_str(&fs::read_to_string(&instance_json)?)?;

        instance.name = new_name.to_string();

        let updated_json = serde_json::to_string_pretty(&instance)?;
        fs::write(instance_json, updated_json)?;

        Ok(())
    }
}
