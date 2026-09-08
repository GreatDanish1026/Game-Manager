param(
    [string]$Version = "1.0.0",
    [string]$Notes = "Game Manager v1.0.0",
    [string]$Repository = "GreatDanish1026/Game-Manager"
)

$ErrorActionPreference = "Stop"

$Root =
    Resolve-Path(
        Join-Path $PSScriptRoot ".."
    )

$NsisDir =
    Join-Path(
        $Root
    ) "src-tauri\target\release\bundle\nsis"

$OutputDir =
    Join-Path(
        $Root
    ) "release-assets"

Write-Host ""
Write-Host "Game Manager Release Asset Preparation" -ForegroundColor Cyan
Write-Host "Version: $Version"
Write-Host "Repository: $Repository"
Write-Host ""

# ------------------------------------------------------------
# Validate release configuration first
# ------------------------------------------------------------
$Validator =
    Join-Path(
        $PSScriptRoot
    ) "validate-v1-release.ps1"

if (
    Test-Path(
        $Validator
    )
) {
    & powershell `
        -ExecutionPolicy Bypass `
        -File $Validator `
        -ExpectedVersion $Version

    if ($LASTEXITCODE -ne 0) {
        throw "Release validation failed. Fix the reported configuration before preparing assets."
    }
}

# ------------------------------------------------------------
# Locate the signed NSIS installer
# ------------------------------------------------------------
if (
    -not (
        Test-Path(
            $NsisDir
        )
    )
) {
    throw "NSIS output directory does not exist: $NsisDir"
}

$Installers =
    Get-ChildItem `
        -Path $NsisDir `
        -File `
        -Filter "*setup.exe" |
    Sort-Object `
        LastWriteTime `
        -Descending

if ($Installers.Count -eq 0) {
    throw "No NSIS *setup.exe installer was found in $NsisDir. Run a signed npm run tauri:build first."
}

$Installer =
    $Installers[0]

$SignaturePath =
    "$($Installer.FullName).sig"

if (
    -not (
        Test-Path(
            $SignaturePath
        )
    )
) {
    throw @"
The updater signature is missing:

$SignaturePath

Build again with TAURI_SIGNING_PRIVATE_KEY configured and bundle.createUpdaterArtifacts=true.
"@
}

# ------------------------------------------------------------
# Prepare stable GitHub asset names
# ------------------------------------------------------------
New-Item `
    -ItemType Directory `
    -Path $OutputDir `
    -Force |
    Out-Null

$SafeVersion =
    $Version `
        -replace '[^0-9A-Za-z\.\-\+]', '-'

$AssetName =
    "GameManager_${SafeVersion}_x64-setup.exe"

$SigName =
    "$AssetName.sig"

$AssetPath =
    Join-Path(
        $OutputDir
    ) $AssetName

$SigOutputPath =
    Join-Path(
        $OutputDir
    ) $SigName

Copy-Item `
    -LiteralPath $Installer.FullName `
    -Destination $AssetPath `
    -Force

Copy-Item `
    -LiteralPath $SignaturePath `
    -Destination $SigOutputPath `
    -Force

# ------------------------------------------------------------
# Read the signature CONTENT, not the .sig file path
# ------------------------------------------------------------
$Signature =
    (
        Get-Content `
            -LiteralPath $SignaturePath `
            -Raw
    ).Trim()

if (
    [string]::IsNullOrWhiteSpace(
        $Signature
    )
) {
    throw "The updater signature file is empty."
}

# ------------------------------------------------------------
# Generate Tauri v2 static latest.json
# ------------------------------------------------------------
$EncodedAssetName =
    [System.Uri]::EscapeDataString(
        $AssetName
    )

$DownloadUrl =
    "https://github.com/$Repository/releases/download/v$Version/$EncodedAssetName"

$Latest = [ordered]@{
    version =
        $Version

    notes =
        $Notes

    pub_date =
        (
            Get-Date
        ).ToUniversalTime().ToString(
            "yyyy-MM-ddTHH:mm:ssZ"
        )

    platforms = [ordered]@{
        "windows-x86_64" = [ordered]@{
            signature =
                $Signature

            url =
                $DownloadUrl
        }
    }
}

$LatestPath =
    Join-Path(
        $OutputDir
    ) "latest.json"

$Latest |
    ConvertTo-Json `
        -Depth 10 |
    Set-Content `
        -LiteralPath $LatestPath `
        -Encoding UTF8

# ------------------------------------------------------------
# Final output
# ------------------------------------------------------------
Write-Host ""
Write-Host "[PASS] Release assets prepared." -ForegroundColor Green
Write-Host ""
Write-Host "Upload these THREE files to GitHub release v${Version}:" -ForegroundColor Yellow
Write-Host "  $AssetPath"
Write-Host "  $SigOutputPath"
Write-Host "  $LatestPath"
Write-Host ""
Write-Host "Updater endpoint:"
Write-Host "  https://github.com/$Repository/releases/latest/download/latest.json"
Write-Host ""
Write-Host "Updater package URL stored in latest.json:"
Write-Host "  $DownloadUrl"
Write-Host ""
Write-Host "IMPORTANT:"
Write-Host "The GitHub release tag must be exactly v$Version unless you edit the generated package URL."
