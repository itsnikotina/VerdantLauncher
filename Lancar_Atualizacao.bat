@echo off
setlocal enabledelayedexpansion
title Verdant Launcher - Lançador Magico de Atualizações
color 0B

echo ====================================================
echo   VERDANT LAUNCHER - LANCADOR DE ATUALIZACAO (AUTO)
echo ====================================================
echo.
echo Para lancar uma atualizacao, o sistema fara tudo sozinho:
echo 1. Atualizar o tauri.conf.json e package.json
echo 2. Commitar e mandar pro GitHub
echo 3. O GitHub compilara os .exe e .AppImage
echo 4. O GitHub atualizara o verdant-updater.json sozinho!
echo.

set /p NEW_VERSION="Digite a NOVA VERSAO (ex: 0.3.0): "
if "!NEW_VERSION!"=="" (
    echo Versao nao pode ser vazia!
    pause & exit /b 1
)

echo.
echo [1/4] Atualizando package.json para !NEW_VERSION!...
call npm --no-git-tag-version version !NEW_VERSION!

echo [2/4] Atualizando tauri.conf.json...
node -e "const fs=require('fs'); let f=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json')); f.version='!NEW_VERSION!'; f.bundle.createUpdaterArtifacts=true; fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(f, null, 2));"

echo [3/4] Commitando alteracoes...
git add package.json package-lock.json src-tauri/tauri.conf.json
git commit -m "Lançando versao v!NEW_VERSION!"

echo [4/4] Criando tag e enviando para o GitHub (A magica comeca aqui!)...
git tag v!NEW_VERSION!
git push origin main
git push origin v!NEW_VERSION!

echo.
color 0A
echo ====================================================
echo   SUCESSO! O GITHUB ASSUMIU O CONTROLE AGORA.
echo ====================================================
echo O robo do GitHub ja esta trabalhando na versao v!NEW_VERSION!
echo.
echo 1. O GitHub compilara o jogo.
echo 2. O GitHub assinara os executaveis.
echo 3. O GitHub editara o arquivo 'verdant-updater.json' sozinho.
echo.
echo O launcher dos jogadores vai se auto-atualizar assim que
echo a aba Actions do Github terminar (leva uns 10 minutos).
echo.
pause
