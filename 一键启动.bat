@echo off
chcp 65001 >nul
setlocal EnableExtensions
title 舍得 - 一键启动

cd /d "%~dp0backend"
if errorlevel 1 (
  echo [错误] 找不到 backend 目录，它应与此 bat 文件同级。
  pause
  exit /b 1
)

echo ============================================================
echo   舍得 · AI 断舍离决策助手  —  一键启动
echo ============================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo [错误] 未在 PATH 中找到 python。
    echo        请安装 Python 3.11+：https://www.python.org/downloads/
    echo        安装时务必勾选 "Add python.exe to PATH"。
    pause
    exit /b 1
  )
  set "PY=py -3"
) else (
  set "PY=python"
)

%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" >nul 2>nul
if errorlevel 1 (
  echo [错误] Python 不可用或版本过低（需要 3.11 或更高）。
  echo        若已安装仍报此错，可能是应用商店占位程序，
  echo        请到 https://www.python.org/downloads/ 重新安装。
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/6] 正在创建虚拟环境 .venv ...
  %PY% -m venv .venv
  if errorlevel 1 ( echo [错误] 虚拟环境创建失败。 & pause & exit /b 1 )

  echo [2/6] 正在安装依赖（首次约 1-3 分钟，需联网）...
  ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q --upgrade pip >nul 2>nul
  ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q --prefer-binary -r requirements.txt
  if errorlevel 1 (
    echo        默认源失败，切换清华镜像重试 ...
    ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q --prefer-binary -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
    if errorlevel 1 ( echo [错误] 依赖安装失败，请检查网络后重试。 & pause & exit /b 1 )
  )
) else (
  echo [1/6] 已找到虚拟环境，跳过创建。
  echo [2/6] 依赖已安装（沿用现有 .venv）。
)

echo [3/6] 准备图片目录与配置文件 ...
if not exist "Photos" mkdir "Photos"
if not exist "Photos\temp" mkdir "Photos\temp"
if not exist "config.ini" (
  if exist "config.ini.example" (
    copy "config.ini.example" "config.ini" >nul
  ) else (
    echo [错误] 仓库缺少 config.ini.example。
    pause
    exit /b 1
  )
)

if not exist "web\index.html" (
  echo [警告] 未找到 web\index.html。
  echo        说明网页托管尚未提交（方案A方式1 未落地），
  echo        打开首页会看到 JSON 而非网页。请先完成网页托管再答辩。
  echo.
)

echo [4/6] 检查数据库 ...
".venv\Scripts\python.exe" _ensure_db.py
if errorlevel 1 ( echo [错误] 数据库初始化失败，见上方报错。 & pause & exit /b 1 )

echo [5/6] 检查 8000 端口 ...
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo [错误] 8000 端口已被占用。
  echo        请先运行项目根目录的 停止服务.bat，或手动释放端口。
  pause
  exit /b 1
)

echo [6/6] 正在启动服务：http://localhost:8000
echo        浏览器将在约 3 秒后自动打开。
echo        请保持此窗口开启，按 Ctrl+C 停止服务。
echo.
start "" cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:8000/"
".venv\Scripts\python.exe" -m uvicorn launch:app --host 0.0.0.0 --port 8000

echo.
echo 服务已停止。
pause
