param(
    [Parameter(Position = 0)]
    [ValidateSet(
        "preflight",
        "prepare",
        "validate",
        "publish",
        "all",
        "help"
    )]
    [string]$Action = "help",

    [string]$Version = "",

    [string]$ProjectRoot = ".",

    [string]$ReleaseDir = "",

    [string]$Repository = "GreatDanish1026/Game-Manager",

    [string]$ReleaseNotes = "",

    [switch]$Draft,

    [switch]$Prerelease,

    [switch]$SkipBuild,

    [switch]$SkipAudits
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest


# ============================================================
# Helpers
# ============================================================

function Write-Step {
    param(
        [string]$Message
    )

    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}


function Write-Pass {
    param(
        [string]$Message
    )

    Write-Host "[PASS] $Message" -ForegroundColor Green
}


function Write-WarnMessage {
    param(
        [string]$Message
    )

    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}


function Fail {
    param(
        [string]$Message
    )

    throw $Message
}


function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = ""
    )

    $OldLocation = Get-Location

    try {
        if ($WorkingDirectory) {
            Set-Location -LiteralPath $WorkingDirectory
        }

        & $FilePath @Arguments

        if ($LASTEXITCODE -ne 0) {
            Fail "$FilePath exited with code $LASTEXITCODE."
        }
    }
    finally {
        Set-Location $OldLocation
    }
}


function Get-JsonFile {
    param(
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        Fail "Required JSON file not found: $Path"
    }

    $Raw =
        [System.IO.File]::ReadAllText(
            $Path
        )

    if ($Raw.Length -gt 0 -and $Raw[0] -eq [char]0xFEFF) {
        $Raw =
            $Raw.Substring(1)
    }

    try {
        return $Raw | ConvertFrom-Json
    }
    catch {
        Fail "Invalid JSON in $Path`n$($_.Exception.Message)"
    }
}


function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    $Encoding =
        New-Object System.Text.UTF8Encoding($false)

    [System.IO.File]::WriteAllText(
        $Path,
        $Content,
        $Encoding
    )
}


function Normalize-Version {
    param(
        [string]$Value
    )

    $Clean =
        $Value.Trim()

    if ($Clean.StartsWith("v")) {
        $Clean =
            $Clean.Substring(1)
    }

    if (
        $Clean -notmatch
        '^\d+\.\d+\.\d+([\-+][0-9A-Za-z\.-]+)?$'
    ) {
        Fail "Version must look like 1.3.0 (or v1.3.0). Received: $Value"
    }

    return $Clean
}


function Resolve-Version {
    param(
        [string]$RequestedVersion,
        [string]$Root
    )

    if ($RequestedVersion) {
        return Normalize-Version $RequestedVersion
    }

    $TauriConfig =
        Join-Path $Root "src-tauri\tauri.conf.json"

    $Config =
        Get-JsonFile $TauriConfig

    if (-not $Config.version) {
        Fail "No version found in src-tauri\tauri.conf.json. Pass -Version explicitly."
    }

    return Normalize-Version ([string]$Config.version)
}


function Get-ReleaseDirectory {
    param(
        [string]$Root,
        [string]$RequestedDirectory,
        [string]$ResolvedVersion
    )

    if ($RequestedDirectory) {
        return [System.IO.Path]::GetFullPath(
            $RequestedDirectory
        )
    }

    return Join-Path $Root "release\v$ResolvedVersion"
}


function Get-InstallerCandidates {
    param(
        [string]$Root
    )

    $Nsis =
        Join-Path $Root "src-tauri\target\release\bundle\nsis"

    if (-not (Test-Path -LiteralPath $Nsis)) {
        return @()
    }

    return @(
        Get-ChildItem -LiteralPath $Nsis -File |
            Where-Object {
                $_.Extension -ieq ".exe"
            } |
            Sort-Object LastWriteTime -Descending
    )
}


function Get-SignatureForInstaller {
    param(
        [System.IO.FileInfo]$Installer
    )

    $Direct =
        "$($Installer.FullName).sig"

    if (Test-Path -LiteralPath $Direct) {
        return Get-Item -LiteralPath $Direct
    }

    $Sibling =
        Join-Path $Installer.DirectoryName (
            "$($Installer.Name).sig"
        )

    if (Test-Path -LiteralPath $Sibling) {
        return Get-Item -LiteralPath $Sibling
    }

    return $null
}


