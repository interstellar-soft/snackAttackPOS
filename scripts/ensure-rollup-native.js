#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { arch, platform, report } = require('node:process');

const MESSAGE_PREFIX = '[ensure-rollup-native]';

function isMusl() {
  try {
    return !report.getReport().header.glibcVersionRuntime;
  } catch (error) {
    return false;
  }
}

const bindingsByPlatformAndArch = {
  android: {
    arm: { base: 'android-arm-eabi' },
    arm64: { base: 'android-arm64' }
  },
  darwin: {
    arm64: { base: 'darwin-arm64' },
    x64: { base: 'darwin-x64' }
  },
  freebsd: {
    arm64: { base: 'freebsd-arm64' },
    x64: { base: 'freebsd-x64' }
  },
  linux: {
    arm: { base: 'linux-arm-gnueabihf', musl: 'linux-arm-musleabihf' },
    arm64: { base: 'linux-arm64-gnu', musl: 'linux-arm64-musl' },
    loong64: { base: 'linux-loong64-gnu' },
    ppc64: { base: 'linux-ppc64-gnu' },
    riscv64: { base: 'linux-riscv64-gnu', musl: 'linux-riscv64-musl' },
    s390x: { base: 'linux-s390x-gnu' },
    x64: { base: 'linux-x64-gnu', musl: 'linux-x64-musl' }
  },
  openharmony: {
    arm64: { base: 'openharmony-arm64' }
  },
  win32: {
    arm64: { base: 'win32-arm64-msvc' },
    ia32: { base: 'win32-ia32-msvc' },
    x64: { base: 'win32-x64-msvc', mingw: 'win32-x64-gnu' }
  }
};

function resolvePackageBase() {
  const platformEntry = bindingsByPlatformAndArch[platform];
  if (!platformEntry) {
    return null;
  }

  const archEntry = platformEntry[arch];
  if (!archEntry) {
    return null;
  }

  if (platform === 'win32' && arch === 'x64') {
    const isMingw = (() => {
      try {
        return report.getReport().header.osName.startsWith('MINGW32_NT');
      } catch (error) {
        return false;
      }
    })();

    if (isMingw && archEntry.mingw) {
      return archEntry.mingw;
    }
  }

  if (archEntry.musl && isMusl()) {
    return archEntry.musl;
  }

  return archEntry.base;
}

function installRollupPackage(packageName, version) {
  const installTarget = `${packageName}@${version}`;
  const npmExecPath = process.env.npm_execpath;
  const nodeExecPath = process.env.npm_node_execpath || process.execPath;
  const command = npmExecPath && npmExecPath.endsWith('.js')
    ? [nodeExecPath, npmExecPath]
    : [npmExecPath || 'npm'];

  console.log(`${MESSAGE_PREFIX} Installing missing optional dependency ${installTarget}`);

  try {
    const [executable, script] = command.length === 2 ? command : [command[0], undefined];
    const args = script
      ? [script, 'install', '--no-save', installTarget]
      : ['install', '--no-save', installTarget];

    execFileSync(executable, args, {
      stdio: 'inherit'
    });
  } catch (error) {
    console.warn(
      `${MESSAGE_PREFIX} Failed to install ${installTarget}.\n` +
        `${MESSAGE_PREFIX} Rollup may fall back to a slower WASM build or fail to start.\n` +
        `${MESSAGE_PREFIX} If the problem persists, please install the package manually.`
    );
  }
}

function ensureRollupNative() {
  let rollupPackageJson;
  try {
    rollupPackageJson = require('rollup/package.json');
  } catch (error) {
    return;
  }

  const packageBase = resolvePackageBase();
  const version = rollupPackageJson.version;

  if (packageBase) {
    const packageName = `@rollup/rollup-${packageBase}`;

    try {
      require.resolve(packageName);
    } catch (error) {
      installRollupPackage(packageName, version);
    }
  }

  try {
    require.resolve('@rollup/wasm-node/dist/native.js');
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      installRollupPackage('@rollup/wasm-node', version);
    }
  }
}

ensureRollupNative();
