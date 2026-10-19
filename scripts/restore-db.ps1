# FACCI M5 — restore SQLite from data/backups (STOP next + worker first)
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupRelativePath,
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-Location $RepoRoot

if (-not $Force) {
  Write-Host "Stop 'npm run dev' / 'npm run start' and 'npm run worker' before restore."
  Write-Host "Re-run with -Force when processes are stopped."
  exit 1
}

npx tsx -e "import { restoreSqliteBackup } from './src/lib/backup.ts'; const r = restoreSqliteBackup(process.argv[1]); console.log(JSON.stringify(r, null, 2));" $BackupRelativePath
Write-Host "Restored. Start dashboard + worker again."
