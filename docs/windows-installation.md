# Install Aurora POS on Windows

1. Double-click **Aurora-POS-Setup-0.2.1.exe** and follow the setup wizard.
2. Open **Aurora POS** from the desktop or Start menu.
3. Choose an administrator password (at least 9 characters). Windows may request permission to install a required Microsoft component.
4. Sign in as **admin**, using the password you just chose.
5. Set the store name and exchange rate in Settings, create cashier accounts, and add your products and stock.

The installer includes the interface, backend, .NET runtime, PostgreSQL database, and Microsoft runtime installer. You do not need Docker, Node.js, .NET, a terminal, or a developer to run it. The store starts empty. Sales work without internet. This build targets Windows 10/11 x64 and one Windows user on one PC.

This initial build is unsigned, so Windows may show an unknown-publisher/SmartScreen warning. Use the copy supplied by the app owner. Public distribution should use a signed release.

## Your data

Data is stored separately from the application in `%APPDATA%\Aurora POS`. Updating or uninstalling the application does not intentionally remove this folder. Keep using the same Windows account. Database credentials are encrypted for that account.

Use **Settings → Export backup** regularly and keep a copy on another drive. To move to another PC, install the app, create the initial admin password, then restore a JSON backup in Settings. Restore replaces the destination store; after restoration, sign in using an account and password from the backup. Do not copy just the database directory or encrypted credential file to another Windows account.

Old version 1 JSON backups can be imported, but fields that those old exports omitted cannot be recovered: extra barcodes, weight settings, debt labels, and personal purchases. New version 2 backups include these fields.

## Updates and troubleshooting

- Close Aurora POS before running a newer installer. Back up the store first.
- Automatic updates are disabled until a real HTTPS update feed is configured.
- If startup fails, reopen the app. If it still fails, share the files in `%APPDATA%\Aurora POS\logs` with support. Do not share `store-credentials.dat` or a store backup publicly.
- If port 17865 is occupied, close the other Aurora POS instance or the conflicting application.
- The database and API listen only on this PC. They stop when Aurora POS closes. Phone access is a separate planned feature.
- Optional ML services are not bundled. The normal checkout and inventory flows do not require them.

## Build the installer (developer)

Install Node.js 20.19+ and the .NET 8 SDK, then from the repository root:

```powershell
npm ci
./scripts/prepare-windows.ps1
./scripts/build-windows.ps1
```

`prepare-windows.ps1` downloads PostgreSQL 15.19 and Microsoft's signed Visual C++ runtime installer. `build-windows.ps1` type-checks and bundles the frontend, compiles Electron, publishes a self-contained .NET backend, and creates the NSIS installer under `frontend/release/`. Only the build computer needs internet and developer tools.

The PostgreSQL archive is supplied through the [official Windows download channel](https://www.postgresql.org/download/windows/); the Microsoft component comes from the [official Visual C++ runtime download](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist). Packaging uses [electron-builder NSIS](https://www.electron.build/docs/nsis/).

For a signed public release, configure your code-signing certificate and re-enable `build.win.signAndEditExecutable`. It is disabled in this unsigned build because this PC cannot create the macOS symbolic links in electron-builder's signing-tool archive. No app security settings are disabled.

## Verification commands

```powershell
dotnet test backend/PosBackend.sln
npm run lint
npm run build
cd frontend
npm run test:cart
npm run test:desktop
```

The desktop integration check creates a new isolated test store under `.tools`, runs real PostgreSQL migrations and backend requests, then shuts down its processes. It does not touch an installed store. For packaged UI verification, `scripts/test-desktop-ui.cjs` uses Playwright's Electron driver; supply `PLAYWRIGHT_MODULE` if Playwright is installed outside the workspace. Screenshots go in `artifacts/`.

`AURORA_DATA_DIR` is an optional support/test override for the store directory. Normal users should leave it unset. Do not run multiple instances against the same data directory.
