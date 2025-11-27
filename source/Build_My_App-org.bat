@echo off
title Media Meta Tagger - One Click Portable Build
setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION

echo === Checking for Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Node.js not found. Attempting to install Node.js LTS via winget...
  where winget >nul 2>nul
  if %ERRORLEVEL% EQU 0 (
    winget install --id OpenJS.NodeJS.LTS --source winget --accept-package-agreements --accept-source-agreements --silent
    echo Waiting a few seconds for PATH to update...
    timeout /t 5 >nul
  ) else (
    echo winget is not available on this system.
    echo Please install Node.js LTS from https://nodejs.org and then re-run this file.
    pause
    exit /b 1
  )
)

echo === Verifying Node...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Node still not detected. Please install Node.js LTS from https://nodejs.org and re-run.
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

echo === Building portable Windows .exe ...
call npx electron-builder --win portable
if %ERRORLEVEL% NEQ 0 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo === DONE! Opening the dist folder...
echo Double-click the generated .exe to run the app. Node.js is NOT required for your end users.
start "" "%cd%\dist"
pause
exit /b 0
