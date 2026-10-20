use super::*;

impl MinecraftInstaller {
    pub async fn get_versions(&self) -> Result<Vec<String>, DownloadError> {
        let response = self.http_client.get(VERSION_MANIFEST_URL).send().await?;
        let manifest: VersionManifest = response.json().await?;

        let versions: Vec<String> = manifest
            .versions
            .iter()
            .filter(|v| v.r#type == "release" || v.r#type == "snapshot")
            .take(500)
            .map(|v| v.id.clone())
            .collect();

        Ok(versions)
    }

    pub async fn get_versions_with_metadata(&self) -> Result<Vec<MinecraftVersion>, DownloadError> {
        let response = self.http_client.get(VERSION_MANIFEST_URL).send().await?;
        let manifest: VersionManifest = response.json().await?;

        let versions: Vec<MinecraftVersion> = manifest
            .versions
            .into_iter()
            .filter(|v| v.r#type == "release" || v.r#type == "snapshot")
            .take(500)
            .collect();

        Ok(versions)
    }

    pub async fn get_versions_by_type(&self, version_type: &str) -> Result<Vec<String>, DownloadError> {
        let response = self.http_client.get(VERSION_MANIFEST_URL).send().await?;
        let manifest: VersionManifest = response.json().await?;

        let versions: Vec<String> = manifest
            .versions
            .iter()
            .filter(|v| v.r#type == version_type)
            .take(500)
            .map(|v| v.id.clone())
            .collect();

        Ok(versions)
    }
}
