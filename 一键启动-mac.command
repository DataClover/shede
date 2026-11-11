#!/bin/bash
# 舍得 · AI 断舍离决策助手 — macOS / Linux 一键启动
# 用法：在本文件所在目录打开终端，执行  bash 一键启动-mac.command
# （若已 chmod +x 也可直接双击运行）

cd "$(dirname "$0")/backend" || { echo "[错误] 找不到 backend 目录，它应与此脚本同级。"; exit 1; }

echo "============================================================"
echo "  舍得 · AI 断舍离决策助手  —  一键启动 (macOS)"
echo "============================================================"
echo

PY=python3
if ! command -v python3 >/dev/null 2>&1; then
  echo "[错误] 未找到 python3。"
  echo "       请安装 Python 3.11+：https://www.python.org/downloads/"
  echo "       或执行：brew install python@3.12"
  exit 1
fi

if ! python3 -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" 2>/dev/null; then
  echo "[错误] Python 版本过低，需要 3.11 或更高（当前：$(python3 --version 2>&1)）。"
  exit 1
fi

if [ ! -x ".venv/bin/python" ]; then
  echo "[1/6] 正在创建虚拟环境 .venv ..."
  python3 -m venv .venv || { echo "[错误] 虚拟环境创建失败。"; exit 1; }

  echo "[2/6] 正在安装依赖（首次约 1-3 分钟，需联网）..."
  .venv/bin/python -m pip install --disable-pip-version-check -q --upgrade pip >/dev/null 2>&1
  if ! .venv/bin/python -m pip install --disable-pip-version-check -q --prefer-binary -r requirements.txt; then
    echo "       默认源失败，切换清华镜像重试 ..."
    if ! .venv/bin/python -m pip install --disable-pip-version-check -q --prefer-binary -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt; then
      echo "[错误] 依赖安装失败，请检查网络后重试。"; exit 1
    fi
  fi
else
  echo "[1/6] 已找到虚拟环境，跳过创建。"
  echo "[2/6] 依赖已安装（沿用现有 .venv）。"
fi

echo "[3/6] 准备图片目录与配置文件 ..."
mkdir -p Photos/temp
if [ ! -f "config.ini" ]; then
  if [ -f "config.ini.example" ]; then
    cp "config.ini.example" "config.ini"
  else
    echo "[错误] 仓库缺少 config.ini.example。"; exit 1
  fi
fi

if [ ! -f "web/index.html" ] && [ ! -f "../web/index.html" ]; then
  echo "[警告] 未找到 web/index.html，打开首页会看到 JSON 而非网页。"
fi

echo "[4/6] 检查数据库 ..."
.venv/bin/python _ensure_db.py || { echo "[错误] 数据库初始化失败，见上方报错。"; exit 1; }

echo "[5/6] 检查 8000 端口 ..."
if lsof -i :8000 >/dev/null 2>&1; then
  echo "[错误] 8000 端口已被占用。"
  echo "       请执行：lsof -ti:8000 | xargs kill"
  exit 1
fi

echo "[6/6] 正在启动服务：http://localhost:8000"
echo "       浏览器将在约 3 秒后自动打开。"
echo "       请保持此窗口开启，按 Ctrl+C 停止服务。"
echo
( sleep 3; open "http://localhost:8000/" >/dev/null 2>&1 || xdg-open "http://localhost:8000/" >/dev/null 2>&1 ) &
exec .venv/bin/python -m uvicorn launch:app --host 0.0.0.0 --port 8000
