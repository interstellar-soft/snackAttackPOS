import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

type BarcodeScannerStatus =
  | { status: 'disabled'; reason: 'not-configured' | 'not-found' }
  | { status: 'connecting'; path: string }
  | { status: 'connected'; path: string }
  | { status: 'disconnected'; path: string; reason?: string }
  | { status: 'error'; message: string; path?: string };

type BarcodeScanPayload = {
  code: string;
  raw: string;
  timestamp: number;
  path?: string;
};

const barcodeStatusChannel = 'barcode/status';
const barcodeScanChannel = 'barcode/scan';

let currentStatus: BarcodeScannerStatus = { status: 'disabled', reason: 'not-configured' };
let serialPort: SerialPort | null = null;
let parser: ReadlineParser | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let handlersRegistered = false;

const getRetryDelay = () => {
  const raw = process.env.BARCODE_SERIAL_RETRY_MS;
  if (!raw) {
    return 5000;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return 5000;
};

const getBaudRate = () => {
  const raw = process.env.BARCODE_SERIAL_BAUD_RATE ?? process.env.BARCODE_SERIAL_BAUD;
  if (!raw) {
    return 9600;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 9600;
};

const sendStatus = (status: BarcodeScannerStatus, windowProvider: () => BrowserWindow | null) => {
  currentStatus = status;
  const window = windowProvider();
  if (window) {
    window.webContents.send(barcodeStatusChannel, status);
  }
};

const sendScan = (payload: BarcodeScanPayload, windowProvider: () => BrowserWindow | null) => {
  const window = windowProvider();
  if (window) {
    window.webContents.send(barcodeScanChannel, payload);
  }
};

const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const destroyPort = () => {
  clearReconnectTimer();
  if (parser) {
    parser.removeAllListeners();
    parser = null;
  }
  if (serialPort) {
    serialPort.removeAllListeners();
    if (serialPort.isOpen) {
      try {
        serialPort.close();
      } catch (error) {
        log.error('Failed to close barcode serial port', error);
      }
    }
    serialPort = null;
  }
};

const scheduleReconnect = (
  windowProvider: () => BrowserWindow | null,
  path: string | undefined
) => {
  const delay = getRetryDelay();
  if (delay <= 0) {
    return;
  }
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void initializeBarcodeScanner(windowProvider, true);
  }, delay);
  const displayPath = path ?? 'unknown';
  log.warn(`Barcode scanner reconnect scheduled in ${delay}ms (path: ${displayPath}).`);
};

const resolveSerialPath = async (): Promise<string | null> => {
  const configured = process.env.BARCODE_SERIAL_PORT?.trim();
  if (configured) {
    return configured;
  }

  try {
    const ports = await SerialPort.list();
    if (ports.length === 1) {
      const [port] = ports;
      log.info('No BARCODE_SERIAL_PORT configured. Using the only detected serial port.', port);
      return port.path;
    }

    if (ports.length === 0) {
      log.warn('No serial ports detected for barcode scanner.');
    } else {
      log.warn(
        'Multiple serial ports detected. Set BARCODE_SERIAL_PORT to choose the barcode scanner port.',
        ports
      );
    }
  } catch (error) {
    log.error('Failed to list serial ports for barcode scanner', error);
  }

  return null;
};

const openSerialPort = async (windowProvider: () => BrowserWindow | null, skipDestroy = false) => {
  const path = await resolveSerialPath();
  if (!path) {
    sendStatus({ status: 'disabled', reason: 'not-found' }, windowProvider);
    destroyPort();
    return;
  }

  if (!skipDestroy) {
    destroyPort();
  }

  const baudRate = getBaudRate();
  log.info(`Opening barcode serial port ${path} at ${baudRate} baud.`);

  serialPort = new SerialPort({ path, baudRate, autoOpen: false });

  sendStatus({ status: 'connecting', path }, windowProvider);

  serialPort.on('open', () => {
    log.info(`Barcode serial port ${path} opened.`);
    sendStatus({ status: 'connected', path }, windowProvider);
  });

  serialPort.on('close', () => {
    log.warn(`Barcode serial port ${path} closed.`);
    sendStatus({ status: 'disconnected', path, reason: 'closed' }, windowProvider);
    destroyPort();
    scheduleReconnect(windowProvider, path);
  });

  serialPort.on('error', (error: Error) => {
    log.error(`Barcode serial port ${path} error`, error);
    sendStatus({ status: 'error', message: error.message, path }, windowProvider);
    destroyPort();
    scheduleReconnect(windowProvider, path);
  });

  parser = serialPort.pipe(new ReadlineParser({ delimiter: /\r?\n/ }));
  parser.on('data', (chunk: Buffer | string) => {
    const raw = typeof chunk === 'string' ? chunk : chunk.toString();
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }

    log.info('Barcode scanned from serial port', { code: trimmed, length: trimmed.length });
    sendScan({ code: trimmed, raw, timestamp: Date.now(), path }, windowProvider);
  });

  serialPort.open((error) => {
    if (error) {
      log.error(`Failed to open barcode serial port ${path}`, error);
      sendStatus({ status: 'error', message: error.message, path }, windowProvider);
      scheduleReconnect(windowProvider, path);
    }
  });
};

export const initializeBarcodeScanner = async (
  windowProvider: () => BrowserWindow | null,
  skipDestroy = false
) => {
  if (!handlersRegistered) {
    ipcMain.handle('barcode/get-status', () => currentStatus);
    ipcMain.handle('barcode/list-ports', async () => {
      try {
        return await SerialPort.list();
      } catch (error) {
        log.error('Failed to list serial ports via IPC', error);
        throw error;
      }
    });
    ipcMain.handle('barcode/restart', async () => {
      await initializeBarcodeScanner(windowProvider);
      return currentStatus;
    });
    handlersRegistered = true;
  }

  await openSerialPort(windowProvider, skipDestroy);
};

export const shutdownBarcodeScanner = () => {
  destroyPort();
  if (handlersRegistered) {
    ipcMain.removeHandler('barcode/get-status');
    ipcMain.removeHandler('barcode/list-ports');
    ipcMain.removeHandler('barcode/restart');
    handlersRegistered = false;
  }
};

export type { BarcodeScannerStatus, BarcodeScanPayload };
