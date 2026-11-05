# 第二课实践 · AI-Inventory-小组作业 语义对齐

> 协议（对齐第二课演示）：先用 `semantic-clarification` 逐轮校准语义 → 语义阶段结束后显式切换 `clarify-decisions` 逐轮梳理决策 → 产出可交接的规范需求。全程不执行、不编造用户回答。

## 原始需求来源（读取的文件）

- `C:\Users\qitianhao\Desktop\AI-Inventory-小组作业\README.md`（舍得 · AI 断舍离决策助手，v0.1.0–v1.0.0 与数据/接口口径）
- `C:\Users\qitianhao\Desktop\AI-Inventory-小组作业\使用说明.md`（小组作业可运行版：启动、坑、演示开关、已知限制）
- `C:\Users\qitianhao\Desktop\AI-Inventory-小组作业\miniprogram\README.md`（开源底座自述：智能物品管理/收纳工具）
- `backend\v5_decision.py`、`backend\v5_dispose.py`（决策层实现，用于核验口径）

## 轮次 1（semantic-clarification）

### 当前理解（可纠正）

项目交付物 = 在开源「收纳小程序」底座上叠加「断舍离决策层」，最终产出一个可运行、可答辩的「舍得 · AI 断舍离决策助手」。
当前 v0.1–v0.5 后端已完成；v0.6（前端四页 question/verdict/observe/dispose）与 v1.0（首页三态看板 + 与 PPT 完全对齐）待做。

### 可直接规范（术语/笔误，不需要选择）

1. 顶部「回答 2~3 个问题」→ 实际固定 **4 问**（README L6 是过时文案；`v5_decision.py` `QUESTIONS` 就是 4 问）。
2. 层级术语混用：`储物箱 / 收纳盒`（box）→ 统一「储物箱」；`收纳袋`（bag）、`物品`（item）不变。
3. `discard`（决策值）与 `trash`（渠道值）是同一概念的两个词 → 统一语义口径（处置/丢弃）。
4. 两个「AI」拆开命名：「AI 识物」（拍照识别，glm-4v-flash / 演示降级）vs「决策 AI」（六维分析与文案，glm-4-flash / 规则兜底）。

### 需要你确认的语义歧义（编号提问）

1. **项目最终定位**：究竟是「断舍离决策助手」还是「收纳工具」还是两者并存？根 README 与 miniprogram/README 的目标不同，决定 v1.0 首页以「三态看板」还是「收纳」为主。
2. **「是否重复」的含义**：`v5_decision.py` L141 把 `replace_answer`（「有没有别的东西能替代」）的分数直接填进 `duplicate` 维；但「是否重复（已有同类）」与「是否有替代（别的能顶）」不是同一概念。保留一个还是拆两维？
3. **「占用空间」打分方向**：维名叫「占用空间」，直觉上分越高越占地方=越该扔；但 L196 提示词把 space 反转成「分越高越不占地方」。前端 v0.6 展示这维时会读反。定哪个口径？
4. **「四选一」到底指什么**：README 写 v0.4.0 是「四选一」，但 `choose` 实际接受 6 个值（keep/observe/sell/gift/recycle/discard）。前端显示 4 个大类按钮还是 6 个？
5. **「与 PPT 完全对齐」（v1.0.0）**：对齐哪份 PPT？对齐文案、字段名、三态颜色还是数据口径？这是 v1.0 验收的唯一真理源，目前指代不清。

### 代码证据

- `v5_decision.py` L46–84：QUESTIONS 固定 4 问（usage/rebuy/replace/emotion）。
- `v5_decision.py` L137–146：规则打分里 `duplicate`←`replace`、`need`←rebuy*0.6+usage*0.4、`space`=50。
- `v5_decision.py` L116–124：`DECISIONS` 6 键，注释却写「用户四选一」；`discard`→`channel="trash"`。
- `v5_decision.py` L196：AI 提示词「space 分越高表示越不占地方」。
- `README.md` L6「2~3 个问题」 vs L113「固定 4 问」。

## 轮次 1 用户答复

- Q1 项目定位：**断舍离决策助手是主目标**。
- Q4 PPT：`D:\other\WXWork\1688858166665770\Cache\File\2026-11\《舍得》——AI断舍离决策助手(1).pdf`（30 页，已读）。

## PPT 产品定义（对齐依据）

- 主流程：拍照 → AI 识别 → 回答 2~3 个问题 → AI 综合分析 → 建议 → 用户决定（留下 / 观察 / 出售或转赠 / 处理）。
- MVP 只保留：拍照识别 + AI 判断 + 30 天观察 + 简单处理建议。
- 明确「不是」：家庭库存管理 / 全屋收纳规划 / 单纯 AI 识物 / 强迫用户扔东西。

## 当前代码状态（已核）

- `app.json`：tabBar 只有「首页/我的」，导航标题「物品管理」；`packageShede` 四页已存在。
- `home.wxml`：收纳 UI（搜索、统计卡、上限进度、新建箱/袋、箱子列表、箱/袋选择浮层）+ 已塞入一个「舍得三态看板」卡片。
- `question/verdict/observe/dispose`：四页 wxml/js 已实现（不是空壳）。
- `v5_decision.py`：4 问、六维（duplicate←replace、space 中性/反转）、choose 6 值（注释写「四选一」）。

## 修改方案（删 / 增）

### 删（去收纳化，PPT「不是收纳 App」）

1. 首页搜索栏（搜物品/箱/袋）。
2. 首页统计卡（储物箱/收纳袋/物品 三计数）→ 换三态计数。
3. 首页「收纳物品上限」进度条。
4. 首页快速操作里的「新建储物箱 / 新建收纳袋」→ 只留「拍照决策」。
5. 首页箱子列表 + 空状态 + 悬浮添加按钮 + 箱/袋选择浮层。
6. `packageStorage` 的 add-box / add-bag / box-detail / bag-detail（收纳层级管理 UI）。
7. `packageSearch` search-result + 搜索入口（MVP 无搜索）。
8. tabBar「首页/我的」→「决策 / 观察箱 / 我的」；标题「物品管理」→「舍得」。

### 增 / 重做（决策主路径）

1. 首页重做：三态看板（待决策/观察中/已处理 + 到期红点）+「拍照决策」主按钮 + 待决策列表。
2. `question` 四问页：已实现，需对齐 PPT 问题数量与措辞。
3. `verdict` 建议页：已实现，重排「四选一」（留下/观察/出售或转赠/处理 4 大类 + 二级渠道）。
4. `observe` 观察箱：已实现，补「到期未用 → 再判断」闭环。
5. `dispose` 处理建议：已实现，补 recycle 独立入口。
6. `item-detail` 重做为「决策详情」：照片 + AI 结论 + 六维 + 选择按钮。

### 待拍板（会改变 UI 文案/结构）

1. 问题数：PPT 页 14「2~3 个」/ 页 22「3 个」/ 页 17 列 3 问；代码是 4 问（多「情感价值」题）。
2. 「四选一」= 4 大类按钮 + 二级渠道，还是 6 个平铺。
3. space 打分方向（第 1 轮 Q3 未答）+ duplicate/replace（第 1 轮 Q2 未答）。
4. 物品是否还挂「储物箱/收纳袋」（PPT 无此概念，后端 box_id/bag_id 强依赖）。