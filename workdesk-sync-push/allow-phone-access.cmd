@echo off
setlocal

echo.
echo This will allow phone access to Workdesk sync test port 8788.
echo Windows may ask for administrator permission.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command ""Remove-NetFirewallRule -DisplayName ''Workdesk Sync Test 8788'' -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName ''Workdesk Sync Test 8788'' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8788 -Profile Any; Write-Host ''Done. You can close this window.''; pause""'"

echo.
echo If an administrator window opened, approve it and wait for Done.
echo Then keep start-wifi-sync-test.cmd running and try the phone address again.
echo.
pause
