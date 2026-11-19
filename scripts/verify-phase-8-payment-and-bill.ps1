$ErrorActionPreference = 'Continue'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$logDirectory = Join-Path $projectRoot '.logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $logDirectory "phase-8-payment-and-bill-verification-$timestamp.txt"

$script:verificationFailed = $false

$header = @(
    '37 MUSIC STUDIO — PHASE 8 PAYMENT & BILL MANAGEMENT VERIFICATION LOG',
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
        [string]$CommandText,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    Write-LogLine ''
    Write-LogLine "===== STEP: $Name ====="
    Write-LogLine "COMMAND: $CommandText"
    Write-LogLine "STEP_TIMESTAMP: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK')"
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
    if ($exitCode -ne 0) {
        $script:verificationFailed = $true
    }
}

Invoke-VerificationStep -Name 'Git Status' -CommandText 'git status --short --branch' -Command { git status --short --branch }
Invoke-VerificationStep -Name 'Format Check (Phase 8 Changed Files)' -CommandText 'npx prettier --check --end-of-line auto src/App.jsx src/styles/index.css src/features/admin src/features/auth/auth.test.jsx' -Command { npx prettier --check --end-of-line auto src/App.jsx src/styles/index.css src/features/admin src/features/auth/auth.test.jsx }
Invoke-VerificationStep -Name 'ESLint' -CommandText 'npm run lint' -Command { npm run lint }
Invoke-VerificationStep -Name 'Vitest Automated Test Suite' -CommandText 'npm run test:run' -Command { npm run test:run }
Invoke-VerificationStep -Name 'Vite Production Build' -CommandText 'npm run build' -Command { npm run build }

Write-LogLine ''
if ($script:verificationFailed) {
    Write-LogLine 'PHASE_8_PAYMENT_AND_BILL_VERIFICATION=FAILED'
    Write-LogLine "LOG_FILE=$logPath"
    exit 1
}

Write-LogLine 'PHASE_8_PAYMENT_AND_BILL_VERIFICATION=PASSED'
Write-LogLine "LOG_FILE=$logPath"
exit 0
