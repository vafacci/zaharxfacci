# FACCI local runtime control (Windows)
# Stop/start worker + optional Next dashboard for "game mode" (free GPU/CPU).
#
# Usage:
#   .\scripts\facci-runtime.ps1 -Action Status
#   .\scripts\facci-runtime.ps1 -Action GameOn
#   .\scripts\facci-runtime.ps1 -Action GameOff
#   .\scripts\facci-runtime.ps1 -Action StopWorker
#   .\scripts\facci-runtime.ps1 -Action StartWorker
#
# Safety: only kills processes whose CommandLine contains this repo path + worker/next markers.
# Does not touch unrelated node processes.

param(
  [ValidateSet(
    "Status",
    "StopWorker",
    "StartWorker",
    "StopDashboard",
    "StartDashboard",
    "GameOn",
    "GameOff"
  )]
  [string]$Action = "Status",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [int]$DashboardPort = 3010,
  # Optional sibling Image Studio (Comfy/Next) — stopped on GameOn, never auto-started.
  [string]$ImageStudioRoot = "C:\Users\Dayan\Desktop\imagegen"
)

$ErrorActionPreference = "Stop"

function Get-FacciProcs([string]$Pattern) {
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and
      $_.CommandLine -like "*$RepoRoot*" -and
      $_.CommandLine -match $Pattern
    }
}

function Stop-FacciProcs([string]$Pattern, [string]$Label) {
  $procs = @(Get-FacciProcs $Pattern)
  $killed = @()
  foreach ($p in $procs) {
    try {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
      $killed += $p.ProcessId
    } catch {
      # already gone
    }
  }
  return [pscustomobject]@{
    label = $Label
    matched = $procs.Count
    killed = $killed
  }
}

function Stop-ImageStudio {
  if (-not $ImageStudioRoot -or -not (Test-Path -LiteralPath $ImageStudioRoot)) {
    return [pscustomobject]@{ label = "imagegen"; matched = 0; killed = @(); skipped = $true }
  }
  $procs = @(
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object {
        $_.CommandLine -and
        $_.CommandLine.Contains($ImageStudioRoot) -and
        ($_.CommandLine.Contains("next") -or $_.CommandLine.Contains("run dev") -or $_.CommandLine.Contains("comfy"))
      }
  )
  $killed = @()
  foreach ($p in $procs) {
    try {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
      $killed += $p.ProcessId
    } catch {}
  }
  return [pscustomobject]@{
    label = "imagegen"
    matched = $procs.Count
    killed = $killed
    skipped = $false
  }
}

function Test-PortOpen([int]$Port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect("127.0.0.1", $Port)
    $c.Close()
    return $true
  } catch {
    return $false
  }
}

function Start-FacciNpm([string]$NpmScript, [string]$LogName) {
  $logDir = Join-Path $RepoRoot "logs"
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
  $out = Join-Path $logDir "$LogName.out.log"
  $err = Join-Path $logDir "$LogName.err.log"
  # Use cmd redirection — nested PowerShell `*>` was breaking Next.js cwd
  # into a bogus path like `...\FACCI-AGENT\2*>`.
  $args = "/c npm run $NpmScript > `"$out`" 2> `"$err`""
  Start-Process -FilePath "cmd.exe" -ArgumentList $args -WorkingDirectory $RepoRoot -WindowStyle Hidden | Out-Null
  return [pscustomobject]@{ script = $NpmScript; log = $out }
}

function Write-ModeFile([string]$Mode) {
  $dataDir = Join-Path $RepoRoot "data"
  if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
  $path = Join-Path $dataDir "runtime-mode.json"
  $obj = @{
    mode = $Mode
    updatedAt = (Get-Date).ToUniversalTime().ToString("o")
    action = $Action
  } | ConvertTo-Json
  Set-Content -LiteralPath $path -Value $obj -Encoding utf8
}

