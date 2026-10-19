# FACCI M5 — create SQLite backup into data/backups
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$Label = "manual"
)

$ErrorActionPreference = "Stop"
Set-Location $RepoRoot
npx tsx -e "import { createSqliteBackup } from './src/lib/backup.ts'; const r = createSqliteBackup(process.argv[1]); console.log(JSON.stringify(r, null, 2));" $Label
