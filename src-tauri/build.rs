fn main() {
    let env_path = std::path::Path::new("../.env");
    
    if env_path.exists() {
        if let Ok(_) = dotenvy::from_path(env_path) {
            if let Ok(client_id) = std::env::var("MICROSOFT_CLIENT_ID") {
                println!("cargo:rustc-env=MICROSOFT_CLIENT_ID={}", client_id);
            }
        }
    }
    
    tauri_build::build()
}