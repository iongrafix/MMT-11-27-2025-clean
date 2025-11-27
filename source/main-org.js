// main.js — stable, single-import, IPC wiring, file previews enabled
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

if (!app.requestSingleInstanceLock()) app.quit();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#0f1115',
    title: 'Media Meta Tagging — Digital Branding Masters',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false // allow file:/// previews
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Load metadata engine
let xmp;
try { xmp = require('./xmp-io.js'); }
catch (e) { dialog.showErrorBox('Startup error', 'Cannot load xmp-io.js.\n' + String(e)); }
const winWrite = xmp?.winWrite || xmp?.writeEmbedded;
const winRead  = xmp?.winRead  || xmp?.readEmbedded;

// IPC: Select Files
ipcMain.handle('select-files', async (_e, opts = {}) => {
  const filters = opts.filters || [
    { name: 'Media', extensions: ['png','jpg','jpeg','tif','tiff','webp','mp4','mov','m4v'] },
    { name: 'All Files', extensions: ['*'] }
  ];
  const properties = opts.properties || ['openFile', 'multiSelections'];
  return dialog.showOpenDialog({ properties, filters });
});

// IPC: Write / Read
const writeHandler = async (_e, payload) => {
  try {
    if (!winWrite) throw new Error('write handler not available (winWrite)');
    const { filePath } = payload || {};
    const fields = payload?.fields || {
      title: payload?.title ?? '',
      tags: payload?.tags ?? '',
      comments: payload?.comments ?? '',
      rating: payload?.rating ?? 0
    };
    if (!filePath) throw new Error('filePath is empty');
    await winWrite(filePath, fields);
    return { ok: true };
  } catch (err) {
    console.error('WRITE ERROR:', err);
    dialog.showErrorBox('Write failed', String(err));
    return { ok: false, error: String(err) };
  }
};
const readHandler = async (_e, { filePath }) => {
  try {
    if (!winRead) throw new Error('read handler not available (winRead)');
    if (!filePath) throw new Error('filePath is empty');
    const res = await winRead(filePath);
    return { ok: true, res };
  } catch (err) {
    console.error('READ ERROR:', err);
    dialog.showErrorBox('Read failed', String(err));
    return { ok: false, error: String(err) };
  }
};
ipcMain.handle('write-embedded', writeHandler);
ipcMain.handle('dbm:write',      writeHandler);
ipcMain.handle('winWrite',       writeHandler);
ipcMain.handle('read-embedded',  readHandler);
ipcMain.handle('dbm:read',       readHandler);
ipcMain.handle('winRead',        readHandler);

// Cleanly end exiftool
app.on('before-quit', () => { try { require('exiftool-vendored').exiftool.end(); } catch (_) {} });

// Show uncaught errors
process.on('uncaughtException', (err) => { try { dialog.showErrorBox('Uncaught Error', String(err?.stack || err)); } catch(_){} console.error(err); });
process.on('unhandledRejection', (reason) => { try { dialog.showErrorBox('Unhandled Promise Rejection', String(reason)); } catch(_){} console.error(reason); });
