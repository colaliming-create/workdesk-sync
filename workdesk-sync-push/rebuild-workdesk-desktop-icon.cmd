@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-pc-shortcut.ps1" -AppUrl "http://localhost:8788/?room=my-workdesk" -ShortcutName "Workdesk" -TargetScript "%~dp0open-local-sync-workdesk.vbs"

echo.
echo Rebuilt desktop shortcut: Workdesk
echo If the icon still looks old, right-click the desktop and choose Refresh.
echo You can also delete the old Workdesk Sync shortcut if it is still there.
echo.
pause
