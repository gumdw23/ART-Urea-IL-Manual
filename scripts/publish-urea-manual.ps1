$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo

Write-Output 'STEP pull'
git fetch origin main
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed' }
git pull --rebase --autostash origin main
if ($LASTEXITCODE -ne 0) { throw 'git pull failed' }

Write-Output 'STEP sync'
python scripts/sync-urea-data.py
if ($LASTEXITCODE -ne 0) { throw 'UREA data sync failed' }

$changed = git status --porcelain -- manual-site/manual-data.json
if (-not $changed) {
  Write-Output 'RESULT NO_CHANGES'
  exit 0
}
Write-Output 'STEP commit'
git add -- manual-site/manual-data.json
if ($LASTEXITCODE -ne 0) { throw 'git add failed' }

$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$message = "Publish UREA Manual data $stamp"
git commit --only -- manual-site/manual-data.json -m $message
if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }
Write-Output 'STEP push'
git push origin main
if ($LASTEXITCODE -ne 0) { throw 'git push failed' }

$sha = (git rev-parse --short HEAD).Trim()
Write-Output "RESULT PUBLISHED $sha"
