@echo off
setlocal enabledelayedexpansion
title AI-Inventory APP - stop backend
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
  set FOUND=1
  echo killing pid %%a ...
  taskkill /F /PID %%a >nul 2>nul
)
if "!FOUND!"=="0" (
  echo no server listening on port 8000.
) else (
  echo done.
)
pause
