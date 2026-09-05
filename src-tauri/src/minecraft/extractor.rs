use std::fs;
use std::path::Path;
use zip::ZipArchive;

/// Descompacta um arquivo ZIP completo (Windows) ou tar.gz (Linux/macOS) para instalar o Java
pub fn extract_all(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let ext = archive_path.to_string_lossy();

    if ext.ends_with(".tar.gz") || ext.ends_with(".tgz") {
        extract_tar_gz(archive_path, dest_dir)
    } else {
        extract_zip(archive_path, dest_dir)
    }
}

fn extract_zip(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let file = fs::File::open(archive_path).map_err(|e| format!("Falha ao abrir ZIP: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Falha ao ler ZIP: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => dest_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn extract_tar_gz(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    use std::process::Command;
    // usa o 'tar' nativo do Linux/macOS — disponível em todas as distros
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    let status = Command::new("tar")
        .arg("-xzf")
        .arg(archive_path)
        .arg("-C")
        .arg(dest_dir)
        .arg("--strip-components=1") // Remove o diretório raiz dentro do tar (ex: jdk-21.0.1+...)
        .status()
        .map_err(|e| format!("Falha ao executar tar: {}", e))?;

    if !status.success() {
        return Err(format!("tar falhou com status: {:?}", status.code()));
    }
    Ok(())
}

/// Extrai arquivos de bibliotecas nativas (.dll no Windows, .so no Linux, .dylib no macOS)
/// dentro dos JARs e os coloca de forma "reta" na pasta 'natives'.
pub fn extract_natives(jar_path: &Path, natives_dir: &Path) -> Result<(), String> {
    let file = fs::File::open(jar_path).map_err(|e| format!("Falha ao abrir Jar Nativo: {}", e))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Falha ao ler Jar Nativo: {}", e))?;

    // Define a extensão de native library correta por plataforma
    let native_ext = if cfg!(target_os = "windows") {
        ".dll"
    } else if cfg!(target_os = "linux") {
        ".so"
    } else {
        ".dylib"
    };

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();

        // Ignora pastas e metadados, busca apenas arquivos nativos
        if name.ends_with(native_ext) {
            let filename = Path::new(&name).file_name().unwrap();
            let outpath = natives_dir.join(filename);

            // Só extrai se o arquivo já não existir para agilizar o boot
            if !outpath.exists() {
                let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}
