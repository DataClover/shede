# 舍得 · AI 断舍离决策助手

> 不是替你扔掉东西，而是帮你想清楚。

微信小程序 + FastAPI + SQLite + 智谱 GLM-4V。
拍照 → AI 识别 → 回答 2~3 个问题 → AI 六维分析（使用频率 / 是否重复 / 实际需求 /
重新购买意愿 / 占用空间 / 情感价值）→ 给出建议与理由 → 用户自己决定
（留下 / 观察 / 出售或转赠 / 处理）。

## 当前状态

| 版本 | 内容 | 状态 |
|---|---|---|
| v0.1.0 | **可运行基线**：原收纳能力跑通 + 修复 4 个启动阻断 + 演示模式 | ✅ 已完成 |
| v0.2.0 | 决策数据层（items_detail 加决策字段 + 迁移） | ⬜ 待做 |
| v0.3.0 | AI 决策分析接口（六维 + 建议 + 理由） | ⬜ 待做 |
| v0.4.0 | 30 天观察箱 | ⬜ 待做 |
| v0.5.0 | 处理建议（出售文案 / 转赠渠道 / 回收） | ⬜ 待做 |
| v0.6.0 | 前端四页（question / verdict / observe / dispose） | ⬜ 待做 |
| v1.0.0 | 首页三态看板 + 与 PPT 完全对齐 | ⬜ 待做 |

> 说明：v0.1.0 的界面仍然是「收纳工具」形态（储物箱 / 收纳袋 / 物品），
> 决策层从 v0.2.0 起叠加。这样每一步都有可运行的产物，便于回退与演示。

## 快速开始

前置：Python 3.11+、微信开发者工具（稳定版）

1. 双击 `一键启动.bat`（首次会自动建虚拟环境并装依赖，约 20~60 秒）
   看到 `Uvicorn running on http://0.0.0.0:8000` 即成功，**窗口不能关**
2. 微信开发者工具 → 导入项目 → 目录选 `miniprogram` → AppID 选「测试号」
3. `详情 → 本地设置` → 勾选「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」

详见 `使用说明.md`。

## 目录结构

```
.
├─ 一键启动.bat / 停止服务.bat
├─ 使用说明.md
├─ backend/                 FastAPI 后端
│   ├─ launch.py            入口（挂载 v0~v4 路由）
│   ├─ config.ini.example   配置模板（含 [demo] 演示开关）
│   ├─ db_init.py           建表（schema 以此为准）
│   ├─ _ensure_db.py        启动前自检：旧库自动备份并重建
│   ├─ common_db.py / security_utils.py
│   └─ v*.py                v0 用户 / v1 储物箱 / v2 收纳袋 / v3 物品 / v4 搜索
└─ miniprogram/             微信小程序
    ├─ pages/               首页 / 搜索 / 我的
    ├─ packageCamera/       拍照 + AI 识图确认  ← 决策流复用这里
    ├─ packageStorage/      储物箱 / 收纳袋 / 物品详情
    └─ packageSearch/
```

## 已知的 4 个「开箱即崩」问题（v0.1.0 已修）

1. 仓库含带 `:` 的目录名，Windows 上 `git clone` 直接失败
2. `launch.py` 的 `StaticFiles(directory="Photos")` 在缺目录时抛 `RuntimeError`
3. 原仓库提交的 `database.sqlite` 是旧 schema（缺 `item_limit` 等），登录后必然 `500`
4. 登录依赖微信 `jscode2session`，无真实 AppID 时返回 400

## 来源声明

收纳功能底座来自开源项目 https://github.com/1eez/AI-Inventory-APP （未附 LICENSE，
默认保留所有权利）。本仓库仅用于课程作业，请勿对外分发或商用。
