@echo off
chcp 65001 >nul
title SKC-App
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js installieren: https://nodejs.org  ^(LTS-Version^)
  pause
  exit /b 1
)
if not exist node_modules (
  echo Einmalige Einrichtung: lade Bausteine herunter ...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)
call npm run lokal
pause
