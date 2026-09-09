param(
    [string]$ProjectRoot = "."
)

$ErrorActionPreference = "Stop"

$ResolvedRoot = Resolve-Path -LiteralPath $ProjectRoot
$Root = [System.IO.Path]::GetFullPath([string]$ResolvedRoot.Path)

Write-Host "GameAtlas v1.2.0 UX / Branding Audit" -ForegroundColor Cyan
Write-Host "Project: $Root" -ForegroundColor DarkGray
Write-Host ""

$SearchRoot = Join-Path $Root "src"

$Files = Get-ChildItem -LiteralPath $SearchRoot -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx

$LegacyBrand = @()
$PlaceholderLanguage = @()

foreach ($File in $Files) {
    $Content = Get-Content -LiteralPath $File.FullName -Raw -ErrorAction SilentlyContinue

    if ($Content -match '(?i)\bGame Manager\b') {
        $LegacyBrand += $File.FullName.Substring($Root.Length + 1)
    }

    if ($Content -match '(?i)\bplanned for\b|\bcoming soon\b|\bplaceholder\b') {
        $PlaceholderLanguage += $File.FullName.Substring($Root.Length + 1)
    }
}

if ($LegacyBrand.Count -eq 0) {
    Write-Host "[PASS] No user-visible legacy 'Game Manager' text found in src." -ForegroundColor Green
} else {
    Write-Host "[REVIEW] Legacy Game Manager text found:" -ForegroundColor Yellow
    $LegacyBrand | Sort-Object -Unique | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Yellow
    }
}

Write-Host ""

if ($PlaceholderLanguage.Count -eq 0) {
    Write-Host "[PASS] No obvious placeholder/coming-soon language found in src." -ForegroundColor Green
} else {
    Write-Host "[REVIEW] Potential placeholder language found:" -ForegroundColor Yellow
    $PlaceholderLanguage | Sort-Object -Unique | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Manual responsive targets:" -ForegroundColor White
Write-Host "  1280x720  - all panels usable without clipped actions" -ForegroundColor DarkGray
Write-Host "  1024x768  - Settings navigation and dashboard remain usable" -ForegroundColor DarkGray
Write-Host "   900x700  - modal/fixed panels remain inside viewport" -ForegroundColor DarkGray