function Test-GitClean {
    param(
        [string]$Root
    )

    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-WarnMessage "git was not found; skipping working-tree check."
        return
    }

    $Status =
        & git -C $Root status --porcelain

    if ($LASTEXITCODE -ne 0) {
        Fail "git status failed."
    }

    if ($Status) {
        Write-WarnMessage "Git working tree has uncommitted changes."
        $Status | ForEach-Object {
            Write-Host "  $_"
        }
    }
    else {
        Write-Pass "Git working tree is clean."
    }
}


function Invoke-OptionalAudit {
    param(
        [string]$ScriptPath,
        [string]$Label,
        [string]$Root
    )

    if (-not (Test-Path -LiteralPath $ScriptPath)) {
        Write-WarnMessage "$Label audit script not present; skipping."
        return
    }

    Write-Step $Label

    & powershell `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File $ScriptPath `
        -ProjectRoot $Root

    if ($LASTEXITCODE -ne 0) {
        Fail "$Label audit failed."
    }

    Write-Pass "$Label audit passed."
}


# ============================================================
# Preflight
# ============================================================

function Invoke-Preflight {
    param(
        [string]$Root,
        [string]$ResolvedVersion,
        [bool]$RunAudits
    )

    Write-Step "Release preflight for GameAtlas v$ResolvedVersion"

    $RequiredPaths = @(
        "package.json",
        "src",
        "src-tauri",
        "src-tauri\tauri.conf.json",
        "src-tauri\Cargo.toml"
    )

    foreach ($Relative in $RequiredPaths) {
        $Path =
            Join-Path $Root $Relative

        if (-not (Test-Path -LiteralPath $Path)) {
            Fail "Required project path missing: $Relative"
        }
    }

    Write-Pass "Required project files are present."

    foreach ($Command in @("node", "npm", "cargo")) {
        if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
            Fail "Required command is not available: $Command"
        }
    }

    Write-Pass "Node, npm, and Cargo are available."

    $TauriConfig =
        Get-JsonFile (
            Join-Path $Root "src-tauri\tauri.conf.json"
        )

    $ConfigVersion =
        Normalize-Version ([string]$TauriConfig.version)

    if ($ConfigVersion -ne $ResolvedVersion) {
        Fail "tauri.conf.json version is $ConfigVersion but requested release is $ResolvedVersion."
    }

    Write-Pass "Tauri version matches v$ResolvedVersion."

    if (
        $TauriConfig.identifier -ne
        "com.greatdanish.gamemanager"
    ) {
        Fail "Tauri identifier changed. Expected com.greatdanish.gamemanager for upgrade continuity."
    }

    Write-Pass "Tauri identifier continuity preserved."

    $TauriConfigPath =
        Join-Path $Root "src-tauri\tauri.conf.json"

    $TauriText =
        [System.IO.File]::ReadAllText(
            $TauriConfigPath
        )

    if (
        $TauriText -notmatch
        'GreatDanish1026/Game-Manager/releases/latest/download/latest\.json'
    ) {
        Write-WarnMessage "Expected GitHub latest.json updater endpoint was not found verbatim in tauri.conf.json."
    }
    else {
        Write-Pass "Updater endpoint looks correct."
    }

    Test-GitClean $Root

    if ($RunAudits) {
        Invoke-OptionalAudit `
            -ScriptPath (Join-Path $Root "scripts\logging-audit.ps1") `
            -Label "Logging audit" `
            -Root $Root

        Invoke-OptionalAudit `
            -ScriptPath (Join-Path $Root "scripts\ux-branding-audit.ps1") `
            -Label "UX / branding audit" `
            -Root $Root
    }

    Write-Step "Frontend build"
    Invoke-Checked `
        -FilePath "npm" `
        -Arguments @("run", "build") `
        -WorkingDirectory $Root
    Write-Pass "Frontend build passed."

    Write-Step "Rust cargo check"
    Invoke-Checked `
        -FilePath "cargo" `
        -Arguments @("check") `
        -WorkingDirectory (Join-Path $Root "src-tauri")
    Write-Pass "cargo check passed."

    Write-Pass "Preflight completed."
}


