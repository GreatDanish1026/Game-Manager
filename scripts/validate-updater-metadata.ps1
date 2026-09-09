param(
    [string]$Repository = "GreatDanish1026/Game-Manager",
    [string]$ExpectedVersion = "",
    [int]$Retries = 3,
    [int]$RetryDelaySeconds = 3
)

$ErrorActionPreference = "Stop"

$Endpoint =
    "https://github.com/$Repository/releases/latest/download/latest.json"

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

function Get-RemoteBytes(
    [string]$Url
) {
    $TempFile =
        [System.IO.Path]::GetTempFileName()

    try {
        Invoke-WebRequest `
            -Uri $Url `
            -UseBasicParsing `
            -OutFile $TempFile `
            -MaximumRedirection 10

        return [System.IO.File]::ReadAllBytes(
            $TempFile
        )
    } finally {
        Remove-Item `
            -LiteralPath $TempFile `
            -Force `
            -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "GameAtlas Remote Updater Metadata Validation" -ForegroundColor Cyan
Write-Host "Repository: $Repository"
Write-Host "Endpoint: $Endpoint"
Write-Host ""

$LatestTag =
    $null

if (
    Get-Command gh -ErrorAction SilentlyContinue
) {
    try {
        $ReleaseJson =
            & gh release view `
                --repo $Repository `
                --json tagName,assets,url

        if (
            $LASTEXITCODE -eq 0
        ) {
            $Release =
                $ReleaseJson |
                ConvertFrom-Json

            $LatestTag =
                [string]$Release.tagName

            Pass "GitHub latest release is $LatestTag."

            $AssetNames =
                @(
                    $Release.assets |
                    ForEach-Object {
                        $_.name
                    }
                )

            if (
                $AssetNames -contains
                "latest.json"
            ) {
                Pass "Latest release contains latest.json."
            } else {
                Fail "Latest GitHub release does not contain latest.json."
            }

            if (
                -not [string]::IsNullOrWhiteSpace(
                    $ExpectedVersion
                )
            ) {
                if (
                    $LatestTag -eq
                    "v$ExpectedVersion"
                ) {
                    Pass "Latest GitHub release tag matches v$ExpectedVersion."
                } else {
                    Fail "Latest GitHub release tag is '$LatestTag', expected 'v$ExpectedVersion'."
                }
            }
        }
    } catch {
        Write-Host "[WARN] Could not inspect release with gh: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "[WARN] gh is not installed; skipping GitHub release-asset inspection." -ForegroundColor Yellow
}

$Bytes =
    $null

for (
    $Attempt = 1;
    $Attempt -le $Retries;
    $Attempt++
) {
    try {
        $Bytes =
            Get-RemoteBytes(
                $Endpoint
            )

        break
    } catch {
        if (
            $Attempt -eq
            $Retries
        ) {
            Fail "Could not download latest.json after $Retries attempt(s): $($_.Exception.Message)"
        } else {
            Write-Host "[WARN] Attempt $Attempt failed; retrying..." -ForegroundColor Yellow

            Start-Sleep `
                -Seconds $RetryDelaySeconds
        }
    }
}

$Latest =
    $null

if (
    $null -ne
    $Bytes
) {
    Pass "latest.json endpoint returned a successful HTTP response."

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
        Fail "Remote latest.json contains a UTF-8 BOM."
    } else {
        Pass "Remote latest.json has no UTF-8 BOM."
    }

    $Raw =
        [System.Text.Encoding]::UTF8.GetString(
            $Bytes
        )

    if (
        $Raw.TrimStart().StartsWith(
            "<"
        )
    ) {
        Fail "Endpoint returned HTML instead of JSON."
    } else {
        try {
            $Latest =
                $Raw |
                ConvertFrom-Json

            Pass "Remote latest.json parses as JSON."
        } catch {
            Fail "Remote latest.json is not valid JSON: $($_.Exception.Message)"
        }
    }
}

if (
    $null -ne
    $Latest
) {
    if (
        Is-SemVer(
            [string]$Latest.version
        )
    ) {
        Pass "Remote version is valid SemVer: $($Latest.version)."
    } else {
        Fail "Remote version is not valid SemVer: '$($Latest.version)'."
    }

    $HasExpectedVersion =
        -not [string]::IsNullOrWhiteSpace(
            $ExpectedVersion
        )

    if (
        $HasExpectedVersion
    ) {
        if (
            $Latest.version -eq
            $ExpectedVersion
        ) {
            Pass "Remote latest.json version matches $ExpectedVersion."
        } else {
            Fail "Remote latest.json version is '$($Latest.version)', expected '$ExpectedVersion'."
        }
    }

    if (
        [string]::IsNullOrWhiteSpace(
            [string]$Latest.pub_date
        )
    ) {
        Fail "Remote latest.json is missing pub_date."
    } else {
        try {
            [DateTimeOffset]::Parse(
                [string]$Latest.pub_date
            ) |
            Out-Null

            Pass "Remote pub_date parses successfully."
        } catch {
            Fail "Remote pub_date is invalid: '$($Latest.pub_date)'."
        }
    }

    $Platform =
        $Latest.platforms.'windows-x86_64'

    if (
        $null -eq
        $Platform
    ) {
        Fail "Remote latest.json is missing platforms.windows-x86_64."
    } else {
        if (
            [string]::IsNullOrWhiteSpace(
                [string]$Platform.signature
            )
        ) {
            Fail "Remote windows-x86_64 signature is empty."
        } else {
            Pass "Remote windows-x86_64 signature is present."
        }

        if (
            [string]::IsNullOrWhiteSpace(
                [string]$Platform.url
            )
        ) {
            Fail "Remote windows-x86_64 URL is empty."
        } else {
            Pass "Remote windows-x86_64 URL is present."

            try {
                $InstallerRequest =
                    Invoke-WebRequest `
                        -Uri ([string]$Platform.url) `
                        -UseBasicParsing `
                        -Method Head `
                        -MaximumRedirection 10

                if (
                    $InstallerRequest.StatusCode -ge 200 -and
                    $InstallerRequest.StatusCode -lt 400
                ) {
                    Pass "Updater package URL is reachable."
                } else {
                    Fail "Updater package URL returned HTTP $($InstallerRequest.StatusCode)."
                }
            } catch {
                Fail "Updater package URL cannot be reached: $($_.Exception.Message)"
            }
        }
    }
}

Write-Host ""

if (
    $Failures.Count -gt 0
) {
    Write-Host "$($Failures.Count) remote updater check(s) failed." -ForegroundColor Red
    exit 1
}

Write-Host "Remote updater metadata is valid for Tauri static updater use." -ForegroundColor Green
exit 0
