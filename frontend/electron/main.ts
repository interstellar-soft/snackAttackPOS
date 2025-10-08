import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import path from 'node:path';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

log.initialize({ preload: true });
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const updateFeedUrl = process.env.ELECTRON_UPDATE_URL;

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
      preload: path.join(__dirname, 'preload.js')
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

  autoUpdater.on('update-available', (info) => {
    sendUpdaterStatus({ status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendUpdaterStatus({ status: 'not-available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdaterStatus({
      status: 'downloading',
      percent: Math.round(progress.percent * 100) / 100,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on('error', (error) => {
    sendUpdaterStatus({
      status: 'error',
      message: error == null ? 'unknown' : (error as Error).message ?? String(error)
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdaterStatus({ status: 'downloaded', version: info.version });
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(() => {
  if (isDev) {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  }

  if (updateFeedUrl) {
    // Allow overriding the update feed at runtime without rebuilding the app.
    autoUpdater.setFeedURL({ provider: 'generic', url: updateFeedUrl });
  }

  createMainWindow();
  registerAutoUpdaterEvents();

  if (!isDev) {
    autoUpdater.checkForUpdates().catch((error) => {
      log.error('Failed to check for updates', error);
    });
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

  try {
    const result = await autoUpdater.checkForUpdates();
    return { result };
  } catch (error) {
    sendUpdaterStatus({
      status: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
});

ipcMain.handle('updater/restart-and-install', () => {
  if (!isDev) {
    autoUpdater.quitAndInstall();
  }
});