# ============================================================
# Prepare release assets
# ============================================================

function Invoke-Prepare {
    param(
        [string]$Root,
        [string]$ResolvedVersion,
        [string]$OutputDirectory,
        [bool]$BuildFirst
    )

    if ($BuildFirst) {
        Write-Step "Signed Tauri release build"

        if (
            -not $env:TAURI_SIGNING_PRIVATE_KEY
        ) {
            Write-WarnMessage "TAURI_SIGNING_PRIVATE_KEY is not set in this shell."
            Write-WarnMessage "A signed updater build requires your existing private key environment variable."
            Fail "Release build stopped before npm run tauri:build."
        }

        Invoke-Checked `
            -FilePath "npm" `
            -Arguments @("run", "tauri:build") `
            -WorkingDirectory $Root
    }

    $Installers =
        Get-InstallerCandidates $Root

    if ($Installers.Count -eq 0) {
        Fail "No NSIS installer found under src-tauri\target\release\bundle\nsis."
    }

    $Installer =
        $Installers[0]

    $Signature =
        Get-SignatureForInstaller $Installer

    if (-not $Signature) {
        Fail "Updater signature not found for installer: $($Installer.Name)"
    }

    New-Item `
        -ItemType Directory `
        -Force `
        -Path $OutputDirectory |
        Out-Null

    $ReleaseInstallerName =
        "GameAtlas_${ResolvedVersion}_x64-setup.exe"

    $ReleaseSigName =
        "$ReleaseInstallerName.sig"

    $ReleaseInstaller =
        Join-Path $OutputDirectory $ReleaseInstallerName

    $ReleaseSig =
        Join-Path $OutputDirectory $ReleaseSigName

    Copy-Item `
        -LiteralPath $Installer.FullName `
        -Destination $ReleaseInstaller `
        -Force

    Copy-Item `
        -LiteralPath $Signature.FullName `
        -Destination $ReleaseSig `
        -Force

    $SignatureText =
        [System.IO.File]::ReadAllText(
            $ReleaseSig
        ).Trim()

    if (-not $SignatureText) {
        Fail "Signature file is empty."
    }

    $DownloadUrl =
        "https://github.com/$Repository/releases/download/v$ResolvedVersion/$ReleaseInstallerName"

    $Latest = [ordered]@{
        version =
            $ResolvedVersion

        notes =
            "GameAtlas v$ResolvedVersion"

        pub_date =
            [DateTime]::UtcNow.ToString(
                "yyyy-MM-ddTHH:mm:ssZ"
            )

        platforms = [ordered]@{
            "windows-x86_64" = [ordered]@{
                signature =
                    $SignatureText

                url =
                    $DownloadUrl
            }
        }
    }

    $LatestJson =
        $Latest |
        ConvertTo-Json -Depth 8

    $LatestPath =
        Join-Path $OutputDirectory "latest.json"

    Write-Utf8NoBom `
        -Path $LatestPath `
        -Content $LatestJson

    Write-Pass "Prepared release assets:"
    Write-Host "  $ReleaseInstallerName"
    Write-Host "  $ReleaseSigName"
    Write-Host "  latest.json"
    Write-Host ""
    Write-Host "Release directory:"
    Write-Host "  $OutputDirectory"
}


# ============================================================
# Validate release assets
# ============================================================

function Invoke-Validate {
    param(
        [string]$ResolvedVersion,
        [string]$OutputDirectory,
        [string]$ExpectedRepository
    )

    Write-Step "Validate release assets"

    $InstallerName =
        "GameAtlas_${ResolvedVersion}_x64-setup.exe"

    $Required = @(
        $InstallerName,
        "$InstallerName.sig",
        "latest.json"
    )

    foreach ($File in $Required) {
        $Path =
            Join-Path $OutputDirectory $File

        if (-not (Test-Path -LiteralPath $Path)) {
            Fail "Missing release asset: $File"
        }

        $Info =
            Get-Item -LiteralPath $Path

        if ($Info.Length -le 0) {
            Fail "Release asset is empty: $File"
        }

        Write-Pass "$File exists and is non-empty."
    }

    $LatestPath =
        Join-Path $OutputDirectory "latest.json"

    $Raw =
        [System.IO.File]::ReadAllText(
            $LatestPath
        )

    if (
        $Raw.Length -gt 0 -and
        $Raw[0] -eq [char]0xFEFF
    ) {
        Fail "latest.json contains a UTF-8 BOM."
    }

    $Latest =
        Get-JsonFile $LatestPath

    $LatestVersion =
        Normalize-Version ([string]$Latest.version)

    if ($LatestVersion -ne $ResolvedVersion) {
        Fail "latest.json version does not match v$ResolvedVersion."
    }

    $Platform =
        $Latest.platforms."windows-x86_64"

    if (-not $Platform) {
        Fail "latest.json is missing platforms.windows-x86_64."
    }

    if (
        -not ([string]$Platform.signature)
    ) {
        Fail "latest.json signature is missing."
    }

    $ExpectedUrl =
        "https://github.com/$ExpectedRepository/releases/download/v$ResolvedVersion/$InstallerName"

    if (
        ([string]$Platform.url) -ne
        $ExpectedUrl
    ) {
        Fail "latest.json URL mismatch.`nExpected: $ExpectedUrl`nActual:   $($Platform.url)"
    }

    Write-Pass "latest.json schema, version, signature, URL, and UTF-8 encoding are valid."

    $SigPath =
        Join-Path $OutputDirectory "$InstallerName.sig"

    $SigFile =
        [System.IO.File]::ReadAllText(
            $SigPath
        ).Trim()

    if (
        $SigFile -ne
        ([string]$Platform.signature).Trim()
    ) {
        Fail "latest.json signature does not exactly match the .sig file."
    }

    Write-Pass "latest.json signature matches the detached .sig file."
    Write-Pass "Release asset validation completed."
}


# ============================================================
# Publish
# ============================================================

function Invoke-Publish {
    param(
        [string]$ResolvedVersion,
        [string]$OutputDirectory,
        [string]$Repo,
        [string]$NotesPath,
        [bool]$IsDraft,
        [bool]$IsPrerelease
    )

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        Fail "GitHub CLI (gh) is required for publish."
    }

    Invoke-Validate `
        -ResolvedVersion $ResolvedVersion `
        -OutputDirectory $OutputDirectory `
        -ExpectedRepository $Repo

    Write-Step "Publish GitHub release v$ResolvedVersion"

    $Tag =
        "v$ResolvedVersion"

    $InstallerName =
        "GameAtlas_${ResolvedVersion}_x64-setup.exe"

    $Assets = @(
        (Join-Path $OutputDirectory $InstallerName)
        (Join-Path $OutputDirectory "$InstallerName.sig")
        (Join-Path $OutputDirectory "latest.json")
    )

    $Existing =
        & gh release view $Tag `
            --repo $Repo `
            --json tagName `
            2>$null

    if ($LASTEXITCODE -eq 0 -and $Existing) {
        Fail "GitHub release $Tag already exists. This script will not overwrite an existing release."
    }

    $Arguments = @(
        "release",
        "create",
        $Tag
    )

    $Arguments += $Assets

    $Arguments += @(
        "--repo",
        $Repo,
        "--title",
        "GameAtlas v$ResolvedVersion"
    )

    if (
        $NotesPath -and
        (Test-Path -LiteralPath $NotesPath)
    ) {
        $Arguments += @(
            "--notes-file",
            $NotesPath
        )
    }
    else {
        $Arguments += @(
            "--notes",
            "GameAtlas v$ResolvedVersion"
        )
    }

    if ($IsDraft) {
        $Arguments += "--draft"
    }

    if ($IsPrerelease) {
        $Arguments += "--prerelease"
    }

    & gh @Arguments

    if ($LASTEXITCODE -ne 0) {
        Fail "GitHub release creation failed."
    }

    Write-Pass "GitHub release v$ResolvedVersion published."

    Write-Step "Verify public release assets"

    foreach ($Name in @(
        $InstallerName,
        "$InstallerName.sig",
        "latest.json"
    )) {
        $Url =
            "https://github.com/$Repo/releases/download/v$ResolvedVersion/$Name"

        try {
            $Response =
                Invoke-WebRequest `
                    -Uri $Url `
                    -Method Head `
                    -UseBasicParsing

            if (
                $Response.StatusCode -lt 200 -or
                $Response.StatusCode -ge 400
            ) {
                Fail "Public asset returned HTTP $($Response.StatusCode): $Name"
            }

            Write-Pass "Public asset reachable: $Name"
        }
        catch {
            Fail "Public release verification failed for $Name`n$($_.Exception.Message)"
        }
    }

    Write-Pass "Public release verification completed."
}


