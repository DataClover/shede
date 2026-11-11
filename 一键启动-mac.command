#!/bin/bash
# 舍得 · 一键启动（Mac）— 双击或终端执行均可
# 本文件必须使用 LF 换行（CRLF 会导致 bash 报错）

cd "$(dirname "$0")/backend" || {
  echo "[错误] 找不到 backend 文件夹，它应该和这个启动器放在一起。"
  read -n 1 -s -r -p "按任意键关闭窗口..."
  exit 1
}

pause() { read -n 1 -s -r -p "按任意键关闭窗口..."; echo; }

echo "正在检查运行环境与依赖..."
echo

# ---- 1. 找到 Python ----
if ! command -v python3 >/dev/null 2>&1; then
  echo "未检测到 Python 环境，请先安装 Python 3.11+"
  echo "下载地址：https://www.python.org/downloads/"
  pause; exit 1
fi

if ! python3 -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" 2>/dev/null; then
  echo "未检测到 Python 环境，请先安装 Python 3.11+"
  echo "下载地址：https://www.python.org/downloads/"
  pause; exit 1
fi

# ---- 2. 依赖检查（已装则跳过，缺失用清华镜像整份安装）----
if ! python3 -c "import fastapi, uvicorn, zhipuai, PIL, pydantic, jwt, multipart, httpx, cachetools" 2>/dev/null; then
  if ! python3 -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt; then
    # 部分 Mac 的系统 Python 需要 --user 安装
    if ! python3 -m pip install --user -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt; then
      echo "依赖安装失败，请检查网络后重试"
      pause; exit 1
    fi
  fi
  # 安装后复查：防止 pip 误判「已安装」但实际不可导入
  if ! python3 -c "import fastapi, uvicorn, zhipuai, PIL, pydantic, jwt, multipart, httpx, cachetools" 2>/dev/null; then
    echo "依赖安装失败，请检查网络后重试"
    pause; exit 1
  fi
fi

# ---- 3. 配置文件（缺则从模板复制）----
if [ ! -f "config.ini" ] && [ -f "config.ini.example" ]; then
  cp "config.ini.example" "config.ini"
fi

# ---- 4. AI 密钥提示（无 key 也能跑，后端自动退回本地轻量推算）----
if ! python3 -c "import configparser,sys; c=configparser.ConfigParser(); c.read('config.ini',encoding='utf-8'); k=c.get('zhipu','zhipu_api_key',fallback='').strip(); sys.exit(0 if k and 'YOUR' not in k.upper() else 1)" 2>/dev/null; then
  echo "提示：未检测到 AI 密钥，已启用本地轻量推算。"
  echo
fi

mkdir -p Photos/temp

# ---- 5. 数据库 ----
if ! python3 _ensure_db.py >/dev/null 2>&1; then
  echo "数据初始化失败，请把本窗口截图发给组员排查。"
  pause; exit 1
fi

# ---- 6. 端口 ----
if lsof -i :8000 >/dev/null 2>&1; then
  echo "检测到 8000 端口被占用，请先关闭其他服务或重启电脑。"
  pause; exit 1
fi

echo "服务正在启动，请勿关闭此窗口..."
echo "浏览器即将自动打开，若未弹出请手动访问 http://localhost:8000"
echo
( sleep 2 && open "http://localhost:8000" >/dev/null 2>&1 ) &
python3 -m uvicorn launch:app --host 0.0.0.0 --port 8000

echo
echo "服务已停止。"
pause
