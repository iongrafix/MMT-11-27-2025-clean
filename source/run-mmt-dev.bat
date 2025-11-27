
@echo off
setlocal

rem ================================
rem Media Meta Tagger - DEV RUNNER
rem Uses the last known good 0.2.1 code
rem ================================

cd /d "%~dp0"

echo.
echo [MMT] Installing Node dependencies (this may take a minute the first time)...
echo.

call npm install

if errorlevel 1 (
    echo.
    echo [MMT] npm install FAILED. Check that Node.js and npm are installed and in your PATH.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo.
echo [MMT] Starting Electron app...
echo (If the window doesn't appear, check the terminal for errors.)
echo.

call npm start

echo.
echo [MMT] Electron app has exited.
echo Press any key to close this window...
pause >nul

endlocal
