# Aurora POS Electron Distribution

This document outlines how to build installers for the Aurora POS desktop
application and how the built-in auto-updater works.

## Project Layout

The existing Vite + React frontend continues to live under `frontend/`.
Electron-specific code is colocated in that package:

- `frontend/electron/main.ts` — Electron main process with the application
  bootstrap and update lifecycle.
- `frontend/electron/preload.ts` — Preload script that exposes a safe API to the
  renderer so React can monitor update status and trigger restarts.
- `frontend/tsconfig.electron.json` — Dedicated TypeScript configuration that
  builds the main and preload scripts into `dist-electron/`.

Vite still produces the renderer bundle inside `frontend/dist/`. Both folders
are consumed by `electron-builder` when packaging the application.

## Development Workflow

1. Install dependencies (from the `frontend/` directory):

   ```sh
   npm install
   ```

2. Launch the desktop shell in development mode:

   ```sh
   npm run electron:dev
   ```

   This runs three processes in parallel:

   - `npm run dev` — the Vite development server for the renderer.
   - `npm run build:electron:watch` — TypeScript compiler in watch mode for the
     Electron main/preload scripts.
   - `npm run electron:serve` — waits for both the dev server and compiled
     Electron output before spawning `electron .`.

   Hot-module reloading continues to work for renderer changes. Restart Electron
   when updating `frontend/electron/*` files.

## Rebuilding native modules

Some dependencies (for example `serialport`) ship prebuilt binaries that need to
be rebuilt against the Electron version bundled with Aurora POS. Run the helper
script from the repository root whenever you upgrade Electron or install a new
native module:

```sh
npm run electron:rebuild --workspace frontend
```

The script wraps `electron-rebuild` and pins the Electron runtime to match the
version declared in `frontend/package.json`, ensuring reproducible rebuilds on
all platforms.

## Building Installers

1. Install dependencies (if you only ran the dev command previously you already
   have them):

   ```sh
   cd frontend
   npm install
   ```

2. Create a production renderer bundle and compile the Electron entry points:

   ```sh
   npm run electron:package
   ```

   The script wraps `vite build`, runs the TypeScript compiler for the main and
   preload processes, and then calls `electron-builder` to produce installers.

3. Generated installers are written to `frontend/release/`. The current
   configuration produces:

   - Windows NSIS installer (`.exe`). Double-click the file to launch a guided
     setup wizard that adds Aurora POS to the Start Menu and creates an
     uninstall entry.
   - macOS disk image (`.dmg`) and ZIP archive. Open the `.dmg`, drag **Aurora
     POS** into `/Applications`, or unzip the archive and move the app bundle to
     your preferred folder.
   - Linux AppImage and Debian package. Mark the AppImage as executable and run
     it directly, or install the `.deb` with `sudo dpkg -i *.deb` on Debian/
     Ubuntu systems.

   To build for a single platform (for example just Windows on CI), append the
   electron-builder target flag: `npm run electron:package -- --win`, `--mac`,
   or `--linux`.

4. Add application icons in `frontend/build/` (for example `icon.icns`,
   `icon.ico`, and `icon.png`) to customize the installer branding.

## Auto-Updater

The main process uses [`electron-updater`](https://www.electron.build/auto-update)
with the generic provider. During packaging, `electron-builder` embeds the
default update feed URL declared in `frontend/package.json` under `build.publish`.

- **Runtime overrides:** Set the `ELECTRON_UPDATE_URL` environment variable when
  launching the packaged application to point at a different update feed (for
  example a staging channel). The updater will honour the override without
  requiring a rebuild.
- **Renderer integration:** The preload script surfaces an `electronAPI`
  namespace on `window` with helpers to request an update check and subscribe to
  status events. When an update is downloaded the React app prompts the operator
  to restart. Choosing “Restart” calls back into the main process to install the
  update (`autoUpdater.quitAndInstall()`).

### Hosting Updates

The default configuration targets a generic HTTP(S) file server. To publish a
release:

1. Host the generated installer binaries and the accompanying `latest.yml`
   (Windows) / `app-update.yml` (macOS, Linux) files at the location referenced
   by `build.publish[0].url`.
2. When a new version is released, upload the new assets and keep the same
   folder structure. The auto-updater downloads the delta the next time the app
   starts.

If you already have release infrastructure (e.g. GitHub Releases, S3, or a
custom CDN), adjust the `publish` section accordingly. See the
[`electron-builder` docs](https://www.electron.build/configuration/publish) for
provider-specific options.

### Development Notes

Auto-updates are disabled while running in development mode. Manually calling
`checkForUpdates` in dev emits a `dev-mode` status payload so you can verify the
renderer wiring without making network requests.
