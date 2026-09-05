use crate::minecraft::downloader;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Retorna o diretÃ³rio de uma instÃ¢ncia de forma cross-platform
fn verdant_instance_dir(instance_id: &str) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(app_data).join(".verdant").join("instances").join(instance_id)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".config").join("verdant-launcher").join("instances").join(instance_id)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub hits: Vec<ModProject>,
    pub total_hits: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModProject {
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub icon_url: Option<String>,
    pub author: String,
    pub slug: String,
    pub downloads: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModDependency {
    pub version_id: Option<String>,
    pub project_id: Option<String>,
    pub dependency_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModVersion {
    pub id: String,
    pub name: String,
    pub version_number: String,
    pub version_type: String,
    pub files: Vec<ModFile>,
    #[serde(default)]
    pub dependencies: Vec<ModDependency>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModProjectResult {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub icon_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModFile {
    pub url: String,
    pub filename: String,
    pub primary: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalMod {
    pub filename: String,
    pub name: String,
    pub path: String,
    pub enabled: bool,
    pub file_type: String,
    pub project_id: Option<String>,
    pub modified_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct InstanceIndex {
    pub mods: std::collections::HashMap<String, String>,
}

fn load_index(instance_dir: &Path) -> InstanceIndex {
    let index_path = instance_dir.join("verdant_index.json");
    if let Ok(content) = fs::read_to_string(&index_path) {
        if let Ok(index) = serde_json::from_str(&content) {
            return index;
        }
    }
    InstanceIndex::default()
}

fn save_index(instance_dir: &Path, index: &InstanceIndex) {
    let index_path = instance_dir.join("verdant_index.json");
    if let Ok(content) = serde_json::to_string_pretty(index) {
        let _ = fs::write(index_path, content);
    }
}

const MODRINTH_API: &str = "https://api.modrinth.com/v2";

pub async fn search_mods(
    client: &Client,
    query: &str,
    version: &str,
    loader: &str,
    project_type: &str,
    sort: &str,
    category: &str,
    offset: usize,
) -> Result<SearchResult, String> {
    let mut facets_list = Vec::new();

    // Versao do jogo
    if !version.is_empty() {
        facets_list.push(format!("[\"versions:{}\"]", version));
    }

    // Tipo de projeto (mod, resourcepack, shader, modpack)
    if !project_type.is_empty() {
        facets_list.push(format!("[\"project_type:{}\"]", project_type));
    }

    // Loader (somente aplica se for mod)
    if project_type == "mod" && loader != "vanilla" && !loader.is_empty() {
        facets_list.push(format!("[\"categories:{}\"]", loader.to_lowercase()));
    }

    // Categoria especifica
    if !category.is_empty() && category != "all" {
        facets_list.push(format!("[\"categories:{}\"]", category.to_lowercase()));
    }

    let mut url = format!(
        "{}/search?query={}&index={}&offset={}&limit=20",
        MODRINTH_API, query, sort, offset
    );

    if !facets_list.is_empty() {
        let facets = format!("[{}]", facets_list.join(","));
        url = format!("{}&facets={}", url, facets);
    }

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Erro na API do Modrinth: {} - {}", text, url));
    }

    let search_res: SearchResult = res.json().await.map_err(|e| e.to_string())?;
    Ok(search_res)
}

pub async fn get_mod_versions(
    client: &Client,
    project_id: &str,
    version: &str,
    loader: &str,
) -> Result<Vec<ModVersion>, String> {
    let mut url = format!("{}/project/{}/version", MODRINTH_API, project_id);
    let mut query_params = Vec::new();

    if !loader.is_empty() {
        query_params.push(format!("loaders=[\"{}\"]", loader.to_lowercase()));
    }
    if !version.is_empty() {
        query_params.push(format!("game_versions=[\"{}\"]", version));
    }

    if !query_params.is_empty() {
        url.push('?');
        url.push_str(&query_params.join("&"));
    }

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Erro ao buscar versÃƒÆ’Ã‚Âµes do mod: {}", res.status()));
    }

    let versions: Vec<ModVersion> = res.json().await.map_err(|e| e.to_string())?;
    Ok(versions)
}

pub async fn download_mod(
    client: &Client,
    file_url: &str,
    filename: &str,
    instance_dir: &Path,
    folder_name: &str,
) -> Result<(), String> {
    let target_dir = instance_dir.join(folder_name);
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let out_path = target_dir.join(filename);
    downloader::download_file(client, file_url, &out_path).await?;

    Ok(())
}

pub fn list_local_mods(instance_dir: &Path) -> Result<Vec<LocalMod>, String> {
    let mut mods = Vec::new();
    let index = load_index(instance_dir);

    let folders = vec![
        ("mods", "mod", vec![".jar", ".jar.disabled"]),
        (
            "resourcepacks",
            "resourcepack",
            vec![".zip", ".zip.disabled"],
        ),
        ("shaderpacks", "shader", vec![".zip", ".zip.disabled"]),
    ];

    for (folder_name, file_type, extensions) in folders {
        let dir = instance_dir.join(folder_name);
        if !dir.exists() {
            continue;
        }

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let filename = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    let mut matched = false;
                    for ext in &extensions {
                        if filename.ends_with(ext) {
                            matched = true;
                            break;
                        }
                    }

                    if matched {
                        let enabled = !filename.ends_with(".disabled");
                        let name = if enabled {
                            filename.clone()
                        } else {
                            filename.replace(".disabled", "")
                        };

                        let project_id = index.mods.get(&name).cloned();

                        let modified_at = entry.metadata()
                            .ok()
                            .and_then(|m| m.modified().ok())
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs())
                            .unwrap_or(0);
                            
                        mods.push(LocalMod {
                            filename: filename.clone(),
                            name,
                            path: path.to_string_lossy().to_string(),
                            enabled,
                            file_type: file_type.to_string(),
                            project_id,
                            modified_at,
                        });
                    }
                }
            }
        }
    }

    Ok(mods)
}

