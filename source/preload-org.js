// preload.js — expose safe APIs to the renderer
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');

contextBridge.exposeInMainWorld('dbm', {
  selectFiles: (opts = {}) => ipcRenderer.invoke('select-files', opts),
  write: (filePath, fields) => ipcRenderer.invoke('write-embedded', { filePath, fields }),
  read: (filePath) => ipcRenderer.invoke('read-embedded', { filePath }),

  // NEW: read file as Uint8Array for TIFF decoding
  readBinary: async (filePath) => {
    const buf = fs.readFileSync(filePath);               // Buffer
    return Uint8Array.from(buf);                         // passable to renderer
  },

  log: (...args) => ipcRenderer.send('dbm:log', args)
});
