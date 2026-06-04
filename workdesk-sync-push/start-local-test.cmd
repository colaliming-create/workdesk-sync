@echo off
setlocal
cd /d "%~dp0"

echo.
echo Workdesk local test
echo.
echo Keep this window open while testing.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on this computer.
  echo Please install Node.js first, then run this file again.
  echo Download: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo Open this address on this PC:
echo http://localhost:8788/?room=my-workdesk
echo.
echo Starting local server...
echo.

node server.js

echo.
echo The local server has stopped.
echo If you saw an error above, send me a screenshot.
echo.
pause
