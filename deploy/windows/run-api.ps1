# Runs the API in the foreground. Use this to check a fresh copy works before
# installing it as a service - the startup errors land in the console instead of
# the event log, which makes the first run much easier to diagnose.
#
#   .\run-api.ps1
#   .\run-api.ps1 -Port 8080
#
# Ctrl+C stops it. Nothing survives a reboot; use install-service.ps1 for that.

[CmdletBinding()]
param(
    [int]    $Port        = 5080,
    [string] $Environment = 'Production'
)

$ErrorActionPreference = 'Stop'

# publish.ps1 copies these scripts into out\ alongside the binaries, so after
# copying the whole deploy\windows folder to a server there are two copies of
# this script: one beside the executable and one a level above it. Running the
# outer one should work rather than reporting a missing executable.
function Resolve-ApiPackageRoot([string] $StartPath) {
    foreach ($candidate in @($StartPath, (Join-Path $StartPath 'out'))) {
        if (Test-Path (Join-Path $candidate 'FutureTech.Api.exe')) {
            return (Resolve-Path $candidate).Path
        }
    }
    throw @"
Could not find FutureTech.Api.exe in:
  $StartPath
  $(Join-Path $StartPath 'out')

If you copied the deploy\windows folder, the binaries are in its 'out'
subfolder - run this script from there instead:
    cd $StartPath\out

If 'out' is missing or holds no .exe, the package was never built. On the
machine with the source, run:
    powershell -ExecutionPolicy Bypass -File deploy\windows\publish.ps1
"@
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-ApiPackageRoot $here
$exe  = Join-Path $root 'FutureTech.Api.exe'

New-Item -ItemType Directory -Force -Path (Join-Path $root 'data') | Out-Null

$env:ASPNETCORE_ENVIRONMENT = $Environment

Write-Host "Starting FutureTech API on http://0.0.0.0:$Port ($Environment)" -ForegroundColor Cyan
Write-Host "  health : http://localhost:$Port/health"
Write-Host "  swagger: http://localhost:$Port/swagger"
Write-Host 'First run seeds the database, which takes a few seconds.'
Write-Host ''

# Run from the package folder, not from wherever the operator invoked this
# script. appsettings.Production.json, the SeedData content pack and the SQLite
# file are all resolved relative to it.
Push-Location $root
try {
    # --urls, not $env:ASPNETCORE_URLS: appsettings.Production.json sets "Urls"
    # and that file is loaded after the host environment variables, so the
    # environment variable loses. Command-line configuration is added last and
    # does win.
    & $exe --urls "http://0.0.0.0:$Port"
} finally {
    Pop-Location
}

# The service reads its port from appsettings.Production.json instead, since it
# is started by the Service Control Manager with no arguments. Change "Urls"
# there if you want the installed service on a different port.
