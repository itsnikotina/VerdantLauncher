use super::downloader::download_file;
use reqwest::Client;
use serde::Deserialize;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Emitter;

#[derive(Debug, Deserialize)]
pub struct FabricProfile {
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub libraries: Vec<FabricLibrary>,
}

#[derive(Debug, Deserialize)]
pub struct FabricLibrary {
    pub name: String,
    pub url: String,
}

pub fn parse_maven_coord(coord: &str) -> String {
    let parts: Vec<&str> = coord.split(':').collect();
    if parts.len() < 3 {
        return coord.to_string();
    }

    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];

    format!(
        "{}/{}/{}/{}-{}.jar",
        group, artifact, version, artifact, version
    )
}

pub async fn setup_fabric(
    client: &Client,
    mc_version: &str,
    loader_version: &str,
    libraries_dir: &PathBuf,
    app: &AppHandle,
) -> Result<(String, Vec<String>), String> {
    let emit_status = |msg: &str| {
        let _ = app.emit("launch-status", msg);
    };

    emit_status("Baixando perfil do Fabric...");

    let url = format!(
        "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
        mc_version, loader_version
    );

    let profile: FabricProfile = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Erro ao buscar perfil Fabric: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Erro ao parsear perfil Fabric: {}", e))?;

    let mut extra_classpath = Vec::new();

    emit_status("Sincronizando bibliotecas do Fabric...");

    for lib in profile.libraries {
        let lib_path_str = parse_maven_coord(&lib.name);
        let lib_file_path = libraries_dir.join(&lib_path_str);

        let mut download_url = lib.url.clone();
        if !download_url.ends_with('/') {
            download_url.push('/');
        }
        download_url.push_str(&lib_path_str);

        if !lib_file_path.exists() {
            if let Some(parent) = lib_file_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            download_file(client, &download_url, &lib_file_path).await?;
        }

        extra_classpath.push(lib_file_path.to_string_lossy().into_owned());
    }

    Ok((profile.main_class, extra_classpath))
}
