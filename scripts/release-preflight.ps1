param(
    [string]$ProjectRoot = ".",
    [switch]$FullBuild,
    [switch]$SkipNpmInstallCheck
)

$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkGray
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor DarkGray
}

function Pass([string]$Message) {
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Fail([string]$Message) {
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    $script:Failures++
}

function Require-File([string]$Path, [string]$Label) {
    if (Test-Path -LiteralPath $Path) {
        Pass "$Label exists"
        return $true
    }

    Fail "$Label missing: $Path"
    return $false
}

function Read-Utf8Text([string]$Path) {
    return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

$Failures = 0
$Warnings = 0

$ResolvedRoot = Resolve-Path -LiteralPath $ProjectRoot
$Root = [System.IO.Path]::GetFullPath([string]$ResolvedRoot.Path)

Write-Host "GameAtlas v1.2.0 Release Preflight" -ForegroundColor White
Write-Host "Project: $Root" -ForegroundColor DarkGray

$PackageJson = Join-Path $Root "package.json"
$CargoToml = Join-Path $Root "src-tauri\Cargo.toml"
$TauriConf = Join-Path $Root "src-tauri\tauri.conf.json"
$IconIco = Join-Path $Root "src-tauri\icons\icon.ico"
$Icon32 = Join-Path $Root "src-tauri\icons\32x32.png"
$Icon128 = Join-Path $Root "src-tauri\icons\128x128.png"
$Icon256 = Join-Path $Root "src-tauri\icons\128x128@2x.png"

Write-Section "Required files"
$packageOk = Require-File $PackageJson "package.json"
$cargoOk = Require-File $CargoToml "Cargo.toml"
$tauriOk = Require-File $TauriConf "tauri.conf.json"
Require-File $IconIco "Windows icon"
Require-File $Icon32 "32x32 icon"
Require-File $Icon128 "128x128 icon"
Require-File $Icon256 "256x256-equivalent icon"

if (-not ($packageOk -and $cargoOk -and $tauriOk)) {
    throw "Core project files are missing. Preflight cannot continue."
}

Write-Section "Version consistency"

$Package = Get-Content -LiteralPath $PackageJson -Raw | ConvertFrom-Json
$PackageVersion = [string]$Package.version

$CargoText = Get-Content -LiteralPath $CargoToml -Raw
$CargoVersionMatch = [regex]::Match(
    $CargoText,
    '(?ms)^\[package\].*?^version\s*=\s*"([^"]+)"'
)
$CargoVersion = if ($CargoVersionMatch.Success) { $CargoVersionMatch.Groups[1].Value } else { $null }

$Tauri = Get-Content -LiteralPath $TauriConf -Raw | ConvertFrom-Json
$TauriVersion = [string]$Tauri.version

$ExpectedVersion = "1.2.0"

foreach ($entry in @(
    @{ Name = "package.json"; Value = $PackageVersion },
    @{ Name = "Cargo.toml"; Value = $CargoVersion },
    @{ Name = "tauri.conf.json"; Value = $TauriVersion }
)) {
    if ($entry.Value -eq $ExpectedVersion) {
        Pass "$($entry.Name) version = $ExpectedVersion"
    } else {
        Fail "$($entry.Name) version is '$($entry.Value)' (expected $ExpectedVersion)"
    }
}

if (($PackageVersion -eq $CargoVersion) -and ($CargoVersion -eq $TauriVersion)) {
    Pass "All three version sources match"
} else {
    Fail "Version sources do not match"
}

Write-Section "Branding and installation identity"

if ([string]$Tauri.productName -eq "GameAtlas") {
    Pass "productName = GameAtlas"
} else {
    Fail "productName is '$($Tauri.productName)' (expected GameAtlas)"
}

if ([string]$Tauri.identifier -eq "com.greatdanish.gamemanager") {
    Pass "Tauri identifier preserved: com.greatdanish.gamemanager"
} else {
    Fail "Tauri identifier changed to '$($Tauri.identifier)'. Preserve com.greatdanish.gamemanager for update/install continuity."
}

if ($Tauri.bundle.createUpdaterArtifacts -eq $true) {
    Pass "createUpdaterArtifacts = true"
} else {
    Fail "createUpdaterArtifacts is not true"
}

$ConfiguredIcons = @($Tauri.bundle.icon)
$RequiredIcons = @(
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
)

foreach ($Icon in $RequiredIcons) {
    if ($ConfiguredIcons -contains $Icon) {
        Pass "Tauri bundle icon configured: $Icon"
    } else {
        Fail "Tauri bundle icon missing from config: $Icon"
    }
}

Write-Section "Updater configuration"

$ExpectedEndpoint = "https://github.com/GreatDanish1026/Game-Manager/releases/latest/download/latest.json"
$Endpoints = @($Tauri.plugins.updater.endpoints)

if ($Endpoints -contains $ExpectedEndpoint) {
    Pass "Updater endpoint preserved"
} else {
    Fail "Expected updater endpoint not found: $ExpectedEndpoint"
}

$PubKey = [string]$Tauri.plugins.updater.pubkey
if ([string]::IsNullOrWhiteSpace($PubKey)) {
    Fail "Updater public key is missing"
} else {
    Pass "Updater public key is configured"
}

Write-Section "Source-tree release checks"

$ForbiddenBrandPattern = '(?i)\bGame Manager\b'
$AllowedFiles = @(
    "README.md"
)

$SourceExtensions = @("*.js","*.jsx","*.ts","*.tsx","*.rs","*.json","*.toml","*.md")
$BrandHits = @()

foreach ($Pattern in $SourceExtensions) {
    Get-ChildItem -LiteralPath $Root -Recurse -File -Filter $Pattern -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch '\\node_modules\\' -and
            $_.FullName -notmatch '\\target\\' -and
            $_.FullName -notmatch '\\dist\\' -and
            $_.FullName -notmatch '\\\.git\\'
        } |
        ForEach-Object {
            $Content = Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue
            if ($Content -match $ForbiddenBrandPattern) {
                $BrandHits += $_.FullName
            }
        }
}

$BrandHits = $BrandHits | Sort-Object -Unique

if ($BrandHits.Count -eq 0) {
    Pass "No visible 'Game Manager' branding found in source/config/docs"
} else {
    Warn "Found legacy 'Game Manager' text in $($BrandHits.Count) file(s). Review whether each occurrence is intentionally internal/backward-compatible:"
    foreach ($Hit in $BrandHits) {
        Write-Host "       $Hit" -ForegroundColor Yellow
    }
    $Warnings++
}

$GameManagerStorageHits = @()
Get-ChildItem -LiteralPath (Join-Path $Root "src") -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx -ErrorAction SilentlyContinue |
    ForEach-Object {
        $Content = Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue
        if ($Content -match 'game-manager-') {
            $GameManagerStorageHits += $_.FullName
        }
    }

if ($GameManagerStorageHits.Count -gt 0) {
    Pass "Backward-compatible game-manager-* storage/event keys are still present (expected)"
} else {
    Warn "No game-manager-* persistence keys were found. Verify user data continuity was not accidentally broken."
    $Warnings++
}

Write-Section "JavaScript / frontend build"

if (-not $SkipNpmInstallCheck) {
    $NodeModules = Join-Path $Root "node_modules"
    if (Test-Path -LiteralPath $NodeModules) {
        Pass "node_modules exists"
    } else {
        Warn "node_modules is missing. Run npm install before release."
        $Warnings++
    }
}

Push-Location $Root
try {
    & npm run build
    if ($LASTEXITCODE -eq 0) {
        Pass "npm run build"
    } else {
        Fail "npm run build failed with exit code $LASTEXITCODE"
    }
} catch {
    Fail "npm run build failed: $($_.Exception.Message)"
}
Pop-Location

Write-Section "Rust validation"

Push-Location (Join-Path $Root "src-tauri")
try {
    & cargo check
    if ($LASTEXITCODE -eq 0) {
        Pass "cargo check"
    } else {
        Fail "cargo check failed with exit code $LASTEXITCODE"
    }
} catch {
    Fail "cargo check failed: $($_.Exception.Message)"
}
Pop-Location

if ($FullBuild) {
    Write-Section "Full Tauri production build"

    Push-Location $Root
    try {
        & npm run tauri:build
        if ($LASTEXITCODE -eq 0) {
            Pass "npm run tauri:build"
        } else {
            Fail "npm run tauri:build failed with exit code $LASTEXITCODE"
        }
    } catch {
        Fail "npm run tauri:build failed: $($_.Exception.Message)"
    }
    Pop-Location

    $BundleRoot = Join-Path $Root "src-tauri\target\release\bundle"
    if (Test-Path -LiteralPath $BundleRoot) {
        Pass "Tauri bundle output exists"

        $ExeAssets = Get-ChildItem -LiteralPath $BundleRoot -Recurse -File -Filter "*.exe" -ErrorAction SilentlyContinue
        if ($ExeAssets.Count -gt 0) {
            Pass "Installer executable(s) found"
            foreach ($Asset in $ExeAssets) {
                Write-Host "       $($Asset.FullName)" -ForegroundColor DarkGray
            }
        } else {
            Fail "No installer .exe found under bundle output"
        }

        $SigAssets = Get-ChildItem -LiteralPath $BundleRoot -Recurse -File -Filter "*.sig" -ErrorAction SilentlyContinue
        if ($SigAssets.Count -gt 0) {
            Pass "Updater signature artifact(s) found"
        } else {
            Fail "No updater .sig artifact found under bundle output"
        }
    } else {
        Fail "Tauri bundle output directory not found"
    }
}

Write-Section "latest.json validation (if present)"

$LatestCandidates = @(
    (Join-Path $Root "latest.json"),
    (Join-Path $Root "release\latest.json"),
    (Join-Path $Root "dist\latest.json")
) | Where-Object { Test-Path -LiteralPath $_ }

if ($LatestCandidates.Count -eq 0) {
    Warn "No local latest.json found. This is okay before release asset preparation, but validate it before upload."
    $Warnings++
} else {
    foreach ($LatestPath in $LatestCandidates) {
        $Bytes = [System.IO.File]::ReadAllBytes($LatestPath)

        $HasBom =
            $Bytes.Length -ge 3 -and
            $Bytes[0] -eq 0xEF -and
            $Bytes[1] -eq 0xBB -and
            $Bytes[2] -eq 0xBF

        if ($HasBom) {
            Fail "latest.json has a UTF-8 BOM: $LatestPath"
        } else {
            Pass "latest.json has no UTF-8 BOM: $LatestPath"
        }

        try {
            $Latest = Get-Content -LiteralPath $LatestPath -Raw | ConvertFrom-Json
            Pass "latest.json parses as JSON"

            if ([string]$Latest.version -eq $ExpectedVersion) {
                Pass "latest.json version = $ExpectedVersion"
            } else {
                Fail "latest.json version is '$($Latest.version)' (expected $ExpectedVersion)"
            }

            $WindowsUrl = [string]$Latest.platforms."windows-x86_64".url
            $WindowsSig = [string]$Latest.platforms."windows-x86_64".signature

            if ($WindowsUrl -match 'GameAtlas_1\.2\.0_x64-setup\.exe$') {
                Pass "latest.json Windows asset uses GameAtlas naming"
            } else {
                Warn "Review Windows updater asset URL: $WindowsUrl"
                $Warnings++
            }

            if ([string]::IsNullOrWhiteSpace($WindowsSig)) {
                Fail "latest.json Windows signature is empty"
            } else {
                Pass "latest.json Windows signature is present"
            }
        } catch {
            Fail "latest.json is invalid: $($_.Exception.Message)"
        }
    }
}

Write-Section "Release preflight result"

if ($Failures -eq 0) {
    Write-Host ""
    Write-Host "PRE-FLIGHT PASSED" -ForegroundColor Green
    Write-Host "Failures: 0" -ForegroundColor Green
    Write-Host "Warnings: $Warnings" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The automated checks passed. Complete the manual regression checklist before publishing v1.2.0." -ForegroundColor White
    exit 0
}

Write-Host ""
Write-Host "PRE-FLIGHT FAILED" -ForegroundColor Red
Write-Host "Failures: $Failures" -ForegroundColor Red
Write-Host "Warnings: $Warnings" -ForegroundColor Yellow
exit 1
