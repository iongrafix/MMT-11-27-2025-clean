const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow;

const APP_NAME = 'Media Meta Tagger';
const LOG_FILE = path.join(app.getPath('userData'), 'app-logs', `app-${new Date().toISOString().slice(0, 10)}.log`);

function ensureLogDir() {
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error('Failed to create log directory', err);
  }
}

function log(...args) {
  const msg = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  ensureLogDir();
  try {
    fs.appendFileSync(LOG_FILE, msg, 'utf8');
  } catch (err) {
    console.error('Failed to write log', err);
  }
  if (mainWindow) {
    mainWindow.webContents.send('app:log', msg.trimEnd());
  }
  console.log(msg.trimEnd());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: APP_NAME,
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
// Simple tools check so app startup does not crash
async function ensureTools() {
  try {
    if (process.platform === 'win32') {
      // On Windows we expect a bundled exiftool.exe
      const exifPath = path.join(MTAG_ROOT, 'tools', 'exiftool.exe');
      if (!fs.existsSync(exifPath)) {
        log('ensureTools: exiftool.exe not found at', exifPath);
      } else {
        log('ensureTools: exiftool.exe OK at', exifPath);
      }
    } else {
      // On macOS we use the Homebrew exiftool in /opt/homebrew/bin/exiftool
      log('ensureTools: macOS – using Homebrew exiftool');
    }
  } catch (err) {
    log('ensureTools ERROR', err.message || err);
  }
}

app.on('ready', () => {
  createWindow();
  ensureTools();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ---------------------------------------------------------
// ---------------------------------------------------------
// Tools / exiftool setup (cross-platform)
const EXIFTOOL_PATH =
  process.platform === 'win32'
    ? path.join(MTAG_ROOT, 'tools', 'exiftool.exe')   // Windows
    : '/opt/homebrew/bin/exiftool';                   // macOS (Homebrew)

function runExif(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(EXIFTOOL_PATH, args, {
      cwd: cwd || undefined,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      log('runExif spawn ERROR', err.message);
      reject(err);
    });

    child.on('close', (code) => {
      if (code !== 0 && stderr.trim()) {
        const err = new Error(stderr.trim());
        log('runExif exit ERROR', err.message);
        return reject(err);
      }

      resolve({ stdout, stderr });
    });
  });
}
// ---------------------------------------------------------
// IPC: dialogs
// ---------------------------------------------------------
ipcMain.handle('dialog:open', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'heic', 'mp4', 'mov'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return null;
  }
  const file = result.filePaths[0];
  log('dialog:open ->', file);
  return file;
});

