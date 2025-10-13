import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const omit = (process.env.npm_config_omit ?? '').split(/\s+/).filter(Boolean);
if (omit.includes('dev')) {
  console.log('[postinstall] Skipping Electron native module rebuild because dev dependencies are omitted.');
  process.exit(0);
}

if (process.env.ELECTRON_SKIP_REBUILD === '1') {
  console.log('[postinstall] ELECTRON_SKIP_REBUILD=1 detected. Skipping native module rebuild.');
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(__dirname, '..', 'package.json');

let electronVersionRaw = '';
try {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  electronVersionRaw =
    packageJson.devDependencies?.electron ?? packageJson.dependencies?.electron ?? '';
} catch (error) {
  console.warn('[postinstall] Unable to read package.json to determine Electron version. Skipping rebuild.');
  console.warn(error);
  process.exit(0);
}

const electronVersion = electronVersionRaw.replace(/^[^0-9]*/, '');
if (!electronVersion) {
  console.log('[postinstall] Electron version could not be determined. Skipping native module rebuild.');
  process.exit(0);
}

let rebuildModule;
try {
  rebuildModule = await import('@electron/rebuild');
} catch (error) {
  if (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND') {
    console.log('[postinstall] @electron/rebuild is not available. Skipping native module rebuild.');
    process.exit(0);
  }
  throw error;
}

const rebuildFn =
  typeof rebuildModule.rebuild === 'function'
    ? rebuildModule.rebuild
    : typeof rebuildModule.default === 'function'
      ? rebuildModule.default
      : typeof rebuildModule.default?.rebuild === 'function'
        ? rebuildModule.default.rebuild
        : null;

if (!rebuildFn) {
  console.log('[postinstall] Unable to locate rebuild function export. Skipping native module rebuild.');
  process.exit(0);
}

console.log(`[postinstall] Rebuilding native modules for Electron ${electronVersion}...`);
try {
  await rebuildFn({
    buildPath: resolve(__dirname, '..'),
    electronVersion,
    force: true
  });
  console.log('[postinstall] Native module rebuild complete.');
} catch (error) {
  console.error('[postinstall] Native module rebuild failed.');
  console.error('[postinstall] Ensure the required build tools are installed, then run "npm run electron:rebuild --workspace frontend".');
  console.error('[postinstall] Set ELECTRON_SKIP_REBUILD=1 to bypass the postinstall hook temporarily.');
  throw error;
}
