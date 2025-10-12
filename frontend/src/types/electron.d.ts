export type UpdaterMessage =
  | { status: 'checking' }
  | { status: 'available'; version?: string }
  | { status: 'not-available'; version?: string }
  | { status: 'downloading'; percent: number; transferred?: number; total?: number }
  | { status: 'downloaded'; version?: string }
  | { status: 'error'; message: string }
  | { status: 'dev-mode' }
  | { status: 'disabled' }
  | { status: string; [key: string]: unknown };

type UpdateStatusCallback = (message: UpdaterMessage) => void;

export type BarcodeScanPayload = {
  code: string;
  raw: string;
  timestamp: number;
  path?: string;
};

export type BarcodeScannerStatus =
  | { status: 'disabled'; reason: 'not-configured' | 'not-found' }
  | { status: 'connecting'; path: string }
  | { status: 'connected'; path: string }
  | { status: 'disconnected'; path: string; reason?: string }
  | { status: 'error'; message: string; path?: string };

type BarcodeScanCallback = (payload: BarcodeScanPayload) => void;
type BarcodeStatusCallback = (status: BarcodeScannerStatus) => void;

declare global {
  interface Window {
    electronAPI?: {
      checkForUpdates?: () => Promise<unknown>;
      restartToUpdate?: () => Promise<void>;
      onUpdateStatus?: (callback: UpdateStatusCallback) => () => void;
      getBarcodeScannerStatus?: () => Promise<BarcodeScannerStatus>;
      restartBarcodeScanner?: () => Promise<BarcodeScannerStatus>;
      listBarcodeSerialPorts?: () => Promise<unknown>;
      onBarcodeScan?: (callback: BarcodeScanCallback) => () => void;
      onBarcodeScannerStatus?: (callback: BarcodeStatusCallback) => () => void;
    };
  }
}

export {};
