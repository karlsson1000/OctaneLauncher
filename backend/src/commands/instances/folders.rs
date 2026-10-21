use super::*;

#[tauri::command]
pub fn open_instance_folder(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;

    let instance_dir = get_instance_dir(&safe_name);

    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }

    open_folder(instance_dir).map_err(|e| e.to_string())
}
