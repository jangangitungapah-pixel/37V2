$ErrorActionPreference = 'Stop'

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logDir = '.logs'
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logPath = Join-Path $logDir "settings-center-verification-$timestamp.txt"

$settingsCenterTargets = @(
  'src/App.jsx',
  'src/features/admin/settings/settings-center.test.jsx',
  'src/features/admin/settings/pages/AdminSettingsPage.jsx',
  'src/features/admin/settings/pages/StudioProfilePage.jsx',
  'src/features/admin/settings/pages/AccountSecurityPage.jsx',
  'src/features/admin/settings/components/SettingsBreadcrumb.jsx',
  'src/features/admin/settings/components/SettingsModuleCard.jsx',
  'src/features/admin/settings/components/StudioProfileForm.jsx',
  'src/features/admin/settings/components/StudioProfilePreview.jsx',
  'src/features/admin/settings/components/StudioProfileSaveBar.jsx',
  'src/features/admin/settings/utils/settings-formatters.js',
  'src/features/admin/settings/studio-profile/config/default-studio-profile.js',
  'src/features/admin/settings/studio-profile/utils/normalize-studio-profile.js',
  'src/features/admin/settings/studio-profile/schemas/studio-profile-schema.js',
  'src/features/admin/settings/studio-profile/repositories/studio-profile-repository.js',
  'src/features/admin/settings/studio-profile/services/studio-profile-service.js',
  'src/features/admin/settings/studio-profile/hooks/useStudioProfile.js'
)

function Invoke-Step {
  param(
    [string]$Label,
    [scriptblock]$Command
  )

  Write-Output "=== $Label ===" | Tee-Object -FilePath $logPath -Append
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $Command 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath $logPath -Append
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }

  if ($exitCode -ne 0) {
    throw "$Label failed with exit code $exitCode"
  }
}

"Settings Center Foundation Verification - $(Get-Date -Format o)" | Out-File -FilePath $logPath -Encoding utf8

Invoke-Step 'Scoped Prettier Format Check' {
  npx prettier --check @settingsCenterTargets
}

Invoke-Step 'ESLint Check' {
  npm run lint
}

Invoke-Step 'Full Vitest Suite' {
  npm run test:run
}

Invoke-Step 'Production Build (Vite)' {
  npm run build
}

Write-Output "Verification complete. Log written to $logPath" | Tee-Object -FilePath $logPath -Append
