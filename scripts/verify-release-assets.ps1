param(
    [string]$Version = "1.0.0"
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

$LatestPath =
    Join-Path(
        $ReleaseDir
    ) "latest.json"

$ExpectedInstaller =
    Join-Path(
        $ReleaseDir
    ) "GameManager_${Version}_x64-setup.exe"

$ExpectedSignature =
    "$ExpectedInstaller.sig"

$Failures =
    New-Object `
        System.Collections.Generic.List[string]

function Pass(
    [string]$Message
) {
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Fail(
    [string]$Message
) {
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    $script:Failures.Add($Message)
}

Write-Host ""
Write-Host "Game Manager Local Updater Asset Verification" -ForegroundColor Cyan
Write-Host ""

if (
    Test-Path(
        $ExpectedInstaller
    )
) {
    Pass "Installer exists."
} else {
    Fail "Installer missing: $ExpectedInstaller"
}

if (
    Test-Path(
        $ExpectedSignature
    )
) {
    Pass "Installer signature exists."
} else {
    Fail "Installer signature missing: $ExpectedSignature"
}

if (
    -not (
        Test-Path(
            $LatestPath
        )
    )
) {
    Fail "latest.json is missing."
} else {
    try {
        $Latest =
            Get-Content `
                -LiteralPath $LatestPath `
                -Raw |
            ConvertFrom-Json

        Pass "latest.json is valid JSON."

        if ($Latest.version -eq $Version) {
            Pass "latest.json version is $Version."
        } else {
            Fail "latest.json version is '$($Latest.version)' instead of '$Version'."
        }

        $Platform =
            $Latest.platforms.'windows-x86_64'

        if ($null -eq $Platform) {
            Fail "windows-x86_64 platform entry is missing."
        } else {
            if (
                [string]::IsNullOrWhiteSpace(
                    [string]$Platform.url
                )
            ) {
                Fail "windows-x86_64 URL is missing."
            } else {
                Pass "windows-x86_64 URL is present."
            }

            if (
                [string]::IsNullOrWhiteSpace(
                    [string]$Platform.signature
                )
            ) {
                Fail "windows-x86_64 signature is missing."
            } else {
                Pass "windows-x86_64 signature content is present."
            }
        }
    } catch {
        Fail "latest.json could not be parsed: $($_.Exception.Message)"
    }
}

Write-Host ""

if ($Failures.Count -gt 0) {
    Write-Host "$($Failures.Count) check(s) failed." -ForegroundColor Red
    exit 1
}

Write-Host "Local updater release assets are valid." -ForegroundColor Green
exit 0
