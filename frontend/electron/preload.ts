import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type { BarcodeScanPayload, BarcodeScannerStatus } from './barcode';

type UpdaterMessage = {
  status: string;
  [key: string]: unknown;
};

const updaterChannel = 'updater/status';
const barcodeScanChannel = 'barcode/scan';
const barcodeStatusChannel = 'barcode/status';

contextBridge.exposeInMainWorld('electronAPI', {
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
  },
  getBarcodeScannerStatus: () => ipcRenderer.invoke('barcode/get-status'),
  restartBarcodeScanner: () => ipcRenderer.invoke('barcode/restart'),
  listBarcodeSerialPorts: () => ipcRenderer.invoke('barcode/list-ports'),
  onBarcodeScan: (callback: (payload: BarcodeScanPayload) => void) => {
    const handler = (_event: IpcRendererEvent, payload: BarcodeScanPayload) => {
      callback(payload);
    };

    ipcRenderer.on(barcodeScanChannel, handler);
    return () => {
      ipcRenderer.removeListener(barcodeScanChannel, handler);
    };
  },
  onBarcodeScannerStatus: (callback: (status: BarcodeScannerStatus) => void) => {
    const handler = (_event: IpcRendererEvent, status: BarcodeScannerStatus) => {
      callback(status);
    };

    ipcRenderer.on(barcodeStatusChannel, handler);
    return () => {
      ipcRenderer.removeListener(barcodeStatusChannel, handler);
    };
  }
});
