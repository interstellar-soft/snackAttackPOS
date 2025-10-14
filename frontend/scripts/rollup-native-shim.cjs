const path = require('node:path');
const { createRequire } = require('node:module');

const localRequire = createRequire(__filename);

function loadNativeBinding(nativePath) {
  try {
    return localRequire(nativePath);
  } catch (error) {
    if (error && (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_DLOPEN_FAILED')) {
      return null;
    }

    throw error;
  }
}

function loadWasmFallback() {
  try {
    return localRequire('@rollup/wasm-node');
  } catch (error) {
    error.message = `Failed to load Rollup native binding and the WASM fallback.\n${error.message}`;
    throw error;
  }
}

(function ensureRollupHasBinding() {
  let nativePath;
  try {
    nativePath = localRequire.resolve('rollup/dist/native.js');
  } catch {
    return;
  }

  if (require.cache[nativePath]) {
    return;
  }

  const exportsFromNative = loadNativeBinding(nativePath);
  if (exportsFromNative) {
    require.cache[nativePath] = {
      id: nativePath,
      filename: nativePath,
      loaded: true,
      exports: exportsFromNative
    };
    return;
  }

  const wasmExports = loadWasmFallback();
  require.cache[nativePath] = {
    id: nativePath,
    filename: nativePath,
    loaded: true,
    exports: wasmExports
  };

  const relativeNativePath = path.relative(process.cwd(), nativePath);
  console.warn(
    `[rollup-native-shim] Falling back to the WASM Rollup build because the native binding could not be loaded (module: ${relativeNativePath}).`
  );
})();
