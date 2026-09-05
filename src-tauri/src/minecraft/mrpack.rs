use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use zip::ZipArchive;

use crate::instances::InstanceConfig;

static CANCEL_TOKENS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();

fn get_cancel_token(id: &str) -> Arc<AtomicBool> {
    let map = CANCEL_TOKENS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut map = map.lock().unwrap();
    let token = Arc::new(AtomicBool::new(false));
    map.insert(id.to_string(), token.clone());
    token
}

#[tauri::command]
pub fn cancel_install_mrpack(id: String) {
    if let Some(map) = CANCEL_TOKENS.get() {
        if let Some(token) = map.lock().unwrap().get(&id) {
            token.store(true, Ordering::SeqCst);
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct MrPackIndex {
    #[serde(rename = "formatVersion")]
    pub format_version: u32,
    pub game: String,
    #[serde(rename = "versionId")]
    pub version_id: String,
    pub name: String,
    pub summary: Option<String>,
    pub files: Vec<MrPackFile>,
    pub dependencies: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub struct MrPackFile {
    pub path: String,
    pub hashes: HashMap<String, String>,
    pub env: Option<HashMap<String, String>>,
    pub downloads: Vec<String>,
    #[serde(rename = "fileSize")]
    pub file_size: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct InstallProgress {
    pub state: String,
    pub current: usize,
    pub total: usize,
    pub message: String,
}

fn emit_progress(app: &AppHandle, state: &str, current: usize, total: usize, message: &str) {
    let _ = app.emit(
        "pack-install-progress",
        InstallProgress {
            state: state.to_string(),
            current,
            total,
            message: message.to_string(),
        },
    );
}

#[tauri::command]
pub async fn install_mrpack(
    app: AppHandle,
    url: String,
    pack_name: String,
    pack_version: String,
    icon_url: Option<String>,
    project_id: Option<String>,
    pack_description: Option<String>,
) -> Result<String, String> {
    let tracking_id = project_id.unwrap_or_else(|| pack_name.clone());
    let cancel_token = get_cancel_token(&tracking_id);

    emit_progress(
        &app,
        "downloading_pack",
        0,
        1,
        "Baixando metadados do modpack...",
    );

    let client = Client::builder()
        .user_agent("VerdantLauncher/0.1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let verdant_dir = {
        #[cfg(target_os = "windows")]
        {
            let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA nao encontrado".to_string())?;
            PathBuf::from(appdata).join(".verdant")
        }
        #[cfg(not(target_os = "windows"))]
        {
            let home = std::env::var("HOME").map_err(|_| "HOME nao encontrado".to_string())?;
            PathBuf::from(home).join(".config").join("verdant-launcher")
        }
    };
    let temp_dir = verdant_dir.join("temp");
    fs::create_dir_all(&temp_dir).ok();

    let mrpack_path = temp_dir.join(format!("{}.mrpack", pack_version));

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Erro ao baixar mrpack: {}", res.status()));
    }

    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    fs::write(&mrpack_path, &bytes).map_err(|e| e.to_string())?;

    if cancel_token.load(Ordering::SeqCst) {
        fs::remove_file(&mrpack_path).ok();
        return Err("CANCELLED".to_string());
    }

    emit_progress(&app, "extracting", 0, 1, "Lendo pacote...");

    let file = fs::File::open(&mrpack_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let index_str = {
        let mut index_file = archive
            .by_name("modrinth.index.json")
            .map_err(|_| "modrinth.index.json nao encontrado")?;
        let mut content = String::new();
        use std::io::Read;
        index_file
            .read_to_string(&mut content)
            .map_err(|e| e.to_string())?;
        content
    };

    let index: MrPackIndex =
        serde_json::from_str(&index_str).map_err(|e| format!("Erro lendo index: {}", e))?;

    let mc_version = index
        .dependencies
        .get("minecraft")
        .ok_or("Versao do Minecraft nao especificada")?
        .clone();

    let (loader, loader_version) = if let Some(fabric) = index.dependencies.get("fabric-loader") {
        ("fabric".to_string(), Some(fabric.clone()))
    } else if let Some(forge) = index.dependencies.get("forge") {
        ("forge".to_string(), Some(forge.clone()))
    } else if let Some(quilt) = index.dependencies.get("quilt-loader") {
        ("quilt".to_string(), Some(quilt.clone()))
    } else if let Some(neoforge) = index.dependencies.get("neoforge") {
        ("neoforge".to_string(), Some(neoforge.clone()))
    } else {
        ("vanilla".to_string(), None)
    };

    let id: String = pack_name
        .to_lowercase()
        .replace(" ", "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect();
    let base_instance_id = format!("{}-{}", id, pack_version.replace(".", "-"));

    let mut instance_id = base_instance_id.clone();
    let mut final_pack_name = pack_name.clone();
    let mut instance_dir = verdant_dir.join("instances").join(&instance_id);
    let mut counter = 2;

    while instance_dir.exists() {
        instance_id = format!("{}-{}", base_instance_id, counter);
        final_pack_name = format!("{} ({})", pack_name, counter);
        instance_dir = verdant_dir.join("instances").join(&instance_id);
        counter += 1;
    }

    fs::create_dir_all(&instance_dir).map_err(|e| e.to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();

    let config = InstanceConfig {
        id: instance_id.clone(),
        name: final_pack_name.clone(),
        description: pack_description.or(index.summary.clone()),
        mc_version,
        loader,
        loader_version,
        ram_mb: 4096,
        java_args: None,
        icon_path: icon_url.clone(),
        created_at: timestamp,
    };

    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(instance_dir.join("instance.json"), json).map_err(|e| e.to_string())?;

    emit_progress(&app, "extracting", 1, 1, "Extraindo overrides...");
    for i in 0..archive.len() {
        if cancel_token.load(Ordering::SeqCst) {
            fs::remove_dir_all(&instance_dir).ok();
            fs::remove_file(&mrpack_path).ok();
            return Err("CANCELLED".to_string());
        }

        let mut file = archive.by_index(i).unwrap();
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let mut out_p = None;
        if outpath.starts_with("overrides") {
            out_p = Some(outpath.strip_prefix("overrides").unwrap().to_owned());
        } else if outpath.starts_with("client-overrides") {
            out_p = Some(outpath.strip_prefix("client-overrides").unwrap().to_owned());
        }

        if let Some(stripped_path) = out_p {
            let target = instance_dir.join(&stripped_path);
            if (*file.name()).ends_with('/') {
                fs::create_dir_all(&target).ok();
            } else {
                if let Some(p) = target.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p).ok();
                    }
                }
                let mut outfile = fs::File::create(&target).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
    }

    let valid_files: Vec<_> = index
        .files
        .into_iter()
        .filter(|f| {
            if let Some(env) = &f.env {
                if let Some(client) = env.get("client") {
                    if client == "unsupported" {
                        return false;
                    }
                }
            }
            true
        })
        .collect();

    let total_valid = valid_files.len();

    let total_bytes: u64 = valid_files.iter().filter_map(|f| f.file_size).sum();
    for (i, file_info) in valid_files.into_iter().enumerate() {
        if cancel_token.load(Ordering::SeqCst) {
            fs::remove_dir_all(&instance_dir).ok();
            fs::remove_file(&mrpack_path).ok();
            return Err("CANCELLED".to_string());
        }

        let filename = Path::new(&file_info.path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let msg = format!("Baixando {}...", filename);
        emit_progress(&app, "downloading_mods", i, total_valid, &msg);

        if let Some(download_url) = file_info.downloads.first() {
            let target_path = instance_dir.join(&file_info.path);
            if let Some(p) = target_path.parent() {
                fs::create_dir_all(p).ok();
            }

            let mod_res = client.get(download_url).send().await;
            if let Ok(mres) = mod_res {
                if mres.status().is_success() {
                    if let Ok(mod_bytes) = mres.bytes().await {
                        fs::write(&target_path, &mod_bytes).ok();
                    }
                }
            }
        }
    }

    fs::remove_file(&mrpack_path).ok();

    if let Some(i_url) = icon_url {
        if !i_url.is_empty() {
            emit_progress(
                &app,
                "downloading_icon",
                total_valid,
                total_valid,
                "Baixando icone do modpack...",
            );
            if let Ok(icon_res) = client.get(&i_url).send().await {
                if icon_res.status().is_success() {
                    if let Ok(icon_bytes) = icon_res.bytes().await {
                        fs::write(instance_dir.join("icon.png"), &icon_bytes).ok();
                    }
                }
            }
        }
    }

    emit_progress(
        &app,
        "done",
        total_valid,
        total_valid,
        "Modpack instalado com sucesso!",
    );

    Ok(instance_id)
}


