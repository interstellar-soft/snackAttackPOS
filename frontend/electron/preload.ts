import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';

type UpdaterMessage = {
  status: string;
  [key: string]: unknown;
};

const updaterChannel = 'updater/status';

contextBridge.exposeInMainWorld('electronAPI', {
  setupState: () => ipcRenderer.invoke('desktop/setup-state'),
  setupStore: (password: string) => ipcRenderer.invoke('desktop/setup', password),
  checkForUpdates: () => ipcRenderer.invoke('updater/check-now'),
  restartToUpdate: () => ipcRenderer.invoke('updater/restart-and-install'),
  onUpdateStatus: (callback: (message: UpdaterMessage) => void) => {
    const handler = (_event: IpcRendererEvent, payload: UpdaterMessage) => {
      callback(payload);
    };

    ipcRenderer.on(updaterChannel, handler);
    return () => {
      ipcRenderer.removeListener(updaterChannel, handler);
    };
  }
});
