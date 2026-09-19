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

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe  = Join-Path $here 'FutureTech.Api.exe'
if (-not (Test-Path $exe)) { throw "Expected the API executable at $exe" }

New-Item -ItemType Directory -Force -Path (Join-Path $here 'data') | Out-Null

$env:ASPNETCORE_ENVIRONMENT = $Environment

Write-Host "Starting FutureTech API on http://0.0.0.0:$Port ($Environment)" -ForegroundColor Cyan
Write-Host "  health : http://localhost:$Port/health"
Write-Host "  swagger: http://localhost:$Port/swagger"
Write-Host 'First run seeds the database, which takes a few seconds.'
Write-Host ''

# --urls, not $env:ASPNETCORE_URLS: appsettings.Production.json sets "Urls" and
# that file is loaded after the host environment variables, so the environment
# variable loses. Command-line configuration is added last and does win.
& $exe --urls "http://0.0.0.0:$Port"

# The service reads its port from appsettings.Production.json instead, since it
# is started by the Service Control Manager with no arguments. Change "Urls"
# there if you want the installed service on a different port.
