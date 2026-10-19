# FACCI M5 - Windows Scheduled Tasks helper (worker + optional dashboard)
#
# STATUS DISTINCTION:
#   IMPLEMENTED = this script exists in the repo and can register/unregister tasks.
#   INSTALLED   = FACCI-Worker / FACCI-Dashboard exists in Task Scheduler on THIS machine.
#   TESTED HERE = acceptance runs -Status only unless the owner explicitly installs.
#
# Safety:
#   - Does NOT bind ports remotely (FACCI stays on 127.0.0.1).
#   - Default / -Status is read-only (no changes).
#   - Install uses AtLogOn for the interactive user (not SYSTEM).
#   - Runs only while the PC is awake and the user session is logged on.

param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [switch]$IncludeDashboard,
  [switch]$Unregister,
  [switch]$Status,
  [switch]$Install
)

$ErrorActionPreference = "Stop"
$workerTask = "FACCI-Worker"
$dashTask = "FACCI-Dashboard"

function Get-FacciTaskInfo([string]$Name) {
  $t = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
  if (-not $t) {
    return [pscustomobject]@{
      Name = $Name
      Installed = $false
      State = "Absent"
      Actions = $null
    }
  }
  $action = ($t.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }) -join "; "
  return [pscustomobject]@{
    Name = $Name
    Installed = $true
    State = [string]$t.State
    Actions = $action
  }
}

function Show-Status {
  Write-Host "FACCI Windows tasks - STATUS (read-only)"
  Write-Host "RepoRoot: $RepoRoot"
  Write-Host "Script: IMPLEMENTED in repo. Installation is OPTIONAL and owner-driven."
  Write-Host ""
  foreach ($name in @($workerTask, $dashTask)) {
    $info = Get-FacciTaskInfo $name
    if ($info.Installed) {
      Write-Host ("[{0}] INSTALLED  state={1}" -f $info.Name, $info.State)
      Write-Host ("         action: {0}" -f $info.Actions)
    }
    else {
      Write-Host ("[{0}] NOT INSTALLED on this machine" -f $info.Name)
    }
  }
  Write-Host ""
  Write-Host "To install (makes changes):  .\scripts\install-windows-tasks.ps1 -Install"
  Write-Host "Optional dashboard:          .\scripts\install-windows-tasks.ps1 -Install -IncludeDashboard"
  Write-Host "Unregister:                  .\scripts\install-windows-tasks.ps1 -Unregister"
}

function Remove-FacciTask([string]$Name) {
  $existing = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
  if ($existing) {
    Unregister-ScheduledTask -TaskName $Name -Confirm:$false
    Write-Host "Removed scheduled task: $Name"
  }
}

# Default / explicit status - no mutations
if ($Status -or ((-not $Install) -and (-not $Unregister))) {
  Show-Status
  if ((-not $Install) -and (-not $Unregister)) {
    Write-Host "(No -Install / -Unregister supplied - no changes made.)"
    exit 0
  }
  if (-not $Install) {
    exit 0
  }
}

if ($Unregister) {
  Remove-FacciTask $workerTask
  Remove-FacciTask $dashTask
  Write-Host "Unregister complete."
  exit 0
}

# --- Install path (explicit -Install only) ---
$null = Get-Command node -ErrorAction Stop
$null = Get-Command npm -ErrorAction Stop
$cmd = (Get-Command cmd.exe -ErrorAction Stop).Source

Remove-FacciTask $workerTask

# Wrapper .cmd avoids nested-quote pain under Task Scheduler.
$wrapperDir = Join-Path $RepoRoot "scripts\windows-task-wrappers"
New-Item -ItemType Directory -Force -Path $wrapperDir | Out-Null
$workerCmd = Join-Path $wrapperDir "run-worker.cmd"
$dashCmd = Join-Path $wrapperDir "run-dashboard.cmd"
Set-Content -Path $workerCmd -Encoding ASCII -Value "@echo off`r`ncd /d `"$RepoRoot`"`r`nnpm run worker`r`n"
Set-Content -Path $dashCmd -Encoding ASCII -Value "@echo off`r`ncd /d `"$RepoRoot`"`r`nnpm run start`r`n"

$workerAction = New-ScheduledTaskAction -Execute $workerCmd -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $workerTask `
  -Action $workerAction `
  -Trigger $trigger `
  -Settings $settings `
  -Description "FACCI durable worker. Local-only. AtLogOn." | Out-Null

Write-Host "INSTALLED: $workerTask (AtLogOn) in $RepoRoot"
Write-Host "Start now:  Start-ScheduledTask -TaskName '$workerTask'"

if ($IncludeDashboard) {
  Remove-FacciTask $dashTask
  $dashAction = New-ScheduledTaskAction -Execute $dashCmd -WorkingDirectory $RepoRoot
  Register-ScheduledTask `
    -TaskName $dashTask `
    -Action $dashAction `
    -Trigger $trigger `
    -Settings $settings `
    -Description "FACCI Next.js on 127.0.0.1:3010. Local-only. Build first." | Out-Null
  Write-Host "INSTALLED: $dashTask - ensure npm run build succeeded first."
}

Write-Host ""
Write-Host "Notes:"
Write-Host "- Tasks run only when the PC is awake and the user is logged on."
Write-Host "- Dashboard stays on 127.0.0.1 - do not enable remote bind without auth+TLS."
Write-Host "- Acceptance testing uses -Status only; install was not required for M5 acceptance."
Write-Host "- Unregister:  .\scripts\install-windows-tasks.ps1 -Unregister"
