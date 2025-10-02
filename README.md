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
