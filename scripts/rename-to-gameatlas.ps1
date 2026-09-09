param(
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if (
    [string]::IsNullOrWhiteSpace(
        $ProjectRoot
    )
) {
    $ResolvedRoot =
        Resolve-Path(
            Join-Path $PSScriptRoot ".."
        )
} else {
    $ResolvedRoot =
        Resolve-Path(
            $ProjectRoot
        )
}

$ProjectRoot =
    [System.IO.Path]::GetFullPath(
        [string]$ResolvedRoot.Path
    )

Write-Host ""
Write-Host "GameAtlas Branding Rename" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host ""

$BackupRoot =
    Join-Path `
        $ProjectRoot `
        ("rename-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

New-Item `
    -ItemType Directory `
    -Path $BackupRoot `
    -Force |
    Out-Null

function Backup-File(
    [string]$Path
) {
    if (
        -not (
            Test-Path(
                $Path
            )
        )
    ) {
        return
    }

    $FullPath =
        [System.IO.Path]::GetFullPath(
            $Path
        )

    $RootPrefix =
        $ProjectRoot.TrimEnd(
            '\'
        ) + '\'

    if (
        $FullPath.StartsWith(
            $RootPrefix,
            [System.StringComparison]::OrdinalIgnoreCase
        )
    ) {
        $Relative =
            $FullPath.Substring(
                $RootPrefix.Length
            )
    } else {
        $Relative =
            [System.IO.Path]::GetFileName(
                $FullPath
            )
    }

    $Destination =
        Join-Path `
            $BackupRoot `
            $Relative

    $DestinationDir =
        [System.IO.Path]::GetDirectoryName(
            $Destination
        )

    if (
        -not [string]::IsNullOrWhiteSpace(
            $DestinationDir
        )
    ) {
        New-Item `
            -ItemType Directory `
            -Path $DestinationDir `
            -Force |
            Out-Null
    }

    Copy-Item `
        -LiteralPath $FullPath `
        -Destination $Destination `
        -Force
}

function Replace-BrandText(
    [string]$Path
) {
    if (
        -not (
            Test-Path(
                $Path
            )
        )
    ) {
        return
    }

    Backup-File(
        $Path
    )

    $Text =
        [System.IO.File]::ReadAllText(
            $Path
        )

    $Updated =
        $Text.Replace(
            "Game Manager",
            "GameAtlas"
        )

    if (
        $Updated -ne $Text
    ) {
        $Utf8NoBom =
            New-Object `
                System.Text.UTF8Encoding `
                -ArgumentList $false

        [System.IO.File]::WriteAllText(
            $Path,
            $Updated,
            $Utf8NoBom
        )

        Write-Host "[UPDATED] $Path" -ForegroundColor Green
    }
}

# ------------------------------------------------------------
# Frontend branding
# ------------------------------------------------------------
$SourceRoot =
    Join-Path `
        $ProjectRoot `
        "src"

if (
    Test-Path(
        $SourceRoot
    )
) {
    $SourceFiles =
        Get-ChildItem `
            -Path $SourceRoot `
            -Recurse `
            -File |
        Where-Object {
            $_.Extension -in @(
                ".js",
                ".jsx",
                ".ts",
                ".tsx"
            )
        }

    foreach (
        $File in $SourceFiles
    ) {
        Replace-BrandText(
            $File.FullName
        )
    }
}

# ------------------------------------------------------------
# README / user-facing project docs
# ------------------------------------------------------------
$Readme =
    Join-Path `
        $ProjectRoot `
        "README.md"

Replace-BrandText(
    $Readme
)

# ------------------------------------------------------------
# Tauri visible product branding
#
# IMPORTANT:
# - KEEP identifier unchanged.
# - KEEP updater public key/endpoints unchanged.
# - KEEP version unchanged.
# - KEEP Rust/Cargo package name unchanged.
#
# This lets the installed application retain its existing identity while
# changing the visible product branding.
# ------------------------------------------------------------
$TauriPath =
    Join-Path `
        $ProjectRoot `
        "src-tauri\tauri.conf.json"

