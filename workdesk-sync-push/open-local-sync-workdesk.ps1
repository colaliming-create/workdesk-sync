$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8788
$url = "http://localhost:$port/?room=my-workdesk&fresh=desktop"

function Test-PortOpen {
  param([int]$Port)
  try {
    $client = [Net.Sockets.TcpClient]::new()
    $result = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $success = $result.AsyncWaitHandle.WaitOne(300)
    if ($success) { $client.EndConnect($result) }
    $client.Close()
    return $success
  } catch {
    return $false
  }
}

function Get-BrowserPath {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  return $null
}

if (-not (Test-PortOpen -Port $port)) {
  $serverScript = Join-Path $root "start-wifi-sync-test.ps1"
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$serverScript`""
  ) | Out-Null

  $ready = $false
  for ($i = 0; $i -lt 30; $i += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-PortOpen -Port $port) {
      $ready = $true
      break
    }
  }
  if (-not $ready) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show("Workdesk sync service did not start. Please run start-wifi-sync-test.cmd once and send a screenshot if it shows an error.", "Workdesk Sync")
    exit 1
  }
}

$browser = Get-BrowserPath
if (-not $browser) {
  Start-Process $url
  exit 0
}

Start-Process $browser -ArgumentList @("--app=$url", "--new-window") | Out-Null
