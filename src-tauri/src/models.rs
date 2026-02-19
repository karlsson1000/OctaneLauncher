use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use std::collections::HashMap;

// ===== PUBLIC API MODELS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_expiry: DateTime<Utc>,
    pub username: String,
    pub uuid: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Instance {
    pub name: String,
    pub version: String,
    pub created_at: String,
    pub last_played: Option<String>,
    pub loader: Option<String>,
    pub loader_version: Option<String>,
    pub settings_override: Option<LauncherSettings>,
    #[serde(default)]
    pub icon_path: Option<String>,
    #[serde(default)]
    pub total_playtime_seconds: u64,
}

// ===== FRIENDS SYSTEM MODELS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Friend {
    pub uuid: String,
    pub username: String,
    pub status: FriendStatus,
    pub last_seen: DateTime<Utc>,
    pub current_instance: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FriendStatus {
    Online,
    Offline,
    InGame,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FriendRequest {
    pub id: String,
    pub from_uuid: String,
    pub from_username: String,
    pub to_uuid: String,
    pub status: RequestStatus,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RequestStatus {
    Pending,
    Accepted,
    Rejected,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendFriendRequestPayload {
    pub username: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserStatusUpdate {
    pub uuid: String,
    pub status: FriendStatus,
    pub current_server: Option<String>,
}

// ===== TEMPLATE MODELS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstanceTemplate {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub launcher_settings: Option<LauncherSettings>,
    pub minecraft_options: Option<MinecraftOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftOptions {
    pub version: Option<i32>,
    pub lang: Option<String>,
    pub fov: Option<f32>,
    pub fov_effect_scale: Option<f32>,
    pub render_distance: Option<i32>,
    pub simulation_distance: Option<i32>,
    pub max_fps: Option<i32>,
    pub fullscreen: Option<bool>,
    pub vsync: Option<bool>,
    pub gui_scale: Option<i32>,
    pub brightness: Option<f32>,
    pub entity_shadows: Option<bool>,
    pub entity_distance_scaling: Option<f32>,
    pub particles: Option<String>,
    pub graphics: Option<String>,
    pub graphics_preset: Option<String>,
    pub smooth_lighting: Option<bool>,
    pub biome_blend: Option<i32>,
    pub mipmap_levels: Option<i32>,
    pub chunk_updates_mode: Option<i32>,
    pub cloud_rendering: Option<String>,
    pub cloud_range: Option<i32>,
    pub weather_radius: Option<i32>,
    pub vignette: Option<bool>,
    pub cutout_leaves: Option<bool>,
    pub improved_transparency: Option<bool>,
    pub max_anisotropy_bit: Option<i32>,
    pub texture_filtering: Option<i32>,
    pub chunk_section_fade_in_time: Option<f32>,
    pub inactivity_fps_limit: Option<String>,
    pub screen_effect_scale: Option<f32>,
    pub darkness_effect_scale: Option<f32>,
    pub glint_speed: Option<f32>,
    pub glint_strength: Option<f32>,
    pub damage_tilt_strength: Option<f32>,
    pub bob_view: Option<bool>,
    pub force_unicode_font: Option<bool>,
    pub japanese_glyph_variants: Option<bool>,
    pub reduced_debug_info: Option<bool>,
    pub show_autosave_indicator: Option<bool>,
    pub menu_background_blurriness: Option<i32>,
    pub sound_device: Option<String>,
    pub master_volume: Option<f32>,
    pub music_volume: Option<f32>,
    pub record_volume: Option<f32>,
    pub weather_volume: Option<f32>,
    pub blocks_volume: Option<f32>,
    pub hostile_volume: Option<f32>,
    pub neutral_volume: Option<f32>,
    pub players_volume: Option<f32>,
    pub ambient_volume: Option<f32>,
    pub voice_volume: Option<f32>,
    pub ui_volume: Option<f32>,
    pub show_subtitles: Option<bool>,
    pub directional_audio: Option<bool>,
    pub music_toast: Option<String>,
    pub music_frequency: Option<String>,
    pub mouse_sensitivity: Option<f32>,
    pub invert_mouse: Option<bool>,
    pub invert_x_mouse: Option<bool>,
    pub raw_input: Option<bool>,
    pub discrete_mouse_scroll: Option<bool>,
    pub mouse_wheel_sensitivity: Option<f32>,
    pub allow_cursor_changes: Option<bool>,
    pub touchscreen: Option<bool>,
    pub auto_jump: Option<bool>,
    pub sneak_toggles: Option<bool>,
    pub sprint_toggles: Option<bool>,
    pub toggle_attack: Option<bool>,
    pub toggle_use: Option<bool>,
    pub sprint_window: Option<i32>,
    pub rotate_with_minecart: Option<bool>,
    pub main_hand: Option<String>,
    pub attack_indicator: Option<i32>,
    pub auto_suggestions: Option<bool>,
    pub operator_items_tab: Option<bool>,
    pub narrator: Option<i32>,
    pub narrator_hotkey: Option<bool>,
    pub chat_visibility: Option<i32>,
    pub chat_opacity: Option<f32>,
    pub chat_line_spacing: Option<f32>,
    pub chat_scale: Option<f32>,
    pub text_background_opacity: Option<f32>,
    pub background_for_chat_only: Option<bool>,
    pub chat_height_focused: Option<f32>,
    pub chat_height_unfocused: Option<f32>,
    pub chat_width: Option<f32>,
    pub chat_delay: Option<f32>,
    pub chat_colors: Option<bool>,
    pub chat_links: Option<bool>,
    pub chat_links_prompt: Option<bool>,
    pub notification_display_time: Option<f32>,
    pub high_contrast: Option<bool>,
    pub high_contrast_block_outline: Option<bool>,
    pub dark_mojang_studios_background: Option<bool>,
    pub hide_lightning_flashes: Option<bool>,
    pub hide_splash_texts: Option<bool>,
    pub onboard_accessibility: Option<bool>,
    pub panorama_scroll_speed: Option<f32>,
    pub realms_notifications: Option<bool>,
    pub hide_server_address: Option<bool>,
    pub skip_multiplayer_warning: Option<bool>,
    pub hide_matched_names: Option<bool>,
    pub joined_first_server: Option<bool>,
    pub allow_server_listing: Option<bool>,
    pub only_show_secure_chat: Option<bool>,
    pub save_chat_drafts: Option<bool>,
    pub advanced_item_tooltips: Option<bool>,
    pub pause_on_lost_focus: Option<bool>,
    pub override_width: Option<i32>,
    pub override_height: Option<i32>,
    pub use_native_transport: Option<bool>,
    pub tutorial_step: Option<String>,
    pub gl_debug_verbosity: Option<i32>,
    pub sync_chunk_writes: Option<bool>,
    pub telemetry_opt_in_extra: Option<bool>,
    pub resource_packs: Option<Vec<String>>,
    pub incompatible_resource_packs: Option<Vec<String>>,
    pub last_server: Option<String>,
    pub model_part_cape: Option<bool>,
    pub model_part_jacket: Option<bool>,
    pub model_part_left_sleeve: Option<bool>,
    pub model_part_right_sleeve: Option<bool>,
    pub model_part_left_pants_leg: Option<bool>,
    pub model_part_right_pants_leg: Option<bool>,
    pub model_part_hat: Option<bool>,
    pub keybinds: Option<HashMap<String, String>>,
}

impl Default for MinecraftOptions {
    fn default() -> Self {
        Self {
            version: None,
            lang: None,
            fov: None,
            fov_effect_scale: None,
            render_distance: None,
            simulation_distance: None,
            max_fps: None,
            fullscreen: None,
            vsync: None,
            gui_scale: None,
            brightness: None,
            entity_shadows: None,
            entity_distance_scaling: None,
            particles: None,
            graphics: None,
            graphics_preset: None,
            smooth_lighting: None,
            biome_blend: None,
            mipmap_levels: None,
            chunk_updates_mode: None,
            cloud_rendering: None,
            cloud_range: None,
            weather_radius: None,
            vignette: None,
            cutout_leaves: None,
            improved_transparency: None,
            max_anisotropy_bit: None,
            texture_filtering: None,
            chunk_section_fade_in_time: None,
            inactivity_fps_limit: None,
            screen_effect_scale: None,
            darkness_effect_scale: None,
            glint_speed: None,
            glint_strength: None,
            damage_tilt_strength: None,
            bob_view: None,
            force_unicode_font: None,
            japanese_glyph_variants: None,
            reduced_debug_info: None,
            show_autosave_indicator: None,
            menu_background_blurriness: None,
            sound_device: None,
            master_volume: None,
            music_volume: None,
            record_volume: None,
            weather_volume: None,
            blocks_volume: None,
            hostile_volume: None,
            neutral_volume: None,
            players_volume: None,
            ambient_volume: None,
            voice_volume: None,
            ui_volume: None,
            show_subtitles: None,
            directional_audio: None,
            music_toast: None,
            music_frequency: None,
            mouse_sensitivity: None,
            invert_mouse: None,
            invert_x_mouse: None,
            raw_input: None,
            discrete_mouse_scroll: None,
            mouse_wheel_sensitivity: None,
            allow_cursor_changes: None,
            touchscreen: None,
            auto_jump: None,
            sneak_toggles: None,
            sprint_toggles: None,
            toggle_attack: None,
            toggle_use: None,
            sprint_window: None,
            rotate_with_minecart: None,
            main_hand: None,
            attack_indicator: None,
            auto_suggestions: None,
            operator_items_tab: None,
            narrator: None,
            narrator_hotkey: None,
            chat_visibility: None,
            chat_opacity: None,
            chat_line_spacing: None,
            chat_scale: None,
            text_background_opacity: None,
            background_for_chat_only: None,
            chat_height_focused: None,
            chat_height_unfocused: None,
            chat_width: None,
            chat_delay: None,
            chat_colors: None,
            chat_links: None,
            chat_links_prompt: None,
            notification_display_time: None,
            high_contrast: None,
            high_contrast_block_outline: None,
            dark_mojang_studios_background: None,
            hide_lightning_flashes: None,
            hide_splash_texts: None,
            onboard_accessibility: None,
            panorama_scroll_speed: None,
            realms_notifications: None,
            hide_server_address: None,
            skip_multiplayer_warning: None,
            hide_matched_names: None,
            joined_first_server: None,
            allow_server_listing: None,
            only_show_secure_chat: None,
            save_chat_drafts: None,
            advanced_item_tooltips: None,
            pause_on_lost_focus: None,
            override_width: None,
            override_height: None,
            use_native_transport: None,
            tutorial_step: None,
            gl_debug_verbosity: None,
            sync_chunk_writes: None,
            telemetry_opt_in_extra: None,
            resource_packs: None,
            incompatible_resource_packs: None,
            last_server: None,
            model_part_cape: None,
            model_part_jacket: None,
            model_part_left_sleeve: None,
            model_part_right_sleeve: None,
            model_part_left_pants_leg: None,
            model_part_right_pants_leg: None,
            model_part_hat: None,
            keybinds: Some(HashMap::new()),
        }
    }
}

// ===== SETTINGS MODELS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LauncherSettings {
    pub java_path: Option<String>,
    #[serde(default = "default_memory")]
    pub memory_mb: u32,
    #[serde(default = "default_discord_rpc_enabled")]
    pub discord_rpc_enabled: bool,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default = "default_auto_navigate_to_console")]
    pub auto_navigate_to_console: bool,
}

fn default_memory() -> u32 {
    2048
}

fn default_discord_rpc_enabled() -> bool {
    true
}

fn default_auto_navigate_to_console() -> bool {
    true
}

impl Default for LauncherSettings {
    fn default() -> Self {
        Self {
            java_path: None,
            memory_mb: 2048,
            discord_rpc_enabled: true,
            language: None,
            auto_navigate_to_console: true,
        }
    }
}

// ===== AUTHENTICATION MODELS =====

#[derive(Serialize, Deserialize)]
pub struct TokenWithExpiry {
    pub token: Arc<str>,
    pub expiry: DateTime<Utc>,
}

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct XboxLiveAuthRequest<'a> {
    pub properties: XboxLiveAuthProperties<'a>,
    pub relying_party: &'a str,
    pub token_type: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct XboxLiveAuthProperties<'a> {
    pub auth_method: &'a str,
    pub site_name: &'a str,
    pub rps_ticket: &'a str,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct XboxLiveAuthResponse {
    pub issue_instant: DateTime<Utc>,
    pub not_after: DateTime<Utc>,
    pub token: Arc<str>,
}

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct XstsAuthRequest<'a> {
    pub properties: XstsAuthProperties<'a>,
    pub relying_party: &'a str,
    pub token_type: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct XstsAuthProperties<'a> {
    pub sandbox_id: &'a str,
    pub user_tokens: &'a [&'a str],
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct XstsAuthResponse {
    pub issue_instant: DateTime<Utc>,
    pub not_after: DateTime<Utc>,
    pub token: Arc<str>,
    pub display_claims: DisplayClaims,
}

