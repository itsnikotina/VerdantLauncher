use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize)]
pub struct InstanceConfig {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub mc_version: String,
    pub loader: String,
    pub loader_version: Option<String>,
    pub ram_mb: u32,
    pub java_args: Option<String>,
    pub icon_path: Option<String>,
    pub created_at: String,
    pub last_played: Option<u64>,
}

fn get_instances_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA nao encontrado".to_string())?;
        Ok(PathBuf::from(appdata).join(".verdant").join("instances"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME nao encontrado".to_string())?;
        Ok(PathBuf::from(home).join(".config").join("verdant-launcher").join("instances"))
    }
}

#[tauri::command]
pub fn get_instances() -> Result<String, String> {
    let dir = get_instances_dir()?;
    if !dir.exists() {
        return Ok("[]".to_string());
    }

    let mut instances = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        if let Ok(entry) = entry {
            let json_path = entry.path().join("instance.json");
            if json_path.exists() {
                if let Ok(content) = fs::read_to_string(&json_path) {
                    if let Ok(mut config) = serde_json::from_str::<InstanceConfig>(&content) {
                        let icon_path = entry.path().join("icon.png");
                        if icon_path.exists() {
                            if let Ok(bytes) = fs::read(&icon_path) {
                                use base64::{engine::general_purpose::STANDARD, Engine as _};
                                let b64 = STANDARD.encode(&bytes);
                                config.icon_path = Some(format!("data:image/png;base64,{}", b64));
                            } else {
                                config.icon_path = None;
                            }
                        } else {
                            config.icon_path = None;
                        }
                        instances.push(config);
                    }
                }
            }
        }
    }

    instances.sort_by(|a, b| {
        let a_time = a.last_played.unwrap_or(0);
        let b_time = b.last_played.unwrap_or(0);
        
        let cmp = b_time.cmp(&a_time);
        if cmp != std::cmp::Ordering::Equal {
            return cmp;
        }
        b.created_at.cmp(&a.created_at)
    });

    serde_json::to_string(&instances).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn swap_instances_order(id1: String, id2: String) -> Result<(), String> {
    let dir = get_instances_dir()?;
    let p1 = dir.join(&id1).join("instance.json");
    let p2 = dir.join(&id2).join("instance.json");

    if !p1.exists() || !p2.exists() {
        return Err("Instancias nao encontradas".into());
    }

    let mut c1: InstanceConfig = serde_json::from_str(&fs::read_to_string(&p1).unwrap_or_default()).map_err(|e| e.to_string())?;
    let mut c2: InstanceConfig = serde_json::from_str(&fs::read_to_string(&p2).unwrap_or_default()).map_err(|e| e.to_string())?;

    let t1 = c1.last_played.unwrap_or(0);
    let t2 = c2.last_played.unwrap_or(0);

    if t1 == t2 {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
        // Se ambos não foram jogados ainda, damos prioridade artificial pro c1 que tentamos subir
        c1.last_played = Some(now);
        c2.last_played = Some(now - 1);
    } else {
        c1.last_played = Some(t2);
        c2.last_played = Some(t1);
    }

    fs::write(&p1, serde_json::to_string_pretty(&c1).unwrap_or_default()).map_err(|e| e.to_string())?;
    fs::write(&p2, serde_json::to_string_pretty(&c2).unwrap_or_default()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_last_played(id: String) -> Result<(), String> {
    let dir = get_instances_dir()?;
    let json_path = dir.join(&id).join("instance.json");
    if json_path.exists() {
        if let Ok(content) = fs::read_to_string(&json_path) {
            if let Ok(mut config) = serde_json::from_str::<InstanceConfig>(&content) {
                let timestamp = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                config.last_played = Some(timestamp);
                if let Ok(updated) = serde_json::to_string_pretty(&config) {
                    let _ = fs::write(json_path, updated);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn create_instance(
    name: String,
    description: Option<String>,
    mc_version: String,
    loader: String,
    loader_version: Option<String>,
) -> Result<String, String> {
    let dir = get_instances_dir()?;

    let id: String = name
        .to_lowercase()
        .replace(" ", "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect();

    if id.is_empty() {
        return Err("O nome da instancia deve conter letras ou numeros.".to_string());
    }

    let instance_dir = dir.join(&id);

    if instance_dir.exists() {
        return Err("Ja existe uma instancia com esse nome.".to_string());
    }

    fs::create_dir_all(&instance_dir).map_err(|e| e.to_string())?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();

    let config = InstanceConfig {
        id: id.clone(),
        name,
        description,
        mc_version,
        loader,
        loader_version,
        ram_mb: 4096,
        java_args: None,
        icon_path: None,
        created_at: timestamp,
        last_played: None,
    };

    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(instance_dir.join("instance.json"), json).map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub fn delete_instance(id: String) -> Result<String, String> {
    let dir = get_instances_dir()?;
    let instance_dir = dir.join(&id);

    if !instance_dir.exists() {
        return Err("instancia nao encontrada.".to_string());
    }

    fs::remove_dir_all(&instance_dir).map_err(|e| format!("Falha ao apagar arquivos: {}", e))?;

    Ok("instancia apagada com sucesso!".to_string())
}

#[tauri::command]
pub fn open_instance_folder(id: String) -> Result<(), String> {
    let dir = get_instances_dir()?;
    let instance_dir = dir.join(&id);

    if !instance_dir.exists() {
        return Err("instancia nao encontrada.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&instance_dir)
            .spawn()
            .map_err(|e| format!("Falha ao abrir pasta: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&instance_dir)
            .spawn()
            .map_err(|e| format!("Falha ao abrir pasta: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&instance_dir)
            .spawn()
            .map_err(|e| format!("Falha ao abrir pasta: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn update_instance(
    id: String,
    name: String,
    description: Option<String>,
    ram_mb: u32,
    java_args: Option<String>,
) -> Result<(), String> {
    let dir = get_instances_dir()?;
    let instance_dir = dir.join(&id);
    let json_path = instance_dir.join("instance.json");

    if !json_path.exists() {
        return Err("Instância não encontrada.".to_string());
    }

    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let mut config: InstanceConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    config.name = name;
    config.description = description;
    config.ram_mb = ram_mb;

    // Tratando strings vazias como None para não salvar parâmetros inúteis
    config.java_args = match java_args {
        Some(args) if args.trim().is_empty() => None,
        Some(args) => Some(args),
        None => None,
    };

    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(json_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn read_image_file(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Falha ao ler arquivo: {}", e))?;
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let b64 = STANDARD.encode(&bytes);

    // Simplistic mime type detection based on extension
    let mime = if path.to_lowercase().ends_with(".png") {
        "image/png"
    } else if path.to_lowercase().ends_with(".jpg") || path.to_lowercase().ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "image/png" // Fallback
    };

    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
pub fn set_instance_icon(id: String, image_path: Option<String>) -> Result<(), String> {
    let dir = get_instances_dir()?;
    let instance_dir = dir.join(&id);

    if !instance_dir.exists() {
        return Err("instancia nao encontrada.".to_string());
    }

    let icon_dest = instance_dir.join("icon.png");

    if let Some(path) = image_path {
        fs::copy(&path, &icon_dest).map_err(|e| format!("Erro ao copiar imagem: {}", e))?;
    } else {
        if icon_dest.exists() {
            fs::remove_file(&icon_dest).map_err(|e| format!("Erro ao remover icone: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn set_instance_icon_data(id: String, image_data: Vec<u8>) -> Result<(), String> {
    let dir = get_instances_dir()?;
    let instance_dir = dir.join(&id);

    if !instance_dir.exists() {
        return Err("instancia nao encontrada.".to_string());
    }

    let icon_dest = instance_dir.join("icon.png");
    fs::write(&icon_dest, image_data).map_err(|e| format!("Erro ao salvar imagem: {}", e))?;

    Ok(())
}
