@echo off
setlocal
title AI-Inventory APP - backend
cd /d "%~dp0backend"
if errorlevel 1 goto :nodir

echo ============================================================
echo   AI-Inventory APP  -  one click backend launcher
echo ============================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] python not found in PATH.
  echo         Install Python 3.11+ from https://www.python.org/downloads/
  echo         and tick "Add python.exe to PATH".
  goto :end
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/4] creating virtual env .venv ...
  python -m venv .venv
  if errorlevel 1 goto :fail
  echo [2/4] installing dependencies, first run may take 1-3 minutes ...
  ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r requirements.txt
  if errorlevel 1 (
    echo       default index failed, retrying with tsinghua mirror ...
    ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
    if errorlevel 1 goto :fail
  )
) else (
  echo [1/4] virtual env found, skip install
)

if not exist "Photos" mkdir "Photos"
if not exist "Photos\temp" mkdir "Photos\temp"
if not exist "config.ini" copy "config.ini.example" "config.ini" >nul

echo [3/4] checking database ...
".venv\Scripts\python.exe" _ensure_db.py
if errorlevel 1 goto :fail

echo [4/4] starting server on http://localhost:8000 ...
echo.
echo   phone / other device on the same Wi-Fi, use:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'VMware|Loopback|Bluetooth|vEthernet' } | ForEach-Object { Write-Host ('     ' + $_.IPAddress + ':8000/  (' + $_.InterfaceAlias + ')') }"
echo.
echo.
echo   keep this window open. press Ctrl+C or run stop.bat to stop.
echo.
".venv\Scripts\python.exe" -m uvicorn launch:app --host 0.0.0.0 --port 8000
goto :end

:fail
echo.
echo [ERROR] startup failed, see messages above.
goto :end

:nodir
echo [ERROR] folder "backend" not found next to this bat file.

:end
echo.
pause
