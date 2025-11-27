# Windows Build Guide (Media Meta Tagging MVP)

This project ships ready to build **Windows** installers with **electron-builder**.

## Quick Start (Windows 10/11)

1) Install **Node.js LTS**: https://nodejs.org  
2) Unzip the project and open **PowerShell** in the project folder.
3) Run:
```powershell
npm install
```
4) Build the Windows installer (NSIS) and a portable ZIP:
```powershell
# x64 (most common)
npx electron-builder --win --x64

# or via helper script:
.\build-win.ps1
# optional arch:
.\build-win.ps1 -Arch arm64
```
5) Your artifacts will appear in the `dist\` folder:
- `Media Meta Tagger Setup X.Y.Z.exe` (NSIS installer)
- `media-meta-tagger-X.Y.Z-win.zip` (portable)

## Common Notes
- No code signing configured; Windows may show a SmartScreen prompt.
- Icons: you can add a `.ico` at `assets/icon.ico` and electron-builder will use it.
- If you hit network proxy/cert issues during install, try:
```powershell
npm config set strict-ssl false
```

## Development
```powershell
npm start
```

Metadata is saved under Electron's `userData` path as `metadata.json`, separate from your media files.