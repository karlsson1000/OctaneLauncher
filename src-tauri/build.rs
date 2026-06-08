fn main() {
    dotenvy::dotenv().ok();

    for var in &["MICROSOFT_CLIENT_ID", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"] {
        if let Ok(val) = std::env::var(var) {
            println!("cargo:rustc-env={}={}", var, val);
        }
    }

    tauri_build::build()
}
