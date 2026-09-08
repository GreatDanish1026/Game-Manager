param(
    [string]$Version = "1.0.0",
    [string]$Notes = "",
    [string]$Repository = "GreatDanish1026/Game-Manager"
)

$ErrorActionPreference = "Stop"

if (
    [string]::IsNullOrWhiteSpace(
        $Notes
    )
) {
    $Notes = "Game Manager v$Version"
}

$Root =
    Resolve-Path(
        Join-Path $PSScriptRoot ".."
    )

$NsisDir =
    Join-Path `
        $Root `
        "src-tauri\target\release\bundle\nsis"

$OutputDir =
    Join-Path `
        $Root `
        "release-assets"

Write-Host ""
Write-Host "Game Manager Release Asset Preparation" -ForegroundColor Cyan
Write-Host "Version: $Version"
Write-Host "Repository: $Repository"
Write-Host ""

# ------------------------------------------------------------
# Validate release configuration first, when validator exists
# ------------------------------------------------------------
$Validator =
    Join-Path `
        $PSScriptRoot `
        "validate-v1-release.ps1"

if (
    Test-Path(
        $Validator
    )
) {
    & powershell `
        -ExecutionPolicy Bypass `
        -File $Validator `
        -ExpectedVersion $Version

    if (
        $LASTEXITCODE -ne 0
    ) {
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
    @(
        Get-ChildItem `
            -Path $NsisDir `
            -File `
            -Filter "*setup.exe" |
        Sort-Object `
            -Property LastWriteTime `
            -Descending
    )

if (
    $Installers.Count -eq 0
) {
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

Write-Host "Using installer:"
Write-Host "  $($Installer.FullName)"
Write-Host "Using signature:"
Write-Host "  $SignaturePath"
Write-Host ""

# ------------------------------------------------------------
# Prepare stable GitHub asset names
# ------------------------------------------------------------
New-Item `
    -ItemType Directory `
    -Path $OutputDir `
    -Force |
    Out-Null

$SafeVersion =
    $Version -replace '[^0-9A-Za-z\.\-\+]', '-'

$AssetName =
    "GameManager_${SafeVersion}_x64-setup.exe"

$SigName =
    "$AssetName.sig"

$AssetPath =
    Join-Path `
        $OutputDir `
        $AssetName

$SigOutputPath =
    Join-Path `
        $OutputDir `
        $SigName

Copy-Item `
    -LiteralPath $Installer.FullName `
    -Destination $AssetPath `
    -Force

Copy-Item `
    -LiteralPath $SignaturePath `
    -Destination $SigOutputPath `
    -Force

# ------------------------------------------------------------
# Read the signature CONTENT
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

$PlatformEntry =
    [ordered]@{
        signature =
            $Signature

        url =
            $DownloadUrl
    }

$Platforms =
    [ordered]@{
        "windows-x86_64" =
            $PlatformEntry
    }

$Latest =
    [ordered]@{
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

        platforms =
            $Platforms
    }

$LatestPath =
    Join-Path `
        $OutputDir `
        "latest.json"

$LatestJson =
    $Latest |
    ConvertTo-Json `
        -Depth 10

# Windows PowerShell 5.1 writes a BOM with Set-Content -Encoding UTF8.
# Use .NET explicitly to produce UTF-8 WITHOUT a BOM.
$Utf8NoBom =
    New-Object `
        System.Text.UTF8Encoding `
        -ArgumentList $false

[System.IO.File]::WriteAllText(
    $LatestPath,
    $LatestJson,
    $Utf8NoBom
)

# ------------------------------------------------------------
# Validate the generated JSON immediately
# ------------------------------------------------------------
$Bytes =
    [System.IO.File]::ReadAllBytes(
        $LatestPath
    )

$HasBom =
    (
        $Bytes.Length -ge 3
    ) -and (
        $Bytes[0] -eq 0xEF
    ) -and (
        $Bytes[1] -eq 0xBB
    ) -and (
        $Bytes[2] -eq 0xBF
    )

if (
    $HasBom
) {
    throw "Generated latest.json contains a UTF-8 BOM."
}

$ParsedText =
    [System.IO.File]::ReadAllText(
        $LatestPath
    )

$Parsed =
    $ParsedText |
    ConvertFrom-Json

if (
    $Parsed.version -ne $Version
) {
    throw "Generated latest.json version does not match $Version."
}

$ParsedPlatform =
    $Parsed.platforms.'windows-x86_64'

if (
    $null -eq $ParsedPlatform
) {
    throw "Generated latest.json is missing platforms.windows-x86_64."
}

if (
    [string]::IsNullOrWhiteSpace(
        [string]$ParsedPlatform.signature
    )
) {
    throw "Generated latest.json contains an empty signature."
}

if (
    [string]$ParsedPlatform.url -ne $DownloadUrl
) {
    throw "Generated latest.json contains an unexpected updater URL."
}

# ------------------------------------------------------------
# Final output
# ------------------------------------------------------------
Write-Host ""
Write-Host "[PASS] Release assets prepared." -ForegroundColor Green
Write-Host "[PASS] latest.json is UTF-8 without BOM." -ForegroundColor Green
Write-Host "[PASS] latest.json parsed and validated." -ForegroundColor Green
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
