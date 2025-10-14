import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
const shimPath = fileURLToPath(new URL('./rollup-native-shim.cjs', import.meta.url));
const viteBin = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url));

const child = spawn(process.execPath, ['--require', shimPath, viteBin, ...args], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
