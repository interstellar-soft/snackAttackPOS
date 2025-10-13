# Troubleshooting `npm install` errors

This guide captures the most common fixes for dependency installation problems that can appear when installing the Aurora POS
front-end dependencies. The examples below target Windows PowerShell terminals because the errors primarily impact developers on
Windows, but the same steps apply to other shells.

## Clean up partial installs

If a previous install failed midway, remove the `node_modules` folder and lockfile artifacts before retrying. PowerShell requires
an elevated prompt to delete some nested directories created by npm:

```powershell
# Run PowerShell as Administrator before executing these commands
Set-Location frontend
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
```

After the cleanup, re-run the install to let npm recreate both directories:

```powershell
npm install
```

## Increase npm's network retry window

Spurious `ECONNRESET` errors are often caused by slow or unstable connections to the npm registry. The repository now ships with a
`.npmrc` file inside `frontend/` that increases the retry timeout and forces npm to use the public registry. If you still see the
error, you can temporarily bump the timeout further from your shell:

```powershell
npm config set fetch-retry-maxtimeout 300000
npm config set fetch-retry-mintimeout 60000
npm config set fetch-retries 6
```

To restore npm's defaults later, run:

```powershell
npm config delete fetch-retry-maxtimeout
npm config delete fetch-retry-mintimeout
npm config delete fetch-retries
```

## Verify proxy and SSL settings

`ECONNRESET` can also indicate an intercepting proxy or outdated TLS configuration. Confirm that you can reach the registry directly
by running:

```powershell
Invoke-WebRequest https://registry.npmjs.org/tailwindcss
```

If the request fails, you may need to configure your proxy credentials in npm:

```powershell
npm config set proxy http://username:password@proxy.example.com:8080
npm config set https-proxy http://username:password@proxy.example.com:8080
```

Avoid disabling SSL verification unless you fully trust the network path. Instead, import your organization's root certificate into
Windows' certificate store so that Node.js can validate the TLS connection.

## Last resort: offline install

When the registry is intermittently reachable, running `npm install --cache .npm-cache --prefer-offline` inside `frontend/` lets npm
reuse any packages it previously downloaded. Commit the cache directory to a temporary location outside the repository to avoid
polluting Git history.

If none of the steps above resolve the problem, capture the full npm log file referenced in the error message and share it with the
team so we can dig deeper.

## Docker builds with restricted registries

When Docker is responsible for installing dependencies (for example, during
`docker compose ... up --build`), copy `.env.example` to `.env` and set the
`FRONTEND_NPM_*` variables before building. Compose passes those values as build
arguments so the frontend Dockerfile can point npm at your mirror and reuse the
retry/backoff settings you configure.