# ============================================================
# Main
# ============================================================

if ($Action -eq "help") {
    Write-Host @"

GameAtlas release tool

Usage:
  .\scripts\release.ps1 preflight
  .\scripts\release.ps1 prepare  -Version 1.3.0
  .\scripts\release.ps1 validate -Version 1.3.0
  .\scripts\release.ps1 publish  -Version 1.3.0 -ReleaseNotes .\RELEASE_NOTES.md
  .\scripts\release.ps1 all      -Version 1.3.0 -ReleaseNotes .\RELEASE_NOTES.md

Useful switches:
  -SkipBuild     Reuse an existing signed Tauri build during prepare/all.
  -SkipAudits    Skip logging-audit.ps1 and ux-branding-audit.ps1.
  -Draft         Publish GitHub release as a draft.
  -Prerelease    Mark the GitHub release as a prerelease.
  -ReleaseDir    Override the default release\v<version> output folder.

Permanent scripts expected after consolidation:
  release.ps1
  logging-audit.ps1
  ux-branding-audit.ps1

"@
    exit 0
}


$ResolvedRoot =
    Resolve-Path -LiteralPath $ProjectRoot

$Root =
    [System.IO.Path]::GetFullPath(
        ([string]$ResolvedRoot.Path)
    )

$ResolvedVersion =
    Resolve-Version `
        -RequestedVersion $Version `
        -Root $Root

