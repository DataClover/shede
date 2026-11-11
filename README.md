# 舍得 · AI 断舍离决策助手（小程序端）

十二组 · 人工智能通识课作品

拍照识物 → 回答 4 个问题 → 六维评分与建议 → 四选一（留下 / 观察 30 天 / 出售转赠 / 处理）→ 观察箱跟踪。

> 本分支为微信小程序端源码。网页版源码在 `web` 分支。

---

## 一、运行方式

小程序需要后端接口，分两步。

### 第 1 步：启动后端

需要 Python 3.11 或更高版本（[python.org](https://www.python.org/downloads/) 下载，安装时勾选 **Add python.exe to PATH**）。

| 系统 | 操作 |
|---|---|
| Windows | 双击 `一键启动.bat` |
| macOS / Linux | 项目目录执行 `bash 一键启动-mac.command` |

首次运行会自动创建虚拟环境并安装依赖（约 1~3 分钟），看到 `Uvicorn running on http://0.0.0.0:8000` 即成功，窗口不要关。

> 配置 AI：把 `backend/config.ini.example` 复制为 `backend/config.ini`，填写 `zhipu_api_key`。
> 未配置时自动使用规则打分，流程不受影响。该文件已被 .gitignore 忽略，**切勿提交到任何仓库**。

### 第 2 步：打开小程序

1. 微信开发者工具 → 导入项目
2. 目录选 `miniprogram`
3. AppID 选「测试号」
4. `详情 → 本地设置` → 勾选「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」

真机预览时，把 `miniprogram/utils/config.js` 里的 `baseUrl` 改成电脑的局域网 IP，例如 `http://192.168.1.10:8000/`，并确保手机与电脑在同一网络。

## 二、目录结构

```
├─ miniprogram/             微信小程序源码
│  ├─ pages/                决策工作台 / 观察箱 / 我的
│  ├─ packageCamera/        拍照 + AI 识图确认
│  ├─ packageStorage/       决策详情
│  ├─ packageShede/         四问 / 六维建议 / 处理建议
│  └─ utils/                配置与请求封装
├─ backend/                 FastAPI 后端
│  ├─ launch.py             入口
│  ├─ config.ini.example    配置模板
│  └─ v*.py                 用户 / 物品识图 / 决策·观察·处理
├─ 汇报材料/                课堂展示 PPT
├─ 一键启动.bat             Windows 一键启动
├─ 一键启动-mac.command     macOS / Linux 一键启动
└─ 停止服务.bat             Windows 停止服务
```

## 三、常见问题

| 现象 | 处理 |
|---|---|
| 提示未找到 python | 到 python.org 安装 3.12，安装时勾选 Add to PATH |
| 提示 Python 版本过低 | 需要 3.11 或更高 |
| 依赖安装失败 | 检查网络；脚本会自动切换清华镜像重试 |
| 8000 端口被占用 | 运行 `停止服务.bat`，或重启电脑后再试 |
| 小程序报「不在合法域名列表」 | 详情 → 本地设置 → 勾选「不校验合法域名」 |
| 小程序请求超时 | 确认后端已启动；真机预览需把 baseUrl 改为局域网 IP |

## 四、说明

- AI 只提供建议，最终决定权始终在使用者。
- 六维评分口径：分数越高越支持「留下」；「占用空间」分越高表示越不占地方。
- 本作品为课程作业，基于开源底座二次开发，仅用于学习交流。
