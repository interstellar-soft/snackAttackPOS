# Fixing "No native build was found" errors in the desktop app

When launching the Electron app you may encounter an error similar to:

```
Error: No native build was found for platform=win32 arch=x64 runtime=electron
... loaded from: .../node_modules/@serialport/bindings-cpp/build/Release/bindings.node
```

This happens when a dependency that ships native bindings (for example the
`serialport` package used by the barcode reader) has only been compiled for the
Node.js runtime, not for the bundled Electron runtime. Electron embeds a custom
version of Node.js, so native modules must be rebuilt against Electron's ABI
before they can be loaded.

## Quick fix

From the `frontend/` directory run:

```powershell
npm install
```

The install step automatically executes our postinstall hook, which rebuilds all
native dependencies against the Electron version pinned in
`frontend/package.json`. After the rebuild finishes, relaunch the desktop app
and the error disappears.

## Manual rebuild

If you set `ELECTRON_SKIP_REBUILD=1` or install dependencies with
`npm install --omit=dev`, the postinstall hook is skipped. Run the helper script
manually to rebuild the native modules:

```powershell
npm run electron:rebuild --workspace frontend
```

Make sure the machine has the toolchain required by `node-gyp` (Python,
Microsoft Build Tools on Windows, or the equivalent Xcode CLI tools on macOS).
Once the script completes, restart the Electron app.
