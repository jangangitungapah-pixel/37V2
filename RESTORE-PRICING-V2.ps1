$ErrorActionPreference = 'Stop'

# Run this script from the 37V2 repository root.
$expectedMainCommit = 'c134b6312b5b2818e1c5f7511c19ec164ae43e55'
$expectedPricingBlob = '94b769608fc53531f6ddb6459d8d07dfe0504d77'
$pricingPath = 'src/features/admin/settings/pricing/config/default-pricing-settings.js'

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) {
    throw 'Current directory is not inside a Git repository.'
}

$actualMainCommit = (git rev-parse --verify origin/main 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or $actualMainCommit -ne $expectedMainCommit) {
    throw "origin/main does not match the verified baseline ($expectedMainCommit). Stop and inspect the new main head before restoring."
}

$targetStatus = git status --porcelain -- $pricingPath
if ($LASTEXITCODE -ne 0) {
    throw 'Could not inspect the working-tree status for the Pricing config.'
}
if ($targetStatus) {
    throw 'Pricing config already has local or staged changes. Preserve and inspect them before restoration.'
}

$sourceBlob = (git rev-parse "origin/main:$pricingPath").Trim()
if ($LASTEXITCODE -ne 0 -or $sourceBlob -ne $expectedPricingBlob) {
    throw "The Pricing config blob on origin/main is not the verified V2 source ($expectedPricingBlob)."
}

git restore --source=origin/main --worktree -- $pricingPath
if ($LASTEXITCODE -ne 0) {
    throw 'git restore failed. No staging or commit was attempted.'
}

$restoredBlob = (git hash-object -- $pricingPath).Trim()
if ($LASTEXITCODE -ne 0 -or $restoredBlob -ne $expectedPricingBlob) {
    throw "Restored Pricing file hash mismatch. Expected $expectedPricingBlob, got $restoredBlob. Stop and inspect the file."
}

Write-Host "Restored exact Price & Fee Settings V2 source from origin/main."
Write-Host "Verified blob: $restoredBlob"
Write-Host 'Only the working-tree file was restored; no staging, commit, push, PR, merge, or deploy was performed.'
