# Media Meta Tagging MVP (Electron)

A minimal Electron app that lets you select or drag-and-drop media files, then attach metadata (tags, description, color) **without renaming or modifying the original files**. Metadata is stored in a JSON file under Electron's `userData` directory.

## Features
- Select files via dialog or drag & drop
- Add/edit tags, description, and a color swatch
- Filter by filename or tag
- Auto-saves edits
- Cross-platform (Windows/macOS)

## Prereqs
- Node.js 18+
- Git (optional)

## Install & Run
```bash
# 1) Install dependencies
npm install

# 2) Start in dev
npm start
```

## Package for Distribution
This project includes `electron-builder`.

```bash
# macOS signing/notarization not configured. For a local build:
npm run dist
```

Artifacts are written to `dist/`.

## Where is metadata stored?
Electron's `app.getPath('userData')`, as `metadata.json`. On macOS it's typically:
`~/Library/Application Support/Media Meta Tagging MVP/metadata.json` (actual folder name may vary by appId).

## Notes
- This is a simple MVP. For larger datasets consider moving to SQLite/Better-Sqlite3 or LowDB.
- Thumbnails/previews are not implemented to keep the MVP small and secure.