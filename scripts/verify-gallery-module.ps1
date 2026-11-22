$ErrorActionPreference = 'Stop'

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logDir = '.logs'
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logPath = Join-Path $logDir "gallery-module-verification-$timestamp.txt"

$galleryTargets = @(
  'src/App.jsx',
  'src/data/landing-page-content.js',
  'src/components/landing/GallerySection.jsx',
  'src/components/landing/GalleryLightboxDialog.jsx',
  'src/pages/LandingPage.test.jsx',
  'src/features/admin/navigation/admin-navigation.js',
  'src/features/admin/admin-shell.test.jsx',
  'src/features/admin/settings/settings.test.jsx',
  'src/features/admin/settings/settings-center.test.jsx',
  'src/features/admin/gallery/gallery.test.jsx',
  'src/features/admin/gallery/config/gallery-config.js',
  'src/features/admin/gallery/utils/cloudinary-url.js',
  'src/features/admin/gallery/utils/gallery-format.js',
  'src/features/admin/gallery/utils/gallery-normalize.js',
  'src/features/admin/gallery/schemas/gallery-schema.js',
  'src/features/admin/gallery/services/cloudinary-upload-service.js',
  'src/features/admin/gallery/services/gallery-service.js',
  'src/features/admin/gallery/repositories/gallery-repository.js',
  'src/features/admin/gallery/hooks/useGalleryItems.js',
  'src/features/admin/gallery/hooks/useGalleryUpload.js',
  'src/features/admin/gallery/hooks/usePublishedGallery.js',
  'src/features/admin/gallery/components/GalleryEmptyState.jsx',
  'src/features/admin/gallery/components/GalleryItemCard.jsx',
  'src/features/admin/gallery/components/GalleryItemEditorDialog.jsx',
  'src/features/admin/gallery/components/GalleryItemGrid.jsx',
  'src/features/admin/gallery/components/GalleryItemPreviewDialog.jsx',
  'src/features/admin/gallery/components/GalleryOwnerAccessNotice.jsx',
  'src/features/admin/gallery/components/GalleryPublishStatusBadge.jsx',
  'src/features/admin/gallery/components/GalleryToolbar.jsx',
  'src/features/admin/gallery/components/GalleryUploadDropzone.jsx',
  'src/features/admin/gallery/components/GalleryUploadQueue.jsx',
  'src/features/admin/gallery/pages/AdminGalleryPage.jsx',
  'firestore.indexes.json',
  'firebase.json'
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

"Gallery Module & Landing Page Integration Verification - $(Get-Date -Format o)" | Out-File -FilePath $logPath -Encoding utf8

Invoke-Step 'Scoped Prettier Format Check' {
  npx prettier --check @galleryTargets
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
