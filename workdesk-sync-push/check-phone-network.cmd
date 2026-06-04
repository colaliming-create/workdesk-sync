@echo off
setlocal
cd /d "%~dp0"

echo.
echo Workdesk phone network check
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host 'Current network profile:'; Get-NetConnectionProfile | Format-Table Name,InterfaceAlias,NetworkCategory -AutoSize; Write-Host ''; Write-Host 'Phone test addresses:'; Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { 'http://' + $_.IPAddress + ':8788/ping' }; Write-Host ''; Write-Host 'Port 8788 listener:'; Get-NetTCPConnection -LocalPort 8788 -State Listen -ErrorAction SilentlyContinue | Format-Table LocalAddress,LocalPort,State,OwningProcess -AutoSize"

echo.
echo Keep start-wifi-sync-test.cmd running while using these addresses.
echo.
pause
