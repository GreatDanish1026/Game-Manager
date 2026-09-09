param(
    [string]$Version = "1.2.0",
    [string]$Repository = "GreatDanish1026/Game-Manager"
)

$ErrorActionPreference = "Stop"

function Pass([string]$Message) {
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Fail([string]$Message) {
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    $script:Failures++
}

$Failures = 0

$InstallerName = "GameAtlas_${Version}_x64-setup.exe"
$SignatureName = "${InstallerName}.sig"

$Base =
    "https://github.com/$Repository/releases/download/v$Version"

$InstallerUrl = "$Base/$InstallerName"
$SignatureUrl = "$Base/$SignatureName"
$LatestUrl =
    "https://github.com/$Repository/releases/latest/download/latest.json"

Write-Host "GameAtlas v$Version Public Release Validation" -ForegroundColor Cyan
Write-Host ""

foreach ($Entry in @(
    @{ Name = $InstallerName; Url = $InstallerUrl },
    @{ Name = $SignatureName; Url = $SignatureUrl },
    @{ Name = "latest.json"; Url = $LatestUrl }
)) {
    try {
        $Response =
            Invoke-WebRequest -Uri $Entry.Url -Method Head -MaximumRedirection 10 -UseBasicParsing

        if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 400) {
            Pass "$($Entry.Name) is publicly reachable"
        } else {
            Fail "$($Entry.Name) returned HTTP $($Response.StatusCode)"
        }
    } catch {
        # GitHub/CDN HEAD behavior can vary; try a small GET fallback.
        try {
            $Response =
                Invoke-WebRequest -Uri $Entry.Url -Method Get -MaximumRedirection 10 -UseBasicParsing

            if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 400) {
                Pass "$($Entry.Name) is publicly reachable"
            } else {
                Fail "$($Entry.Name) returned HTTP $($Response.StatusCode)"
            }
        } catch {
            Fail "$($Entry.Name) could not be fetched: $($_.Exception.Message)"
        }
    }
}

try {
    $LatestResponse =
        Invoke-WebRequest -Uri $LatestUrl -UseBasicParsing -MaximumRedirection 10

    $Raw =
        [string]$LatestResponse.Content

    $Latest =
        $Raw | ConvertFrom-Json

    if ([string]$Latest.version -eq $Version) {
        Pass "Public latest.json version = $Version"
    } else {
        Fail "Public latest.json version is '$($Latest.version)'"
    }

    $Platform =
        $Latest.platforms."windows-x86_64"

    if ([string]$Platform.url -eq $InstallerUrl) {
        Pass "Public latest.json points to GameAtlas installer"
    } else {
        Fail "Public latest.json URL is '$($Platform.url)'"
    }

    if ([string]::IsNullOrWhiteSpace([string]$Platform.signature)) {
        Fail "Public latest.json signature is empty"
    } else {
        Pass "Public latest.json contains signature"
    }

    $SigResponse =
        Invoke-WebRequest -Uri $SignatureUrl -UseBasicParsing -MaximumRedirection 10

    $PublicSig =
        ([string]$SigResponse.Content).Trim()

    if ([string]$Platform.signature -eq $PublicSig) {
        Pass "Public latest.json signature matches public .sig"
    } else {
        Fail "Public latest.json signature does not match public .sig"
    }

} catch {
    Fail "Public updater metadata validation failed: $($_.Exception.Message)"
}

Write-Host ""
if ($Failures -eq 0) {
    Write-Host "PUBLIC RELEASE VALIDATION PASSED" -ForegroundColor Green
    exit 0
}

Write-Host "PUBLIC RELEASE VALIDATION FAILED: $Failures issue(s)" -ForegroundColor Red
exit 1
