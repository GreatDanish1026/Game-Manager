<#
.SYNOPSIS
Builds a signed GameAtlas Windows installer and updater manifest.

.EXAMPLE
.\scripts\release.ps1

.EXAMPLE
.\scripts\release.ps1 -SigningKey C:\secure\gameatlas.key -ReleaseNotes .\RELEASE_NOTES.md

.DESCRIPTION
Prompts securely for the updater signing-key password, builds the NSIS
installer and .sig, and writes a BOM-free latest.json to release\v<version>.
Run Get-Help .\scripts\release.ps1 -Full for all parameters.
#>
[CmdletBinding()]
param(
    [string]$SigningKey = "",
    [string]$Version = "",
    [string]$ReleaseNotes = "",
    [string]$ProjectRoot = "",
    [string]$ReleaseDir = "",
    [string]$Repository = "GreatDanish1026/Game-Manager",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail {
    param([string]$Message)
    throw $Message
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Pass {
    param([string]$Message)
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    Push-Location -LiteralPath $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            Fail "$FilePath exited with code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Normalize-Version {
    param([string]$Value)

    $Normalized = $Value.Trim() -replace '^v', ''
    if ($Normalized -notmatch '^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$') {
        Fail "Invalid semantic version: $Value"
    }

    return $Normalized
}

function Read-Notes {
    param(
        [string]$Path,
        [string]$ResolvedVersion
    )

    if (-not $Path) {
        return "GameAtlas v$ResolvedVersion"
    }

    $ResolvedPath = Resolve-Path -LiteralPath $Path -ErrorAction Stop
    $Notes = [System.IO.File]::ReadAllText($ResolvedPath.Path).Trim()
    if (-not $Notes) {
        Fail "Release notes file is empty: $($ResolvedPath.Path)"
    }

    return $Notes
}

function Write-JsonWithoutBom {
    param(
        [string]$Path,
        [object]$Value
    )

    $Json = $Value | ConvertTo-Json -Depth 12
    $Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, "$Json`n", $Utf8NoBom)
}

if (-not $ProjectRoot) {
    $ProjectRoot = Join-Path $PSScriptRoot ".."
}

$Root = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $ProjectRoot).Path)
$TauriConfigPath = Join-Path $Root "src-tauri\tauri.conf.json"
$PackagePath = Join-Path $Root "package.json"
$CargoPath = Join-Path $Root "src-tauri\Cargo.toml"

foreach ($RequiredPath in @($TauriConfigPath, $PackagePath, $CargoPath)) {
    if (-not (Test-Path -LiteralPath $RequiredPath -PathType Leaf)) {
        Fail "Required project file not found: $RequiredPath"
    }
}

$TauriConfig = Get-Content -LiteralPath $TauriConfigPath -Raw | ConvertFrom-Json
$Package = Get-Content -LiteralPath $PackagePath -Raw | ConvertFrom-Json
$ResolvedVersion = if ($Version) {
    Normalize-Version $Version
}
else {
    Normalize-Version ([string]$TauriConfig.version)
}

if ((Normalize-Version ([string]$TauriConfig.version)) -ne $ResolvedVersion) {
    Fail "tauri.conf.json version does not match $ResolvedVersion."
}

if ((Normalize-Version ([string]$Package.version)) -ne $ResolvedVersion) {
    Fail "package.json version does not match $ResolvedVersion."
}

$CargoText = [System.IO.File]::ReadAllText($CargoPath)
if ($CargoText -notmatch '(?m)^version\s*=\s*"([^\"]+)"') {
    Fail "Could not read the package version from Cargo.toml."
}

if ((Normalize-Version $Matches[1]) -ne $ResolvedVersion) {
    Fail "Cargo.toml version does not match $ResolvedVersion."
}

$OutputDirectory = if ($ReleaseDir) {
    [System.IO.Path]::GetFullPath($ReleaseDir)
}
else {
    Join-Path $Root "release\v$ResolvedVersion"
}

$Notes = Read-Notes -Path $ReleaseNotes -ResolvedVersion $ResolvedVersion

Write-Step "GameAtlas v$ResolvedVersion Windows release"

