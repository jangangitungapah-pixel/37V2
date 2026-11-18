$ErrorActionPreference = 'Continue'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$logDirectory = Join-Path $projectRoot '.logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $logDirectory "phase-4-admin-shell-verification-$timestamp.txt"

$script:verificationFailed = $false

$header = @(
    '37 MUSIC STUDIO — PHASE 4 ADMIN SHELL VERIFICATION LOG',
    "Timestamp: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK')",
    "Node: $(node --version)",
    "npm: $(npm --version)",
    "Baseline HEAD: $(git rev-parse HEAD)",
    ''
)
$header | Set-Content -Path $logPath -Encoding UTF8

function Write-LogLine {
    param([string]$Text)
    $cleanText = $Text -replace '\x1b\[[0-9;]*[a-zA-Z]', ''
    Write-Host $cleanText
    Add-Content -Path $logPath -Value $cleanText -Encoding UTF8
}

function Invoke-VerificationStep {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    Write-LogLine ""
    Write-LogLine "===== $Name ====="
    $global:LASTEXITCODE = 0

    try {
        $output = & $Command 2>&1 | Out-String
        $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
        foreach ($line in ($output -split "`r?`n")) {
            Write-LogLine $line
        }
    }
    catch {
        Write-LogLine ($_ | Out-String)
        $exitCode = 1
    }

    Write-LogLine "EXIT_CODE=$exitCode"
    if ($exitCode -ne 0 -and $Name -ne 'npm audit') {
        $script:verificationFailed = $true
    }
}

Invoke-VerificationStep -Name 'npm run format:check' -Command { npm run format:check }
Invoke-VerificationStep -Name 'npm run lint' -Command { npm run lint }
Invoke-VerificationStep -Name 'npm run test:run' -Command { npm run test:run }
Invoke-VerificationStep -Name 'npm run build' -Command { npm run build }
Invoke-VerificationStep -Name 'npm audit' -Command { npm audit }

if ($script:verificationFailed) {
    Write-LogLine 'PHASE_4_VERIFICATION=FAILED'
    Write-LogLine "LOG_FILE=$logPath"
    exit 1
}

Write-LogLine 'PHASE_4_VERIFICATION=PASSED'
Write-LogLine "LOG_FILE=$logPath"
exit 0
