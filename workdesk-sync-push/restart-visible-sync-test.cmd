@echo off
setlocal
cd /d "%~dp0"

echo.
echo Restarting Workdesk sync test service...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = Get-NetTCPConnection -LocalPort 8788 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($pid in $ports) { if ($pid -and $pid -ne $PID) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue } }"

timeout /t 1 >nul

call "%~dp0start-wifi-sync-test.cmd"
