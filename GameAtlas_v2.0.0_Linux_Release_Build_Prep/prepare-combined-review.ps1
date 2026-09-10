param(
    [string]$ProjectRoot = ".",
    [string]$LinuxReleaseDir = "",
    [string]$WindowsReleaseDir = ""
)

$ErrorActionPreference = "Stop"

$Version = "2.0.0"

$Root =
    [System.IO.Path]::GetFullPath(
        [string](
            Resolve-Path -LiteralPath $ProjectRoot
        ).Path
    )

if ([string]::IsNullOrWhiteSpace($LinuxReleaseDir)) {
    $LinuxReleaseDir =
        Join-Path $Root "release\v$Version-linux"
}

if ([string]::IsNullOrWhiteSpace($WindowsReleaseDir)) {
    $WindowsReleaseDir =
        Join-Path $Root "release\v$Version"
}

$LinuxAppImage =
    Join-Path $LinuxReleaseDir "GameAtlas_${Version}_x86_64.AppImage"

if (-not (Test-Path -LiteralPath $LinuxAppImage)) {
    throw "Linux AppImage not found: $LinuxAppImage"
}

$CombinedDir =
    Join-Path $Root "release\v$Version-combined"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $CombinedDir |
Out-Null

Copy-Item `
    -LiteralPath $LinuxAppImage `
    -Destination (Join-Path $CombinedDir (Split-Path $LinuxAppImage -Leaf)) `
    -Force

if (Test-Path -LiteralPath $WindowsReleaseDir) {
    Get-ChildItem `
        -LiteralPath $WindowsReleaseDir `
        -File |
    Where-Object {
        $_.Name -in @(
            "GameAtlas_${Version}_x64-setup.exe",
            "GameAtlas_${Version}_x64-setup.exe.sig",
            "latest.json",
            "SHA256SUMS.txt"
        )
    } |
    ForEach-Object {
        Copy-Item `
            -LiteralPath $_.FullName `
            -Destination (Join-Path $CombinedDir $_.Name) `
            -Force
    }
}
else {
    Write-Host "[WARN] Windows release directory not found: $WindowsReleaseDir" -ForegroundColor Yellow
}

$Files =
    Get-ChildItem `
        -LiteralPath $CombinedDir `
        -File |
    Sort-Object Name

Write-Host "[PASS] Combined review directory prepared:" -ForegroundColor Green
Write-Host "  $CombinedDir"
Write-Host ""

$Files |
    Format-Table Name, Length -AutoSize

Write-Host ""
Write-Host "This script does not publish or modify GitHub." -ForegroundColor Yellow