if (
    Test-Path(
        $TauriPath
    )
) {
    Backup-File(
        $TauriPath
    )

    $Tauri =
        Get-Content `
            -LiteralPath $TauriPath `
            -Raw |
        ConvertFrom-Json

    $OriginalIdentifier =
        [string]$Tauri.identifier

    $OriginalVersion =
        [string]$Tauri.version

    $Tauri.productName =
        "GameAtlas"

    if (
        $null -ne $Tauri.app -and
        $null -ne $Tauri.app.windows
    ) {
        foreach (
            $Window in $Tauri.app.windows
        ) {
            if (
                $null -ne $Window.title
            ) {
                $Window.title =
                    "GameAtlas"
            }
        }
    }

    $Json =
        $Tauri |
        ConvertTo-Json `
            -Depth 100

    $Utf8NoBom =
        New-Object `
            System.Text.UTF8Encoding `
            -ArgumentList $false

    [System.IO.File]::WriteAllText(
        $TauriPath,
        $Json,
        $Utf8NoBom
    )

    $Verify =
        Get-Content `
            -LiteralPath $TauriPath `
            -Raw |
        ConvertFrom-Json

    if (
        [string]$Verify.identifier -ne
        $OriginalIdentifier
    ) {
        throw "Safety check failed: Tauri identifier changed."
    }

    if (
        [string]$Verify.version -ne
        $OriginalVersion
    ) {
        throw "Safety check failed: Tauri version changed."
    }

    if (
        [string]$Verify.productName -ne
        "GameAtlas"
    ) {
        throw "Safety check failed: productName was not updated."
    }

    Write-Host "[UPDATED] $TauriPath" -ForegroundColor Green
    Write-Host "[PRESERVED] identifier = $OriginalIdentifier" -ForegroundColor Yellow
    Write-Host "[PRESERVED] version = $OriginalVersion" -ForegroundColor Yellow
}

# ------------------------------------------------------------
# Release tooling: future asset display names
# Keep GitHub repository URL/path unchanged.
# ------------------------------------------------------------
$ScriptsRoot =
    Join-Path `
        $ProjectRoot `
        "scripts"

if (
    Test-Path(
        $ScriptsRoot
    )
) {
    $ReleaseScripts =
        Get-ChildItem `
            -Path $ScriptsRoot `
            -File `
            -Filter "*.ps1"

    foreach (
        $File in $ReleaseScripts
    ) {
        $Path =
            $File.FullName

        if (
            [System.IO.Path]::GetFileName(
                $Path
            ) -eq "rename-to-gameatlas.ps1"
        ) {
            continue
        }

        $Text =
            [System.IO.File]::ReadAllText(
                $Path
            )

        $Updated =
            $Text.Replace(
                "GameManager_",
                "GameAtlas_"
            )

        $Updated =
            $Updated.Replace(
                "Game Manager Release",
                "GameAtlas Release"
            )

        $Updated =
            $Updated.Replace(
                "Game Manager Local Updater",
                "GameAtlas Local Updater"
            )

        $Updated =
            $Updated.Replace(
                "Game Manager Remote Updater",
                "GameAtlas Remote Updater"
            )

        if (
            $Updated -ne $Text
        ) {
            Backup-File(
                $Path
            )

            $Utf8NoBom =
                New-Object `
                    System.Text.UTF8Encoding `
                    -ArgumentList $false

            [System.IO.File]::WriteAllText(
                $Path,
                $Updated,
                $Utf8NoBom
            )

            Write-Host "[UPDATED] $Path" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "Rename pass complete." -ForegroundColor Green
Write-Host "Backup created at:"
Write-Host "  $BackupRoot"
Write-Host ""
Write-Host "Intentionally preserved:" -ForegroundColor Yellow
Write-Host "  com.greatdanish.gamemanager"
Write-Host "  game-manager-* localStorage/event keys"
Write-Host "  Cargo/Rust package and binary names"
Write-Host "  GitHub repository path GreatDanish1026/Game-Manager"
Write-Host "  updater public key and signing configuration"
Write-Host "  current version number"
Write-Host ""
Write-Host "Next:"
Write-Host "  npm run build"
Write-Host "  npm run tauri:dev"
