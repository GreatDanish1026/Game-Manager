param(
    [string]$ProjectRoot = "."
)

$ErrorActionPreference = "Stop"

$ResolvedRoot = Resolve-Path -LiteralPath $ProjectRoot
$Root = [System.IO.Path]::GetFullPath([string]$ResolvedRoot.Path)

Write-Host "GameAtlas Logging Audit" -ForegroundColor Cyan
Write-Host "Project: $Root" -ForegroundColor DarkGray
Write-Host ""

$FrontendHits = @()

Get-ChildItem -LiteralPath (Join-Path $Root "src") -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx |
    ForEach-Object {
        $Matches = Select-String -LiteralPath $_.FullName -Pattern 'console\.(log|info|warn|error|debug)\s*\(' -AllMatches
        foreach ($Match in $Matches) {
            $FrontendHits += [PSCustomObject]@{
                File = $_.FullName.Substring($Root.Length + 1)
                Line = $Match.LineNumber
                Text = $Match.Line.Trim()
            }
        }
    }

$RustHits = @()

Get-ChildItem -LiteralPath (Join-Path $Root "src-tauri\src") -Recurse -File -Include *.rs |
    Where-Object { $_.Name -ne "logging.rs" } |
    ForEach-Object {
        $Matches = Select-String -LiteralPath $_.FullName -Pattern '\b(print|println|eprint|eprintln)!\s*\(' -AllMatches
        foreach ($Match in $Matches) {
            $RustHits += [PSCustomObject]@{
                File = $_.FullName.Substring($Root.Length + 1)
                Line = $Match.LineNumber
                Text = $Match.Line.Trim()
            }
        }
    }

if ($FrontendHits.Count -eq 0) {
    Write-Host "[PASS] No direct frontend console calls found." -ForegroundColor Green
} else {
    Write-Host "[REVIEW] Direct frontend console calls:" -ForegroundColor Yellow
    $FrontendHits | Format-Table -AutoSize
}

Write-Host ""

if ($RustHits.Count -eq 0) {
    Write-Host "[PASS] No direct Rust print/eprint calls found outside logging.rs." -ForegroundColor Green
} else {
    Write-Host "[REVIEW] Direct Rust print/eprint calls:" -ForegroundColor Yellow
    $RustHits | Format-Table -AutoSize
}

Write-Host ""
Write-Host "Review rule:" -ForegroundColor White
Write-Host "  - Routine diagnostics/timings -> devLog/devWarn/perf or logging::dev_log/perf" -ForegroundColor DarkGray
Write-Host "  - Actionable production problems -> warn/error" -ForegroundColor DarkGray
Write-Host "  - Avoid raw print/console calls in feature code" -ForegroundColor DarkGray
