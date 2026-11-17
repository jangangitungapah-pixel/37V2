$ErrorActionPreference = 'Continue'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$logDirectory = Join-Path $projectRoot '.logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $logDirectory "phase-1-verification-$timestamp.txt"

$script:verificationFailed = $false

Start-Transcript -Path $logPath -Force | Out-Null

function Invoke-VerificationStep {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    Write-Host ''
    Write-Host "===== $Name =====" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0

    try {
        & $Command
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) {
            $exitCode = 0
        }
    }
    catch {
        Write-Error $_
        $exitCode = 1
    }

    Write-Host "EXIT_CODE=$exitCode"
    if ($exitCode -ne 0) {
        $script:verificationFailed = $true
    }
}

Invoke-VerificationStep -Name 'Node version' -Command { node --version }
Invoke-VerificationStep -Name 'npm version' -Command { npm --version }
Invoke-VerificationStep -Name 'Install dependencies and generate package-lock.json' -Command { npm install }
Invoke-VerificationStep -Name 'Prettier check' -Command { npm run format:check }
Invoke-VerificationStep -Name 'ESLint' -Command { npm run lint }
Invoke-VerificationStep -Name 'Vitest' -Command { npm run test:run }
Invoke-VerificationStep -Name 'Production build' -Command { npm run build }
Invoke-VerificationStep -Name 'npm audit' -Command { npm audit }

Write-Host ''
if ($script:verificationFailed) {
    Write-Host 'PHASE_1_VERIFICATION=FAILED' -ForegroundColor Red
}
else {
    Write-Host 'PHASE_1_VERIFICATION=PASSED' -ForegroundColor Green
}

Write-Host "LOG_FILE=$logPath"
Stop-Transcript | Out-Null

if ($script:verificationFailed) {
    exit 1
}

exit 0
