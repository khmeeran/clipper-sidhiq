const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  
  getEnvironment: () => ipcRenderer.invoke('get-environment'),
  
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  downloadVideo: (options) => ipcRenderer.invoke('download-video', options),
  
  cancelDownload: (taskId) => ipcRenderer.invoke('cancel-download', taskId),
  
  onDownloadProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('download-progress', listener);
    return () => ipcRenderer.removeListener('download-progress', listener);
  },
  
  validateMedia: (filePath) => ipcRenderer.invoke('validate-media', filePath),
  
  readMediaFile: (filePath) => ipcRenderer.invoke('read-media-file', filePath),
  
  saveClip: (options) => ipcRenderer.invoke('save-clip', options),
  
  openFolder: (targetPath) => ipcRenderer.invoke('open-folder', targetPath)
});
