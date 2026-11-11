@echo off
chcp 65001 >nul
setlocal EnableExtensions
title 舍得 - 一键启动

cd /d "%~dp0backend"
if errorlevel 1 (
  echo [错误] 找不到 backend 文件夹，它应该和这个启动器放在一起。
  pause
  exit /b 1
)

echo 正在检查运行环境与依赖...
echo.

rem ---- 1. 找到 Python（优先 python，其次 py 启动器）----
set "PY="
where python >nul 2>nul
if not errorlevel 1 set "PY=python"
if not defined PY (
  where py >nul 2>nul
  if not errorlevel 1 set "PY=py -3"
)
if not defined PY (
  echo 未检测到 Python 环境，请先安装 Python 3.11+
  echo 下载地址：https://www.python.org/downloads/
  echo 安装时记得勾选 Add python.exe to PATH
  pause
  exit /b 1
)

%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Python 环境，请先安装 Python 3.11+
  echo 下载地址：https://www.python.org/downloads/
  echo 安装时记得勾选 Add python.exe to PATH
  pause
  exit /b 1
)

rem ---- 2. 依赖检查（已装则跳过，缺失用清华镜像整份安装）----
%PY% -c "import fastapi, uvicorn, zhipuai, PIL, pydantic, jwt, multipart, httpx, cachetools" >nul 2>nul
if errorlevel 1 (
  %PY% -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试
    pause
    exit /b 1
  )
  rem 安装后复查：防止 pip 误判「已安装」但实际不可导入
  %PY% -c "import fastapi, uvicorn, zhipuai, PIL, pydantic, jwt, multipart, httpx, cachetools" >nul 2>nul
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试
    pause
    exit /b 1
  )
)

rem ---- 3. 配置文件（缺则从模板复制）----
if not exist "config.ini" (
  if exist "config.ini.example" copy "config.ini.example" "config.ini" >nul
)

rem ---- 4. AI 密钥提示（无 key 也能跑，后端自动退回本地轻量推算）----
%PY% -c "import configparser,sys; c=configparser.ConfigParser(); c.read('config.ini',encoding='utf-8'); k=c.get('zhipu','zhipu_api_key',fallback='').strip(); sys.exit(0 if k and 'YOUR' not in k.upper() else 1)" >nul 2>nul
if errorlevel 1 (
  echo 提示：未检测到 AI 密钥，已启用本地轻量推算。
  echo.
)

if not exist "Photos" mkdir "Photos"
if not exist "Photos\temp" mkdir "Photos\temp"

rem ---- 5. 数据库 ----
%PY% _ensure_db.py >nul 2>nul
if errorlevel 1 (
  echo 数据初始化失败，请把本窗口截图发给组员排查。
  pause
  exit /b 1
)

rem ---- 6. 端口 ----
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo 检测到 8000 端口被占用，请先关闭其他服务或重启电脑。
  pause
  exit /b 1
)

echo 服务正在启动，请勿关闭此窗口...
echo 浏览器即将自动打开，若未弹出请手动访问 http://localhost:8000
echo.
start "" cmd /c "timeout /t 2 >nul && start http://localhost:8000"
%PY% -m uvicorn launch:app --host 0.0.0.0 --port 8000

echo.
echo 服务已停止。
pause