if (-not $SkipBuild) {
    foreach ($Command in @("node", "npm", "cargo")) {
        if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
            Fail "Required command is not installed or not on PATH: $Command"
        }
    }

    $KeyValue = $SigningKey
    if (-not $KeyValue) {
        $KeyValue = $env:TAURI_SIGNING_PRIVATE_KEY
    }
    if (-not $KeyValue) {
        $KeyValue = $env:TAURI_SIGNING_PRIVATE_KEY_PATH
    }
    if (-not $KeyValue) {
        $KeyValue = Read-Host "Path to your Tauri updater private key"
    }
    if (-not $KeyValue) {
        Fail "A Tauri updater private key is required."
    }

    if (Test-Path -LiteralPath $KeyValue -PathType Leaf) {
        $KeyValue = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $KeyValue).Path)
    }

    $SecurePassword = Read-Host `
        "Signing-key password (press Enter only if the key has no password)" `
        -AsSecureString
    $PasswordPointer = [IntPtr]::Zero
    $PlainPassword = $null
    $PreviousKey = $env:TAURI_SIGNING_PRIVATE_KEY
    $PreviousKeyPath = $env:TAURI_SIGNING_PRIVATE_KEY_PATH
    $PreviousPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD

    try {
        $PasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
        $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($PasswordPointer)

        $env:TAURI_SIGNING_PRIVATE_KEY = $KeyValue
        Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PATH -ErrorAction SilentlyContinue
        $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $PlainPassword

        Write-Step "Install locked dependencies"
        Invoke-Checked -FilePath "npm" -Arguments @("ci") -WorkingDirectory $Root

        Write-Step "Build and sign NSIS installer"
        Invoke-Checked `
            -FilePath "npm" `
            -Arguments @("run", "tauri:build", "--", "--bundles", "nsis") `
            -WorkingDirectory $Root
    }
    finally {
        $PlainPassword = $null
        if ($PasswordPointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPointer)
        }

        if ($null -eq $PreviousKey) {
            Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
        }
        else {
            $env:TAURI_SIGNING_PRIVATE_KEY = $PreviousKey
        }

        if ($null -eq $PreviousKeyPath) {
            Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PATH -ErrorAction SilentlyContinue
        }
        else {
            $env:TAURI_SIGNING_PRIVATE_KEY_PATH = $PreviousKeyPath
        }

        if ($null -eq $PreviousPassword) {
            Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
        }
        else {
            $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $PreviousPassword
        }
    }
}

$BundleDirectory = Join-Path $Root "src-tauri\target\release\bundle\nsis"
$InstallerName = "GameAtlas_${ResolvedVersion}_x64-setup.exe"
$BuiltInstaller = Join-Path $BundleDirectory $InstallerName
$BuiltSignature = "$BuiltInstaller.sig"

foreach ($Artifact in @($BuiltInstaller, $BuiltSignature)) {
    if (-not (Test-Path -LiteralPath $Artifact -PathType Leaf)) {
        Fail "Signed build artifact not found: $Artifact"
    }
    if ((Get-Item -LiteralPath $Artifact).Length -le 0) {
        Fail "Signed build artifact is empty: $Artifact"
    }
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$ReleaseInstaller = Join-Path $OutputDirectory $InstallerName
$ReleaseSignature = "$ReleaseInstaller.sig"
Copy-Item -LiteralPath $BuiltInstaller -Destination $ReleaseInstaller -Force
Copy-Item -LiteralPath $BuiltSignature -Destination $ReleaseSignature -Force

$SignatureText = [System.IO.File]::ReadAllText($ReleaseSignature).Trim()
if (-not $SignatureText) {
    Fail "The generated updater signature is empty."
}

$ManifestPath = Join-Path $OutputDirectory "latest.json"
$Platforms = [ordered]@{}

if (Test-Path -LiteralPath $ManifestPath -PathType Leaf) {
    $ExistingText = [System.IO.File]::ReadAllText($ManifestPath).TrimStart([char]0xFEFF)
    try {
        $Existing = $ExistingText | ConvertFrom-Json
        if ((Normalize-Version ([string]$Existing.version)) -eq $ResolvedVersion) {
            foreach ($Property in $Existing.platforms.PSObject.Properties) {
                $Platforms[$Property.Name] = $Property.Value
            }
        }
    }
    catch {
        Fail "Existing latest.json is invalid and cannot be merged: $($_.Exception.Message)"
    }
}

$DownloadUrl =
    "https://github.com/$Repository/releases/download/v$ResolvedVersion/$InstallerName"
$Platforms["windows-x86_64"] = [ordered]@{
    signature = $SignatureText
    url = $DownloadUrl
}

$Manifest = [ordered]@{
    version = $ResolvedVersion
    notes = $Notes
    pub_date = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = $Platforms
}

Write-JsonWithoutBom -Path $ManifestPath -Value $Manifest

$ManifestBytes = [System.IO.File]::ReadAllBytes($ManifestPath)
if (
    $ManifestBytes.Length -ge 3 -and
    $ManifestBytes[0] -eq 0xEF -and
    $ManifestBytes[1] -eq 0xBB -and
    $ManifestBytes[2] -eq 0xBF
) {
    Fail "latest.json contains a UTF-8 BOM."
}

$Validated = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$ValidatedEntry = $Validated.platforms."windows-x86_64"
if (
    (Normalize-Version ([string]$Validated.version)) -ne $ResolvedVersion -or
    ([string]$ValidatedEntry.signature).Trim() -ne $SignatureText -or
    ([string]$ValidatedEntry.url) -ne $DownloadUrl
) {
    Fail "latest.json validation failed."
}

$ChecksumPath = Join-Path $OutputDirectory "SHA256SUMS-WINDOWS.txt"
$Hash = (Get-FileHash -LiteralPath $ReleaseInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText(
    $ChecksumPath,
    "$Hash  $InstallerName`n",
    [System.Text.UTF8Encoding]::new($false)
)

Write-Pass "Signed Windows release created and validated."
Write-Host "  $ReleaseInstaller"
Write-Host "  $ReleaseSignature"
Write-Host "  $ManifestPath"
Write-Host "  $ChecksumPath"
Write-Host ""
Write-Host "If the Linux script has already written the same release directory, its platform entries were preserved."
