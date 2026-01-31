#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dotenvy::dotenv().ok();
    octane_launcher_lib::run()
}