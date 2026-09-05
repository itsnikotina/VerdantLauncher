use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct VersionMeta {
    pub downloads: Downloads,
    pub libraries: Vec<Library>,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndex,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "javaVersion")]
    pub java_version: Option<JavaVersion>,
    pub logging: Option<Logging>,
}

#[derive(Debug, Deserialize)]
pub struct Logging {
    pub client: Option<LoggingClient>,
}

#[derive(Debug, Deserialize)]
pub struct LoggingClient {
    pub argument: String,
    pub file: DownloadFile,
}

#[derive(Debug, Deserialize)]
pub struct JavaVersion {
    #[serde(rename = "majorVersion")]
    pub major_version: u32,
}

#[derive(Debug, Deserialize)]
pub struct Downloads {
    pub client: DownloadFile,
}

#[derive(Debug, Deserialize)]
pub struct DownloadFile {
    pub url: String,
    pub sha1: String,
    pub size: u64,
    pub path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssetIndex {
    pub id: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct Library {
    pub name: String,
    pub downloads: Option<LibraryDownloads>,
    pub rules: Option<Vec<Rule>>,
}

#[derive(Debug, Deserialize)]
pub struct Rule {
    pub action: String,
    pub os: Option<RuleOs>,
}

#[derive(Debug, Deserialize)]
pub struct RuleOs {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<DownloadFile>,
    pub classifiers: Option<HashMap<String, DownloadFile>>,
}

// Structs para o Manifesto Geral (para achar a URL da versao 1.20.1)
#[derive(Debug, Deserialize)]
pub struct VersionManifest {
    pub versions: Vec<MinecraftVersion>,
}

#[derive(Debug, Deserialize)]
pub struct MinecraftVersion {
    pub id: String,
    pub url: String,
}

/// Busca o JSON completo de uma versao específica a partir da URL fornecida no manifesto principal
pub async fn fetch_version_meta(client: &Client, url: &str) -> Result<VersionMeta, String> {
    let meta = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Erro de requisição da versao: {}", e))?
        .json::<VersionMeta>()
        .await
        .map_err(|e| format!("Erro ao processar JSON da versao: {}", e))?;
    Ok(meta)
}
