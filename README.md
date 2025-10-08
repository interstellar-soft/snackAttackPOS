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

The root `.env` file is passed to Compose so environment configuration can be centralized even though the compose file lives in `infra/`.

## Desktop Builds

The `frontend/` package now ships an Electron wrapper so Aurora POS can be run as a desktop application with automatic updates.
See [`docs/electron.md`](docs/electron.md) for development instructions, packaging commands, and update configuration.
If you install the packaged desktop build and run into a blank window, follow the
post-install checklist in [`docs/desktop-post-install.md`](docs/desktop-post-install.md)
to bring up the backend stack and sign in.

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
