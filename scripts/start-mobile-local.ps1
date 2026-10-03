param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo
function Check-Step { if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE" } }
$dotnetPath = if (Test-Path '.tools/dotnet/dotnet.exe') { "$repo/.tools/dotnet/dotnet.exe" } else { 'dotnet' }
$env:DOTNET_CLI_HOME = "$repo/.tools/dotnet-home"
if (!$SkipBuild) {
    & $dotnetPath build backend/src/PosBackend/PosBackend.csproj -p:WarningLevel=0
    Check-Step
    & $dotnetPath build backend/src/PosMobile/PosMobile.csproj
    Check-Step
    if (Test-Path '.tools/package/bin/npm-cli.js') { & node .tools/package/bin/npm-cli.js run build --workspace frontend }
    else { & npm.cmd run build --workspace frontend }
    Check-Step
    & node scripts/prepare-mobile-ocr.mjs
    Check-Step
}
New-Item -ItemType Directory -Force backend/src/PosBackend/wwwroot | Out-Null
Copy-Item frontend/dist/* backend/src/PosBackend/wwwroot -Recurse -Force
& node scripts/start-mobile-local.mjs
Check-Step
