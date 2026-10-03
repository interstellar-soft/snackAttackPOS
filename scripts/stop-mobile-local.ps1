$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$stateFile = Join-Path $repo '.tools/mobile-local/runtime.json'
if (Test-Path $stateFile) {
    $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    foreach ($serviceId in $state.processes) {
        $service = Get-CimInstance Win32_Process -Filter "ProcessId = $serviceId" -ErrorAction SilentlyContinue
        $pcDll = Join-Path $repo 'backend/src/PosBackend/bin/Debug/net8.0/PosBackend.dll'
        $mobileDll = Join-Path $repo 'backend/src/PosMobile/bin/Debug/net8.0/PosMobile.dll'
        if ($service -and ($service.CommandLine.Contains($pcDll) -or $service.CommandLine.Contains($mobileDll))) {
            Stop-Process -Id $serviceId -ErrorAction SilentlyContinue
        }
    }
}
$database = Join-Path $repo '.tools/mobile-local/database'
if (Test-Path (Join-Path $database 'postmaster.pid')) {
    & "$repo/frontend/resources/postgresql/bin/pg_ctl.exe" -D $database status
    if ($LASTEXITCODE -eq 0) {
        & "$repo/frontend/resources/postgresql/bin/pg_ctl.exe" -D $database -m fast -w stop
        if ($LASTEXITCODE -ne 0) { throw 'The local demo database could not be stopped.' }
    }
}
Write-Output 'Local demo services stopped. The installed store is unchanged.'
