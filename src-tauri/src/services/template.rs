use crate::models::{InstanceTemplate, MinecraftOptions};
use crate::utils::get_launcher_dir;
use chrono::Utc;
use std::{fs, path::PathBuf};

pub struct TemplateManager;

impl TemplateManager {
    fn get_templates_dir() -> PathBuf {
        get_launcher_dir().join("templates")
    }

    fn get_template_path(template_id: &str) -> PathBuf {
        Self::get_templates_dir().join(format!("{}.json", template_id))
    }

    pub fn create_template(
        name: String,
        description: Option<String>,
        launcher_settings: Option<crate::models::LauncherSettings>,
        minecraft_options: Option<MinecraftOptions>,
    ) -> Result<InstanceTemplate, Box<dyn std::error::Error>> {
        let templates_dir = Self::get_templates_dir();
        fs::create_dir_all(&templates_dir)?;

        let timestamp = Utc::now().timestamp_millis();
        let random_part: u32 = (timestamp % 10000) as u32;
        let template_id = format!("{}-{}", timestamp, random_part);

        let template = InstanceTemplate {
            id: template_id,
            name,
            description,
            created_at: Utc::now().to_rfc3339(),
            launcher_settings,
            minecraft_options,
        };

        let template_path = Self::get_template_path(&template.id);
        let json = serde_json::to_string_pretty(&template)?;
        fs::write(&template_path, json)?;

        Ok(template)
    }

