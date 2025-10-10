# Aurora POS Documentation

This directory will house in-depth architecture notes, ADRs, and integration guides as the project evolves across milestones.

- [Desktop packaging guide](./desktop-app.md) — explains how to ship the React
  frontend inside Electron/Tauri without major code changes.
- [Onboarding existing inventory](./inventory-onboarding.md) — shows how to record the stock you already have on hand when first deploying Aurora POS.

## Profit and waste accounting

Waste transactions are treated as a cost in the pricing service. When a line
item is marked as waste, the system sets its sale price to zero while still
recording the inventory cost. The calculated profit for that line therefore
becomes the negative of the cost, which rolls up into analytics as a deduction
from overall profit.【F:backend/src/PosBackend/Application/Services/CartPricingService.cs†L45-L157】

In short, marking an item as waste will decrease reported profit by the value
of the wasted inventory.

Personal purchases that are saved to “My Cart” are also priced using inventory
cost and have their profit explicitly set to zero. This keeps employee carts
from inflating profit metrics while still tracking the spend for personal
records.【F:backend/src/PosBackend/Application/Services/CartPricingService.cs†L45-L188】

> ℹ️ **Compose & environment files**
>
> Docker Compose resolves environment variables relative to the directory containing the compose file. Because the project keeps the primary `.env` in the repository root while the compose file lives in `infra/`, pass the root file explicitly when running Compose (e.g., `docker compose --env-file .env -f infra/docker-compose.yml up -d --build`).
