// preload.js – safe bridge between renderer and main
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mmt', {
  openFile: () => ipcRenderer.invoke('dialog:open'),
  readWin: (file) => ipcRenderer.invoke('exif:read-win', file),
  writeWin: (payload) => ipcRenderer.invoke('exif:write-win', payload),
  clear: (file) => ipcRenderer.invoke('exif:clear', file),
  openLogs: () => ipcRenderer.invoke('app:open-logs'),
  onLog: (cb) => {
    ipcRenderer.on('app:log', (_event, msg) => cb(msg));
  },
});
