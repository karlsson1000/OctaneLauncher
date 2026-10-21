use super::*;
use base64::{engine::general_purpose, Engine as _};

#[tauri::command]
pub async fn set_instance_icon(
    instance_name: String,
    image_data: String,
) -> Result<Option<String>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    
    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }
    
    let image_bytes = general_purpose::STANDARD
        .decode(&image_data)
        .map_err(|e| e.to_string())?;
    
    if image_bytes.len() > 25 * 1024 * 1024 {
        return Err("Image too large (max 25MB)".to_string());
    }
    
    let format = image::guess_format(&image_bytes)
        .map_err(|e| e.to_string())?;
    
    match format {
        image::ImageFormat::Png | 
        image::ImageFormat::Jpeg | 
        image::ImageFormat::WebP |
        image::ImageFormat::Gif => {},
        _ => return Err("Unsupported image format. Use PNG, JPEG, WebP, or GIF".to_string()),
    }

    let (icon_file_name, icon_path) = if format == image::ImageFormat::Gif {
        let icon_path = instance_dir.join("icon.gif");
        std::fs::write(&icon_path, &image_bytes)
            .map_err(|e| e.to_string())?;
        let stale_png = instance_dir.join("icon.png");
        if stale_png.exists() {
            let _ = std::fs::remove_file(&stale_png);
        }
        ("icon.gif", icon_path)
    } else {
        let img = image::load_from_memory(&image_bytes)
            .map_err(|e| e.to_string())?;

        let resized = img.resize_exact(256, 256, image::imageops::FilterType::Lanczos3);

        let icon_path = instance_dir.join("icon.png");
        resized.save(&icon_path)
            .map_err(|e| e.to_string())?;
        let stale_gif = instance_dir.join("icon.gif");
        if stale_gif.exists() {
            let _ = std::fs::remove_file(&stale_gif);
        }
        ("icon.png", icon_path)
    };
    
    let instance_json = instance_dir.join("instance.json");
    let content = std::fs::read_to_string(&instance_json)
        .map_err(|e| e.to_string())?;
    
    let mut instance: Instance = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;
    
    instance.icon_path = Some(icon_file_name.to_string());
    
    let updated_json = serde_json::to_string_pretty(&instance)
        .map_err(|e| e.to_string())?;

    std::fs::write(&instance_json, updated_json)
        .map_err(|e| e.to_string())?;

    Ok(Some(icon_path.to_string_lossy().into_owned()))
}

#[tauri::command]
pub async fn remove_instance_icon(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    
    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }
    
    let icon_png = instance_dir.join("icon.png");
    if icon_png.exists() {
        std::fs::remove_file(&icon_png)
            .map_err(|e| e.to_string())?;
    }

    let icon_gif = instance_dir.join("icon.gif");
    if icon_gif.exists() {
        std::fs::remove_file(&icon_gif)
            .map_err(|e| e.to_string())?;
    }
    
    let instance_json = instance_dir.join("instance.json");
    let content = std::fs::read_to_string(&instance_json)
        .map_err(|e| e.to_string())?;
    
    let mut instance: Instance = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;
    
    instance.icon_path = None;
    
    let updated_json = serde_json::to_string_pretty(&instance)
        .map_err(|e| e.to_string())?;
    
    std::fs::write(&instance_json, updated_json)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
