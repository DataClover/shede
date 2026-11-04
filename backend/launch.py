# !/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
  使用FastAPI构建后台服务 —— 部署在广州轻量二代
  @Version: 1.0
  @Author: lordli
  @Date: 2025-7-14
  @Python version:3.12.9
  @Libary:
      pip install configparser fastapi uvicorn

  生成requirements.txt， 在python工程目录中运行(xx个库)：
  pip freeze > requirements.txt

  @Update:
        1.0 2025-7-14 初始版本
        2.0

  @Launch: python launch.py    # 或者用下面的方式也可以
           uvicorn launch:app --reload --host 0.0.0.0 --port 8000
"""
import uvicorn
from configparser import ConfigParser
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
import os
import time
from datetime import datetime
from contextlib import asynccontextmanager

LOG_FMT = "%(asctime)s - %(levelname)s - %(message)s"

# 将access日志写入uvicorn的日志文件（带时间戳的日志）
def config_access_log_to_show_time():
    # 参考：https://blog.csdn.net/jaket5219999/article/details/135911281
    logger = logging.getLogger("uvicorn.access")
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(LOG_FMT))
    logger.addHandler(handler)

@asynccontextmanager
async def lifespan(app: FastAPI):
    config_access_log_to_show_time()
    yield

config = ConfigParser()
config.read(r'config.ini', encoding='utf-8')

# 生产环境配置
app = FastAPI(
    title=config.get('fastapi', 'title'),  # 从同路径的config.ini中，读取配置信息，以下雷同
    description=config.get('fastapi', 'description'),
    version=config.get('fastapi', 'version'),
    docs_url=None,  # 生产环境禁用API文档
    redoc_url=None,  # 生产环境禁用ReDoc文档
    debug=False,  # 生产环境关闭调试模式
    timeout=config.getint('fastapi', 'timeout'),
    lifespan=lifespan
)

# 开发环境配置（已注释）
# app = FastAPI(
#     title=config.get('fastapi', 'title'),
#     description=config.get('fastapi', 'description'),
#     version=config.get('fastapi', 'version'),
#     docs_url=config.get('fastapi', 'docs_url', fallback=None),  # 开发环境启用API文档
#     redoc_url=config.get('fastapi', 'redoc_url', fallback=None),  # 开发环境启用ReDoc文档
#     debug=config.getboolean('fastapi', 'debug'),  # 开发环境可启用调试模式
#     timeout=config.getint('fastapi', 'timeout'),
#     lifespan=lifespan
# )

# 生产环境CORS配置 - 严格控制访问来源
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yourdomain.com",  # 替换为实际的前端域名
        "https://www.yourdomain.com",  # 替换为实际的前端域名
        "https://servicewechat.com",  # 微信小程序官方域名
        "http://localhost:8000",  # 网页演示版（方案A，配置级改动，非业务逻辑）
        "http://127.0.0.1:8000",
        "http://localhost:5173",  # 兼容 Vite dev server 调试
    ],
    allow_credentials=True,  # 生产环境允许携带凭证
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # 明确指定允许的方法
    allow_headers=["*"],  # 允许的请求头
)

# 开发环境CORS配置（已注释）
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # 开发环境允许任意来源
#     allow_methods=["*"],  # 开发环境允许所有方法
#     allow_headers=["*"],  # 开发环境允许所有请求头
# )

# 配置静态文件服务 - 用于访问photos目录中的图片
app.mount("/Photos", StaticFiles(directory="Photos"), name="Photos")

# -----------------------------------------------------------
# 【 -- 访问日志落盘 -- 】排查真机连不上/卡启动页时看 logs/access.log
# -----------------------------------------------------------
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
ACCESS_LOG = os.path.join(LOG_DIR, "access.log")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started = time.time()
    response = await call_next(request)
    cost_ms = (time.time() - started) * 1000
    try:
        client = request.client.host if request.client else "-"
        query = ("?" + request.url.query) if request.url.query else ""
        ua = (request.headers.get("user-agent") or "-")[:70]
        with open(ACCESS_LOG, "a", encoding="utf-8") as f:
            f.write("%s  %-15s %-4s %s%s -> %s  %.1fms  UA=%s\n" % (
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                client, request.method, request.url.path, query,
                response.status_code, cost_ms, ua))
    except Exception:
        pass  # 日志写入失败不能影响业务
    return response

# -----------------------------------------------------------
# 【 -- v1版本 -- 第一代后台版本 -- 】
# -----------------------------------------------------------
# -----------------------------------------------------------
# 【 -- 系统模块 -- 】
# -----------------------------------------------------------
# 接口：/auth/login  -- 请求方式POST
# 【系统】获取微信小程序openid
from v0_auth import router as AuthRouter
app.include_router(AuthRouter)

# 接口：/v0/user/edit_nickname  -- 请求方式POST
# 【系统】编辑用户昵称
from v0_edit_nickname import router as EditNicknameRouter
app.include_router(EditNicknameRouter)

# -----------------------------------------------------------
# 【 -- 首页 -- 】
# -----------------------------------------------------------
# 接口：/v0/home/info  -- 请求方式GET
# 【首页】获取用户首页信息
from v0_get_home_info import router as HomeInfoRouter
app.include_router(HomeInfoRouter)

# -----------------------------------------------------------
# 【 -- 物品管理 -- 】
# -----------------------------------------------------------
# 接口：/v3/image/upload  -- 请求方式POST
# 【物品】图片上传与AI分析
from v3_upload_image import router as UploadImageRouter
app.include_router(UploadImageRouter)

# 接口：/v3/item/add  -- 请求方式POST
# 【物品】添加物品
from v3_add_item import router as AddItemRouter
app.include_router(AddItemRouter)

# 接口：/v3/item/delete  -- 请求方式POST
# 【物品】删除物品
from v3_delete_item import router as DeleteItemRouter
app.include_router(DeleteItemRouter)

# 接口：/v3/item/get  -- 请求方式GET
# 【物品】获取物品信息
from v3_get_item import router as GetItemRouter
app.include_router(GetItemRouter)

# 接口：/v3/item/edit  -- 请求方式POST
# 【物品】编辑物品
from v3_edit_item import router as EditItemRouter
app.include_router(EditItemRouter)

# -----------------------------------------------------------
# 【 -- v5版本 - 舍得决策层 -- 】
# -----------------------------------------------------------
# 接口：/v5/decision/questions  -- GET   决策问卷定义
# 接口：/v5/decision/analyze    -- POST  六维分析（写回 ai_* 四列）
# 接口：/v5/decision/item       -- GET   详情页（含已有结论与三态）
from v5_decision import router as DecisionRouter
app.include_router(DecisionRouter)

# -----------------------------------------------------------
# 【 -- v5版本 - 舍得观察箱（30 天冷静期） -- 】
# -----------------------------------------------------------
# 接口：/v5/observe/list      -- GET   观察中列表（按到期日）
# 接口：/v5/observe/due       -- GET   已到期（首页卡片/红点）
# 接口：/v5/observe/use       -- POST  观察期内「我用到了」计数
# 接口：/v5/observe/overview  -- GET   三态看板计数
from v5_observe import router as ObserveRouter
app.include_router(ObserveRouter)

# -----------------------------------------------------------
# 【 -- v5版本 - 舍得处理建议（出售/转赠/回收/丢弃） -- 】
# -----------------------------------------------------------
# 接口：/v5/dispose/suggest  -- POST  生成处理建议并写回
# 接口：/v5/dispose/plan     -- GET   读回已生成的建议
from v5_dispose import router as DisposeRouter
app.include_router(DisposeRouter)

# -----------------------------------------------------------
# 【 -- 测试模块 -- 】
# -----------------------------------------------------------
# 接口：/v0/testAI/  -- 请求方式POST
# 接口：/v0/testAI2/  -- 请求方式POST
# 【测试】测试AI返回内容
# -----------------------------------------------------------

@app.get("/health")
async def health_check():
    # 【系统】健康检查探针：供启动脚本/监控定时轮询，返回 200 即表示服务存活
    return {
        'status': 'ok',
        'version': app.version,
        'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    }

# 网页演示版（方案A）：静态产物挂到 /，必须在所有 API 路由（含 /health）之后挂载
import os
_web_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web")
if os.path.isdir(_web_dist):
    app.mount("/", StaticFiles(directory=_web_dist, html=True), name="web")

if __name__ == "__main__":
    # 生产环境启动配置
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        access_log=True,  # 生产环境启用访问日志
        log_level="info"  # 生产环境日志级别
    )
    
    # 开发环境启动配置（已注释）
    # uvicorn.run(
    #     app, 
    #     host="0.0.0.0", 
    #     port=8000,
    #     reload=True,  # 开发环境启用热重载
    #     log_level="debug"  # 开发环境调试日志级别
    # )