pub fn toggle_local_mod(instance_dir: &Path, filename: &str, enable: bool) -> Result<(), String> {
    let folders = vec!["mods", "resourcepacks", "shaderpacks"];
    let mut found_path = None;

    for folder in folders {
        let path = instance_dir.join(folder).join(filename);
        if path.exists() {
            found_path = Some(path);
            break;
        }
    }

    let current_path = match found_path {
        Some(p) => p,
        None => {
            return Err(
                "Arquivo nÃƒÆ’Ã‚Â£o encontrado nas pastas de mods/resourcepacks/shaders".to_string(),
            )
        }
    };

    let new_filename = if enable {
        if filename.ends_with(".disabled") {
            filename.replace(".disabled", "")
        } else {
            return Ok(());
        }
    } else {
        if !filename.ends_with(".disabled") {
            format!("{}.disabled", filename)
        } else {
            return Ok(());
        }
    };

    let new_path = current_path.parent().unwrap().join(new_filename);
    fs::rename(current_path, new_path).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn delete_local_mod(instance_dir: &Path, filename: &str) -> Result<(), String> {
    let folders = vec!["mods", "resourcepacks", "shaderpacks"];

    for folder in folders {
        let path = instance_dir.join(folder).join(filename);
        if path.exists() {
            fs::remove_file(path).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    Ok(())
}

// ------------------------------------------------------------------------------------------------
// TAURI COMMANDS
// ------------------------------------------------------------------------------------------------

#[tauri::command]
pub async fn search_modrinth_mods(
    query: String,
    version: String,
    loader: String,
    project_type: String,
    sort: String,
    category: String,
    offset: usize,
) -> Result<SearchResult, String> {
    let client = Client::builder()
        .user_agent("VerdantLauncher/0.1.0")
        .build()
        .map_err(|e| e.to_string())?;
    search_mods(
        &client,
        &query,
        &version,
        &loader,
        &project_type,
        &sort,
        &category,
        offset,
    )
    .await
}

#[tauri::command]
pub async fn get_modrinth_versions(
    project_id: String,
    version: String,
    loader: String,
) -> Result<Vec<ModVersion>, String> {
    let client = Client::builder()
        .user_agent("VerdantLauncher/0.1.0")
        .build()
        .map_err(|e| e.to_string())?;
    get_mod_versions(&client, &project_id, &version, &loader).await
}

#[tauri::command]
pub async fn install_modrinth_mod(
    file_url: String,
    filename: String,
    instance_id: String,
    project_type: String,
    project_id: Option<String>,
) -> Result<(), String> {
    let client = Client::builder()
        .user_agent("VerdantLauncher/0.1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let instance_dir = verdant_instance_dir(&instance_id);

    let folder_name = match project_type.as_str() {
        "resourcepack" => "resourcepacks",
        "shader" => "shaderpacks",
        _ => "mods",
    };

    download_mod(&client, &file_url, &filename, &instance_dir, folder_name).await?;

    // Salvar no JSON
    if let Some(pid) = project_id {
        let mut index = load_index(&instance_dir);
        index.mods.insert(filename.clone(), pid);
        save_index(&instance_dir, &index);
    }

    Ok(())
}

pub async fn get_projects(
    client: &Client,
    ids: Vec<String>,
) -> Result<Vec<ModProjectResult>, String> {
    let ids_json = serde_json::to_string(&ids).map_err(|e| e.to_string())?;
    let url = format!("{}/projects?ids={}", MODRINTH_API, ids_json);

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Erro ao buscar projetos: {}", res.status()));
    }

    let projects: Vec<ModProjectResult> = res.json().await.map_err(|e| e.to_string())?;
    Ok(projects)
}

#[tauri::command]
pub async fn get_modrinth_projects(ids: Vec<String>) -> Result<Vec<ModProjectResult>, String> {
    let client = Client::builder()
        .user_agent("VerdantLauncher/0.1.0")
        .build()
        .map_err(|e| e.to_string())?;
    get_projects(&client, ids).await
}

#[tauri::command]
pub async fn get_instance_mods(instance_id: String) -> Result<Vec<LocalMod>, String> {
    let instance_dir = verdant_instance_dir(&instance_id);
    list_local_mods(&instance_dir)
}

#[tauri::command]
pub fn toggle_instance_mod(
    instance_id: String,
    filename: String,
    enable: bool,
) -> Result<(), String> {
    let instance_dir = verdant_instance_dir(&instance_id);
    toggle_local_mod(&instance_dir, &filename, enable)
}

#[tauri::command]
pub fn delete_instance_mod(instance_id: String, filename: String) -> Result<(), String> {
    let instance_dir = verdant_instance_dir(&instance_id);
    delete_local_mod(&instance_dir, &filename)
}



