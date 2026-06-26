const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, selected Electron API bindings to the window context (renderer process)
contextBridge.exposeInMainWorld('electron', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isElectron: true
});