// ---------------------------------------------------------
// Tag helpers
// ---------------------------------------------------------
function splitTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0);
  }
  return String(input)
    .split(/[;,]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function normalizeTags(input) {
  const arr = splitTags(input);
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

// -------------------------------------------------------
// IPC: write metadata (Windows, exiftool)
// -------------------------------------------------------
function buildWriteArgs(file, { title, comments, windowsTags, macTags }) {
  // in-place overwrite to reduce temp-file rename issues
  const args = ['-m', '-P', '-overwrite_original_in_place'];

  const safeTitle = (title || '').trim();
  const safeComments = (comments || '').trim();

  // Normalize + de-duplicate tags from both boxes
  const fromWin = normalizeTags(windowsTags);
  const fromMac = normalizeTags(macTags);
  const allTags = [...fromWin, ...fromMac];

  const seen = new Set();
  const combinedTags = [];

  for (const raw of allTags) {
    const t = (raw || '').trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    combinedTags.push(t);
  }

  if (isVideo(file)) {
    // ---------- VIDEO: MP4 / MOV etc ----------

    // Title
    if (safeTitle) {
      args.push(
        `-QuickTime:Title=${safeTitle}`,
        `-XMP-dc:Title=${safeTitle}`
      );
    } else {
      args.push(
        '-QuickTime:Title=',
        '-XMP-dc:Title='
      );
    }

    // Comments
    if (safeComments) {
      args.push(
        `-QuickTime:Comment=${safeComments}`,
        `-XMP-dc:Description=${safeComments}`,
        `-XPComment=${safeComments}`,
        `-UserComment=${safeComments}`,
        `-Comment=${safeComments}`
      );
    } else {
      args.push(
        '-QuickTime:Comment=',
        '-XMP-dc:Description=',
        '-XPComment=',
        '-UserComment=',
        '-Comment='
      );
    }

    // Tags / Keywords
    if (combinedTags.length) {
  const joined = combinedTags.join('; ');

  args.push(
    // Cross-platform-ish
    `-XMP-dc:Subject=${joined}`,
    // Windows-friendly keyword fields
    `-XPKeywords=${joined}`,
    `-Keywords=${joined}`
    // We can re-introduce QuickTime/ItemList later
  );
} else {
  args.push(
    '-XMP-dc:Subject=',
    '-XPKeywords=',
    '-Keywords='
  );
}
  } else {
    // ---------- STILL IMAGES: JPG / PNG / TIFF / HEIC etc ----------

    // Title
    if (safeTitle) {
      args.push(
        `-Title=${safeTitle}`,
        `-XPTitle=${safeTitle}`,
        `-XMP-dc:Title=${safeTitle}`
      );
    } else {
      args.push(
        '-Title=',
        '-XPTitle=',
        '-XMP-dc:Title='
      );
    }

    // Comments
    if (safeComments) {
      args.push(
        `-XPComment=${safeComments}`,
        `-UserComment=${safeComments}`,
        `-Comment=${safeComments}`,
        `-XMP-dc:Description=${safeComments}`
      );
    } else {
      args.push(
        '-XPComment=',
        '-UserComment=',
        '-Comment=',
        '-XMP-dc:Description='
      );
    }

    // Tags / Keywords
    if (combinedTags.length) {
      const joined = combinedTags.join('; ');

      args.push(
        `-XPKeywords=${joined}`,
        `-Keywords=${joined}`,
        `-XMP-dc:Subject=${joined}`
      );
    } else {
      args.push(
        '-XPKeywords=',
        '-Keywords=',
        '-XMP-dc:Subject='
      );
    }
  }

  args.push(file);
  return args;
}

// -------------------------------------------------------
// IPC: clear metadata (Windows, exiftool)
// -------------------------------------------------------
function buildClearArgs(file) {
  const args = ['-m', '-P', '-overwrite_original_in_place'];

  if (isVideo(file)) {
    // VIDEO: MP4 / MOV — clear comments, title, and tags safely
    args.push(
      '-QuickTime:Title=',
      '-XMP-dc:Title=',
      '-QuickTime:Comment=',
      '-XMP-dc:Description=',
      '-XPComment=',
      '-UserComment=',
      '-Comment=',
      '-XMP-dc:Subject=',
      '-XPKeywords=',
      '-Keywords='
      // (NO ItemList:Keywords, NO QuickTime:Keywords)
    );
  } else {
    // STILL IMAGES: JPG / PNG / TIFF / HEIC
    args.push(
      '-Title=',
      '-XPTitle=',
      '-XMP-dc:Title=',
      '-XPComment=',
      '-UserComment=',
      '-Comment=',
      '-XMP-dc:Description=',
      '-XPKeywords=',
      '-Keywords=',
      '-XMP-dc:Subject='
    );
  }

  args.push(file);
  return args;
}


async function safeWrite(args, file) {
  // Simple safety wrapper: write directly; you already have backups by versioning/zips
  const cwd = path.dirname(file);
  await runExif(args, cwd);
}
// ---------------------------------------------------------
// Media helper: which files should we treat as taggable media?
// ---------------------------------------------------------
const MEDIA_EXTS = [
  '.jpg', '.jpeg', '.png', '.tif', '.tiff', '.heic',
  '.mov', '.mp4', '.m4v', '.avi', '.heif', '.bmp'
];

function isMedia(file) {
  if (!file) return false;
  const ext = path.extname(file).toLowerCase();
  return MEDIA_EXTS.includes(ext);
}
const VIDEO_EXTS = [
  '.mp4',
  '.mov',
  '.m4v',
  '.avi',
  '.mkv'
];

function isVideo(file) {
  if (!file) return false;
  const ext = path.extname(file).toLowerCase();
  return VIDEO_EXTS.includes(ext);
}

// ---------------------------------------------------------
// IPC: write / read / clear metadata
// ---------------------------------------------------------
ipcMain.handle('exif:write-win', async (_e, payload) => {
  try {
    const { file, title, comments, windowsTags, macTags } = payload || {};
    if (!file || !isMedia(file)) throw new Error('No/unsupported file');
    log('write-win', file);

    const args = buildWriteArgs(file, { title, comments, windowsTags, macTags });
    await safeWrite(args, file);
    return { ok: true };
  } catch (err) {
    log('write-win ERROR', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('exif:read-win', async (_e, file) => {
  try {
    if (!file || !isMedia(file)) throw new Error('No/unsupported file');
    log('read-win', file);

    const args = ['-m', '-P', '-j'];

    if (isVideo(file)) {
      args.push(
        '-QuickTime:Title',
        '-XMP-dc:Title',
        '-Title',
        '-QuickTime:Comment',
        '-XMP-dc:Description',
        '-Comment'
      );
    } else {
      args.push('-Title', '-XMP-dc:Title', '-Comment', '-XMP-dc:Description');
    }

    // Tags for both Windows + macOS
    args.push('-XPKeywords', '-Keywords', '-XMP-dc:Subject');
    args.push(file);

    const { stdout } = await runExif(args, path.dirname(file));
    const arr = JSON.parse(stdout || '[]');
    const raw = arr && arr[0] ? arr[0] : {};

    const title = isVideo(file)
      ? (raw['QuickTime:Title'] || raw['XMP-dc:Title'] || raw.Title || '')
      : (raw.Title || raw['XMP-dc:Title'] || '');

    const comments = isVideo(file)
      ? (raw['QuickTime:Comment'] || raw['XMP-dc:Description'] || raw.Comment || '')
      : (raw.Comment || raw['XMP-dc:Description'] || '');

    const winRaw = raw.XPKeywords || raw.Keywords;
    const macRaw = raw['XMP-dc:Subject'];

    const windowsTags = normalizeTags(winRaw);
    const macTags = normalizeTags(macRaw);

    const finalWindowsTags = windowsTags.length ? windowsTags : macTags.slice();

    return {
      ok: true,
      title,
      comments,
      windowsTags: finalWindowsTags,
      macTags,
    };
  } catch (err) {
    log('read-win ERROR', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('exif:clear', async (_e, file) => {
  try {
    if (!file || !isMedia(file)) throw new Error('No/unsupported file');
    log('clear-win', file);

    const args = buildClearArgs(file);
    const cwd = path.dirname(file);
    await runExif(args, cwd);

    return { ok: true };
  } catch (err) {
    log('clear-win ERROR', err.message);
    return { ok: false, error: err.message };
  }
});

// ---------------------------------------------------------
// Logs
// ---------------------------------------------------------
ipcMain.handle('app:open-logs', async () => {
  try {
    ensureLogDir();
    await shell.openPath(LOG_FILE);
    return { ok: true };
  } catch (err) {
    log('open-logs ERROR', err.message);
    return { ok: false, error: err.message };
  }
});

function normalizePath(p) {
  if (!p) return '';
  return p.replace(/\\/g, '/');
}

log(APP_NAME, 'main process started');
