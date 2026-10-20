use crate::commands::validation::sanitize_instance_name;
use crate::models::Instance;
use crate::utils::*;
use std::io::Write;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

mod archive;
mod mrpack;

use archive::export_as_zip;
use mrpack::export_as_mrpack;

#[tauri::command]
pub async fn export_instance(
    instance_name: String,
    output_path: String,
    export_format: String,
    include_worlds: bool,
    include_resource_packs: bool,
    include_shader_packs: bool,
    include_mods: bool,
    include_config: bool,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let instance_dir = get_instance_dir(&safe_name);

    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }

    let output_path_obj = std::path::Path::new(&output_path);
    if let Some(parent) = output_path_obj.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create output directory: {}", e))?;
        }
    }

    let file = std::fs::File::create(&output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;

    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o755);

    if export_format == "mrpack" {
        export_as_mrpack(
            &mut zip,
            &safe_name,
            &instance_dir,
            options,
            include_worlds,
            include_resource_packs,
            include_shader_packs,
            include_mods,
            include_config,
        )
        .await?;
    } else {
        export_as_zip(
            &mut zip,
            &instance_dir,
            options,
            include_worlds,
            include_resource_packs,
            include_shader_packs,
            include_mods,
            include_config,
        )?;
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(())
}
