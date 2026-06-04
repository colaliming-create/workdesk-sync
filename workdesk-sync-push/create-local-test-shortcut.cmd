@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-pc-shortcut.ps1" -AppUrl "http://localhost:8788/?room=my-workdesk" -ShortcutName "Workdesk" -TargetScript "%~dp0open-local-sync-workdesk.vbs"

echo.
echo Desktop shortcut created: Workdesk
echo Double-click it to auto-start sync service and open the app window.
echo.
pause