#[derive(Deserialize)]
pub struct DisplayClaims {
    pub xui: Vec<std::collections::HashMap<String, String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MinecraftLoginRequest<'a> {
    pub identity_token: &'a str,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub struct MinecraftLoginResponse {
    pub username: Arc<str>,
    pub access_token: Arc<str>,
    pub expires_in: usize,
}

#[derive(Deserialize)]
pub struct MinecraftProfile {
    pub id: Uuid,
    pub name: Arc<str>,
}

// ===== MULTI-ACCOUNT MODELS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredAccount {
    pub uuid: String,
    pub username: String,
    pub access_token: String,
    pub refresh_token: String,
    pub token_expiry: DateTime<Utc>,
    pub added_at: String,
    pub last_used: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccountsData {
    pub accounts: HashMap<String, StoredAccount>,
    pub active_account_uuid: Option<String>,
}

impl Default for AccountsData {
    fn default() -> Self {
        Self {
            accounts: HashMap::new(),
            active_account_uuid: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccountInfo {
    pub uuid: String,
    pub username: String,
    pub is_active: bool,
    pub added_at: String,
    pub last_used: Option<String>,
}

// ===== MINECRAFT VERSION MODELS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MinecraftVersion {
    pub id: String,
    pub r#type: String,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionManifest {
    pub latest: Latest,
    pub versions: Vec<MinecraftVersion>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Latest {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionDetails {
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndex,
    pub assets: String,
    pub downloads: Downloads,
    pub id: String,
    pub libraries: Vec<Library>,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "minecraftArguments")]
    pub minecraft_arguments: Option<String>,
    pub arguments: Option<Arguments>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetIndex {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Downloads {
    pub client: DownloadInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadInfo {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Library {
    pub downloads: Option<LibraryDownloads>,
    pub name: String,
    pub rules: Option<Vec<Rule>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<Artifact>,
    pub classifiers: Option<std::collections::HashMap<String, Artifact>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Artifact {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Rule {
    pub action: String,
    pub os: Option<OsRule>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsRule {
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Arguments {
    pub game: Vec<serde_json::Value>,
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct AssetIndexData {
    pub objects: std::collections::HashMap<String, AssetObject>,
}

#[derive(Debug, Deserialize)]
pub struct AssetObject {
    pub hash: String,
    #[allow(dead_code)]
    pub size: u64,
}

// ===== FABRIC LOADER MODELS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FabricProfileJson {
    pub id: String,
    #[serde(rename = "inheritsFrom")]
    pub inherits_from: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub time: String,
    #[serde(rename = "type")]
    pub profile_type: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub arguments: Option<FabricArguments>,
    pub libraries: Vec<FabricProfileLibrary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FabricArguments {
    pub game: Vec<serde_json::Value>,
    #[serde(default)]
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FabricProfileLibrary {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FabricLoaderVersion {
    pub separator: String,
    pub build: u32,
    pub maven: String,
    pub version: String,
    pub stable: bool,
}

// ===== NEOFORGE LOADER MODELS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeoForgeVersion {
    pub minecraft_version: String,
    pub neoforge_version: String,
    pub full_version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeoForgeProfileJson {
    pub id: String,
    #[serde(rename = "inheritsFrom")]
    pub inherits_from: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub time: String,
    #[serde(rename = "type")]
    pub profile_type: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub arguments: Option<NeoForgeArguments>,
    pub libraries: Vec<NeoForgeProfileLibrary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeoForgeArguments {
    pub game: Vec<serde_json::Value>,
    #[serde(default)]
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeoForgeProfileLibrary {
    pub name: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub downloads: Option<serde_json::Value>,
}

// ===== CHAT =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub from_uuid: String,
    pub to_uuid: String,
    pub content: String,
    #[serde(with = "chrono::serde::ts_seconds")]
    pub timestamp: DateTime<Utc>,
    pub is_own: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
  pub struct Snapshot {
      pub id: String,
      pub name: String,
      pub created_at: String,
      pub size_bytes: u64,
      pub file_path: String,
}