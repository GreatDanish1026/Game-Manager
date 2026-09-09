param(
    [string]$ReleaseDirectory = ".\release-v1.2.0",
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

$Resolved = Resolve-Path -LiteralPath $ReleaseDirectory
$Dir = [System.IO.Path]::GetFullPath([string]$Resolved.Path)

$InstallerName = "GameAtlas_${Version}_x64-setup.exe"
$SignatureName = "${InstallerName}.sig"

$Installer = Join-Path $Dir $InstallerName
$Signature = Join-Path $Dir $SignatureName
$Latest = Join-Path $Dir "latest.json"

Write-Host "GameAtlas v$Version Local Release Validation" -ForegroundColor Cyan
Write-Host "Directory: $Dir" -ForegroundColor DarkGray
Write-Host ""

foreach ($Item in @(
    @{ Path = $Installer; Label = $InstallerName },
    @{ Path = $Signature; Label = $SignatureName },
    @{ Path = $Latest; Label = "latest.json" }
)) {
    if (Test-Path -LiteralPath $Item.Path) {
        Pass "$($Item.Label) exists"
    } else {
        Fail "$($Item.Label) missing"
    }
}

if (Test-Path -LiteralPath $Signature) {
    $Sig = [System.IO.File]::ReadAllText($Signature, [System.Text.Encoding]::UTF8).Trim()

    if ([string]::IsNullOrWhiteSpace($Sig)) {
        Fail "Signature file is empty"
    } else {
        Pass "Signature file is non-empty"
    }
}

if (Test-Path -LiteralPath $Latest) {
    try {
        $LatestObject = Get-Content -LiteralPath $Latest -Raw | ConvertFrom-Json
        Pass "latest.json parses"

        if ([string]$LatestObject.version -eq $Version) {
            Pass "latest.json version = $Version"
        } else {
            Fail "latest.json version is '$($LatestObject.version)'"
        }

        $ExpectedUrl =
            "https://github.com/$Repository/releases/download/v$Version/$InstallerName"

        $Platform =
            $LatestObject.platforms."windows-x86_64"

        if ([string]$Platform.url -eq $ExpectedUrl) {
            Pass "latest.json installer URL is correct"
        } else {
            Fail "latest.json installer URL is '$($Platform.url)'"
        }

        $SignatureText =
            if (Test-Path -LiteralPath $Signature) {
                [System.IO.File]::ReadAllText($Signature, [System.Text.Encoding]::UTF8).Trim()
            } else {
                ""
            }

        if ([string]$Platform.signature -eq $SignatureText -and $SignatureText) {
            Pass "latest.json signature exactly matches .sig file"
        } else {
            Fail "latest.json signature does not exactly match .sig file"
        }

        $Bytes =
            [System.IO.File]::ReadAllBytes($Latest)

        $HasBom =
            $Bytes.Length -ge 3 -and
            $Bytes[0] -eq 0xEF -and
            $Bytes[1] -eq 0xBB -and
            $Bytes[2] -eq 0xBF

        if ($HasBom) {
            Fail "latest.json has UTF-8 BOM"
        } else {
            Pass "latest.json is BOM-free"
        }
    } catch {
        Fail "latest.json validation failed: $($_.Exception.Message)"
    }
}

if (Test-Path -LiteralPath $Installer) {
    $Info =
        [System.Diagnostics.FileVersionInfo]::GetVersionInfo(
            $Installer
        )

    Write-Host ""
    Write-Host "Installer metadata:" -ForegroundColor White
    Write-Host "  ProductName: $($Info.ProductName)" -ForegroundColor DarkGray
    Write-Host "  FileVersion: $($Info.FileVersion)" -ForegroundColor DarkGray
    Write-Host "  ProductVersion: $($Info.ProductVersion)" -ForegroundColor DarkGray

    if ($Info.ProductName -match "GameAtlas") {
        Pass "Installer ProductName contains GameAtlas"
    } else {
        Write-Host "[REVIEW] ProductName does not clearly contain GameAtlas. Verify visually during install." -ForegroundColor Yellow
    }
}

Write-Host ""
if ($Failures -eq 0) {
    Write-Host "LOCAL RELEASE VALIDATION PASSED" -ForegroundColor Green
    exit 0
}

Write-Host "LOCAL RELEASE VALIDATION FAILED: $Failures issue(s)" -ForegroundColor Red
exit 1
