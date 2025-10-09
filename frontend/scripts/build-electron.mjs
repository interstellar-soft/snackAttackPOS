import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import * as esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const outdir = resolve(projectRoot, 'dist-electron');

const args = process.argv.slice(2);
const watch = args.includes('--watch');

const ensureOutDir = () => {
  if (!existsSync(outdir)) {
    mkdirSync(outdir, { recursive: true });
  }
  const packageJsonPath = resolve(outdir, 'package.json');
  const packageJson = JSON.stringify({ type: 'commonjs' }, null, 2);
  writeFileSync(packageJsonPath, `${packageJson}\n`);
};

const runTypeCheck = () =>
  new Promise((resolvePromise, rejectPromise) => {
    const tsc = spawn('npx', ['tsc', '--project', 'tsconfig.electron.json', '--noEmit'], {
      cwd: projectRoot,
      stdio: 'inherit'
    });
    tsc.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error('TypeScript type check failed'));
      }
    });
  });

const buildOptions = {
  entryPoints: [
    resolve(projectRoot, 'electron/main.ts'),
    resolve(projectRoot, 'electron/preload.ts')
  ],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: ['node18'],
  outdir,
  sourcemap: true,
  tsconfig: resolve(projectRoot, 'tsconfig.electron.json'),
  external: ['electron', 'electron-log', 'electron-updater']
};

const runBuild = async () => {
  ensureOutDir();
  await runTypeCheck();

  if (watch) {
    const ctx = await esbuild.context({ ...buildOptions });
    await ctx.watch();
    console.log('Watching Electron sources with esbuild...');
    await new Promise(() => {});
  } else {
    await esbuild.build(buildOptions);
  }
};

runBuild().catch((error) => {
  console.error(error);
  process.exit(1);
});