$OutputDirectory =
    Get-ReleaseDirectory `
        -Root $Root `
        -RequestedDirectory $ReleaseDir `
        -ResolvedVersion $ResolvedVersion


switch ($Action) {
    "preflight" {
        Invoke-Preflight `
            -Root $Root `
            -ResolvedVersion $ResolvedVersion `
            -RunAudits (-not $SkipAudits)
    }

    "prepare" {
        Invoke-Prepare `
            -Root $Root `
            -ResolvedVersion $ResolvedVersion `
            -OutputDirectory $OutputDirectory `
            -BuildFirst (-not $SkipBuild)
    }

    "validate" {
        Invoke-Validate `
            -ResolvedVersion $ResolvedVersion `
            -OutputDirectory $OutputDirectory `
            -ExpectedRepository $Repository
    }

    "publish" {
        Invoke-Publish `
            -ResolvedVersion $ResolvedVersion `
            -OutputDirectory $OutputDirectory `
            -Repo $Repository `
            -NotesPath $ReleaseNotes `
            -IsDraft $Draft `
            -IsPrerelease $Prerelease
    }

    "all" {
        Invoke-Preflight `
            -Root $Root `
            -ResolvedVersion $ResolvedVersion `
            -RunAudits (-not $SkipAudits)

        Invoke-Prepare `
            -Root $Root `
            -ResolvedVersion $ResolvedVersion `
            -OutputDirectory $OutputDirectory `
            -BuildFirst (-not $SkipBuild)

        Invoke-Validate `
            -ResolvedVersion $ResolvedVersion `
            -OutputDirectory $OutputDirectory `
            -ExpectedRepository $Repository

        Invoke-Publish `
            -ResolvedVersion $ResolvedVersion `
            -OutputDirectory $OutputDirectory `
            -Repo $Repository `
            -NotesPath $ReleaseNotes `
            -IsDraft $Draft `
            -IsPrerelease $Prerelease
    }
}
