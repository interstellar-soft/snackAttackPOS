param([string]$Dotnet = 'dotnet', [switch]$Unpacked)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo
$npmCli = "$repo\.tools\package\bin\npm-cli.js"
function Invoke-Npm { if (Test-Path $npmCli) { & node $npmCli @args } else { & npm.cmd @args } }
if ($Dotnet -eq 'dotnet' -and (Test-Path '.tools/dotnet/dotnet.exe')) { $Dotnet = "$repo\.tools\dotnet\dotnet.exe" }
$env:DOTNET_CLI_HOME = "$repo\.tools\dotnet-home"
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
function Check-Step { if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE" } }
if (!(Test-Path 'frontend/resources/postgresql/bin/pg_ctl.exe')) {
    throw 'PostgreSQL binaries are missing. Run scripts/prepare-windows.ps1 first.'
}
Invoke-Npm run build --workspace frontend
Check-Step
Invoke-Npm run build:electron --workspace frontend
Check-Step
& $Dotnet publish backend/src/PosBackend/PosBackend.csproj -c Release -r win-x64 --self-contained true -p:WarningLevel=0 -o frontend/resources/backend
Check-Step
New-Item -ItemType Directory -Force frontend/resources/backend/wwwroot | Out-Null
Copy-Item -Path frontend/dist/* -Destination frontend/resources/backend/wwwroot -Recurse -Force
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
Push-Location frontend
try {
    if ($Unpacked) { & node ../node_modules/electron-builder/cli.js --win --dir --publish never }
    else { & node ../node_modules/electron-builder/cli.js --win nsis --publish never }
    Check-Step
} finally { Pop-Location }
