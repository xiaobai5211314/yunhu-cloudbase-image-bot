# yunhu-cloudbase-image-bot

一个可部署在 Linux 服务器上的通用生图 API 服务。第一版实现 CloudBase `hunyuan-image` provider，并提供云湖 webhook 入口。

## 已确认来源

- CloudBase Node SDK 支持 `app.ai()`、`ai.createImageModel("hunyuan-image")`、`imageModel.generateImage()`，生图示例从 `res.data[0].url` 读取图片 URL。来源：CloudBase 官方文档 <https://docs.cloudbase.net/en/ai/model/nodejs-access>
- `@cloudbase/node-sdk` 初始化可通过环境变量 `CLOUDBASE_APIKEY` 配置服务端 API Key。来源：CloudBase 官方文档 <https://docs.cloudbase.net/api-reference/server/node-sdk/initialization>
- 云湖公开教程可确认发送消息接口能力和 `POST https://chat-go.jwzhd.com/open-apis/v1/bot/send?token=...` 形态。当前代码按 `recvId`、`recvType`、`contentType`、`content` 尝试发送，图片消息 payload 字段仍为待核实。来源：云湖教程 <https://www.yhchat.com/article/10005>

## 目录结构

```text
yunhu-cloudbase-image-bot/
├─ package.json
├─ .env.example
├─ ecosystem.config.cjs
├─ README.md
├─ src/
│  ├─ server.js
│  ├─ routes/
│  │  ├─ imageApi.js
│  │  └─ yunhuWebhook.js
│  ├─ services/
│  │  ├─ cloudbaseImage.js
│  │  ├─ imageService.js
│  │  └─ yunhuApi.js
│  ├─ providers/
│  │  ├─ cloudbaseProvider.js
│  │  ├─ openaiProvider.js
│  │  ├─ volcengineProvider.js
│  │  └─ customProvider.js
│  ├─ utils/
│  │  ├─ logger.js
│  │  └─ parseCommand.js
│  └─ config.js
```

## Linux 部署

```bash
npm install
cp .env.example .env
nano .env
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

服务默认监听 `PORT=8788`。

健康检查：

```bash
curl http://127.0.0.1:8788/health
```

返回：

```text
ok
```

## 环境变量

`.env.example` 只提供占位配置，不要提交真实 `.env`。

```bash
PORT=8788
NODE_ENV=production

CLOUDBASE_ENV_ID=
CLOUDBASE_APIKEY=
CLOUDBASE_IMAGE_PROVIDER=hunyuan-image
CLOUDBASE_IMAGE_MODEL=hunyuan-image-v3.0-v1.0.4

DEFAULT_IMAGE_PROVIDER=cloudbase
DEFAULT_IMAGE_MODEL=hunyuan-image-v3.0-v1.0.4
DEFAULT_IMAGE_SIZE=1024x1024
IMAGE_API_TOKEN=