function Get-StatusObject {
  $workers = @(Get-FacciProcs "worker[/\\]index|tsx.*worker")
  $dash = @(Get-FacciProcs "next(\.js)?\s+dev|next-server|next\\dist\\server")
  $portOpen = Test-PortOpen $DashboardPort
  $modePath = Join-Path $RepoRoot "data\runtime-mode.json"
  $mode = $null
  if (Test-Path $modePath) {
    try { $mode = Get-Content $modePath -Raw | ConvertFrom-Json } catch { $mode = $null }
  }
  return [pscustomobject]@{
    repoRoot = $RepoRoot
    workerRunning = ($workers.Count -gt 0)
    workerPids = @($workers | ForEach-Object { $_.ProcessId })
    dashboardProcs = ($dash.Count -gt 0)
    dashboardPids = @($dash | ForEach-Object { $_.ProcessId })
    dashboardPortOpen = $portOpen
    dashboardPort = $DashboardPort
    modeFile = $mode
  }
}

$result = $null

switch ($Action) {
  "Status" {
    $result = Get-StatusObject
  }
  "StopWorker" {
    $stop = Stop-FacciProcs "worker[/\\]index|tsx.*worker" "worker"
    Start-Sleep -Milliseconds 400
    $result = [pscustomobject]@{ action = $Action; stop = $stop; status = Get-StatusObject }
  }
  "StartWorker" {
    $st = Get-StatusObject
    if ($st.workerRunning) {
      $result = [pscustomobject]@{ action = $Action; started = $false; reason = "already_running"; status = $st }
    } else {
      $started = Start-FacciNpm "worker" "facci-worker"
      Start-Sleep -Seconds 1
      $result = [pscustomobject]@{ action = $Action; started = $true; launch = $started; status = Get-StatusObject }
    }
  }
  "StopDashboard" {
    $stop = Stop-FacciProcs "next(\.js)?\s+dev|next-server|next\\dist\\server|next\s+dev" "dashboard"
    Start-Sleep -Milliseconds 400
    $result = [pscustomobject]@{ action = $Action; stop = $stop; status = Get-StatusObject }
  }
  "StartDashboard" {
    $st = Get-StatusObject
    if ($st.dashboardPortOpen) {
      $result = [pscustomobject]@{ action = $Action; started = $false; reason = "port_open"; status = $st }
    } else {
      $started = Start-FacciNpm "dev" "facci-dev"
      Start-Sleep -Seconds 1
      $result = [pscustomobject]@{ action = $Action; started = $true; launch = $started; status = Get-StatusObject }
    }
  }
  "GameOn" {
    $w = Stop-FacciProcs "worker[/\\]index|tsx.*worker" "worker"
    $img = Stop-ImageStudio
    # Defer dashboard kill so an HTTP caller can finish responding.
    $defer = @"
Start-Sleep -Seconds 2
Set-Location -LiteralPath '$RepoRoot'
& '$PSCommandPath' -Action StopDashboard -RepoRoot '$RepoRoot'
"@
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $defer
    ) -WindowStyle Hidden | Out-Null
    Write-ModeFile "game"
    Start-Sleep -Milliseconds 400
    $result = [pscustomobject]@{
      action = $Action
      mode = "game"
      workerStop = $w
      imageStudioStop = $img
      dashboardStop = "deferred_2s"
      status = Get-StatusObject
    }
  }
  "GameOff" {
    Write-ModeFile "develop"
    $st = Get-StatusObject
    $launches = @()
    if (-not $st.workerRunning) {
      $launches += Start-FacciNpm "worker" "facci-worker"
    }
    if (-not $st.dashboardPortOpen) {
      $launches += Start-FacciNpm "dev" "facci-dev"
    }
    Start-Sleep -Seconds 1
    $result = [pscustomobject]@{
      action = $Action
      mode = "develop"
      launches = $launches
      status = Get-StatusObject
    }
  }
}

$result | ConvertTo-Json -Depth 6
