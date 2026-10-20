use std::path::{Path, PathBuf};

pub const LIBRARY_BASE_URL: &str = "https://libraries.minecraft.net/";

pub fn library_maven_path(libraries_dir: &Path, name: &str) -> PathBuf {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return libraries_dir.join("unknown.jar");
    }
    let (group, artifact, version_raw) = (parts[0], parts[1], parts[2]);
    let version = version_raw.split('@').next().unwrap_or(version_raw);
    let classifier_raw = if parts.len() >= 4 { parts[3] } else { "" };
    let classifier = classifier_raw.split('@').next().unwrap_or("");
    let classifier = if classifier.is_empty() { None } else { Some(classifier) };
    let group_path = group.replace('.', "/");
    let jar_name = if let Some(cls) = classifier {
        format!("{}-{}-{}.jar", artifact, version, cls)
    } else {
        format!("{}-{}.jar", artifact, version)
    };
    libraries_dir.join(&group_path).join(artifact).join(version).join(&jar_name)
}

pub fn library_maven_url(name: &str) -> String {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return String::new();
    }
    let (group, artifact, version_raw) = (parts[0], parts[1], parts[2]);
    let version = version_raw.split('@').next().unwrap_or(version_raw);
    let classifier_raw = if parts.len() >= 4 { parts[3] } else { "" };
    let classifier = classifier_raw.split('@').next().unwrap_or("");
    let classifier = if classifier.is_empty() { None } else { Some(classifier) };
    let group_path = group.replace('.', "/");
    let jar_name = if let Some(cls) = classifier {
        format!("{}-{}-{}.jar", artifact, version, cls)
    } else {
        format!("{}-{}.jar", artifact, version)
    };
    format!("{}{}/{}/{}/{}", LIBRARY_BASE_URL, group_path, artifact, version, jar_name)
}

pub fn get_current_os() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();

    #[cfg(target_os = "linux")]
    return "linux".to_string();
}

pub fn get_launcher_dir() -> PathBuf {
    let home = dirs::home_dir().expect("Could not find home directory");

    #[cfg(target_os = "windows")]
    let launcher_dir = home.join("AppData").join("Roaming").join("Octane Launcher");

    #[cfg(target_os = "linux")]
    let launcher_dir = home.join(".octane-launcher");

    launcher_dir
}

pub fn get_meta_dir() -> PathBuf {
    get_launcher_dir().join("meta")
}

pub fn get_instances_dir() -> PathBuf {
    get_launcher_dir().join("instances")
}

pub fn get_instance_dir(instance_name: &str) -> PathBuf {
    get_instances_dir().join(instance_name)
}

pub fn get_trash_dir() -> PathBuf {
    get_launcher_dir().join("trash")
}

pub fn get_trash_index_path() -> PathBuf {
    get_trash_dir().join("trash_index.json")
}

pub fn get_saved_options_path() -> PathBuf {
    get_launcher_dir().join("saved-options.txt")
}
