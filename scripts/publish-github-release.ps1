param(
    [string]$Version = "1.0.0",
    [string]$Title = "Game Manager v1.0.0",
    [string]$NotesFile = ""
)

$ErrorActionPreference = "Stop"

$Root =
    Resolve-Path(
        Join-Path $PSScriptRoot ".."
    )

$ReleaseDir =
    Join-Path(
        $Root
    ) "release-assets"

$Installer =
    Join-Path(
        $ReleaseDir
    ) "GameManager_${Version}_x64-setup.exe"

$Signature =
    "$Installer.sig"

$Latest =
    Join-Path(
        $ReleaseDir
    ) "latest.json"

$Tag =
    "v$Version"

if (
    -not (
        Get-Command gh -ErrorAction SilentlyContinue
    )
) {
    throw "GitHub CLI (gh) is not installed or not in PATH."
}

foreach (
    $File
    in @(
        $Installer,
        $Signature,
        $Latest
    )
) {
    if (
        -not (
            Test-Path(
                $File
            )
        )
    ) {
        throw "Missing release asset: $File"
    }
}

# Confirm GitHub CLI authentication before changing anything.
& gh auth status

if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI authentication is not ready. Run gh auth login first."
}

$Arguments = @(
    "release",
    "create",
    $Tag,
    $Installer,
    $Signature,
    $Latest,
    "--repo",
    "GreatDanish1026/Game-Manager",
    "--title",
    $Title
)

if (
    -not (
        [string]::IsNullOrWhiteSpace(
            $NotesFile
        )
    )
) {
    $Arguments += @(
        "--notes-file",
        $NotesFile
    )
} else {
    $Arguments += @(
        "--generate-notes"
    )
}

Write-Host ""
Write-Host "About to create GitHub release $Tag." -ForegroundColor Yellow
Write-Host "Repository: GreatDanish1026/Game-Manager"
Write-Host ""

$Confirmation =
    Read-Host "Type RELEASE to continue"

if ($Confirmation -ne "RELEASE") {
    Write-Host "Cancelled."
    exit 0
}

& gh @Arguments

if ($LASTEXITCODE -ne 0) {
    throw "GitHub release creation failed."
}

Write-Host ""
Write-Host "[PASS] GitHub release created." -ForegroundColor Green
Write-Host "Verify:"
Write-Host "https://github.com/GreatDanish1026/Game-Manager/releases/latest/download/latest.json"
