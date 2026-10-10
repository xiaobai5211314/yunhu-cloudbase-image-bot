# yunhu-cloudbase-image-bot (云湖生图机器人)

## 1. 项目概述
基于 Node.js / Express 开发的通用生图 API 服务与云湖（Yunhu）聊天机器人 Webhook 服务。
- 核心功能：接收云湖群聊与私聊生图指令，或通过标准 REST API 接收生图请求，调用腾讯云开发 CloudBase 混元生图（`hunyuan-image`）或 OpenAI 兼容 Provider 生成图片并回调发送。
- 技术栈：Node.js、Express、`@cloudbase/node-sdk`、Axios、PM2。

## 2. 项目结构
- `src/server.js`：Express 服务入口（请求体原始解析、中间件与路由挂载）。
- `src/routes/`：
  - `imageApi.js`：开放生图接口路由 (`/api/v1/images/generations`)。
  - `yunhuWebhook.js`：云湖 Webhook 消息接收与事件分发路由 (`/yunhu/webhook`)。
- `src/services/`：
  - `cloudbaseImage.js`：CloudBase 混元生图接入逻辑。
  - `imageService.js`：多 Provider 生图调度与回退服务。
  - `yunhuApi.js`：云湖 Bot 消息发送与图片上传 API 封装。
- `src/providers/`：
  - `cloudbaseProvider.js`：腾讯云开发 SDK 驱动。
  - `openaiProvider.js`：兼容 OpenAI 格式的生图 Provider。
- `ecosystem.config.cjs`：PM2 进程守护配置。
- `package.json`：项目依赖与运行脚本。

## 3. 开发约定
- Node.js 版本要求：Node.js >= 18。
- 敏感配置保护：禁止将含有真实密钥的 `.env` 提交到 Git 仓库，所有私有凭据均通过环境变量注入。
- 错误降级与日志：生图超时或第三方服务异常时需记录结构化日志，并向云湖端回退友好文字提示。

## 4. 核心业务规则
- **CloudBase 初始化规则**：
  - SDK 初始化仅显式传入 `env` 与 `timeout`，`CLOUDBASE_APIKEY` 由 SDK 自动从环境变量读取，禁止在代码中硬编码。
- **云湖 Webhook 消息流契约**：
  - 必须保存 `rawBody` 用于验签与调试回溯。
  - 收到群消息时解析 `@机器人` 或斜杠命令，过滤非指令噪音。
  - 图片上传至云湖接口后再发送图片消息，若配置开启降级且生图失败，回退发送文字错误提示。
- **生图接口契约**：
  - `/api/v1/images/generations` 严格对齐 OpenAI 生图接口入参规范（`prompt`, `model`, `n`, `size`）。

## 5. 构建与运行
- **安装依赖**：
  ```bash
  npm install
  ```
- **本地启动**：
  ```bash
  npm start
  ```
- **生产环境部署（PM2）**：
  ```bash
  pm2 start ecosystem.config.cjs
  pm2 save
  ```

## 6. 测试与验证
- 健康检查：
  ```bash
  curl http://127.0.0.1:8788/health
  ```
  预期返回：`ok`。
- 本地生成接口测试：
  ```bash
  curl -X POST http://127.0.0.1:8788/api/v1/images/generations \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <TOKEN>" \
    -d "{\"prompt\": \"一只可爱的小猫\"}"
  ```

## 7. 修改注意事项
- 严禁擅自修改 `ecosystem.config.cjs` 中的实例名称与启动入口。
- 新增生图 Provider 时，需在 `src/providers/` 继承统一接口，并在 `imageService.js` 注册。

## 8. 相关文档
- [README.md](file:///e:/OneDrive%20-%201301173082@stu.ahcme.edu.cn/OneDrive%20-%20stu.ahcme.edu.cn/%E5%B0%8F%E7%99%BD/%E7%A8%8B%E5%BA%8F/yunhushengtu/README.md)
