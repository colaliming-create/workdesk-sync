@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-wifi-sync-test.ps1"

echo.
echo The sync test has stopped.
echo If you saw an error above, send me a screenshot.
echo.
pause
