param(
  [Parameter(Mandatory = $true)]
  [string]$AppUrl,

  [string]$ShortcutName = "Workdesk Sync",

  [string]$TargetScript = ""
)

$ErrorActionPreference = "Stop"

function Get-ChromePath {
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

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "$ShortcutName.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)

if ($TargetScript) {
  $shortcut.TargetPath = "$env:WINDIR\System32\wscript.exe"
  $shortcut.Arguments = "`"$TargetScript`""
  $shortcut.WorkingDirectory = $PSScriptRoot
} else {
  $browser = Get-ChromePath
  if (-not $browser) {
    throw "Chrome or Edge was not found."
  }
  $shortcut.TargetPath = $browser
  $shortcut.Arguments = "--app=`"$AppUrl`" --new-window"
  $shortcut.WorkingDirectory = Split-Path $browser
}

$ico = Join-Path $PSScriptRoot "icons\workdesk.ico"
$svg = Join-Path $PSScriptRoot "icons\icon.svg"
if (Test-Path -LiteralPath $ico) {
  $shortcut.IconLocation = "$ico,0"
} elseif (Test-Path -LiteralPath $svg) {
  $shortcut.IconLocation = $svg
}

$shortcut.Description = "Workdesk Sync"
$shortcut.Save()

Write-Host "Created shortcut: $shortcutPath"
