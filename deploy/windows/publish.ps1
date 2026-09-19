# Builds a self-contained Windows package for FutureTech.Api.
#
# Self-contained on purpose: the target machine needs no .NET runtime installed,
# which removes the most common "it works here" failure when handing a build to
# someone else's server.
#
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\publish.ps1
#
# Output: deploy\windows\out\  (copy this whole folder to the server)

[CmdletBinding()]
param(
    [string] $Configuration = 'Release',
    [string] $Runtime       = 'win-x64',
    [string] $OutputPath,
    [switch] $Zip
)

$ErrorActionPreference = 'Stop'

$here     = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo     = Resolve-Path (Join-Path $here '..\..')
$project  = Join-Path $repo 'src\backend\FutureTech.Api\FutureTech.Api.csproj'

if (-not $OutputPath) { $OutputPath = Join-Path $here 'out' }

if (-not (Test-Path $project)) {
    throw "Could not find the API project at $project"
}

if (Test-Path $OutputPath) {
    Write-Host "Clearing $OutputPath"
    Remove-Item $OutputPath -Recurse -Force
}

Write-Host "Publishing FutureTech.Api ($Configuration / $Runtime, self-contained)..." -ForegroundColor Cyan

# Not single-file: the seed JSON has to stay readable on disk, and a plain
# folder is far easier to inspect and patch on a server than a bundle.
dotnet publish $project `
    --configuration $Configuration `
    --runtime $Runtime `
    --self-contained true `
    --output $OutputPath `
    -p:PublishSingleFile=false `
    -p:DebugType=None `
    -p:GenerateDocumentationFile=false `
    --nologo

if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed with exit code $LASTEXITCODE" }

# Ship the operator scripts alongside the binaries so the server only needs one folder.
foreach ($file in @('appsettings.Production.json', 'run-api.ps1', 'install-service.ps1', 'uninstall-service.ps1', 'open-firewall.ps1', 'README.md')) {
    $source = Join-Path $here $file
    if (Test-Path $source) { Copy-Item $source -Destination $OutputPath -Force }
}

$seed = Join-Path $OutputPath 'SeedData'
if (-not (Test-Path $seed)) {
    throw "SeedData did not reach the output folder - the API cannot seed content without it."
}
$seedCount = (Get-ChildItem $seed -Filter *.json).Count
$exe = Join-Path $OutputPath 'FutureTech.Api.exe'
if (-not (Test-Path $exe)) { throw "Expected $exe to exist after publish." }

$sizeMb = [math]::Round((Get-ChildItem $OutputPath -Recurse | Measure-Object Length -Sum).Sum / 1MB, 1)

Write-Host ""
Write-Host "Published to $OutputPath" -ForegroundColor Green
Write-Host "  executable : FutureTech.Api.exe"
Write-Host "  seed files : $seedCount"
Write-Host "  total size : $sizeMb MB"

if ($Zip) {
    $zipPath = Join-Path $here 'FutureTech.Api-win-x64.zip'
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $OutputPath '*') -DestinationPath $zipPath
    Write-Host "  archive    : $zipPath"
}

Write-Host ""
Write-Host "Next: copy the folder to the server, then run install-service.ps1 as Administrator." -ForegroundColor Cyan
