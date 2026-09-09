param(
    [string]$Version = "1.0.0",
    [string]$Repository = "GreatDanish1026/Game-Manager"
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

$ExpectedAssetName =
    "GameManager_${Version}_x64-setup.exe"

$ExpectedInstaller =
    Join-Path(
        $ReleaseDir
    ) $ExpectedAssetName

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

function Is-SemVer(
    [string]$Value
) {
    if (
        [string]::IsNullOrWhiteSpace(
            $Value
        )
    ) {
        return $false
    }

    return $Value -match `
        '^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$'
}

Write-Host ""
Write-Host "Game Manager Local Updater Metadata Verification" -ForegroundColor Cyan
Write-Host "Version: $Version"
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
        Fail "latest.json contains a UTF-8 BOM. Regenerate it with the updated prepare-release-assets.ps1."
    } else {
        Pass "latest.json is UTF-8 without a BOM."
    }

    try {
        $Raw =
            [System.IO.File]::ReadAllText(
                $LatestPath
            )

        $Latest =
            $Raw |
            ConvertFrom-Json

        Pass "latest.json is valid JSON."

        if (
            Is-SemVer(
                [string]$Latest.version
            )
        ) {
            Pass "latest.json version is valid SemVer."
        } else {
            Fail "latest.json version is not valid SemVer: '$($Latest.version)'."
        }

        if (
            $Latest.version
            -eq $Version
        ) {
            Pass "latest.json version matches $Version."
        } else {
            Fail "latest.json version is '$($Latest.version)' instead of '$Version'."
        }

        if (
            $Latest.pub_date
        ) {
            try {
                [DateTimeOffset]::Parse(
                    [string]$Latest.pub_date
                ) |
                Out-Null

                Pass "pub_date parses as a date."
            } catch {
                Fail "pub_date is not valid RFC3339-compatible date text: '$($Latest.pub_date)'."
            }
        }

        $Platform =
            $Latest.platforms.'windows-x86_64'

        if (
            $null -eq $Platform
        ) {
            Fail "windows-x86_64 platform entry is missing."
        } else {
            $ExpectedUrl =
                "https://github.com/$Repository/releases/download/v$Version/$ExpectedAssetName"

            if (
                [string]::IsNullOrWhiteSpace(
                    [string]$Platform.url
                )
            ) {
                Fail "windows-x86_64 URL is missing."
            } elseif (
                $Platform.url -ne $ExpectedUrl
            ) {
                Fail "Updater URL does not match the expected release asset. Found: $($Platform.url)"
            } else {
                Pass "Updater URL points to the expected v$Version installer."
            }

            if (
                [string]::IsNullOrWhiteSpace(
                    [string]$Platform.signature
                )
            ) {
                Fail "windows-x86_64 signature is missing."
            } else {
                Pass "windows-x86_64 signature content is present."

                if (
                    Test-Path(
                        $ExpectedSignature
                    )
                ) {
                    $ExpectedSigContent =
                        (
                            Get-Content `
                                -LiteralPath $ExpectedSignature `
                                -Raw
                        ).Trim()

                    if (
                        $Platform.signature.Trim()
                        -eq
                        $ExpectedSigContent
                    ) {
                        Pass "latest.json signature exactly matches the .sig file."
                    } else {
                        Fail "latest.json signature does not match the installer .sig file."
                    }
                }
            }
        }
    } catch {
        Fail "latest.json could not be parsed: $($_.Exception.Message)"
    }
}

Write-Host ""

if (
    $Failures.Count -gt 0
) {
    Write-Host "$($Failures.Count) check(s) failed." -ForegroundColor Red
    exit 1
}

Write-Host "Local updater metadata is valid." -ForegroundColor Green
exit 0
