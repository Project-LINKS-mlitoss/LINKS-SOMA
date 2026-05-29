// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    abr: {
      checkData: () => ipcRenderer.invoke('abr:check-data'),
      checkDataForCode: (lgCode: string) => ipcRenderer.invoke('abr:check-data-for-code', lgCode),
      downloadData: (abrCode: string | string[]) => ipcRenderer.invoke('abr:download-data', abrCode),
      downloadDataWithProgress: (abrCodes: string | string[]) => ipcRenderer.invoke('abr:download-data-with-progress', abrCodes),
      deleteData: () => ipcRenderer.invoke('abr:delete-data'),
      onDownloadProgress: (callback: (progress: string) => void) => {
        ipcRenderer.on('abr:download-progress', (_event, progress) => callback(progress));
        return () => {
          ipcRenderer.removeAllListeners('abr:download-progress');
        };
      },
      geocode: (address: string) => ipcRenderer.invoke('abr:geocode', address),
      geocodeBatch: (addresses: string[]) => ipcRenderer.invoke('abr:geocode-batch', addresses),
    },
    prefectureFile: {
      save: (fileBuffer: ArrayBuffer, fileName: string) => {
        // Convert ArrayBuffer to Buffer
        const buffer = Buffer.from(fileBuffer);
        return ipcRenderer.invoke('prefecture-file:save', buffer, fileName);
      },
      getDefault: () => ipcRenderer.invoke('prefecture-file:get-default'),
      readDefault: () => ipcRenderer.invoke('prefecture-file:read-default'),
    },
});
