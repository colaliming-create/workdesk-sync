$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $root "data\rooms"
$port = 8788
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".ico" = "image/x-icon"
}

function Get-RoomName {
  param([string]$Path)
  $match = [regex]::Match($Path, "^/api/rooms/([^/?]+)$")
  if (-not $match.Success) { return $null }
  return ($match.Groups[1].Value -replace "[^a-zA-Z0-9_-]", "")
}

function Get-DefaultState {
  return @{
    tasks = @()
    notes = ""
    reminderLog = @{}
    updatedAt = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
  } | ConvertTo-Json -Depth 8
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$Body
  )
  $header = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET,POST,PUT,OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`nConnection: close`r`n`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
}

function Read-RequestBody {
  param(
    [System.IO.StreamReader]$Reader,
    [string[]]$Headers
  )
  $contentLength = 0
  foreach ($header in $Headers) {
    if ($header -match "^Content-Length:\s*(\d+)") {
      $contentLength = [int]$Matches[1]
      break
    }
  }
  if ($contentLength -le 0) { return "" }
  $buffer = New-Object char[] $contentLength
  $read = $Reader.ReadBlock($buffer, 0, $contentLength)
  if ($read -le 0) { return "" }
  return -join $buffer[0..($read - 1)]
}

function Show-Addresses {
  $addresses = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -ExpandProperty IPAddress

  Write-Host ""
  Write-Host "Workdesk PC + phone sync test"
  Write-Host ""
  Write-Host "Keep this window open while testing."
  Write-Host "If Windows asks for network access, choose Allow."
  Write-Host ""
  Write-Host "PC:"
  Write-Host "http://localhost:$port/?room=my-workdesk&fresh=8"
  Write-Host ""
  Write-Host "Phone:"
  foreach ($ip in $addresses) {
    Write-Host "http://$ip`:$port/?room=my-workdesk&fresh=8"
    Write-Host "test: http://$ip`:$port/ping"
  }
  Write-Host ""
  Write-Host "Use the 192.168 address first if there is one."
  Write-Host ""
}

function Handle-Client {
  param([System.Net.Sockets.TcpClient]$Client)

  try {
    $stream = $Client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $false, 4096, $true)
    $requestLine = $reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($requestLine)) { return }

    $headers = @()
    while (($line = $reader.ReadLine()) -ne $null -and $line -ne "") {
      $headers += $line
    }

    $parts = $requestLine.Split(" ")
    $method = if ($parts.Length -gt 0) { $parts[0] } else { "GET" }
    $rawPath = if ($parts.Length -gt 1) { [Uri]::UnescapeDataString($parts[1]) } else { "/" }
    $path = $rawPath.Split("?")[0]

    if ($method -eq "OPTIONS") {
      Send-Response $stream 204 "No Content" "application/json; charset=utf-8" ([byte[]]@())
      return
    }

    if ($path -eq "/ping") {
      Send-Response $stream 200 "OK" "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Workdesk phone access OK"))
      return
    }

    if ($path -eq "/api/push/public-key") {
      Send-Response $stream 200 "OK" "application/json; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes('{"publicKey":""}'))
      return
    }

    if ($path -match "^/api/rooms/.+/subscriptions$") {
      Send-Response $stream 200 "OK" "application/json; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes('{"ok":true}'))
      return
    }

    $room = Get-RoomName $path
    if ($room) {
      $file = Join-Path $dataDir "$room.json"
      if ($method -eq "GET") {
        $json = if (Test-Path -LiteralPath $file) { Get-Content -Raw -Encoding UTF8 -LiteralPath $file } else { Get-DefaultState }
        Send-Response $stream 200 "OK" "application/json; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes($json))
        return
      }
      if ($method -eq "PUT") {
        $body = Read-RequestBody -Reader $reader -Headers $headers
        if ([string]::IsNullOrWhiteSpace($body)) { $body = Get-DefaultState }
        $body | Set-Content -Encoding UTF8 -LiteralPath $file
        Send-Response $stream 200 "OK" "application/json; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes($body))
        return
      }
    }

    if ($path -eq "/") { $path = "/index.html" }
    $relative = [Uri]::UnescapeDataString($path.TrimStart("/")).Replace("/", [IO.Path]::DirectorySeparatorChar)
    $filePath = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $relative))
    $resolvedRoot = [IO.Path]::GetFullPath($root)

    if (-not $filePath.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      $filePath = Join-Path $root "index.html"
    }

    $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
    $bytes = [IO.File]::ReadAllBytes($filePath)
    Send-Response $stream 200 "OK" $contentType $bytes
  } catch {
    Write-Host "Ignored a dropped/invalid connection."
  } finally {
    try { $Client.Close() } catch {}
  }
}

Show-Addresses

try {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "Port 8788 is already in use. Close old Workdesk windows, or run restart-visible-sync-test.cmd again."
  throw
}

while ($true) {
  try {
    $client = $listener.AcceptTcpClient()
    Handle-Client $client
  } catch {
    Write-Host "Ignored a connection error."
  }
}
