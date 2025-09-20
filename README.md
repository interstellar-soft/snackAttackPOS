# LitePOS

LitePOS is a modern, production-ready point-of-sale platform built for small retailers. It delivers a delightful cashier experience, full product and inventory management, customer tracking, and insightful reports – all running on a clean .NET + React stack.

## Tech stack

- **Backend:** .NET 8 Web API, Entity Framework Core (Pomelo MySQL provider), JWT authentication with refresh tokens, FluentValidation, Serilog
- **Frontend:** React 18 + TypeScript (Vite), TailwindCSS + shadcn/ui components, React Router, Zustand state, Axios
- **Database:** MySQL 8 (via Docker Compose)

## Quick start

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd snackAttackPOS
   ```

2. **Start MySQL + Adminer**
   ```bash
   docker compose up -d
   ```
   - MySQL is exposed on `localhost:3306` (user: `litepos`, password: `litepospassword`).
   - Adminer is available on `http://localhost:8080` for quick DB inspection.

3. **Backend setup**
   ```bash
   cd backend
   dotnet restore
   dotnet ef database update --project LitePOS.Api/LitePOS.Api.csproj
   dotnet run --project LitePOS.Api/LitePOS.Api.csproj
   ```
   The API boots on `http://localhost:5243` (https on `https://localhost:7243`).

4. **Frontend setup**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
   The POS UI runs at `http://localhost:5173`.

5. **Log in** using one of the seeded accounts:
   - Admin: `admin@litepos.dev` / `Admin123!`
   - Manager: `manager@litepos.dev` / `Manager123!`
   - Cashier: `cashier@litepos.dev` / `Cashier123!`

## What’s included

### Backend API highlights
- JWT bearer auth with refresh tokens and role-based policies (Admin, Manager, Cashier).
- Clean REST endpoints for products, categories, inventory adjustments, customers, sales, reports, and store settings.
- FluentValidation on all create/update payloads.
- EF Core with Pomelo MySQL provider, automatic migrations, and rich seed data (100+ demo products, sample customers, roles).
- Serilog request logging and centralized error handling returning RFC7807 problem details.
- CORS configured for the Vite dev server (`http://localhost:5173`).

### Frontend app highlights
- Fully responsive layout with sidebar navigation, topbar greeting, and dark/light mode toggle.
- Dashboard with real-time sales KPIs, animated charts, and polished stat cards.
- Product management page with searchable tables, pagination, and modal forms for create/update.
- Inventory center featuring low-stock alerts and reason-tracked adjustments.
- Sales register with barcode search, product tiles, inline cart editing, split tender checkout, and printable receipts.
- Customer CRM to store contacts and attach them to sales.
- Reports with daily summaries and 30-day top-product analysis.
- Settings page to edit store profile, tax rate, and receipt template preview.
- Axios client with automatic token refresh, Zustand auth store, Tailwind + shadcn component library.

## Typical workflow

1. **Create catalog items** under **Products → Add product** (set price, tax, stock levels, and status).
2. **Adjust inventory** as stock arrives or is counted via **Inventory → Stock adjustment**.
3. **Ring a sale** on **Sales Register**. Search/scan items, adjust quantities/discounts, pick tender split, and complete checkout.
4. Inventory automatically decrements and the receipt can be printed or revisited under **Receipts**.
5. **Attach customers** for loyalty tracking and review performance in **Reports**.

## Running tests & linting

- **Backend:** `dotnet test` (add tests as desired).
- **Frontend:** `npm run build` ensures the TypeScript project compiles.

## Environment variables

The defaults work for local development. Override via `appsettings.Development.json` or Vite env vars (`.env`):

- `ConnectionStrings:DefaultConnection`
- `Jwt:Secret`, `Jwt:AccessTokenMinutes`, `Jwt:RefreshTokenDays`
- `Frontend:Origin`
- `VITE_API_URL` for the frontend (defaults to `http://localhost:5243/api`).

## Printing receipts

Visit `/receipts/:saleId` (e.g. from the sales list) to view the styled receipt and use the **Print** button. The template pulls header/footer text from Settings.

## Production considerations

- Swap MySQL credentials with secure values and configure HTTPS certificates.
- Run `dotnet ef migrations add` for schema changes, and apply via CI/CD.
- Harden JWT secrets, refresh token TTLs, and enable HTTPS redirection.
- Serve the React build (`npm run build`) via your preferred hosting (NGINX, Azure Static Web Apps, etc.).

Enjoy building with LitePOS! Contributions and feedback are welcome.
