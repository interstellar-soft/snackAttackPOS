const path = require('node:path');
const { createRequire } = require('node:module');

const localRequire = createRequire(__filename);

function isMissingNativeBindingError(error) {
  if (!error) {
    return false;
  }

  if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_DLOPEN_FAILED') {
    return true;
  }

  if (typeof error.message === 'string' && error.message.includes('Cannot find module @rollup/rollup-')) {
    return true;
  }

  return isMissingNativeBindingError(error.cause);
}

function loadNativeBinding(nativePath) {
  try {
    return localRequire(nativePath);
  } catch (error) {
    if (isMissingNativeBindingError(error)) {
      return null;
    }

    throw error;
  }
}

function loadWasmFallback() {
  try {
    return localRequire('@rollup/wasm-node/dist/native.js');
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
