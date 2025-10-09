import { app } from 'electron';
import log from 'electron-log';
import { execFile } from 'node:child_process';
import { promises as fs, constants as fsConstants, existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const locateComposeFile = async (): Promise<string | null> => {
  const appPath = app.getAppPath();
  const candidates = [
    path.resolve(appPath, '..', 'infra', 'docker-compose.yml'),
    path.resolve(appPath, '..', '..', 'infra', 'docker-compose.yml'),
    path.resolve(path.dirname(appPath), 'infra', 'docker-compose.yml')
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate, fsConstants.F_OK);
      return candidate;
    } catch (error) {
      log.debug('Docker compose file not found at candidate', candidate, error);
    }
  }

  return null;
};

const ensureEnvFile = async (composePath: string): Promise<string | null> => {
  const projectRoot = path.resolve(path.dirname(composePath), '..');
  const envFile = path.resolve(projectRoot, '.env');
  const envExample = path.resolve(projectRoot, '.env.example');

  try {
    await fs.access(envFile, fsConstants.F_OK);
    return envFile;
  } catch (error) {
    log.info('.env file missing, attempting to bootstrap from example', error);
  }

  try {
    await fs.access(envExample, fsConstants.F_OK);
    await fs.copyFile(envExample, envFile);
    return envFile;
  } catch (error) {
    log.warn('Unable to prepare environment file for docker compose', error);
    return null;
  }
};

const tryStartDockerDesktop = async (): Promise<boolean> => {
  try {
    if (process.platform === 'darwin') {
      await execFileAsync('open', ['-a', 'Docker']);
      return true;
    }

    if (process.platform === 'win32') {
      const candidates = [
        'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
        'C:\\Program Files (x86)\\Docker\\Docker\\Docker Desktop.exe'
      ];

      for (const candidate of candidates) {
        if (!existsSync(candidate)) {
          continue;
        }

        const command = `Start-Process -FilePath '${candidate.replace(/'/g, "''")}'`;
        await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command]);
        return true;
      }
    }
  } catch (error) {
    log.warn('Failed to trigger Docker Desktop start', error);
  }

  return false;
};

const ensureDockerDaemon = async (): Promise<void> => {
  try {
    await execFileAsync('docker', ['info']);
    return;
  } catch (initialError) {
    log.warn('Docker daemon not ready on first check', initialError);
  }

  const startAttempted = await tryStartDockerDesktop();

  if (!startAttempted) {
    throw new Error(
      'Docker Desktop does not appear to be running. Please start Docker Desktop and relaunch the application.'
    );
  }

  const maxAttempts = 20;
  const delayMs = 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await execFileAsync('docker', ['info']);
      log.info('Docker daemon is ready after attempt', attempt);
      return;
    } catch (error) {
      log.info(`Waiting for Docker daemon to become ready (attempt ${attempt}/${maxAttempts})`);
      await delay(delayMs);
    }
  }

  throw new Error('Docker daemon did not become ready in time.');
};

export interface BootstrapOptions {
  isDev: boolean;
}

export const bootstrapInfrastructure = async ({ isDev }: BootstrapOptions): Promise<void> => {
  try {
    await execFileAsync('docker', ['--version']);
  } catch (error) {
    throw new Error('Docker CLI is not installed or not available in the PATH.');
  }

  const composePath = await locateComposeFile();

  if (!composePath) {
    log.info('No docker-compose.yml file found. Skipping infrastructure bootstrap.');
    return;
  }

  const envFile = await ensureEnvFile(composePath);

  if (!envFile) {
    throw new Error('Unable to locate or create a .env file required for docker compose.');
  }

  await ensureDockerDaemon();

  const composeArgs = ['compose', '--env-file', envFile, '-f', composePath, 'up', '-d'];

  if (isDev) {
    composeArgs.push('--build');
  }

  log.info('Starting infrastructure with docker compose', composeArgs.join(' '));

  try {
    await execFileAsync('docker', composeArgs, { cwd: path.dirname(path.dirname(composePath)) });
  } catch (error) {
    log.error('docker compose up failed', error);
    throw new Error('Failed to start application services using docker compose.');
  }
};
