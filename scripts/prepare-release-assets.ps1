param(
    [string]$ProjectRoot = ".",
    [string]$Version = "1.2.0",
    [string]$Repository = "GreatDanish1026/Game-Manager",
    [string]$OutputDirectory = ".\release-v1.2.0"
)

$ErrorActionPreference = "Stop"

function Pass([string]$Message) {
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Fail([string]$Message) {
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    throw $Message
}

function Info([string]$Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

$ResolvedRoot = Resolve-Path -LiteralPath $ProjectRoot
$Root = [System.IO.Path]::GetFullPath([string]$ResolvedRoot.Path)

$OutputPath =
    if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
        [System.IO.Path]::GetFullPath($OutputDirectory)
    } else {
        [System.IO.Path]::GetFullPath(
            (Join-Path $Root $OutputDirectory)
        )
    }

$BundleRoot = Join-Path $Root "src-tauri\target\release\bundle"
$NsisRoot = Join-Path $BundleRoot "nsis"

if (-not (Test-Path -LiteralPath $NsisRoot)) {
    Fail "NSIS bundle directory not found: $NsisRoot. Run npm run tauri:build first."
}

$ExpectedInstallerName = "GameAtlas_${Version}_x64-setup.exe"
$ExpectedSignatureName = "${ExpectedInstallerName}.sig"

$InstallerCandidates = @(
    Get-ChildItem -LiteralPath $NsisRoot -File -Filter "*.exe" -ErrorAction SilentlyContinue
)

if ($InstallerCandidates.Count -eq 0) {
    Fail "No NSIS installer .exe found under $NsisRoot."
}

$Installer =
    $InstallerCandidates |
    Where-Object {
        $_.Name -eq $ExpectedInstallerName
    } |
    Select-Object -First 1

if (-not $Installer) {
    if ($InstallerCandidates.Count -eq 1) {
        $Installer = $InstallerCandidates[0]
        Info "Using generated installer '$($Installer.Name)' and normalizing release asset name to '$ExpectedInstallerName'."
    } else {
        Write-Host "Found installer candidates:" -ForegroundColor Yellow
        $InstallerCandidates | ForEach-Object {
            Write-Host "  $($_.FullName)" -ForegroundColor Yellow
        }

        Fail "Could not uniquely select the v$Version NSIS installer."
    }
}

$SignatureCandidates = @(
    Get-ChildItem -LiteralPath $NsisRoot -File -Filter "*.sig" -ErrorAction SilentlyContinue
)

$Signature =
    $SignatureCandidates |
    Where-Object {
        $_.Name -eq $ExpectedSignatureName
    } |
    Select-Object -First 1

if (-not $Signature) {
    $LikelySig = "$($Installer.FullName).sig"

    if (Test-Path -LiteralPath $LikelySig) {
        $Signature = Get-Item -LiteralPath $LikelySig
    }
}

if (-not $Signature) {
    if ($SignatureCandidates.Count -eq 1) {
        $Signature = $SignatureCandidates[0]
        Info "Using generated signature '$($Signature.Name)' and normalizing release asset name to '$ExpectedSignatureName'."
    } else {
        Fail "Updater signature .sig was not found. Confirm createUpdaterArtifacts=true and the updater signing environment is configured."
    }
}

New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

$ReleaseInstaller = Join-Path $OutputPath $ExpectedInstallerName
$ReleaseSignature = Join-Path $OutputPath $ExpectedSignatureName
$LatestJsonPath = Join-Path $OutputPath "latest.json"

Copy-Item -LiteralPath $Installer.FullName -Destination $ReleaseInstaller -Force
Copy-Item -LiteralPath $Signature.FullName -Destination $ReleaseSignature -Force

Pass "Installer prepared: $ExpectedInstallerName"
Pass "Signature prepared: $ExpectedSignatureName"

$SignatureText =
    [System.IO.File]::ReadAllText(
        $ReleaseSignature,
        [System.Text.Encoding]::UTF8
    ).Trim()

if ([string]::IsNullOrWhiteSpace($SignatureText)) {
    Fail "Signature file is empty."
}

$InstallerUrl =
    "https://github.com/$Repository/releases/download/v$Version/$ExpectedInstallerName"

$Notes =
    "GameAtlas v$Version"

$LatestObject = [ordered]@{
    version = $Version
    notes = $Notes
    pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = [ordered]@{
        "windows-x86_64" = [ordered]@{
            signature = $SignatureText
            url = $InstallerUrl
        }
    }
}

$LatestJson =
    $LatestObject |
    ConvertTo-Json -Depth 10

# Windows PowerShell 5.1 Set-Content -Encoding UTF8 adds a BOM.
# WriteAllText + UTF8Encoding(false) guarantees UTF-8 without BOM.
$Utf8NoBom =
    New-Object System.Text.UTF8Encoding -ArgumentList $false

[System.IO.File]::WriteAllText(
    $LatestJsonPath,
    $LatestJson,
    $Utf8NoBom
)

Pass "latest.json generated as UTF-8 without BOM"

# Validate the JSON immediately.
$Parsed =
    Get-Content -LiteralPath $LatestJsonPath -Raw |
    ConvertFrom-Json

if ([string]$Parsed.version -ne $Version) {
    Fail "latest.json version validation failed."
}

$Platform =
    $Parsed.platforms."windows-x86_64"

if ([string]::IsNullOrWhiteSpace([string]$Platform.signature)) {
    Fail "latest.json signature is empty."
}

if ([string]$Platform.url -ne $InstallerUrl) {
    Fail "latest.json installer URL does not match the expected release URL."
}

$Bytes =
    [System.IO.File]::ReadAllBytes(
        $LatestJsonPath
    )

$HasBom =
    $Bytes.Length -ge 3 -and
    $Bytes[0] -eq 0xEF -and
    $Bytes[1] -eq 0xBB -and
    $Bytes[2] -eq 0xBF

if ($HasBom) {
    Fail "latest.json unexpectedly contains a UTF-8 BOM."
}

Pass "latest.json content validation passed"

$InstallerInfo =
    [System.Diagnostics.FileVersionInfo]::GetVersionInfo(
        $ReleaseInstaller
    )

Write-Host ""
Write-Host "Prepared release assets:" -ForegroundColor White
Write-Host "  $ReleaseInstaller" -ForegroundColor DarkGray
Write-Host "  $ReleaseSignature" -ForegroundColor DarkGray
Write-Host "  $LatestJsonPath" -ForegroundColor DarkGray
Write-Host ""

Write-Host "Installer file metadata:" -ForegroundColor White
Write-Host "  ProductName: $($InstallerInfo.ProductName)" -ForegroundColor DarkGray
Write-Host "  FileVersion: $($InstallerInfo.FileVersion)" -ForegroundColor DarkGray
Write-Host "  ProductVersion: $($InstallerInfo.ProductVersion)" -ForegroundColor DarkGray

if ($InstallerInfo.ProductName -and $InstallerInfo.ProductName -notmatch "GameAtlas") {
    Write-Host "[WARN] Installer metadata ProductName does not contain GameAtlas. Review branding before release." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next: upload all three prepared files to GitHub release tag v$Version." -ForegroundColor Cyan
