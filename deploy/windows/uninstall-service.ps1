# Removes the FutureTechApi Windows service. Run as Administrator.
# The install folder and its database are left alone unless -RemoveFiles is passed.

[CmdletBinding()]
param(
    [string] $ServiceName = 'FutureTechApi',
    [string] $InstallPath = 'C:\FutureTechApi',
    [switch] $RemoveFiles
)

$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'This script must run as Administrator.' }

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -ne 'Stopped') {
        Write-Host "Stopping $ServiceName..."
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 3
    }
    sc.exe delete $ServiceName | Out-Null
    Write-Host "Service '$ServiceName' removed." -ForegroundColor Green
} else {
    Write-Host "Service '$ServiceName' is not installed."
}

Remove-NetFirewallRule -DisplayName 'FutureTech API' -ErrorAction SilentlyContinue
[Environment]::SetEnvironmentVariable('ASPNETCORE_ENVIRONMENT', $null, 'Machine')

if ($RemoveFiles) {
    # This deletes every account and all learner progress along with the binaries.
    Write-Warning "Deleting $InstallPath, including the database."
    Remove-Item $InstallPath -Recurse -Force -ErrorAction SilentlyContinue
} elseif (Test-Path $InstallPath) {
    Write-Host "Files kept at $InstallPath (pass -RemoveFiles to delete them and the database)."
}
