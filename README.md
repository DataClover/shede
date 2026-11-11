# 舍得 · AI 断舍离决策助手

> 不是替你扔掉东西，而是帮你想清楚。

微信小程序 + FastAPI + SQLite + 智谱 GLM-4V。
拍照 → AI 识别 → 回答 4 个固定问题 → AI 六维分析（使用频率 / 是否重复 / 实际需求 /
重新购买意愿 / 占用空间 / 情感价值）→ 给出建议与理由 → 用户自己决定
（留下 / 观察 / 出售或转赠 / 处理）。

## 当前状态

| 版本 | 内容 | 状态 |
|---|---|---|
| v0.1.0 | **可运行基线**：原收纳能力跑通 + 修复 4 个启动阻断 + 演示模式 | ✅ 已完成 |
| v0.2.0 | **决策数据层**：`items_detail` 加 17 个决策字段（三态 / 回答 / 六维 / 观察箱 / 处理）+ 旧库无损就地迁移 | ✅ 已完成 |
| v0.3.0 | **AI 六维分析接口**：`/v5/decision/questions` + `/v5/decision/analyze` + `/v5/decision/item`，结论写回 `ai_*` | ✅ 已完成 |
| v0.4.0 | **30 天观察箱**：`/v5/decision/choose` 四选一流转 + `/v5/observe/{list,due,use,overview}` | ✅ 已完成 |
| v0.5.0 | **处理建议**：`/v5/dispose/{suggest,plan}`（出售文案+估价区间 / 转赠对象 / 回收指引） | ✅ 已完成 |
| v0.6.0 | 前端四页（question / verdict / observe / dispose） | ✅ 已完成 |
| v0.7.0 | **小程序前端改造落地**：决策工作台首页 + 主包观察箱 tab + 删除收纳/搜索入口 | ✅ 已完成 |
| v0.8.0 | **方案A 网页演示版**：`web/` 纯静态决策流 7 视图，挂后端 `/` 下同源演示 | ✅ 已完成 |

> 说明：v0.1.0 的界面仍然是「收纳工具」形态（储物箱 / 收纳袋 / 物品），
> 决策层从 v0.2.0 起叠加。这样每一步都有可运行的产物，便于回退与演示。

## 快速开始

前置：Python 3.11+、微信开发者工具（稳定版）

1. 双击 `一键启动.bat` 启动后端（首次会自动建虚拟环境并装依赖，约 20~60 秒）
   看到 `Uvicorn running on http://0.0.0.0:8000` 即成功，**窗口不能关**
2. 小程序：微信开发者工具 → 导入项目 → 目录选 `miniprogram` → AppID 选「测试号」，
   `详情 → 本地设置` → 勾选「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」

详见 `使用说明.md`；答辩现场流程见 `docs/contracts/doc_答辩手册.md`。

## 目录结构

```
.
├─ 一键启动.bat / 停止服务.bat
├─ README.md / 使用说明.md
├─ backend/               FastAPI + SQLite 后端
│   ├─ launch.py          入口（挂载 v0~v5 路由 + web/ 静态托管）
│   ├─ config.ini.example 配置模板（含 [demo] 演示开关）
│   ├─ db_init.py         建表（schema 以此为准）
│   ├─ _ensure_db.py      启动前自检：旧库就地补列 / 无损重建（不删数据）
│   └─ v*.py              v0 用户 / v3 物品识图 / v5 决策·观察·处理
├─ miniprogram/           微信小程序（产品载体）
│   ├─ pages/             决策工作台 / 观察箱 / 我的
│   ├─ packageCamera/     拍照 + AI 识图确认
│   ├─ packageStorage/    决策详情
│   └─ packageShede/      四问 / 六维建议 / 处理建议
└─ docs/
    ├─ references/        只读参考资料（设计 PPT 等，AI 不得修改）
    └─ contracts/         可变契约文档（答辩手册 / 决策记录）
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

### 决策接口（v0.3.0）

| 接口 | 方法 | 说明 |
|---|---|---|
| `/v5/decision/questions` | GET | 返回固定 4 问 + 选项 + 六维中文名，前端直接渲染（枚举与打分逻辑同源） |
| `/v5/decision/analyze` | POST | 入参 `openid / item_id / 4 个回答`，出六维分 + 总分 + `verdict` + 理由 + 建议文案，写回 `ai_*` 四列 |
| `/v5/decision/item` | GET | 详情页：物品基础信息 + 已有 AI 结论 + `dims` + 三态中文 |

打分口径（`v5_decision.py`，对用户可解释）：

- 回答映射：`usage` 这周 90 / 这月 65 / 半年内 35 / 想不起 10；`rebuy` 会 85 / 说不好 55 / 不会 20；
  `replace` 无替代 80 / 有替代 40 / 坏了 30；`emotion` 高 85 / 中 55 / 低 20
- 权重：使用频率 .25、实际需求 .20、重新购买 .15、是否重复 .15、占用空间 .10、情感 .15
- `verdict`：总分 ≥65 `keep`、40~64 `observe`、<40 `dispose`
- `space`（占用空间）目前取中性 50 —— 拍照识别阶段还没有尺寸信息，不编造
- 填了真实智谱 key 就改走 `glm-4-flash` 出六维 + 理由（`source=ai`）；key 缺失或 AI 异常时
  自动退回规则打分并在 `reason` 里注明 `source=rule(...)`，**演示永远不会卡在 AI 上**

### 四选一与观察箱（v0.4.0）

| 接口 | 方法 | 说明 |
|---|---|---|
| `/v5/decision/choose` | POST | `decision` = `keep/observe/sell/gift/recycle/discard`；`observe` 写 `observe_until=+30天`，其余直接落 `resolved`（出售/转赠/回收/丢弃同时记 `dispose_channel` 与 `disposed_at`） |
| `/v5/observe/list` | GET | 观察中列表，按到期日升序，带 `days_left` / `expired` |
| `/v5/observe/due` | GET | 已到期的（首页到期卡片 + 红点数据源） |
| `/v5/observe/use` | POST | 观察期内「我用到了」`observe_used_count+1`，≥3 次提示直接留下 |
| `/v5/observe/overview` | GET | 三态计数（pending/observing/resolved + 留下数/处理数 + 到期数），v1.0.0 首页直接用 |

提醒策略：**不用微信订阅消息**（需正式 AppID 且要逐次授权），改成小程序内「首页到期卡片 + 红点」，
打开小程序就能看到，不受推送权限限制。

### 处理建议（v0.5.0）

| 接口 | 方法 | 说明 |
|---|---|---|
| `/v5/dispose/suggest` | POST | 入参 `channel`（sell/gift/recycle/discard，留空按已有 `decision` 推断）；出「标题文案 + 正文 + 渠道 + 3 条可执行 tips」，出售额外给**估价区间**，结果写回 `dispose_channel` / `dispose_suggest` |
| `/v5/dispose/plan` | GET | 读回已生成的建议（详情页展示） |

- 估价按分类区间 × 成色系数（`ai_score` 越高越靠近上沿），**不编造精确价格**；
- 渠道是校园场景可落地的：闲鱼/转转/学校二手群、同宿舍/班级群/公益点、回收箱与电子废弃物点；
- 填了真实 key 时用 `glm-4-flash` 改写文案与 tips（`source=ai`），失败回退规则版（`source=rule`）。

## 来源声明

收纳功能底座来自开源项目 https://github.com/1eez/AI-Inventory-APP （未附 LICENSE，
默认保留所有权利）。本仓库仅用于课程作业，请勿对外分发或商用。
