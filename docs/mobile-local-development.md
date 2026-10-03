# Mobile dashboard — local implementation

This is a working local development build, not a hosted release. The existing v0.2.1 installer has not been replaced with this development code.

## Start it

From the project directory, after `npm ci` and with the bundled PostgreSQL binaries prepared:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-mobile-local.ps1
```

The script builds both .NET services, the PC frontend and the local OCR assets. It uses the downloaded .NET SDK when present, otherwise the installed .NET 8 SDK. Leave the terminal running. To stop both services and the isolated PostgreSQL instance reliably, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-mobile-local.ps1` in another terminal. This command also handles a stale database PID file after an abruptly closed terminal.

- PC app: http://127.0.0.1:18065
- Mobile admin dashboard: http://127.0.0.1:18066
- Username for both: `admin`
- Generated development password: `adminPassword` in `.tools/mobile-local/credentials.json`. Do not commit or share this file.

The local launcher uses separate `aurora_pc` and `aurora_mobile` databases under `.tools/mobile-local`. It does not read or change the installed store's `%APPDATA%\Aurora POS` data. Both URLs bind to loopback; this first preview runs on this computer, not on a physical phone over the internet. Use the browser's phone viewport to preview it. HTTPS hosting/LAN setup is a later deployment step.

To pair manually, sign in to the mobile dashboard, open More → Manage PC connection, and generate a code. In PC Settings → Mobile admin dashboard, enter `http://127.0.0.1:18066` and that code. It expires after ten minutes and is single-use. The local launcher explicitly permits loopback HTTP. Other deployments require HTTPS pairing URLs.

To populate an empty local store with clearly fictional demo items, sales and a purchase, run `node scripts/seed-mobile-local.mjs` after starting the services. This also pairs the local dashboard. The script skips sample creation when products already exist.

## Implemented

- Separate mobile admin credentials and server-side sessions, nine-character minimum at account bootstrap, HttpOnly/SameSite cookies, credential rate limits, mutation-header CSRF protection, logout revocation and per-store data access.
- Responsive English/Arabic navigation, overview with date-range sales/profit, debts and low-stock counts, searchable/paged records, related sale/purchase/product records, pairing/revocation and visible stale-data status.
- All 18 persisted business tables are synchronized: categories, products, extra barcodes, inventory, expiry batches, transactions, transaction lines, price rules, offers/items, suppliers, purchases/lines, users, audit metadata, exchange rates, store profile and personal purchases. A test compares this catalog to the EF model so a future unmapped business table fails the checks.
- Password hashes and future unknown user fields are excluded by an allowlist. Audit action/entity/user/time are included; unstructured audit `Data` and IP addresses are intentionally excluded because they are not a safe stable export contract. Printer/serial preferences and unsaved carts are local state.
- Durable PostgreSQL outbox changes commit or roll back with business writes. The first upload is a consistent snapshot; subsequent batches include complete database transactions. Deletes, retry acknowledgement, offline catch-up, backup-restore generations and retired-generation rejection are supported. The PC still sells when the mobile service is unavailable.
- A five-second worker uploads while the backend/POS is open. Unpaired stores retain a revision marker rather than accumulating full duplicate business data. Pausing and re-pairing re-snapshot when necessary. Acknowledged events are pruned.
- Mobile purchase drafts persist in the mobile database. The admin reviews item names, barcode/product matches, quantities, costs, currency and selling prices for new products before confirming. Confirmation queues an immutable command for the PC. The PC applies it with the existing purchasing rules inside a database transaction, persists the command ID, and updates stock only once. Changed/deleted product versions, obsolete restore generations, missing admin access and duplicate supplier/reference purchases are rejected with an explanation.
- Purchase quantities retain three decimal places, including 0.001 kg. New weighted-product creation is not yet supported from mobile; select an existing weighted product, or create it on the PC first.
- Camera/file input for up to five JPG/PNG/WebP invoice pages. Bundled Tesseract.js and English/Arabic models perform OCR in the browser. Photos are not sent to an external recognition provider or stored in the mobile database. OCR text produces conservative name suggestions; quantity defaults to 1 and must be reviewed. It does not reliably infer invoice table structure, pack sizes or barcode identity, and never invents prices. Product search and additional-barcode matching help the admin map each line. Manual entry remains available.

