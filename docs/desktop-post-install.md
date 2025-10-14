# Aurora POS desktop post-install checklist

If you launch the packaged desktop app and only see a blank window, the backend
services are not running yet. The Electron shell only hosts the React UI—the
Point of Sale APIs, database, and machine-learning helper all run outside of the
desktop executable. Follow the steps below to bring the full stack online on
your workstation and sign in.

## 1. Start the infrastructure stack

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) if
you have not already. Docker Compose spins up PostgreSQL, the .NET backend, and
the ML microservice that power the UI described below.
2. Open a terminal in the repository root (the folder that contains
   `package.json`, `infra/docker-compose.yml`, etc.).
3. Create a `.env` file if you have not done so already:

   ```sh
   cp .env.example .env
   ```

4. Launch the containers:

   ```sh
   docker compose --env-file .env -f infra/docker-compose.yml up -d --build
   ```

   The compose file provisions three services (`db`, `backend`, and `ml`) plus a
   static frontend container for local browsers. The desktop app talks to the
   backend directly on port `5000`. Each container uses the
   `restart: unless-stopped` policy, so after this initial boot the stack comes
   back automatically the next time Docker Desktop starts (for example, after a
   computer reboot).
5. Confirm everything is healthy:

   ```sh
   docker compose -f infra/docker-compose.yml ps
   curl http://localhost:5000/health
   ```

   The health endpoint returns `{ "status": "ok" }` when the API is ready.

## 2. Launch the desktop app

1. Start **Aurora POS** from the shortcut the installer created.
2. The login screen appears once the backend at
   `http://localhost:5000` responds. If you still see a blank window,
   double-check that the Docker containers are running and that nothing else is
   blocking port `5000`.
3. First-time credentials are seeded automatically:
   - `admin` / `ChangeMe123!`
   - `manager` / `ChangeMe123!`
   - `cashier` / `ChangeMe123!`

   Pick any account, sign in, and you should be redirected to the POS screen.

## 3. Troubleshooting tips

- **Still blank after the checks above?**
  - Open the log file at
    `%APPDATA%\Aurora POS\logs\main.log` (Windows) or
    `~/Library/Logs/Aurora POS/main.log` (macOS). The Electron main process logs
    API connectivity issues and auto-update errors there.
  - Make sure the backend URL matches your environment. The desktop build uses
    `http://localhost:5000` unless overridden with the `VITE_API_URL`
    environment variable during packaging. If you need to point at a remote
    server, set `VITE_API_URL` before running `npm run electron:package`.
- **"Unable to load preload script" after an update?** Windows sometimes keeps
  a partially written `app.asar` when an update is interrupted. Relaunching the
  installer repairs the bundle—there is no need to uninstall first. Download
  the current installer, close Aurora POS, and run the installer again. It
  replaces the files under
  `%LOCALAPPDATA%\Programs\aurora-pos-frontend\resources\app.asar` with a
  fresh copy so the preload script can be loaded normally.
- **Resetting the demo data:** stop the containers, delete the `postgres-data`
  Docker volume, and re-run the `docker compose` command. The backend migrates
  the database and re-seeds users and inventory on startup.

Following this checklist should resolve the blank screen by ensuring the backend
stack is reachable before you open the desktop shell.
