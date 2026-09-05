@echo off
echo Preparando ambiente de build...
powershell -ExecutionPolicy Bypass -File "%~dp0build_release.ps1"
pause
