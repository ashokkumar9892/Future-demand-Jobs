# Registers FutureTech.Api as a Windows service. Run as Administrator from the
# folder produced by publish.ps1.
#
#   powershell -ExecutionPolicy Bypass -File install-service.ps1
#
# The service starts automatically at boot and restarts itself if it crashes.

[CmdletBinding()]
param(
    [string] $ServiceName = 'FutureTechApi',
    [string] $DisplayName = 'FutureTech Career Academy API',
    [string] $InstallPath = 'C:\FutureTechApi',
    [string] $Environment = 'Production'
)

$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    throw 'This script must run as Administrator (service registration and firewall changes need it).'
}

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

# Copy the published output into a stable location, unless we are already there.
$installed = if (Test-Path $InstallPath) { (Resolve-Path $InstallPath).Path } else { $null }

if ($root -ne $installed) {
    Write-Host "Installing from $root to $InstallPath"
    New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null

    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existing -and $existing.Status -ne 'Stopped') {
        Write-Host "Stopping the running service first..."
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 2
    }

    # Keep the database: it holds every account and all learner progress.
    Get-ChildItem $root -Exclude 'data' | Copy-Item -Destination $InstallPath -Recurse -Force
} else {
    Write-Host "Already installed at $InstallPath"
}

New-Item -ItemType Directory -Force -Path (Join-Path $InstallPath 'data') | Out-Null

$exe = Join-Path $InstallPath 'FutureTech.Api.exe'
if (-not (Test-Path $exe)) { throw "Expected the API executable at $exe" }

$settings = Join-Path $InstallPath 'appsettings.Production.json'
if (Test-Path $settings) {
    $raw = Get-Content $settings -Raw
    if ($raw -match 'REPLACE-THIS-WITH-A-RANDOM') {
        Write-Warning 'Jwt:SigningKey is still the placeholder. Anyone with that key can mint tokens for any account.'
        Write-Warning "Edit $settings before exposing this API to the internet."
    }
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Service '$ServiceName' already exists - updating it."
    if ($existing.Status -ne 'Stopped') { Stop-Service -Name $ServiceName -Force; Start-Sleep -Seconds 2 }
    sc.exe config $ServiceName binPath= "`"$exe`"" start= auto | Out-Null
} else {
    Write-Host "Creating service '$ServiceName'..."
    # The trailing spaces after binPath= and start= are required by sc.exe.
    sc.exe create $ServiceName binPath= "`"$exe`"" DisplayName= "`"$DisplayName`"" start= auto | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "sc.exe create failed with exit code $LASTEXITCODE" }
}

sc.exe description $ServiceName "Career development platform API. Serves the FutureTech Career Academy SPA." | Out-Null

# Restart on failure: 5s, then 10s, then every 60s. Counter resets daily.
sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/60000 | Out-Null

# ASPNETCORE_ENVIRONMENT has to be visible to the service, not just this shell.
[Environment]::SetEnvironmentVariable('ASPNETCORE_ENVIRONMENT', $Environment, 'Machine')
$env:ASPNETCORE_ENVIRONMENT = $Environment

Write-Host "Starting $ServiceName..."
Start-Service -Name $ServiceName
Start-Sleep -Seconds 6

$service = Get-Service -Name $ServiceName
Write-Host "Service status: $($service.Status)" -ForegroundColor Cyan

if ($service.Status -ne 'Running') {
    Write-Warning 'The service did not reach Running. Check the Windows Application event log:'
    Write-Warning "  Get-EventLog -LogName Application -Source '$ServiceName' -Newest 20"
    exit 1
}

# Prove it actually serves requests rather than just that the process started.
try {
    $health = Invoke-RestMethod -Uri 'http://localhost:5080/health' -TimeoutSec 20
    Write-Host "Health check: $($health.status) at $($health.utc)" -ForegroundColor Green
} catch {
    Write-Warning "The service is running but /health did not answer: $($_.Exception.Message)"
    Write-Warning 'Check that Urls in appsettings.Production.json matches the port you are testing.'
    exit 1
}

Write-Host ""
Write-Host "Installed. Next steps:" -ForegroundColor Cyan
Write-Host "  1. .\open-firewall.ps1          (allow inbound 5080)"
Write-Host "  2. Test from another machine:   http://<this-server-ip>:5080/health"
Write-Host "  3. Point the web app at it:     set API_PROXY_TARGET in Netlify"
