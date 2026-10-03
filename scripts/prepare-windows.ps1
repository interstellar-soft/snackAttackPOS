$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo
New-Item -ItemType Directory -Force .tools, frontend/resources/postgresql | Out-Null
$archive = "$repo\.tools\postgresql.zip"
if (!(Test-Path $archive)) {
    Invoke-WebRequest 'https://get.enterprisedb.com/postgresql/postgresql-15.19-1-windows-x64-binaries.zip' -OutFile $archive
}
$expectedHash = 'CC54E2D349F48C7743AD0C509B755EA565FF04BB5C5E71745D114074CAB0C453'
if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne $expectedHash) {
    throw 'The PostgreSQL archive does not match the pinned build input. Download the official 15.19-1 archive again.'
}
& tar -xf $archive -C frontend/resources/postgresql --strip-components=1 pgsql/bin pgsql/lib pgsql/share pgsql/doc pgsql/server_license.txt pgsql/commandlinetools_3rd_party_licenses.txt
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL extraction failed.' }
& frontend/resources/postgresql/bin/postgres.exe --version
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not run on this build PC.' }
Invoke-WebRequest 'https://aka.ms/vc14/vc_redist.x64.exe' -OutFile frontend/resources/vc_redist.x64.exe
$signature = Get-AuthenticodeSignature frontend/resources/vc_redist.x64.exe
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') {
    throw 'Microsoft runtime signature verification failed.'
}
