@echo off
title Media Meta Tagger - Build Installer
setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION

echo === Checking for Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Please install Node.js LTS from https://nodejs.org then re-run this file.
  pause
  exit /b 1
)

echo === Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo npm install failed.
  pause
  exit /b 1
)

echo === Building Windows installer (.exe) and ZIP...
call npx electron-builder --win --x64
if %ERRORLEVEL% NEQ 0 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo === DONE! Opening the dist folder...
start "" "%cd%\dist"
pause
exit /b 0
