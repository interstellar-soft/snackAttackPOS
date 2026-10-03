import { app, BrowserWindow, dialog, ipcMain, session, safeStorage } from 'electron';
import log from 'electron-log';
import path from 'node:path';
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo, UpdateCheckResult } from 'electron-updater';
import electronUpdater from 'electron-updater';
import { bootstrapInfrastructure } from './docker';
import { startLocalRuntime, type LocalCredentials, type LocalRuntime } from './local-runtime';
import { promises as fs, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const { autoUpdater } = electronUpdater;

const preloadPath = path.join(__dirname, 'preload.js');

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let localRuntime: LocalRuntime | undefined;
let runtimeStarting: Promise<LocalRuntime> | undefined;
let shutdownComplete = false;
let shuttingDown = false;
const startupPath = path.join(__dirname, '../desktop/startup.html');
const startupUrl = pathToFileURL(startupPath).href;
app.setName('Aurora POS');
app.setPath('userData', process.env.AURORA_DATA_DIR
  ? path.resolve(process.env.AURORA_DATA_DIR) : path.join(app.getPath('appData'), 'Aurora POS'));

if (!app.requestSingleInstanceLock()) app.exit(0);
app.on('second-instance', () => { mainWindow?.restore(); mainWindow?.focus(); });
app.on('before-quit', event => {
  if ((!localRuntime && !runtimeStarting) || shutdownComplete) return;
  event.preventDefault();
  if (shuttingDown) return;
  shuttingDown = true;
  void Promise.resolve(localRuntime ?? runtimeStarting).then(runtime => runtime?.stop())
    .catch(error => log.error('Store shutdown failed', error)).finally(() => {
    shutdownComplete = true;
    app.quit();
  });
});

log.initialize({ preload: true });
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

const updateFeedUrl = process.env.ELECTRON_UPDATE_URL;
const isUpdateConfigured = () => Boolean(updateFeedUrl?.startsWith('https://'));

const sendUpdaterStatus = (payload: Record<string, unknown>) => {
  log.info('[auto-updater]', payload);
  mainWindow?.webContents.send('updater/status', payload);
};

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
      enableBlinkFeatures: 'Serial'
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(startupPath);
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL();
    if (url !== current && (!localRuntime || new URL(url).origin !== localRuntime.url)) event.preventDefault();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const registerAutoUpdaterEvents = () => {
  autoUpdater.on('checking-for-update', () => {
    sendUpdaterStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendUpdaterStatus({ status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    sendUpdaterStatus({ status: 'not-available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    sendUpdaterStatus({
      status: 'downloading',
      percent: Math.round(progress.percent * 100) / 100,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on('error', (error: Error) => {
    sendUpdaterStatus({
      status: 'error',
      message: error?.message ?? String(error)
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    sendUpdaterStatus({ status: 'downloaded', version: info.version });
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(async () => {
  if (isDev) {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  }

  const defaultSession = session.defaultSession;

  if (defaultSession) {
    type PermissionRequestHandler = Exclude<Parameters<typeof defaultSession.setPermissionRequestHandler>[0], null>;
    type PermissionArgument = Parameters<PermissionRequestHandler>[1];
    type PermissionCheckHandler = Exclude<Parameters<typeof defaultSession.setPermissionCheckHandler>[0], null>;
    type PermissionCheckArgument = Parameters<PermissionCheckHandler>[1];

    const isSerialPermission = (permission: PermissionArgument | PermissionCheckArgument) => {
      return permission === 'serial';
    };

    defaultSession.setPermissionCheckHandler((contents, permission) => {
      if (contents === mainWindow?.webContents && isSerialPermission(permission)) {
        return true;
      }
      return false;
    });

    defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
      if (contents === mainWindow?.webContents && isSerialPermission(permission)) {
        callback(true);
        return;
      }
      callback(false);
    });

    defaultSession.on('select-serial-port', (event, portList, webContents, callback) => {
      event.preventDefault();

      if (portList.length === 0) {
        callback('');
        return;
      }

      if (portList.length === 1) {
        callback(portList[0]?.portId ?? '');
        return;
      }

      const browserWindow = BrowserWindow.fromWebContents(webContents) ?? mainWindow ?? undefined;
      const buttons = portList.map((port, index) => port.displayName ?? port.portId ?? `Port ${index + 1}`);
      const detail = portList
        .map((port, index) => {
          const name = port.displayName ?? port.portId ?? `Port ${index + 1}`;
          const vendor = port.vendorId ? `Vendor: ${port.vendorId}` : null;
          const product = port.productId ? `Product: ${port.productId}` : null;
          const segments = [vendor, product].filter(Boolean);
          return segments.length > 0 ? `${name} (${segments.join(', ')})` : name;
        })
        .join('\n');

      const dialogOptions = {
        type: 'question' as const,
        title: 'Select scanner',
        message: 'Choose a serial device to connect to the scanner.',
        detail,
        buttons: [...buttons, 'Cancel'],
        cancelId: buttons.length,
        defaultId: 0
      };

      const selectionPromise = browserWindow
        ? dialog.showMessageBox(browserWindow, dialogOptions)
        : dialog.showMessageBox(dialogOptions);

      void selectionPromise
        .then((result) => {
          if (result.response >= 0 && result.response < portList.length) {
            callback(portList[result.response]?.portId ?? '');
            return;
          }
          callback('');
        })
        .catch((error) => {
          log.error('Failed to show serial port selection dialog', error);
          callback('');
        });
    });
  }

  if (isUpdateConfigured() && updateFeedUrl) {
    // Allow overriding the update feed at runtime without rebuilding the app.
    autoUpdater.setFeedURL({ provider: 'generic', url: updateFeedUrl });
  }

  try {
    if (isDev) {
      await bootstrapInfrastructure({ isDev });
      createMainWindow();
    } else {
      const dataRoot = app.getPath('userData');
      const configPath = path.join(dataRoot, 'store-credentials.dat');
      await fs.mkdir(dataRoot, { recursive: true });
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.');
      let credentials: LocalCredentials | undefined;
      if (existsSync(configPath)) {
        credentials = JSON.parse(safeStorage.decryptString(await fs.readFile(configPath))) as LocalCredentials;
      }
      const saveCredentials = async (value: LocalCredentials) => {
        const pending = `${configPath}.tmp`;
        await fs.writeFile(pending, safeStorage.encryptString(JSON.stringify(value)));
        await fs.rename(pending, configPath);
      };
      ipcMain.handle('desktop/setup-state', event => {
        if (event.senderFrame?.url !== startupUrl) throw new Error('Untrusted window');
        return { needsSetup: !credentials };
      });
      const chosen = new Promise<LocalCredentials>(resolve => {
        ipcMain.handle('desktop/setup', async (event, password: unknown) => {
          if (credentials || event.senderFrame?.url !== startupUrl) throw new Error('Setup is unavailable');
          if (typeof password !== 'string' || password.length < 9 || Buffer.byteLength(password, 'utf8') > 72)
            throw new Error('Use a password of at least 9 characters and at most 72 UTF-8 bytes.');
          const value = { databasePassword: randomBytes(32).toString('hex'),
            jwtKey: randomBytes(48).toString('hex'), adminPassword: password };
          await saveCredentials(value);
          credentials = value;
          resolve(value);
        });
      });
      createMainWindow();
      credentials = credentials ?? await chosen;
      runtimeStarting = startLocalRuntime(process.resourcesPath, dataRoot, credentials);
      localRuntime = await runtimeStarting;
      if (shuttingDown) return;
      delete credentials.adminPassword;
      await saveCredentials(credentials);
      ipcMain.removeHandler('desktop/setup');
      ipcMain.removeHandler('desktop/setup-state');
      await mainWindow!.loadURL(`${localRuntime.url}/`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Failed to start store', message);
    dialog.showErrorBox('Aurora POS could not start', message);
    app.quit();
    return;
  }
  registerAutoUpdaterEvents();

  const updateConfigured = isUpdateConfigured();

  if (!isDev && updateConfigured) {
    autoUpdater
      .checkForUpdates()
      .catch((error: unknown) => {
        log.error('Failed to check for updates', error);
      });
  } else if (!updateConfigured) {
    sendUpdaterStatus({ status: 'disabled' });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

ipcMain.handle('updater/check-now', async () => {
  if (isDev) {
    sendUpdaterStatus({ status: 'dev-mode' });
    return { mode: 'dev' };
  }

  if (!isUpdateConfigured()) {
    sendUpdaterStatus({ status: 'disabled' });
    return { mode: 'disabled' };
  }

  try {
    const result: UpdateCheckResult | null = await autoUpdater.checkForUpdates();
    return { result };
  } catch (error: unknown) {
    sendUpdaterStatus({
      status: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }
});

ipcMain.handle('updater/restart-and-install', () => {
  if (!isDev) {
    autoUpdater.quitAndInstall();
  }
});
