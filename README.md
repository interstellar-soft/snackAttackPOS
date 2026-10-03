# Aurora POS Monorepo

This repository hosts the Aurora POS platform, a clean-room, open-source grocery point-of-sale inspired by modern retail systems. Development progresses across defined milestones.

## Milestone Progress
- [x] Milestone 1 — Scaffold & Infra
- [x] Milestone 2 — Core POS (Backend + DB)
- [x] Milestone 3 — Frontend POS GUI
- [x] Milestone 4 — Multi-Currency (USD & LBP)
- [x] Milestone 5 — AI Features
- [x] Milestone 6 — Owner Analytics *(current)*
- [ ] Milestone 7 — Tests, Docs, Runbook

Further documentation will expand alongside subsequent milestones.

## Bringing the stack up

To start all services locally, ensure you have Docker and Docker Compose installed, then run:

```sh
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

The root `.env` file is passed to Compose so environment configuration can be centralized even though the compose file lives in `infra/`. Every service in the compose file now uses `restart: unless-stopped`, so Docker automatically brings the stack back online on the next boot (unless you manually stop the containers).

## Desktop Builds

The Windows installer includes the interface, backend, and database. Open the app, choose your administrator password, and sign in as `admin`. Docker and developer tools are not required on the user PC.

See [Windows installation and builds](docs/windows-installation.md) for setup, backups, packaging, and troubleshooting, and [the review report](docs/review-2026-10-01.md) for improvements and release limits. Automatic updates are disabled until a real update feed is configured.

The next phase is described in the [mobile owner dashboard plan](docs/mobile-owner-dashboard-plan.md): a complete mobile admin mirror of POS business data, secure cloud synchronization, and admin-reviewed purchases prepared from invoice photos while the Windows POS remains usable offline.

## Connecting a barcode scanner

Aurora POS can connect directly to USB barcode scanners that expose a serial (COM) interface through the browser's Web Serial API.
For step-by-step instructions on choosing a compatible browser, configuring the scanner, and pairing it with the POS screen, see
[`docs/scanner-setup.md`](docs/scanner-setup.md).

## Installing JavaScript dependencies

This monorepo uses npm workspaces. Running `npm install` from the repository root will install the `frontend/` dependencies automatically.
If you prefer to manage the frontend in isolation you can continue to run `npm install` directly from the `frontend/` directory.

## Building the frontend bundle

Once dependencies are installed you can produce an optimized production build of the POS interface with Vite:

```sh
cd frontend
npm run build
```

The command emits static assets to `frontend/dist/` that can be served by the Electron shell, Nginx, or any other static file
host. The build is cross-platform — the same command works on Windows, macOS, and Linux shells.

### Mobile dashboard (local development)

The first working mobile implementation includes PC synchronization, an English/Arabic admin dashboard, and locally read invoice photos that produce purchase drafts for admin review. See [local setup and current limitations](docs/mobile-local-development.md). Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-mobile-local.ps1` to launch an isolated local PC and mobile preview. It is not deployed or included in the v0.2.1 installer.
