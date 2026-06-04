@echo off
setlocal
cd /d "%~dp0"

echo.
echo Current phone addresses for Workdesk
echo.
echo Try the 192.168 address first:
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { 'http://' + $_.IPAddress + ':8788/?room=my-workdesk&fresh=8' }"

echo.
echo If none of these opens on your phone:
echo 1. Keep Workdesk running on the PC.
echo 2. Make sure phone and PC are on the same Wi-Fi.
echo 3. Run allow-phone-access.cmd once.
echo.
pause
