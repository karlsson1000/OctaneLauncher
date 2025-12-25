use serde::{Deserialize, Serialize};
use std::time::Duration;

const MODRINTH_API_BASE: &str = "https://api.modrinth.com/v2";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthSearchResult {
    pub hits: Vec<ModrinthProject>,
    pub offset: u32,
    pub limit: u32,
    pub total_hits: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthProject {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub categories: Vec<String>,
    pub client_side: String,
    pub server_side: String,
    pub project_type: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub color: Option<u32>,
    pub project_id: String,
    pub author: String,
    pub display_categories: Option<Vec<String>>,
    pub versions: Vec<String>,
    pub follows: u32,
    pub date_created: String,
    pub date_modified: String,
    pub latest_version: Option<String>,
    pub license: String,
    pub gallery: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthProjectDetails {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub categories: Vec<String>,
    pub client_side: String,
    pub server_side: String,
    pub body: String,
    pub status: String,
    pub project_type: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub color: Option<u32>,
    pub id: String,
    pub team: String,
    pub published: String,
    pub updated: String,
    pub followers: u32,
    pub license: ProjectLicense,
    pub versions: Vec<String>,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub gallery: Option<Vec<GalleryImage>>,
    pub issues_url: Option<String>,
    pub source_url: Option<String>,
    pub wiki_url: Option<String>,
    pub discord_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectLicense {
    pub id: String,
    pub name: String,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GalleryImage {
    pub url: String,
    pub featured: bool,
    pub title: Option<String>,
    pub description: Option<String>,
    pub created: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthVersion {
    pub id: String,
    pub project_id: String,
    pub author_id: String,
    pub featured: bool,
    pub name: String,
    pub version_number: String,
    pub changelog: Option<String>,
    pub date_published: String,
    pub downloads: u32,
    pub version_type: String,
    pub files: Vec<VersionFile>,
    pub dependencies: Vec<Dependency>,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionFile {
    pub hashes: FileHashes,
    pub url: String,
    pub filename: String,
    pub primary: bool,
    pub size: u64,
    pub file_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileHashes {
    pub sha1: String,
    pub sha512: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Dependency {
    pub version_id: Option<String>,
    pub project_id: Option<String>,
    pub file_name: Option<String>,
    pub dependency_type: String,
}

pub struct ModrinthClient {
    http_client: reqwest::Client,
}

impl ModrinthClient {
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("AtomicLauncher/2.4.0")
            .build()
            .unwrap();

        Self { http_client }
    }

    pub async fn search_projects(
        &self,
        query: &str,
        facets: Option<&str>,
        index: Option<&str>,
        offset: Option<u32>,
        limit: Option<u32>,
    ) -> Result<ModrinthSearchResult, Box<dyn std::error::Error>> {
        let url = format!("{}/search", MODRINTH_API_BASE);
        let mut params = vec![("query", query.to_string())];

        if let Some(facets) = facets {
            params.push(("facets", facets.to_string()));
        }

        if let Some(index) = index {
            params.push(("index", index.to_string()));
        }

        if let Some(offset) = offset {
            params.push(("offset", offset.to_string()));
        }

        if let Some(limit) = limit {
            params.push(("limit", limit.to_string()));
        }

        let response = self
            .http_client
            .get(&url)
            .query(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Modrinth API error: {}", error_text).into());
        }

        let result: ModrinthSearchResult = response.json().await?;
        Ok(result)
    }

    pub async fn get_project(
        &self,
        id_or_slug: &str,
    ) -> Result<ModrinthProjectDetails, Box<dyn std::error::Error>> {
        let url = format!("{}/project/{}", MODRINTH_API_BASE, id_or_slug);

        let response = self.http_client.get(&url).send().await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Modrinth API error: {}", error_text).into());
        }

        let project: ModrinthProjectDetails = response.json().await?;
        Ok(project)
    }

    pub async fn get_project_versions(
        &self,
        id_or_slug: &str,
        loaders: Option<Vec<String>>,
        game_versions: Option<Vec<String>>,
    ) -> Result<Vec<ModrinthVersion>, Box<dyn std::error::Error>> {
        let url = format!("{}/project/{}/version", MODRINTH_API_BASE, id_or_slug);

        let mut params = Vec::new();

        if let Some(loaders) = loaders {
            params.push(("loaders", format!("[\"{}\"]", loaders.join("\",\""))));
        }

        if let Some(game_versions) = game_versions {
            params.push((
                "game_versions",
                format!("[\"{}\"]", game_versions.join("\",\"")),
            ));
        }

        let response = self.http_client.get(&url).query(&params).send().await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Modrinth API error: {}", error_text).into());
        }

        let versions: Vec<ModrinthVersion> = response.json().await?;
        Ok(versions)
    }

    pub async fn download_mod_file(
        &self,
        url: &str,
        destination: &std::path::Path,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let response = self.http_client.get(url).send().await?;

        if !response.status().is_success() {
            return Err(format!("Failed to download file: HTTP {}", response.status()).into());
        }

        let bytes = response.bytes().await?;
        std::fs::write(destination, bytes)?;

        Ok(())
    }
}