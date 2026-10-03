# Mobile dashboard: first internet deployment

Recommended provider: Render, with one Docker web service and one managed PostgreSQL database in Frankfurt. `render.yaml` describes paid entry-level resources; review Render's current estimate before creating them. No hosting resources have been created yet.

## Create the hosted pilot

1. Create or sign into your GitHub and Render accounts. Keep the source repository **private**. Upload the contents of the prepared `artifacts/aurora-mobile-hosting.zip` into its root (not the entire local workspace). The bundle excludes local passwords, store databases, demo data and desktop binaries.
2. In Render, choose **New → Blueprint**, connect that private repository, and use `render.yaml` at its root. Review the web service, database, Frankfurt region and monthly charges before creating resources.
3. Enter `Bootstrap__Username`, `Bootstrap__Password` and `Bootstrap__StoreName` when prompted. Use your chosen mobile administrator credentials; password minimum is **9 characters**. Do not reuse the demo password. Save these credentials in your password manager.
4. Wait for the database and web service to become healthy. Open the service's HTTPS `onrender.com` URL. Log in, sign out, and log in again. `/health/ready` should return `ready`.
5. After successful login, remove `Bootstrap__Password` from the service environment and redeploy. The administrator is already stored in PostgreSQL. Bootstrap does not change an existing account's password. Account recovery and a password-change interface are not implemented yet, so keep the chosen password securely.
6. On the mobile dashboard, generate a pairing code. On the current PC development app, open **Settings → Mobile sync**, enter the HTTPS URL and code, then pair. The PC must have internet access and remain running for current updates and pending purchases to apply. The existing 0.2.1 installer predates this sync feature; build and test a new installer before distributing it to stores.
7. Confirm the initial snapshot finishes. Compare stock, sales, purchases and debts against the PC. Make a small test transaction and verify it appears on the phone. Test a reviewed purchase draft and confirm it applies once on the PC. Disconnect/reconnect the PC and verify catch-up before using live store data.

## What is configured

- HTTPS terminates at Render; authentication cookies are always Secure, HttpOnly and SameSite Strict in hosted mode. The app validates its public host and browser mutation origins. Render's `RENDER_EXTERNAL_URL` supplies the default public origin.
- The mobile service connects to its own PostgreSQL database with TLS. External database access is disabled by `ipAllowList: []`. The PC database stays on the PC; it is never exposed through router port forwarding.
- Automatic deploys are off. Deploy updates manually after verification. The container runs as an unprivileged user, includes English/Arabic OCR assets, and needs no persistent web-service disk. Business records, pairing and sessions persist in PostgreSQL.
- Photos are processed locally in the phone browser. OCR proposes a draft; the administrator reviews product matches, quantities, prices and barcodes before submitting. It does not silently post purchases.

For a custom domain, configure it in Render and set `Hosting__PublicOrigin` to exactly `https://your-domain` (no path). Pair the PC with that same origin. Never enable `Hosting__AllowLocalHttp` on the hosted service.

## Pilot limits and operations

This is a pilot deployment, not a completed production rollout. MFA, self-service account recovery, numbered mobile database migrations, scheduled reconciliation and large-store load testing remain outstanding. Snapshots currently have a 50 MB request limit. Some detailed screens still show technical field labels.

Before live use, configure and verify the chosen PostgreSQL plan's backup retention and perform a restore exercise. Keep PC backups too: the mobile copy is not a replacement for them. A code rollback does not undo database changes. Before schema-changing upgrades, take a database backup and plan a compatible rollback.

If login returns 401, use the **mobile** credentials chosen in step 3; installed-PC credentials can differ. A 429 means wait one minute before retrying. If deployment startup fails, check the service logs for missing bootstrap values, invalid public origin or database connectivity; never share environment values or database URLs in screenshots.

## Local verification and container build

Run `dotnet test backend/tests/PosMobile.Tests/PosMobile.Tests.csproj`, then the local integration scripts `node scripts/test-mobile-hosting.mjs` and `node scripts/test-mobile-sync.mjs` after building the PC and mobile projects. These scripts use isolated test databases.

With Docker running, build from repository root:

```powershell
docker build -f backend/src/PosMobile/Dockerfile -t aurora-mobile:pilot .
```

The Docker engine was unavailable during preparation; the first Render container build and live HTTPS smoke test are still required. No internet deployment has been performed.

References: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [database connections](https://render.com/docs/postgresql-creating-connecting), [pricing](https://render.com/pricing).