## Architecture and source map

- `backend/src/PosSync`: versioned transport contract and business-table catalog.
- `backend/src/PosBackend/Application/Services/MobileSyncService.cs`: pairing, encryption, snapshots, upload/acknowledgement and command polling.
- `backend/src/PosBackend/Application/Services/MobilePurchaseService.cs`: transactional purchase application and retry/conflict handling.
- PC migrations 15 and 16: trigger-based outbox/state and processed-command records. They are raw infrastructure tables, intentionally outside the EF business model and user backup format.
- `backend/src/PosMobile`: independent mobile service and PostgreSQL mirror. The HTTP API never accepts a browser-supplied store ID; the session/device determines it.
- `backend/src/PosMobile/wwwroot`: mobile interface, local OCR and home-screen manifest.
- `frontend/src/components/settings/MobileSyncCard.tsx`: PC connection controls.
- `scripts/prepare-mobile-ocr.mjs`: copies pinned npm OCR/runtime/language assets and notices into the mobile web root; generated assets are ignored by git.

The mobile database is initialized transactionally with additive `CREATE TABLE IF NOT EXISTS` statements. Introduce numbered cloud schema migrations before the first hosted release. Set `ConnectionStrings__Mobile`, `Bootstrap__Username`, `Bootstrap__Password`, and optionally `Bootstrap__StoreName` / `StoreTimezone` to run the service separately. Bootstrap only creates an absent account; changing its environment password does not reset an existing account.

## Verification

```powershell
.tools/dotnet/dotnet.exe test backend/tests/PosBackend.Tests/PosBackend.Tests.csproj
node .tools/package/bin/npm-cli.js run build --workspace frontend
node .tools/package/bin/npm-cli.js run lint --workspace frontend
node scripts/prepare-mobile-ocr.mjs
$env:PLAYWRIGHT_MODULE = 'path/to/playwright'
node scripts/test-mobile-sync.mjs
```

Build both services before the integration script. The integration script creates a fresh isolated PostgreSQL cluster each run and shuts it down afterward. Browser checks use installed Microsoft Edge; set `PLAYWRIGHT_MODULE` to a Playwright installation to include them. Without that variable, API/database checks still run. Test data remains under `.tools/mobile-test-*` for diagnosis; it is not real store data.

The tests cover initial/incremental sync, restored snapshots, omitted secrets, session/CSRF boundaries, purchase/stock/report parity, 0.001 quantities, duplicate confirmation/redelivery, product conflicts, transaction rollback, two-store isolation, stale-generation rejection, revoked-device catch-up, phone layout, Arabic direction and actual OCR on a generated invoice fixture. Test results and screenshots are in `artifacts/`.

## Before online release

1. Add MFA, account recovery/password management, managed user/store provisioning and HTTPS/reverse-proxy configuration. Current bootstrap login is suitable for this local preview, not a finished public identity service.
2. Stage/chunk large initial snapshots, add periodic content reconciliation and tune queues/indexes with realistic store volumes. The current request limit is 50 MB and snapshots are constructed in memory. This implementation must not be presented as tested for arbitrarily large histories.
3. Expand the phone's specialized report/receipt screens and translate record field labels; raw business detail labels currently follow the PC schema. The interface has basic home-screen metadata, but no offline business-data cache or push notifications.
4. Pilot Arabic/English real-world invoices. The first OCR flow reads text and suggests lines; complex table extraction, automatic pack conversion, crop/rotate and invoice-image archiving are not implemented. Users must review quantities as well as enter prices/barcodes. Duplicate invoice references are checked; identical-photo detection is not implemented.
5. Add editable creation dates, document retention policies if photos will later be archived, and automated backup/restore operations for the mobile database. Test restores involving pending remote commands and multiple concurrent users at production scale.
6. Configure hosting and an HTTPS domain, then build a signed Windows update containing the sync changes. The local preview does not publish or upload real store data.

The design uses PostgreSQL's transactional trigger behavior ([official documentation](https://www.postgresql.org/docs/15/trigger-definition.html)), the browser isolation assumptions described in [ASP.NET Core CSRF guidance](https://learn.microsoft.com/aspnet/core/security/anti-request-forgery), and the [Tesseract.js local-asset configuration](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).
