param(
    [string]$ProjectRoot = "."
)

$ErrorActionPreference = "Stop"

$Root =
    [System.IO.Path]::GetFullPath(
        [string](
            Resolve-Path -LiteralPath $ProjectRoot
        ).Path
    )

$PackageRoot =
    Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "GameAtlas 2.0 - Linux Steam & Proton Discovery" -ForegroundColor Cyan
Write-Host "Project root: $Root"
Write-Host ""

$Required = @(
    "src-tauri\src\lib.rs",
    "src-tauri\src\platform.rs",
    "src-tauri\Cargo.toml"
)

foreach ($Relative in $Required) {
    $Path =
        Join-Path $Root $Relative

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Required file missing: $Relative"
    }
}

$Backup =
    Join-Path $Root (
        ".gameatlas-patch-backups\2.0-linux-steam-proton-" +
        (Get-Date -Format "yyyyMMdd-HHmmss")
    )

New-Item `
    -ItemType Directory `
    -Path $Backup `
    -Force |
    Out-Null

foreach ($Relative in @(
    "src-tauri\src\lib.rs",
    "src-tauri\src\linux_steam.rs"
)) {
    $Source =
        Join-Path $Root $Relative

    if (Test-Path -LiteralPath $Source) {
        $BackupName =
            $Relative -replace '[\\/:*?"<>|]', '_'

        Copy-Item `
            -LiteralPath $Source `
            -Destination (
                Join-Path $Backup $BackupName
            ) `
            -Force
    }
}

Write-Host "[BACKUP] $Backup" -ForegroundColor DarkGray

& node `
    (Join-Path $PackageRoot "patch-linux-steam-proton.cjs") `
    $Root

if ($LASTEXITCODE -ne 0) {
    throw "Linux Steam & Proton patch failed."
}

Write-Host ""
Write-Host "Running frontend build..." -ForegroundColor Cyan

Push-Location $Root
try {
    & npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed."
    }
}
finally {
    Pop-Location
}

Write-Host "[PASS] Frontend build" -ForegroundColor Green

Write-Host ""
Write-Host "Running Rust check..." -ForegroundColor Cyan

Push-Location (Join-Path $Root "src-tauri")
try {
    & cargo check

    if ($LASTEXITCODE -ne 0) {
        throw "cargo check failed."
    }
}
finally {
    Pop-Location
}

Write-Host "[PASS] cargo check" -ForegroundColor Green
Write-Host ""
Write-Host "[PASS] Linux Steam & Proton Discovery backend installed." -ForegroundColor Green
Write-Host ""
Write-Host "Windows regression test:" -ForegroundColor Cyan
Write-Host "  npm run tauri:dev"
