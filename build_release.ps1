$ErrorActionPreference = "Stop"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERDANT LAUNCHER - BUILD AUTOMATIZADO " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Pegar versao atual do tauri.conf.json
$tauriConfPath = "src-tauri\tauri.conf.json"
$tauriConf = Get-Content -Raw $tauriConfPath | ConvertFrom-Json
$version = $tauriConf.version
Write-Host "-> Versao detectada: v$version" -ForegroundColor Green

# 2. Configurar a chave de assinatura
$keyPath = "updater.key"
if (-not (Test-Path $keyPath)) {
    Write-Host "ERRO: updater.key nao encontrado na raiz!" -ForegroundColor Red
    exit 1
}
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw $keyPath

# 3. Rodar o build
Write-Host "-> Iniciando compilacao (isso vai demorar alguns minutos)..." -ForegroundColor Yellow
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: O build falhou!" -ForegroundColor Red
    exit 1
}

# 4. Definir caminhos e nomes originais gerados pelo Tauri
$nsisPath = "src-tauri\target\release\bundle\nsis"
$originalExeName = "Verdant Launcher_$($version)_x64-setup.exe"
$originalSigName = "$originalExeName.sig"

$exePath = Join-Path $nsisPath $originalExeName
$sigPath = Join-Path $nsisPath $originalSigName

if (-not (Test-Path $exePath)) {
    Write-Host "ERRO: Executavel nao encontrado em $exePath" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $sigPath)) {
    Write-Host "ERRO: Assinatura de atualizacao nao encontrada em $sigPath" -ForegroundColor Red
    exit 1
}

# 5. Criar pastas de saida
$outDir = "builds\v$version"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

# 6. Copiar e renomear os arquivos limpos
$cleanExeName = "VerdantLauncher-v$version-windows-setup.exe"
$finalExePath = Join-Path $outDir $cleanExeName

Copy-Item -Path $exePath -Destination $finalExePath -Force

Write-Host "-> Arquivo copiado para a pasta $outDir" -ForegroundColor Green

# 7. Gerar JSON do Supabase
$signature = Get-Content -Raw $sigPath
$signature = $signature.Trim()
$dateString = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$json = @"
{
  "version": "$version",
  "notes": "Nova atualizacao do Verdant Launcher v$version",
  "pub_date": "$dateString",
  "platforms": {
    "windows-x86_64": {
      "signature": "$signature",
      "url": "https://github.com/itsnikotina/VerdantLauncher/releases/download/v$version/$cleanExeName"
    }
  }
}
"@
$jsonPath = Join-Path $outDir "verdant-updater.json"
# Usa UTF8Encoding($false) para nao adicionar o BOM (Byte Order Mark), que causa erro no Tauri
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($jsonPath, $json, $utf8NoBom)

# 8. Gerar instrucoes textuais
$instrucoes = @"
==================================================
 PASSO A PASSO PARA LANCAR A VERSAO v$version
==================================================

1. GITHUB (Onde os arquivos ficam hospedados):
   - Va no seu repositorio: https://github.com/itsnikotina/VerdantLauncher/releases/new
   - Crie uma nova tag chamada: v$version
   - Faca o upload do instalador que esta nesta pasta:
     -> $cleanExeName
   - Clique em 'Publish release'!

2. GITHUB (Arquivo do Auto-Updater):
   - Pegue o arquivo 'verdant-updater.json' gerado nesta pasta.
   - Jogue ele na RAIZ do seu repositorio no Github (basta dar commit/push).
   - O launcher agora vai checar atualizacoes direto pelo Github, o cache dele e
     de no maximo 5 minutinhos (muito melhor que o Supabase)!
     
3. ATENCAO (Transito da versao antiga para a nova):
   Como os launchers antigos (v0.1.7 pra baixo) ainda estao configurados 
   pra olhar pro Supabase, suba esse arquivo 'verdant-updater.json' TAMBEM 
   la no Supabase pela ULTIMA VEZ. Assim as pessoas recebem a v0.1.8 e o 
   novo launcher passa a olhar so pro Github.
"@
$instPath = Join-Path $outDir "LEIA-ME_INSTRUCOES.txt"
Set-Content -Path $instPath -Value $instrucoes -Encoding UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SUCESSO! TUDO PRONTO NA PASTA /builds " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
