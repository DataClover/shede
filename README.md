# 舍得 · AI 断舍离决策助手

十二组 · 人工智能通识课作品

拍照识物 → 回答 4 个问题 → 六维评分与建议 → 四选一（留下 / 观察 30 天 / 出售转赠 / 处理）→ 观察箱跟踪。

---

## 一、最快体验：双击就能看

**双击 `web/index.html`**（用 Chrome / Edge 打开）。

不需要安装 Python，不需要联网，不需要启动任何服务。识物、四问、六维打分、观察箱全部可用，数据保存在本机浏览器里，刷新不丢。

适合老师快速查看作品效果。

## 二、完整功能：真 AI + 后端

需要 Python 3.11 或更高版本（[python.org](https://www.python.org/downloads/) 下载，安装时勾选 **Add python.exe to PATH**）。

| 系统 | 操作 |
|---|---|
| Windows | 双击 `一键启动.bat` |
| macOS / Linux | 项目目录执行 `bash 一键启动-mac.command` |

首次运行会自动创建虚拟环境并安装依赖（约 1~3 分钟），随后浏览器自动打开 <http://localhost:8000>。

此时识物与六维打分调用真 AI 模型；未配置 key 或网络不可用时自动退回规则打分，流程不中断。

> 配置 AI：把 `backend/config.ini.example` 复制为 `backend/config.ini`，填写 `zhipu_api_key`。
> 该文件已被 .gitignore 忽略，不会进入版本库，**切勿提交到任何仓库**。

## 三、目录结构

```
├─ web/                     网页演示版（双击 index.html 即用）
│  ├─ index.html
│  ├─ style.css
│  ├─ app.js                页面与交互逻辑
│  └─ offline.js            本地演示引擎（无后端时接管全部接口）
├─ backend/                 FastAPI 后端（完整功能）
│  ├─ launch.py             入口
│  ├─ config.ini.example    配置模板
│  └─ v*.py                 用户 / 物品识图 / 决策·观察·处理
├─ 汇报材料/                课堂展示 PPT
├─ 一键启动.bat             Windows 一键启动
├─ 一键启动-mac.command     macOS / Linux 一键启动
└─ 停止服务.bat             Windows 停止服务
```

## 四、常见问题

| 现象 | 处理 |
|---|---|
| 双击 index.html 页面空白 | 换 Chrome / Edge 打开，不要用 IE |
| 提示未找到 python | 到 python.org 安装 3.12，安装时勾选 Add to PATH |
| 提示 Python 版本过低 | 需要 3.11 或更高 |
| 依赖安装失败 | 检查网络；脚本会自动切换清华镜像重试 |
| 8000 端口被占用 | 运行 `停止服务.bat`，或重启电脑后再试 |
| 浏览器打开后是 JSON 不是网页 | 请打开 `web/index.html`，而不是后端根路径 |
| 页面提示「演示模式」 | 未连接后端，属正常现象，演示流程完整可用 |

## 五、说明

- AI 只提供建议，最终决定权始终在使用者。
- 六维评分口径：分数越高越支持「留下」；「占用空间」分越高表示越不占地方。
- 本作品为课程作业，基于开源底座二次开发，仅用于学习交流。
