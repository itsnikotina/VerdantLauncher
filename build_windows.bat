@echo off
setlocal
title Verdant Launcher - Build Windows
color 0A

echo.
echo ========================================
echo   VERDANT LAUNCHER - BUILD WINDOWS
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Instalando dependencias Node...
call npm install
if errorlevel 1 (
    color 0C
    echo ERRO: npm install falhou!
    pause & exit /b 1
)

echo.
echo [2/3] Compilando frontend...
call npm run build
if errorlevel 1 (
    color 0C
    echo ERRO: Build do frontend falhou!
    pause & exit /b 1
)

echo.
echo [3/3] Compilando Tauri (Rust + instalador)...
echo Isso pode demorar alguns minutos na primeira vez...
echo.

set START_TIME=%TIME%
call npm run tauri build
set END_TIME=%TIME%

if errorlevel 1 (
    color 0C
    echo.
    echo ========================================
    echo  ERRO: Build do Tauri falhou!
    echo ========================================
    pause & exit /b 1
)

echo.
color 0A
echo ========================================
echo   BUILD CONCLUIDO COM SUCESSO!
echo ========================================
echo.
echo Inicio: %START_TIME%
echo Fim:    %END_TIME%
echo.
echo Instaladores gerados em:
echo   src-tauri\target\release\bundle\
echo.
explorer "src-tauri\target\release\bundle\nsis"
pause
