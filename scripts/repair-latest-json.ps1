param(
    [string]$Version = "1.0.0",
    [string]$Repository = "GreatDanish1026/Game-Manager",
    [string]$Notes = "",
    [switch]$Upload
)

$ErrorActionPreference = "Stop"

function Pass(
    [string]$Message
) {
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Fail(
    [string]$Message
) {
    throw $Message
}

if (
    -not (
        Get-Command gh -ErrorAction SilentlyContinue
    )
) {
    Fail "GitHub CLI (gh) is required. Install it with: winget install --id GitHub.cli"
}

& gh auth status

if (
    $LASTEXITCODE -ne 0
) {
    Fail "GitHub CLI authentication is not ready. Run: gh auth login"
}

$Tag =
    "v$Version"

$AssetName =
    "GameAtlas_${Version}_x64-setup.exe"

$SigName =
    "$AssetName.sig"

$TempDir =
    Join-Path `
        $env:TEMP `
        "GameManager-UpdaterRepair-$Version"

if (
    Test-Path(
        $TempDir
    )
) {
    Remove-Item `
        -LiteralPath $TempDir `
        -Recurse `
        -Force
}

New-Item `
    -ItemType Directory `
    -Path $TempDir |
    Out-Null

Write-Host ""
Write-Host "Inspecting GitHub release $Tag..." -ForegroundColor Cyan

$ReleaseJson =
    & gh release view `
        $Tag `
        --repo $Repository `
        --json tagName,assets,url

if (
    $LASTEXITCODE -ne 0
) {
    Fail "Could not read GitHub release $Tag."
}

$Release =
    $ReleaseJson |
    ConvertFrom-Json

if (
    $Release.tagName -ne $Tag
) {
    Fail "Release tag mismatch. Found '$($Release.tagName)', expected '$Tag'."
}

$AssetNames =
    @(
        $Release.assets |
        ForEach-Object {
            $_.name
        }
    )

if (
    $AssetNames -notcontains $AssetName
) {
    Fail "Release is missing installer asset: $AssetName"
}

if (
    $AssetNames -notcontains $SigName
) {
    Fail "Release is missing signature asset: $SigName"
}

Pass "Release contains installer and signature assets."

Write-Host "Downloading existing updater signature..."

& gh release download `
    $Tag `
    --repo $Repository `
    --pattern $SigName `
    --dir $TempDir `
    --clobber

if (
    $LASTEXITCODE -ne 0
) {
    Fail "Could not download $SigName."
}

$SigPath =
    Join-Path `
        $TempDir `
        $SigName

$Signature =
    (
        Get-Content `
            -LiteralPath $SigPath `
            -Raw
    ).Trim()

if (
    [string]::IsNullOrWhiteSpace(
        $Signature
    )
) {
    Fail "Downloaded signature is empty."
}

Pass "Existing updater signature downloaded."

if (
    [string]::IsNullOrWhiteSpace(
        $Notes
    )
) {
    $Notes =
        "Game Manager v$Version"
}

$DownloadUrl =
    "https://github.com/$Repository/releases/download/$Tag/$AssetName"

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

$LatestJson =
    $Latest |
    ConvertTo-Json `
        -Depth 10

$LatestPath =
    Join-Path `
        $TempDir `
        "latest.json"

$Utf8NoBom =
    New-Object `
        System.Text.UTF8Encoding `
        -ArgumentList $false

[System.IO.File]::WriteAllText(
    $LatestPath,
    $LatestJson,
    $Utf8NoBom
)

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
    Fail "Generated latest.json unexpectedly contains a UTF-8 BOM."
}

Pass "Generated latest.json is UTF-8 without BOM."

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
    Fail "Generated latest.json version validation failed."
}

$ParsedSignature =
    [string]$Parsed.platforms.'windows-x86_64'.signature

$SignaturesMatch =
    $ParsedSignature.Trim() -eq $Signature

if (
    -not $SignaturesMatch
) {
    Fail "Generated latest.json signature validation failed."
}

$ParsedUrl =
    [string]$Parsed.platforms.'windows-x86_64'.url

if (
    $ParsedUrl -ne $DownloadUrl
) {
    Fail "Generated latest.json download URL validation failed."
}

Pass "Generated metadata fields validate correctly."

Write-Host ""
Write-Host "Generated file:" -ForegroundColor Cyan
Write-Host $LatestPath
Write-Host ""

if (
    -not $Upload
) {
    Write-Host "Dry run complete. Nothing was changed on GitHub." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To upload the repaired file, run:"
    Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\repair-latest-json.ps1 -Version $Version -Upload"
    exit 0
}

$Confirmation =
    Read-Host "Type REPAIR to replace latest.json on GitHub release $Tag"

if (
    $Confirmation -ne "REPAIR"
) {
    Write-Host "Cancelled."
    exit 0
}

& gh release upload `
    $Tag `
    $LatestPath `
    --repo $Repository `
    --clobber

if (
    $LASTEXITCODE -ne 0
) {
    Fail "GitHub upload failed."
}

Pass "latest.json replaced on GitHub release $Tag."

Write-Host ""
Write-Host "Now run:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\validate-updater-metadata.ps1 -ExpectedVersion $Version"
