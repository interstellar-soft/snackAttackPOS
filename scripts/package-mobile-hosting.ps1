$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$files = @('package.json','package-lock.json','frontend/package.json','render.yaml','scripts/prepare-mobile-ocr.mjs','docs/mobile-render-deployment.md')
foreach ($folder in @('backend/src/PosMobile','backend/src/PosSync')) {
    $files += Get-ChildItem -LiteralPath (Join-Path $repo $folder) -File | Where-Object { $_.Extension -in @('.cs','.csproj') -or $_.Name -in @('Dockerfile','Dockerfile.dockerignore') } | ForEach-Object { "$folder/$($_.Name)" }
}
$web = Join-Path $repo 'backend/src/PosMobile/wwwroot'
$files += Get-ChildItem -LiteralPath $web -File | Where-Object { $_.Extension -in @('.html','.js','.css','.svg','.webmanifest') } | ForEach-Object { "backend/src/PosMobile/wwwroot/$($_.Name)" }
New-Item -ItemType Directory -Force (Join-Path $repo 'artifacts') | Out-Null
$destination = Join-Path $repo 'artifacts/aurora-mobile-hosting.zip'
$stream = [System.IO.File]::Open($destination, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($relative in ($files | Sort-Object -Unique)) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $repo $relative), $relative) | Out-Null
    }
} finally { $archive.Dispose(); $stream.Dispose() }
$check = [System.IO.Compression.ZipFile]::OpenRead($destination)
try {
    if ($check.Entries.FullName -match '(credentials|\.env|\.tools|/bin/|/obj/|/ocr/|/database/)') { throw 'Unexpected private/generated file in deployment bundle.' }
    Write-Output "Created deployment source bundle with $($check.Entries.Count) files: $destination"
} finally { $check.Dispose() }
