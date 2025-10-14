import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import log from 'electron-log';
import path from 'node:path';
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo, UpdateCheckResult } from 'electron-updater';
import electronUpdater from 'electron-updater';
import { bootstrapInfrastructure } from './docker';

const { autoUpdater } = electronUpdater;

const preloadPath = path.join(__dirname, 'preload.js');

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

log.initialize({ preload: true });
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const updateFeedUrl = process.env.ELECTRON_UPDATE_URL;
let hasLoggedMissingFeed = false;

const isUpdateConfigured = () => {
  if (updateFeedUrl) {
    return true;
  }

  try {
    return Boolean(autoUpdater.getFeedURL());
  } catch (error) {
    if (!hasLoggedMissingFeed) {
      log.warn('Auto update feed URL not configured', error);
      hasLoggedMissingFeed = true;
    }
    return false;
  }
};

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
      preload: preloadPath,
      zoomFactor: 0.7,
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
    const indexHtml = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexHtml);
  }

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

    defaultSession.setPermissionCheckHandler((_, permission) => {
      if (isSerialPermission(permission)) {
        return true;
      }
      return false;
    });

    defaultSession.setPermissionRequestHandler((_, permission, callback) => {
      if (isSerialPermission(permission)) {
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

  if (updateFeedUrl) {
    // Allow overriding the update feed at runtime without rebuilding the app.
    autoUpdater.setFeedURL({ provider: 'generic', url: updateFeedUrl });
  }

  try {
    await bootstrapInfrastructure({ isDev });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Failed to bootstrap infrastructure', error);
    dialog.showErrorBox('Infrastructure error', message);
  }

  createMainWindow();
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
