@echo off
setlocal
cd /d "%~dp0"

echo.
echo Workdesk Sync - desktop shortcut for deployed HTTPS app
echo.
echo Paste your deployed sync link below.
echo Example:
echo https://your-app.example.com/?room=my-workdesk
echo.
set /p WORKDESK_SYNC_URL=Sync link: 

if "%WORKDESK_SYNC_URL%"=="" (
  echo No link entered. Canceled.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-pc-shortcut.ps1" -AppUrl "%WORKDESK_SYNC_URL%" -ShortcutName "Workdesk Sync"

echo.
echo Desktop shortcut created: Workdesk Sync
echo.
pause
