fn main() {
    let env_path = std::path::Path::new("../.env");
    
    if env_path.exists() {
        if let Ok(_) = dotenvy::from_path(env_path) {
            if let Ok(client_id) = std::env::var("MICROSOFT_CLIENT_ID") {
                println!("cargo:rustc-env=MICROSOFT_CLIENT_ID={}", client_id);
            }
            if let Ok(url) = std::env::var("SUPABASE_URL") {
                println!("cargo:rustc-env=SUPABASE_URL={}", url);
            }
            if let Ok(key) = std::env::var("SUPABASE_ANON_KEY") {
                println!("cargo:rustc-env=SUPABASE_ANON_KEY={}", key);
            }
            if let Ok(giphy_key) = std::env::var("GIPHY_API_KEY") {
                println!("cargo:rustc-env=GIPHY_API_KEY={}", giphy_key);
            }
        }
    }

    if let Ok(url) = std::env::var("SUPABASE_URL") {
        println!("cargo:rustc-env=SUPABASE_URL={}", url);
    }
    if let Ok(key) = std::env::var("SUPABASE_ANON_KEY") {
        println!("cargo:rustc-env=SUPABASE_ANON_KEY={}", key);
    }
    if let Ok(giphy_key) = std::env::var("GIPHY_API_KEY") {
        println!("cargo:rustc-env=GIPHY_API_KEY={}", giphy_key);
    }
    
    tauri_build::build()
}