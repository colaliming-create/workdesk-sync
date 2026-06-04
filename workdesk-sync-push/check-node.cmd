@echo off
setlocal

echo.
echo Checking Node.js...
echo.

where node
if errorlevel 1 (
  echo.
  echo Node.js was not found.
  echo Download and install it from:
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo.
node -v
echo.
echo Node.js is available.
echo.
pause
