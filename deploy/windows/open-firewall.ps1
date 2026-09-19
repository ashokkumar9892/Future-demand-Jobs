# Opens the API port in Windows Firewall. Run as Administrator.
#
#   .\open-firewall.ps1                       # allow 5080 from anywhere
#   .\open-firewall.ps1 -RemoteAddress 1.2.3.4  # allow only that address
#
# Windows Firewall is only half the job on a cloud VM: the provider's own
# firewall (GCP VPC rule, AWS security group, Azure NSG) must allow the port too.

[CmdletBinding()]
param(
    [int]      $Port          = 5080,
    [string[]] $RemoteAddress = @('Any'),
    [string]   $DisplayName   = 'FutureTech API'
)

$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'This script must run as Administrator.' }

Remove-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue

New-NetFirewallRule `
    -DisplayName $DisplayName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $Port `
    -RemoteAddress $RemoteAddress `
    -Profile Any | Out-Null

Write-Host "Inbound TCP $Port allowed from: $($RemoteAddress -join ', ')" -ForegroundColor Green

if ($RemoteAddress -contains 'Any') {
    Write-Warning 'The port is open to the whole internet and the API speaks plain HTTP.'
    Write-Warning 'Sign-in credentials and JWTs will cross the network unencrypted.'
    Write-Warning 'See the "Putting TLS in front of it" section of README.md in this folder.'
}

Write-Host ''
Write-Host 'Also confirm your cloud provider firewall allows this port:' -ForegroundColor Cyan
Write-Host "  GCP   : gcloud compute firewall-rules create futuretech-api --allow tcp:$Port"
Write-Host "  AWS   : add an inbound rule for TCP $Port to the instance security group"
Write-Host "  Azure : add an inbound port rule for TCP $Port to the network security group"
