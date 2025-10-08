# Aurora POS Documentation

This directory will house in-depth architecture notes, ADRs, and integration guides as the project evolves across milestones.

- [Desktop packaging guide](./desktop-app.md) — explains how to ship the React
  frontend inside Electron/Tauri without major code changes.

> ℹ️ **Compose & environment files**
>
> Docker Compose resolves environment variables relative to the directory containing the compose file. Because the project keeps the primary `.env` in the repository root while the compose file lives in `infra/`, pass the root file explicitly when running Compose (e.g., `docker compose --env-file .env -f infra/docker-compose.yml up -d --build`).
