import { contextBridge, ipcRenderer } from 'electron';

type UpdaterMessage = {
  status: string;
  [key: string]: unknown;
};

const updaterChannel = 'updater/status';

contextBridge.exposeInMainWorld('electronAPI', {
  checkForUpdates: () => ipcRenderer.invoke('updater/check-now'),
  restartToUpdate: () => ipcRenderer.invoke('updater/restart-and-install'),
  onUpdateStatus: (callback: (message: UpdaterMessage) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: UpdaterMessage) => {
      callback(payload);
    };

    ipcRenderer.on(updaterChannel, handler);
    return () => {
      ipcRenderer.removeListener(updaterChannel, handler);
    };
  }
});
