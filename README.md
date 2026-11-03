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
| v0.2.0 | **决策数据层**：`items_detail` 加 17 个决策字段（三态 / 回答 / 六维 / 观察箱 / 处理）+ 旧库无损就地迁移 | ✅ 已完成 |
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
│   ├─ _ensure_db.py        启动前自检：旧库就地补列 / 无损重建（不删数据）
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

## 数据模型（舍得决策层 v0.2.0）

决策层不新建表，直接在 `items_detail` 上叠字段 —— 拍照、识图、图片存储、列表、详情
全部复用原收纳能力，只是物品多了「要不要留」这一层状态。

### 三态流转

```
pending（待决策）──答完问题+AI 分析──> user 选择
   ├─ keep     → resolved（已留下）
   ├─ observe  → observing（观察中，30 天后到期）──到期──> 待用户处理
   └─ sell/gift/recycle/discard → resolved（已处理）
```

### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | TEXT NOT NULL DEFAULT `'pending'` | 三态：`pending` / `observing` / `resolved` |
| `usage_answer` | TEXT | 最近一次使用：`recent`(这周) / `month`(这月) / `long`(半年内) / `never`(想不起来) |
| `rebuy_answer` | TEXT | 会再买吗：`yes` / `no` / `unsure` |
| `replace_answer` | TEXT | 有替代吗：`none`(没有) / `has`(有别的能顶) / `broken`(坏了) |
| `emotion_answer` | TEXT | 情感价值：`high` / `mid` / `low` |
| `ai_verdict` | TEXT | AI 建议：`keep` / `observe` / `dispose` |
| `ai_score` | INTEGER | 保留价值分 0~100（越高越该留） |
| `ai_reason` | TEXT | AI 给的一句理由（展示在建议页） |
| `ai_dims` | TEXT | 六维分数 JSON：`{"usage":..,"duplicate":..,"need":..,"rebuy":..,"space":..,"emotion":..}` |
| `decision` | TEXT | 用户最终选择：`keep` / `observe` / `sell` / `gift` / `recycle` / `discard` |
| `decided_at` | TEXT | 做出选择的时间 |
| `observe_until` | TEXT | 观察到期日（`observe` 时写入，默认 +30 天） |
| `observe_used_count` | INTEGER NOT NULL DEFAULT 0 | 观察期内的「用到了」次数 |
| `last_used_at` | TEXT | 最后一次标记使用的时间 |
| `dispose_channel` | TEXT | 处理渠道：`sell` / `gift` / `recycle` / `trash` |
| `dispose_suggest` | TEXT | 处理建议文案（出售定价话术 / 转赠渠道 / 回收点） |
| `disposed_at` | TEXT | 处理完成时间 |

索引：`idx_items_status(user_id, status)`、`idx_items_observe(status, observe_until)`。

### 旧库迁移（`_ensure_db.py`，每次启动幂等执行）

1. 缺的表用 `CREATE TABLE IF NOT EXISTS` 补建（不动已有数据）
2. 缺的列用 `ALTER TABLE ADD COLUMN` 补齐（24 列，含上面 17 个）
3. 旧库把 `items_detail.bag_id` 卡成 `NOT NULL` → **重建表放开**（顺带把旧表可空而新表
   `NOT NULL` 的列按默认值回填），搬完数据再换名，业务字段逐行保留
4. 期间任何一步都不会 `DROP` 用户数据；v0.1.0 那种「旧库改名 + 重建空库」已废弃

## 来源声明

收纳功能底座来自开源项目 https://github.com/1eez/AI-Inventory-APP （未附 LICENSE，
默认保留所有权利）。本仓库仅用于课程作业，请勿对外分发或商用。
