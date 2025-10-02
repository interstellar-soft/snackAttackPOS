#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  cp .env.example .env
fi

docker compose --env-file .env -f infra/docker-compose.yml up -d --build