YUNHU_BOT_TOKEN=
YUNHU_SEND_API=https://chat-go.jwzhd.com/open-apis/v1/bot/send
YUNHU_UPLOAD_IMAGE_API=
YUNHU_WEBHOOK_SECRET=
YUNHU_IMAGE_TRIGGER_MODE=all
YUNHU_REPLY_MODE=image
YUNHU_IMAGE_FALLBACK_TO_TEXT=false
```

## 配置 CloudBase

1. 在 CloudBase 控制台准备环境 ID，写入 `CLOUDBASE_ENV_ID`。
2. 在 CloudBase 控制台准备服务端 API Key，写入 `CLOUDBASE_APIKEY`。
3. 默认 provider 为 `cloudbase`，默认模型为 `hunyuan-image-v3.0-v1.0.4`。

CloudBase SDK 初始化只显式传入 `env` 和 `timeout`，`CLOUDBASE_APIKEY` 由 SDK 从环境变量读取。该行为来源于 CloudBase 官方文档：<https://docs.cloudbase.net/api-reference/server/node-sdk/initialization>

## 开放生图接口

所有 `/api/v1/images/*` 接口需要：

```http
Authorization: Bearer <IMAGE_API_TOKEN>
```

请求：

```bash
curl -X POST http://127.0.0.1:8788/api/v1/images/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_IMAGE_API_TOKEN" \
  -d '{
    "prompt": "一只可爱的猫咪在草地上玩耍",
    "provider": "cloudbase",
    "model": "hunyuan-image-v3.0-v1.0.4",
    "size": "1024x1024",
    "n": 1,
    "seed": 123456,
    "options": {}
  }'
```

成功响应：

```json
{
  "ok": true,
  "provider": "cloudbase",
  "model": "hunyuan-image-v3.0-v1.0.4",
  "imageUrl": "https://...",
  "images": [{ "url": "https://..." }],
  "raw": {}
}
```

Provider 列表：

```bash
curl http://127.0.0.1:8788/api/v1/providers
```

## 配置云湖 webhook

云湖 webhook 地址配置为：

```text
https://你的域名/yunhu/webhook
```

机器人收到用户消息后，云湖事件订阅会把事件 POST 到该地址。专门生图群推荐配置：

```bash
YUNHU_IMAGE_TRIGGER_MODE=all
YUNHU_REPLY_MODE=image
YUNHU_IMAGE_FALLBACK_TO_TEXT=false
```

这种模式下，用户直接在群里发送普通文本即可生图：

```text
一个蓝猫，二次元风格
```

兼容旧命令前缀，带前缀时会去掉前缀后作为 prompt：

```text
/draw 提示词
/画图 提示词
```

触发模式：

- `YUNHU_IMAGE_TRIGGER_MODE=all`：所有普通文本都触发生图，当前默认值。
- `YUNHU_IMAGE_TRIGGER_MODE=prefix`：只有 `/draw` 和 `/画图` 触发生图。

回复模式：

- `YUNHU_REPLY_MODE=image`：直接发送图片消息，当前默认值。
- `YUNHU_REPLY_MODE=text_url`：发送图片 URL 文本，仅用于调试。
- `YUNHU_IMAGE_FALLBACK_TO_TEXT=true`：图片消息发送失败时回退发送 URL 文本。
- `YUNHU_IMAGE_FALLBACK_TO_TEXT=false`：图片消息发送失败时只记录错误日志，不把 URL 发到群里，当前默认值。

`prefix` 模式下，非画图消息会直接返回：

```json
{ "ok": true, "message": "ignored" }
```

当前实现会把 webhook 原始请求体打印到控制台，方便核对云湖实际字段。

## 云湖字段待核实

以下字段当前没有最终权威样例，代码中已用 `TODO / 待核实` 标注，并做了兼容候选路径：

- webhook 中消息文本字段：`event.message.content.text`、`message.content.text`、`content.text`、`text` 等，待核实。
- webhook 中 `recvId/chatId` 字段：`chatId`、`chat.id`、`conversationId`、`recvId`、`targetId`、`groupId`、`sender.id`、`event.chat.id` 等，待核实。
- webhook 中 `userId` 字段：`event.sender.senderId`、`message.senderId`、`userId` 等，待核实。
- 直接发送图片消息的 payload 字段：当前尝试 `recvId`、`recvType`、`contentType: "image"`、`content.imageUrl`，待核实。如果直接发图失败，请查看服务日志中的云湖 API 完整响应体。
- `YUNHU_WEBHOOK_SECRET` 的签名头、签名算法和校验字段，待核实。

## 图片 URL 调试模式

专门生图群默认直接发送图片消息，不再把长 URL 发到群里。`YUNHU_REPLY_MODE=text_url` 仅用于调试链路。云湖图片消息 payload 字段仍待核实，如果直接发图失败，服务会把云湖 API 响应体完整写入日志，方便调整字段。

## 新增 provider

统一接口定义：

```js
async function generateImage({
  provider,
  model,
  prompt,
  size,
  n,
  seed,
  options
})
```

新增 provider 步骤：

1. 在 `src/providers/` 新增或实现 provider 文件，导出 `name`、`implemented`、`defaultModel`、`generateImage()`。
2. 在 `src/services/imageService.js` 的 provider 映射中注册。
3. 保持返回结构统一：`ok`、`provider`、`model`、`imageUrl`、`images`、`raw`。
4. 如果 provider 需要 token 或 API key，只能从环境变量读取，不要写死。

## 本地验证

```bash
npm install
npm start
```

鉴权失败验证：

```bash
curl -X POST http://127.0.0.1:8788/api/v1/images/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'
```

预期返回 401。

云湖 all 模式验证：

```bash
curl -X POST http://127.0.0.1:8788/yunhu/webhook \
  -H "Content-Type: application/json" \
  -d '{"content":{"text":"一个蓝猫，二次元风格"},"chat":{"id":"test-chat"},"sender":{"id":"test-user"}}'
```

默认会尝试生图并发送图片消息。若未配置 CloudBase 或云湖 token，会返回明确错误。若直接图片消息失败，请查看日志中的云湖 API 响应。

云湖 prefix 模式 ignored 验证：

```bash
YUNHU_IMAGE_TRIGGER_MODE=prefix npm start
curl -X POST http://127.0.0.1:8788/yunhu/webhook \
  -H "Content-Type: application/json" \
  -d '{"content":{"text":"hello"},"chat":{"id":"test-chat"}}'
```
