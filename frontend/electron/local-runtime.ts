import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promises as fs, existsSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { promisify } from 'node:util';

const run = promisify(execFile);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export interface LocalCredentials { databasePassword: string; jwtKey: string; adminPassword?: string }
export interface LocalRuntime { url: string; stop: () => Promise<void> }

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

export async function startLocalRuntime(resources: string, dataRoot: string,
  credentials: LocalCredentials): Promise<LocalRuntime> {
  const pgBin = path.join(resources, 'postgresql', 'bin');
  const backendDir = path.join(resources, 'backend');
  const dataDir = path.join(dataRoot, 'database');
  const logDir = path.join(dataRoot, 'logs');
  await fs.mkdir(logDir, { recursive: true });
  const pgCtl = path.join(pgBin, 'pg_ctl.exe');
  const env = { ...process.env, PGPASSWORD: credentials.databasePassword };
  const command = (exe: string, args: string[]): Promise<{ stdout: string }> => {
    if (exe !== 'pg_ctl.exe') return run(path.join(pgBin, exe), args,
      { env, windowsHide: true, timeout: 90000, maxBuffer: 4 * 1024 * 1024 });
    // PostgreSQL inherits pipe handles on Windows. Ignore stdio and await exit,
    // otherwise execFile's close event waits for the database to stop.
    return new Promise((resolve, reject) => {
      const child = spawn(path.join(pgBin, exe), args, { env, windowsHide: true, stdio: 'ignore' });
      const timeout = setTimeout(() => { child.kill(); reject(new Error('Database control timed out.')); }, 90000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => {
        clearTimeout(timeout);
        if (code === 0) resolve({ stdout: '' });
        else reject(new Error(`Database control failed (${code}). See ${path.join(logDir, 'database.log')}`));
      });
    });
  };
  if (!existsSync(pgCtl) || !existsSync(path.join(backendDir, 'PosBackend.exe'))) {
    throw new Error('Application files are incomplete. Please reinstall Aurora POS. Your store data will be kept.');
  }
  const system32 = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
  if (!existsSync(path.join(system32, 'vcruntime140.dll')) || !existsSync(path.join(system32, 'vcruntime140_1.dll'))) {
    const installer = path.join(resources, 'vc_redist.x64.exe').replace(/'/g, "''");
    const script = `$s=Get-AuthenticodeSignature '${installer}'; ` +
      `if($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notmatch 'Microsoft Corporation'){exit 1}; ` +
      `$p=Start-Process -FilePath '${installer}' -ArgumentList '/install','/quiet','/norestart' -Verb RunAs -WindowStyle Hidden -Wait -PassThru; ` +
      `if($p.ExitCode -notin 0,1638,3010){exit 1}`;
    try { await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 600000 }); }
    catch { throw new Error('Windows could not install the Microsoft runtime. Reopen Aurora POS and allow the Windows installation prompt.'); }
  }
  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
    const passwordFile = path.join(dataRoot, 'init-password.tmp');
    await fs.writeFile(passwordFile, credentials.databasePassword, { mode: 0o600 });
    try {
      await command('initdb.exe', ['-D', dataDir, '-U', 'aurora', '--encoding=UTF8',
        '--locale=C', '--auth=scram-sha-256', `--pwfile=${passwordFile}`]);
    } finally { await fs.rm(passwordFile, { force: true }); }
  }
  // Recover a database left running by a crashed previous instance, using only our data directory.
  try {
    await command('pg_ctl.exe', ['status', '-D', dataDir]);
    await command('pg_ctl.exe', ['stop', '-D', dataDir, '-m', 'fast', '-w', '-t', '60']);
  } catch (error) {
    if (existsSync(path.join(dataDir, 'postmaster.pid'))) throw error;
  }
  const dbPort = await freePort();
  let backend: ChildProcess | undefined;
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (backend && backend.exitCode === null) {
      const exited = new Promise<void>(resolve => backend!.once('exit', () => resolve()));
      backend.kill();
      await Promise.race([exited, delay(5000)]);
    }
    await command('pg_ctl.exe', ['stop', '-D', dataDir, '-m', 'fast', '-w', '-t', '60']);
  };
  await command('pg_ctl.exe', ['start', '-D', dataDir, '-l', path.join(logDir, 'database.log'),
    '-o', `-h 127.0.0.1 -p ${dbPort}`, '-w', '-t', '60']);
  try {
    const connection = ['-h', '127.0.0.1', '-p', String(dbPort), '-U', 'aurora'];
    const result = await command('psql.exe', [...connection, '-d', 'postgres', '-tAc',
      "SELECT 1 FROM pg_database WHERE datname='aurora_pos'"]);
    if (result.stdout.trim() !== '1') {
      await command('createdb.exe', [...connection, 'aurora_pos']);
    }
    // Stable browser origin preserves the held cart and preferences across restarts.
    const apiPort = 17865;
    await new Promise<void>((resolve, reject) => {
      const probe = net.createServer();
      probe.on('error', () => reject(new Error('Aurora POS port 17865 is already in use. Close the other instance and try again.')));
      probe.listen(apiPort, '127.0.0.1', () => probe.close(() => resolve()));
    });
    const url = `http://127.0.0.1:${apiPort}`;
    const output = createWriteStream(path.join(logDir, 'backend.log'), { flags: 'a' });
    backend = spawn(path.join(backendDir, 'PosBackend.exe'), [], {
      cwd: backendDir, windowsHide: true,
      env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Production', ASPNETCORE_URLS: url,
        ConnectionStrings__DefaultConnection: `Host=127.0.0.1;Port=${dbPort};Database=aurora_pos;Username=aurora;Password=${credentials.databasePassword}`,
        Jwt__Key: credentials.jwtKey, Seed__DemoData: 'false', MobileSync__KeyDirectory: path.join(dataRoot, 'sync-keys'),
        Seed__AdminPassword: credentials.adminPassword ?? '', Desktop__Enabled: 'true', MlService__Enabled: 'false' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    backend.stdout?.pipe(output, { end: false });
    backend.stderr?.pipe(output, { end: false });
    let startError: Error | undefined;
    backend.on('error', error => { startError = error; });
    backend.once('close', () => output.end());
    for (let attempt = 0; attempt < 120; attempt++) {
      if (startError || backend.exitCode !== null) {
        throw new Error(`The store service could not start. See ${path.join(logDir, 'backend.log')}`);
      }
      try {
        const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
        if (response.ok && (await response.json() as { service?: string }).service === 'backend') {
          return { url, stop };
        }
      } catch { /* Migrations may still be running. */ }
      await delay(500);
    }
    throw new Error('The store is taking too long to start. Please reopen Aurora POS and check the logs if this continues.');
  } catch (error) {
    await stop().catch(() => undefined);
    throw error;
  }
}
