@echo off
setlocal

echo.
echo This will set the current network profile to Private.
echo Windows may ask for administrator permission.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command ""Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private; Write-Host ''Done. Current network is Private.''; pause""'"

echo.
echo After it says Done, run allow-phone-access.cmd once, then start-wifi-sync-test.cmd again.
echo.
pause
