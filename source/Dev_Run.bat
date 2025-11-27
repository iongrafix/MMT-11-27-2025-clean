@echo off
title Media Meta Tagger - Dev Run
setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION

echo === Installing dependencies (first run may take a minute)...
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo npm install failed.
  pause
  exit /b 1
)

echo === Launching the app in dev mode...
call npm start
