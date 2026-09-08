param(
    [string]$ExpectedVersion = "1.0.0"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$PackagePath = Join-Path $Root "package.json"
$CargoPath = Join-Path $Root "src-tauri\Cargo.toml"
$TauriPath = Join-Path $Root "src-tauri\tauri.conf.json"

$ExpectedRepo = "GreatDanish1026/Game-Manager"
$ExpectedEndpoint = "https://github.com/GreatDanish1026/Game-Manager/releases/latest/download/latest.json"

$Failures = New-Object System.Collections.Generic.List[string]

function Pass([string]$Message) {
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Fail([string]$Message) {
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    $script:Failures.Add($Message)
}

Write-Host ""
Write-Host "Game Manager v1 Release Validator" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host ""

if (-not (Test-Path $PackagePath)) {
    Fail "package.json is missing."
} else {
    $Package = Get-Content $PackagePath -Raw | ConvertFrom-Json

    if ($Package.version -eq $ExpectedVersion) {
        Pass "package.json version is $ExpectedVersion."
    } else {
        Fail "package.json version is '$($Package.version)' instead of '$ExpectedVersion'."
    }
}

if (-not (Test-Path $CargoPath)) {
    Fail "src-tauri\Cargo.toml is missing."
} else {
    $Cargo = Get-Content $CargoPath -Raw

    $CargoVersion = [regex]::Match(
        $Cargo,
        '(?ms)^\[package\].*?^version\s*=\s*"([^"]+)"'
    )

    if ($CargoVersion.Success -and $CargoVersion.Groups[1].Value -eq $ExpectedVersion) {
        Pass "Cargo.toml package version is $ExpectedVersion."
    } else {
        $Found = if ($CargoVersion.Success) { $CargoVersion.Groups[1].Value } else { "<not found>" }
        Fail "Cargo.toml package version is '$Found' instead of '$ExpectedVersion'."
    }
}

if (-not (Test-Path $TauriPath)) {
    Fail "src-tauri\tauri.conf.json is missing."
} else {
    $Tauri = Get-Content $TauriPath -Raw | ConvertFrom-Json

    if ($Tauri.version -eq $ExpectedVersion) {
        Pass "tauri.conf.json version is $ExpectedVersion."
    } else {
        Fail "tauri.conf.json version is '$($Tauri.version)' instead of '$ExpectedVersion'."
    }

    if ($Tauri.identifier) {
        Pass "Tauri identifier is present: $($Tauri.identifier)"
    } else {
        Fail "Tauri identifier is missing."
    }

    if ($Tauri.bundle.createUpdaterArtifacts -eq $true) {
        Pass "bundle.createUpdaterArtifacts is true."
    } else {
        Fail "bundle.createUpdaterArtifacts is not true."
    }

    $Updater = $Tauri.plugins.updater

    if ($null -eq $Updater) {
        Fail "plugins.updater configuration is missing."
    } else {
        if ([string]::IsNullOrWhiteSpace([string]$Updater.pubkey)) {
            Fail "Updater public key is missing."
        } else {
            Pass "Updater public key is configured."
        }

        $Endpoints = @($Updater.endpoints)

        if ($Endpoints -contains $ExpectedEndpoint) {
            Pass "Updater endpoint points to $ExpectedRepo."
        } else {
            Fail "Updater endpoint does not include: $ExpectedEndpoint"
        }
    }
}

Write-Host ""

if ($Failures.Count -gt 0) {
    Write-Host "$($Failures.Count) release validation check(s) failed." -ForegroundColor Red
    exit 1
}

Write-Host "All release configuration checks passed." -ForegroundColor Green
exit 0