    pub fn get_all_templates() -> Result<Vec<InstanceTemplate>, Box<dyn std::error::Error>> {
        let templates_dir = Self::get_templates_dir();

        if !templates_dir.exists() {
            return Ok(Vec::new());
        }

        let mut templates = Vec::new();

        for entry in fs::read_dir(&templates_dir)? {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(template) = serde_json::from_str::<InstanceTemplate>(&content) {
                            templates.push(template);
                        }
                    }
                }
            }
        }

        templates.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(templates)
    }

    pub fn get_template(template_id: &str) -> Result<InstanceTemplate, Box<dyn std::error::Error>> {
        let template_path = Self::get_template_path(template_id);

        if !template_path.exists() {
            return Err(format!("Template '{}' not found", template_id).into());
        }

        let content = fs::read_to_string(&template_path)?;
        let template: InstanceTemplate = serde_json::from_str(&content)?;
        Ok(template)
    }

    pub fn update_template(template: InstanceTemplate) -> Result<(), Box<dyn std::error::Error>> {
        let template_path = Self::get_template_path(&template.id);

        if !template_path.exists() {
            return Err(format!("Template '{}' not found", template.id).into());
        }

        let json = serde_json::to_string_pretty(&template)?;
        fs::write(&template_path, json)?;

        Ok(())
    }

    pub fn delete_template(template_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let template_path = Self::get_template_path(template_id);

        if !template_path.exists() {
            return Err(format!("Template '{}' not found", template_id).into());
        }

        fs::remove_file(&template_path)?;
        Ok(())
    }

    pub fn create_from_instance(
        instance_name: &str,
        template_name: String,
        description: Option<String>,
    ) -> Result<InstanceTemplate, Box<dyn std::error::Error>> {
        let instance_dir = crate::utils::get_instance_dir(instance_name);

        if !instance_dir.exists() {
            return Err(format!("Instance '{}' not found", instance_name).into());
        }

        let instance_json = instance_dir.join("instance.json");
        let instance: crate::models::Instance =
            serde_json::from_str(&fs::read_to_string(&instance_json)?)?;

        let options_path = instance_dir.join("options.txt");
        let minecraft_options = if options_path.exists() {
            Some(Self::parse_options_txt(&options_path)?)
        } else {
            None
        };

        Self::create_template(
            template_name,
            description,
            instance.settings_override,
            minecraft_options,
        )
    }

    fn parse_options_txt(path: &PathBuf) -> Result<MinecraftOptions, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        let mut options = MinecraftOptions::default();

        for line in content.lines() {
            if let Some((key, value)) = line.split_once(':') {
                match key {
                    // Core
                    "version" => options.version = value.parse().ok(),
                    "lang" => options.lang = Some(value.to_string()),
                    
                    // Video - Basic
                    "fov" => options.fov = value.parse().ok(),
                    "fovEffectScale" => options.fov_effect_scale = value.parse().ok(),
                    "renderDistance" => options.render_distance = value.parse().ok(),
                    "simulationDistance" => options.simulation_distance = value.parse().ok(),
                    "maxFps" => options.max_fps = value.parse().ok(),
                    "fullscreen" => options.fullscreen = Some(value == "true"),
                    "enableVsync" => options.vsync = Some(value == "true"),
                    "guiScale" => options.gui_scale = value.parse().ok(),
                    "gamma" => options.brightness = value.parse().ok(),
                    
                    // Video - Quality
                    "entityShadows" => options.entity_shadows = Some(value == "true"),
                    "entityDistanceScaling" => options.entity_distance_scaling = value.parse().ok(),
                    "particles" => options.particles = Some(value.to_string()),
                    "graphicsMode" => options.graphics = Some(value.to_string()),
                    "graphicsPreset" => options.graphics_preset = Some(value.trim_matches('"').to_string()),
                    "ao" => options.smooth_lighting = Some(value == "true"),
                    "biomeBlendRadius" => options.biome_blend = value.parse().ok(),
                    "mipmapLevels" => options.mipmap_levels = value.parse().ok(),
                    "prioritizeChunkUpdates" => options.chunk_updates_mode = value.parse().ok(),
                    "renderClouds" => options.cloud_rendering = Some(value.trim_matches('"').to_string()),
                    "cloudRange" => options.cloud_range = value.parse().ok(),
                    "weatherRadius" => options.weather_radius = value.parse().ok(),
                    "vignette" => options.vignette = Some(value == "true"),
                    "cutoutLeaves" => options.cutout_leaves = Some(value == "true"),
                    "improvedTransparency" => options.improved_transparency = Some(value == "true"),
                    "maxAnisotropyBit" => options.max_anisotropy_bit = value.parse().ok(),
                    "textureFiltering" => options.texture_filtering = value.parse().ok(),
                    
                    // Video - Performance
                    "chunkSectionFadeInTime" => options.chunk_section_fade_in_time = value.parse().ok(),
                    "inactivityFpsLimit" => options.inactivity_fps_limit = Some(value.trim_matches('"').to_string()),
                    "screenEffectScale" => options.screen_effect_scale = value.parse().ok(),
                    "darknessEffectScale" => options.darkness_effect_scale = value.parse().ok(),
                    
                    // Video - Effects
                    "glintSpeed" => options.glint_speed = value.parse().ok(),
                    "glintStrength" => options.glint_strength = value.parse().ok(),
                    "damageTiltStrength" => options.damage_tilt_strength = value.parse().ok(),
                    "bobView" => options.bob_view = Some(value == "true"),
                    
                    // Display
                    "forceUnicodeFont" => options.force_unicode_font = Some(value == "true"),
                    "japaneseGlyphVariants" => options.japanese_glyph_variants = Some(value == "true"),
                    "reducedDebugInfo" => options.reduced_debug_info = Some(value == "true"),
                    "showAutosaveIndicator" => options.show_autosave_indicator = Some(value == "true"),
                    "menuBackgroundBlurriness" => options.menu_background_blurriness = value.parse().ok(),
                    
                    // Audio
                    "soundDevice" => options.sound_device = Some(value.trim_matches('"').to_string()),
                    "soundCategory_master" => options.master_volume = value.parse().ok(),
                    "soundCategory_music" => options.music_volume = value.parse().ok(),
                    "soundCategory_record" => options.record_volume = value.parse().ok(),
                    "soundCategory_weather" => options.weather_volume = value.parse().ok(),
                    "soundCategory_block" => options.blocks_volume = value.parse().ok(),
                    "soundCategory_hostile" => options.hostile_volume = value.parse().ok(),
                    "soundCategory_neutral" => options.neutral_volume = value.parse().ok(),
                    "soundCategory_player" => options.players_volume = value.parse().ok(),
                    "soundCategory_ambient" => options.ambient_volume = value.parse().ok(),
                    "soundCategory_voice" => options.voice_volume = value.parse().ok(),
                    "soundCategory_ui" => options.ui_volume = value.parse().ok(),
                    "showSubtitles" => options.show_subtitles = Some(value == "true"),
                    "directionalAudio" => options.directional_audio = Some(value == "true"),
                    "musicToast" => options.music_toast = Some(value.trim_matches('"').to_string()),
                    "musicFrequency" => options.music_frequency = Some(value.trim_matches('"').to_string()),
                    
                    // Controls - Mouse
                    "mouseSensitivity" => options.mouse_sensitivity = value.parse().ok(),
                    "invertYMouse" => options.invert_mouse = Some(value == "true"),
                    "invertXMouse" => options.invert_x_mouse = Some(value == "true"),
                    "rawMouseInput" => options.raw_input = Some(value == "true"),
                    "discrete_mouse_scroll" => options.discrete_mouse_scroll = Some(value == "true"),
                    "mouseWheelSensitivity" => options.mouse_wheel_sensitivity = value.parse().ok(),
                    "allowCursorChanges" => options.allow_cursor_changes = Some(value == "true"),
                    "touchscreen" => options.touchscreen = Some(value == "true"),
                    
                    // Controls - Movement
                    "autoJump" => options.auto_jump = Some(value == "true"),
                    "toggleCrouch" => options.sneak_toggles = Some(value == "true"),
                    "toggleSprint" => options.sprint_toggles = Some(value == "true"),
                    "toggleAttack" => options.toggle_attack = Some(value == "true"),
                    "toggleUse" => options.toggle_use = Some(value == "true"),
                    "sprintWindow" => options.sprint_window = value.parse().ok(),
                    "rotateWithMinecart" => options.rotate_with_minecart = Some(value == "true"),
                    
                    // Controls - Gameplay
                    "mainHand" => options.main_hand = Some(value.trim_matches('"').to_string()),
                    "attackIndicator" => options.attack_indicator = value.parse().ok(),
                    "autoSuggestions" => options.auto_suggestions = Some(value == "true"),
                    "operatorItemsTab" => options.operator_items_tab = Some(value == "true"),
                    
                    // Chat
                    "narrator" => options.narrator = value.parse().ok(),
                    "narratorHotkey" => options.narrator_hotkey = Some(value == "true"),
                    "chatVisibility" => options.chat_visibility = value.parse().ok(),
                    "chatOpacity" => options.chat_opacity = value.parse().ok(),
                    "chatLineSpacing" => options.chat_line_spacing = value.parse().ok(),
                    "chatScale" => options.chat_scale = value.parse().ok(),
                    "textBackgroundOpacity" => options.text_background_opacity = value.parse().ok(),
                    "backgroundForChatOnly" => options.background_for_chat_only = Some(value == "true"),
                    "chatHeightFocused" => options.chat_height_focused = value.parse().ok(),
                    "chatHeightUnfocused" => options.chat_height_unfocused = value.parse().ok(),
                    "chatWidth" => options.chat_width = value.parse().ok(),
                    "chatDelay" => options.chat_delay = value.parse().ok(),
                    "chatColors" => options.chat_colors = Some(value == "true"),
                    "chatLinks" => options.chat_links = Some(value == "true"),
                    "chatLinksPrompt" => options.chat_links_prompt = Some(value == "true"),
                    "notificationDisplayTime" => options.notification_display_time = value.parse().ok(),
                    
                    // Accessibility
                    "highContrast" => options.high_contrast = Some(value == "true"),
                    "highContrastBlockOutline" => options.high_contrast_block_outline = Some(value == "true"),
                    "darkMojangStudiosBackground" => options.dark_mojang_studios_background = Some(value == "true"),
                    "hideLightningFlashes" => options.hide_lightning_flashes = Some(value == "true"),
                    "hideSplashTexts" => options.hide_splash_texts = Some(value == "true"),
                    "onboardAccessibility" => options.onboard_accessibility = Some(value == "true"),
                    "panoramaScrollSpeed" => options.panorama_scroll_speed = value.parse().ok(),
                    
                    // Multiplayer
                    "realmsNotifications" => options.realms_notifications = Some(value == "true"),
                    "hideServerAddress" => options.hide_server_address = Some(value == "true"),
                    "skipMultiplayerWarning" => options.skip_multiplayer_warning = Some(value == "true"),
                    "hideMatchedNames" => options.hide_matched_names = Some(value == "true"),
                    "joinedFirstServer" => options.joined_first_server = Some(value == "true"),
                    "allowServerListing" => options.allow_server_listing = Some(value == "true"),
                    "onlyShowSecureChat" => options.only_show_secure_chat = Some(value == "true"),
                    "saveChatDrafts" => options.save_chat_drafts = Some(value == "true"),
                    
                    // Advanced
                    "advancedItemTooltips" => options.advanced_item_tooltips = Some(value == "true"),
                    "pauseOnLostFocus" => options.pause_on_lost_focus = Some(value == "true"),
                    "overrideWidth" => options.override_width = value.parse().ok(),
                    "overrideHeight" => options.override_height = value.parse().ok(),
                    "useNativeTransport" => options.use_native_transport = Some(value == "true"),
                    "tutorialStep" => options.tutorial_step = Some(value.to_string()),
                    "glDebugVerbosity" => options.gl_debug_verbosity = value.parse().ok(),
                    "syncChunkWrites" => options.sync_chunk_writes = Some(value == "true"),
                    "telemetryOptInExtra" => options.telemetry_opt_in_extra = Some(value == "true"),
                    
                    // Resource Packs (array parsing)
                    "resourcePacks" => {
                        if value.starts_with('[') && value.ends_with(']') {
                            let cleaned = value.trim_start_matches('[').trim_end_matches(']');
                            if !cleaned.is_empty() {
                                let packs: Vec<String> = cleaned
                                    .split(',')
                                    .map(|s| s.trim().trim_matches('"').to_string())
                                    .collect();
                                options.resource_packs = Some(packs);
                            }
                        }
                    },
                    "incompatibleResourcePacks" => {
                        if value.starts_with('[') && value.ends_with(']') {
                            let cleaned = value.trim_start_matches('[').trim_end_matches(']');
                            if !cleaned.is_empty() {
                                let packs: Vec<String> = cleaned
                                    .split(',')
                                    .map(|s| s.trim().trim_matches('"').to_string())
                                    .collect();
                                options.incompatible_resource_packs = Some(packs);
                            } else {
                                options.incompatible_resource_packs = Some(Vec::new());
                            }
                        }
                    },
                    
                    // Server
                    "lastServer" => options.last_server = Some(value.to_string()),
                    
                    // Model Parts
                    "modelPart_cape" => options.model_part_cape = Some(value == "true"),
                    "modelPart_jacket" => options.model_part_jacket = Some(value == "true"),
                    "modelPart_left_sleeve" => options.model_part_left_sleeve = Some(value == "true"),
                    "modelPart_right_sleeve" => options.model_part_right_sleeve = Some(value == "true"),
                    "modelPart_left_pants_leg" => options.model_part_left_pants_leg = Some(value == "true"),
                    "modelPart_right_pants_leg" => options.model_part_right_pants_leg = Some(value == "true"),
                    "modelPart_hat" => options.model_part_hat = Some(value == "true"),
                    
                    // Keybinds
                    _ => {
                        if key.starts_with("key_") {
                            if let Some(ref mut keybinds) = options.keybinds {
                                keybinds.insert(key.to_string(), value.to_string());
                            }
                        }
                    }
                }
            }
        }

        Ok(options)
    }

    pub fn apply_template_to_instance(
        template_id: &str,
        instance_name: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let template = Self::get_template(template_id)?;
        let instance_dir = crate::utils::get_instance_dir(instance_name);

        if !instance_dir.exists() {
            return Err(format!("Instance '{}' not found", instance_name).into());
        }

        if let Some(launcher_settings) = template.launcher_settings {
            let instance_json = instance_dir.join("instance.json");
            let mut instance: crate::models::Instance =
                serde_json::from_str(&fs::read_to_string(&instance_json)?)?;

            instance.settings_override = Some(launcher_settings);

            let json = serde_json::to_string_pretty(&instance)?;
            fs::write(&instance_json, json)?;
        }

        if let Some(minecraft_options) = template.minecraft_options {
            let options_path = instance_dir.join("options.txt");
            
            let mut existing_options = if options_path.exists() {
                fs::read_to_string(&options_path)?
            } else {
                String::new()
            };

            Self::merge_options_txt(&mut existing_options, &minecraft_options)?;
            fs::write(&options_path, existing_options)?;
        }

        Ok(())
    }

    pub fn merge_options_txt(
        existing: &mut String,
        options: &MinecraftOptions,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut lines: Vec<String> = existing.lines().map(|s| s.to_string()).collect();
        
        let update_line = |lines: &mut Vec<String>, key: &str, value: String| {
            if let Some(pos) = lines.iter().position(|l| l.starts_with(&format!("{}:", key))) {
                lines[pos] = format!("{}:{}", key, value);
            } else {
                lines.push(format!("{}:{}", key, value));
            }
        };

        // Core
        if let Some(version) = options.version {
            update_line(&mut lines, "version", version.to_string());
        }
        if let Some(ref lang) = options.lang {
            update_line(&mut lines, "lang", lang.clone());
        }

        // Video - Basic
        if let Some(fov) = options.fov {
            update_line(&mut lines, "fov", fov.to_string());
        }
        if let Some(fov_effect_scale) = options.fov_effect_scale {
            update_line(&mut lines, "fovEffectScale", fov_effect_scale.to_string());
        }
        if let Some(render_distance) = options.render_distance {
            update_line(&mut lines, "renderDistance", render_distance.to_string());
        }
        if let Some(simulation_distance) = options.simulation_distance {
            update_line(&mut lines, "simulationDistance", simulation_distance.to_string());
        }
        if let Some(max_fps) = options.max_fps {
            update_line(&mut lines, "maxFps", max_fps.to_string());
        }
        if let Some(fullscreen) = options.fullscreen {
            update_line(&mut lines, "fullscreen", fullscreen.to_string());
        }
        if let Some(vsync) = options.vsync {
            update_line(&mut lines, "enableVsync", vsync.to_string());
        }
        if let Some(gui_scale) = options.gui_scale {
            update_line(&mut lines, "guiScale", gui_scale.to_string());
        }
        if let Some(brightness) = options.brightness {
            update_line(&mut lines, "gamma", brightness.to_string());
        }

        // Video - Quality
        if let Some(entity_shadows) = options.entity_shadows {
            update_line(&mut lines, "entityShadows", entity_shadows.to_string());
        }
        if let Some(entity_distance_scaling) = options.entity_distance_scaling {
            update_line(&mut lines, "entityDistanceScaling", entity_distance_scaling.to_string());
        }
        if let Some(ref particles) = options.particles {
            update_line(&mut lines, "particles", particles.clone());
        }
        if let Some(ref graphics) = options.graphics {
            update_line(&mut lines, "graphicsMode", graphics.clone());
        }
        if let Some(ref graphics_preset) = options.graphics_preset {
            update_line(&mut lines, "graphicsPreset", format!("\"{}\"", graphics_preset));
        }
        if let Some(smooth_lighting) = options.smooth_lighting {
            update_line(&mut lines, "ao", smooth_lighting.to_string());
        }
        if let Some(biome_blend) = options.biome_blend {
            update_line(&mut lines, "biomeBlendRadius", biome_blend.to_string());
        }
        if let Some(mipmap_levels) = options.mipmap_levels {
            update_line(&mut lines, "mipmapLevels", mipmap_levels.to_string());
        }
        if let Some(chunk_updates_mode) = options.chunk_updates_mode {
            update_line(&mut lines, "prioritizeChunkUpdates", chunk_updates_mode.to_string());
        }
        if let Some(ref cloud_rendering) = options.cloud_rendering {
            update_line(&mut lines, "renderClouds", format!("\"{}\"", cloud_rendering));
        }
        if let Some(cloud_range) = options.cloud_range {
            update_line(&mut lines, "cloudRange", cloud_range.to_string());
        }
        if let Some(weather_radius) = options.weather_radius {
            update_line(&mut lines, "weatherRadius", weather_radius.to_string());
        }
        if let Some(vignette) = options.vignette {
            update_line(&mut lines, "vignette", vignette.to_string());
        }
        if let Some(cutout_leaves) = options.cutout_leaves {
            update_line(&mut lines, "cutoutLeaves", cutout_leaves.to_string());
        }
        if let Some(improved_transparency) = options.improved_transparency {
            update_line(&mut lines, "improvedTransparency", improved_transparency.to_string());
        }
        if let Some(max_anisotropy_bit) = options.max_anisotropy_bit {
            update_line(&mut lines, "maxAnisotropyBit", max_anisotropy_bit.to_string());
        }
        if let Some(texture_filtering) = options.texture_filtering {
            update_line(&mut lines, "textureFiltering", texture_filtering.to_string());
        }

        // Video - Performance
        if let Some(chunk_section_fade_in_time) = options.chunk_section_fade_in_time {
            update_line(&mut lines, "chunkSectionFadeInTime", chunk_section_fade_in_time.to_string());
        }
        if let Some(ref inactivity_fps_limit) = options.inactivity_fps_limit {
            update_line(&mut lines, "inactivityFpsLimit", format!("\"{}\"", inactivity_fps_limit));
        }
        if let Some(screen_effect_scale) = options.screen_effect_scale {
            update_line(&mut lines, "screenEffectScale", screen_effect_scale.to_string());
        }
        if let Some(darkness_effect_scale) = options.darkness_effect_scale {
            update_line(&mut lines, "darknessEffectScale", darkness_effect_scale.to_string());
        }

        // Video - Effects
        if let Some(glint_speed) = options.glint_speed {
            update_line(&mut lines, "glintSpeed", glint_speed.to_string());
        }
        if let Some(glint_strength) = options.glint_strength {
            update_line(&mut lines, "glintStrength", glint_strength.to_string());
        }
        if let Some(damage_tilt_strength) = options.damage_tilt_strength {
            update_line(&mut lines, "damageTiltStrength", damage_tilt_strength.to_string());
        }
        if let Some(bob_view) = options.bob_view {
            update_line(&mut lines, "bobView", bob_view.to_string());
        }

        // Display
        if let Some(force_unicode_font) = options.force_unicode_font {
            update_line(&mut lines, "forceUnicodeFont", force_unicode_font.to_string());
        }
        if let Some(japanese_glyph_variants) = options.japanese_glyph_variants {
            update_line(&mut lines, "japaneseGlyphVariants", japanese_glyph_variants.to_string());
        }
        if let Some(reduced_debug_info) = options.reduced_debug_info {
            update_line(&mut lines, "reducedDebugInfo", reduced_debug_info.to_string());
        }
        if let Some(show_autosave_indicator) = options.show_autosave_indicator {
            update_line(&mut lines, "showAutosaveIndicator", show_autosave_indicator.to_string());
        }
        if let Some(menu_background_blurriness) = options.menu_background_blurriness {
            update_line(&mut lines, "menuBackgroundBlurriness", menu_background_blurriness.to_string());
        }

        // Audio
        if let Some(ref sound_device) = options.sound_device {
            update_line(&mut lines, "soundDevice", format!("\"{}\"", sound_device));
        }
        if let Some(master_volume) = options.master_volume {
            update_line(&mut lines, "soundCategory_master", master_volume.to_string());
        }
        if let Some(music_volume) = options.music_volume {
            update_line(&mut lines, "soundCategory_music", music_volume.to_string());
        }
        if let Some(record_volume) = options.record_volume {
            update_line(&mut lines, "soundCategory_record", record_volume.to_string());
        }
        if let Some(weather_volume) = options.weather_volume {
            update_line(&mut lines, "soundCategory_weather", weather_volume.to_string());
        }
        if let Some(blocks_volume) = options.blocks_volume {
            update_line(&mut lines, "soundCategory_block", blocks_volume.to_string());
        }
        if let Some(hostile_volume) = options.hostile_volume {
            update_line(&mut lines, "soundCategory_hostile", hostile_volume.to_string());
        }
        if let Some(neutral_volume) = options.neutral_volume {
            update_line(&mut lines, "soundCategory_neutral", neutral_volume.to_string());
        }
        if let Some(players_volume) = options.players_volume {
            update_line(&mut lines, "soundCategory_player", players_volume.to_string());
        }
        if let Some(ambient_volume) = options.ambient_volume {
            update_line(&mut lines, "soundCategory_ambient", ambient_volume.to_string());
        }
        if let Some(voice_volume) = options.voice_volume {
            update_line(&mut lines, "soundCategory_voice", voice_volume.to_string());
        }
        if let Some(ui_volume) = options.ui_volume {
            update_line(&mut lines, "soundCategory_ui", ui_volume.to_string());
        }
        if let Some(show_subtitles) = options.show_subtitles {
            update_line(&mut lines, "showSubtitles", show_subtitles.to_string());
        }
        if let Some(directional_audio) = options.directional_audio {
            update_line(&mut lines, "directionalAudio", directional_audio.to_string());
        }
        if let Some(ref music_toast) = options.music_toast {
            update_line(&mut lines, "musicToast", format!("\"{}\"", music_toast));
        }
        if let Some(ref music_frequency) = options.music_frequency {
            update_line(&mut lines, "musicFrequency", format!("\"{}\"", music_frequency));
        }

        // Controls - Mouse
        if let Some(mouse_sensitivity) = options.mouse_sensitivity {
            update_line(&mut lines, "mouseSensitivity", mouse_sensitivity.to_string());
        }
        if let Some(invert_mouse) = options.invert_mouse {
            update_line(&mut lines, "invertYMouse", invert_mouse.to_string());
        }
        if let Some(invert_x_mouse) = options.invert_x_mouse {
            update_line(&mut lines, "invertXMouse", invert_x_mouse.to_string());
        }
        if let Some(raw_input) = options.raw_input {
            update_line(&mut lines, "rawMouseInput", raw_input.to_string());
        }
        if let Some(discrete_mouse_scroll) = options.discrete_mouse_scroll {
            update_line(&mut lines, "discrete_mouse_scroll", discrete_mouse_scroll.to_string());
        }
        if let Some(mouse_wheel_sensitivity) = options.mouse_wheel_sensitivity {
            update_line(&mut lines, "mouseWheelSensitivity", mouse_wheel_sensitivity.to_string());
        }
        if let Some(allow_cursor_changes) = options.allow_cursor_changes {
            update_line(&mut lines, "allowCursorChanges", allow_cursor_changes.to_string());
        }
        if let Some(touchscreen) = options.touchscreen {
            update_line(&mut lines, "touchscreen", touchscreen.to_string());
        }

        // Controls - Movement
        if let Some(auto_jump) = options.auto_jump {
            update_line(&mut lines, "autoJump", auto_jump.to_string());
        }
        if let Some(sneak_toggles) = options.sneak_toggles {
            update_line(&mut lines, "toggleCrouch", sneak_toggles.to_string());
        }
        if let Some(sprint_toggles) = options.sprint_toggles {
            update_line(&mut lines, "toggleSprint", sprint_toggles.to_string());
        }
        if let Some(toggle_attack) = options.toggle_attack {
            update_line(&mut lines, "toggleAttack", toggle_attack.to_string());
        }
        if let Some(toggle_use) = options.toggle_use {
            update_line(&mut lines, "toggleUse", toggle_use.to_string());
        }
        if let Some(sprint_window) = options.sprint_window {
            update_line(&mut lines, "sprintWindow", sprint_window.to_string());
        }
        if let Some(rotate_with_minecart) = options.rotate_with_minecart {
            update_line(&mut lines, "rotateWithMinecart", rotate_with_minecart.to_string());
        }

        // Controls - Gameplay
        if let Some(ref main_hand) = options.main_hand {
            update_line(&mut lines, "mainHand", format!("\"{}\"", main_hand));
        }
        if let Some(attack_indicator) = options.attack_indicator {
            update_line(&mut lines, "attackIndicator", attack_indicator.to_string());
        }
        if let Some(auto_suggestions) = options.auto_suggestions {
            update_line(&mut lines, "autoSuggestions", auto_suggestions.to_string());
        }
        if let Some(operator_items_tab) = options.operator_items_tab {
            update_line(&mut lines, "operatorItemsTab", operator_items_tab.to_string());
        }

        // Chat
        if let Some(narrator) = options.narrator {
            update_line(&mut lines, "narrator", narrator.to_string());
        }
        if let Some(narrator_hotkey) = options.narrator_hotkey {
            update_line(&mut lines, "narratorHotkey", narrator_hotkey.to_string());
        }
        if let Some(chat_visibility) = options.chat_visibility {
            update_line(&mut lines, "chatVisibility", chat_visibility.to_string());
        }
        if let Some(chat_opacity) = options.chat_opacity {
            update_line(&mut lines, "chatOpacity", chat_opacity.to_string());
        }
        if let Some(chat_line_spacing) = options.chat_line_spacing {
            update_line(&mut lines, "chatLineSpacing", chat_line_spacing.to_string());
        }
        if let Some(chat_scale) = options.chat_scale {
            update_line(&mut lines, "chatScale", chat_scale.to_string());
        }
        if let Some(text_background_opacity) = options.text_background_opacity {
            update_line(&mut lines, "textBackgroundOpacity", text_background_opacity.to_string());
        }
        if let Some(background_for_chat_only) = options.background_for_chat_only {
            update_line(&mut lines, "backgroundForChatOnly", background_for_chat_only.to_string());
        }
        if let Some(chat_height_focused) = options.chat_height_focused {
            update_line(&mut lines, "chatHeightFocused", chat_height_focused.to_string());
        }
        if let Some(chat_height_unfocused) = options.chat_height_unfocused {
            update_line(&mut lines, "chatHeightUnfocused", chat_height_unfocused.to_string());
        }
        if let Some(chat_width) = options.chat_width {
            update_line(&mut lines, "chatWidth", chat_width.to_string());
        }
        if let Some(chat_delay) = options.chat_delay {
            update_line(&mut lines, "chatDelay", chat_delay.to_string());
        }
        if let Some(chat_colors) = options.chat_colors {
            update_line(&mut lines, "chatColors", chat_colors.to_string());
        }
        if let Some(chat_links) = options.chat_links {
            update_line(&mut lines, "chatLinks", chat_links.to_string());
        }
        if let Some(chat_links_prompt) = options.chat_links_prompt {
            update_line(&mut lines, "chatLinksPrompt", chat_links_prompt.to_string());
        }
        if let Some(notification_display_time) = options.notification_display_time {
            update_line(&mut lines, "notificationDisplayTime", notification_display_time.to_string());
        }

        // Accessibility
        if let Some(high_contrast) = options.high_contrast {
            update_line(&mut lines, "highContrast", high_contrast.to_string());
        }
        if let Some(high_contrast_block_outline) = options.high_contrast_block_outline {
            update_line(&mut lines, "highContrastBlockOutline", high_contrast_block_outline.to_string());
        }
        if let Some(dark_mojang_studios_background) = options.dark_mojang_studios_background {
            update_line(&mut lines, "darkMojangStudiosBackground", dark_mojang_studios_background.to_string());
        }
        if let Some(hide_lightning_flashes) = options.hide_lightning_flashes {
            update_line(&mut lines, "hideLightningFlashes", hide_lightning_flashes.to_string());
        }
        if let Some(hide_splash_texts) = options.hide_splash_texts {
            update_line(&mut lines, "hideSplashTexts", hide_splash_texts.to_string());
        }
        if let Some(onboard_accessibility) = options.onboard_accessibility {
            update_line(&mut lines, "onboardAccessibility", onboard_accessibility.to_string());
        }
        if let Some(panorama_scroll_speed) = options.panorama_scroll_speed {
            update_line(&mut lines, "panoramaScrollSpeed", panorama_scroll_speed.to_string());
        }

        // Multiplayer
        if let Some(realms_notifications) = options.realms_notifications {
            update_line(&mut lines, "realmsNotifications", realms_notifications.to_string());
        }
        if let Some(hide_server_address) = options.hide_server_address {
            update_line(&mut lines, "hideServerAddress", hide_server_address.to_string());
        }
        if let Some(skip_multiplayer_warning) = options.skip_multiplayer_warning {
            update_line(&mut lines, "skipMultiplayerWarning", skip_multiplayer_warning.to_string());
        }
        if let Some(hide_matched_names) = options.hide_matched_names {
            update_line(&mut lines, "hideMatchedNames", hide_matched_names.to_string());
        }
        if let Some(joined_first_server) = options.joined_first_server {
            update_line(&mut lines, "joinedFirstServer", joined_first_server.to_string());
        }
        if let Some(allow_server_listing) = options.allow_server_listing {
            update_line(&mut lines, "allowServerListing", allow_server_listing.to_string());
        }
        if let Some(only_show_secure_chat) = options.only_show_secure_chat {
            update_line(&mut lines, "onlyShowSecureChat", only_show_secure_chat.to_string());
        }
        if let Some(save_chat_drafts) = options.save_chat_drafts {
            update_line(&mut lines, "saveChatDrafts", save_chat_drafts.to_string());
        }

        // Advanced
        if let Some(advanced_item_tooltips) = options.advanced_item_tooltips {
            update_line(&mut lines, "advancedItemTooltips", advanced_item_tooltips.to_string());
        }
        if let Some(pause_on_lost_focus) = options.pause_on_lost_focus {
            update_line(&mut lines, "pauseOnLostFocus", pause_on_lost_focus.to_string());
        }
        if let Some(override_width) = options.override_width {
            update_line(&mut lines, "overrideWidth", override_width.to_string());
        }
        if let Some(override_height) = options.override_height {
            update_line(&mut lines, "overrideHeight", override_height.to_string());
        }
        if let Some(use_native_transport) = options.use_native_transport {
            update_line(&mut lines, "useNativeTransport", use_native_transport.to_string());
        }
        if let Some(ref tutorial_step) = options.tutorial_step {
            update_line(&mut lines, "tutorialStep", tutorial_step.clone());
        }
        if let Some(gl_debug_verbosity) = options.gl_debug_verbosity {
            update_line(&mut lines, "glDebugVerbosity", gl_debug_verbosity.to_string());
        }
        if let Some(sync_chunk_writes) = options.sync_chunk_writes {
            update_line(&mut lines, "syncChunkWrites", sync_chunk_writes.to_string());
        }
        if let Some(telemetry_opt_in_extra) = options.telemetry_opt_in_extra {
            update_line(&mut lines, "telemetryOptInExtra", telemetry_opt_in_extra.to_string());
        }

        // Resource Packs
        if let Some(ref resource_packs) = options.resource_packs {
            let formatted = format!("[{}]", resource_packs.iter()
                .map(|p| format!("\"{}\"", p))
                .collect::<Vec<_>>()
                .join(","));
            update_line(&mut lines, "resourcePacks", formatted);
        }
        if let Some(ref incompatible_resource_packs) = options.incompatible_resource_packs {
            let formatted = format!("[{}]", incompatible_resource_packs.iter()
                .map(|p| format!("\"{}\"", p))
                .collect::<Vec<_>>()
                .join(","));
            update_line(&mut lines, "incompatibleResourcePacks", formatted);
        }

        // Server
        if let Some(ref last_server) = options.last_server {
            update_line(&mut lines, "lastServer", last_server.clone());
        }

        // Model Parts
        if let Some(model_part_cape) = options.model_part_cape {
            update_line(&mut lines, "modelPart_cape", model_part_cape.to_string());
        }
        if let Some(model_part_jacket) = options.model_part_jacket {
            update_line(&mut lines, "modelPart_jacket", model_part_jacket.to_string());
        }
        if let Some(model_part_left_sleeve) = options.model_part_left_sleeve {
            update_line(&mut lines, "modelPart_left_sleeve", model_part_left_sleeve.to_string());
        }
        if let Some(model_part_right_sleeve) = options.model_part_right_sleeve {
            update_line(&mut lines, "modelPart_right_sleeve", model_part_right_sleeve.to_string());
        }
        if let Some(model_part_left_pants_leg) = options.model_part_left_pants_leg {
            update_line(&mut lines, "modelPart_left_pants_leg", model_part_left_pants_leg.to_string());
        }
        if let Some(model_part_right_pants_leg) = options.model_part_right_pants_leg {
            update_line(&mut lines, "modelPart_right_pants_leg", model_part_right_pants_leg.to_string());
        }
        if let Some(model_part_hat) = options.model_part_hat {
            update_line(&mut lines, "modelPart_hat", model_part_hat.to_string());
        }

        // Keybinds
        if let Some(ref keybinds) = options.keybinds {
            for (key, value) in keybinds {
                update_line(&mut lines, key, value.clone());
            }
        }

        *existing = lines.join("\n");
        Ok(())
    }
}