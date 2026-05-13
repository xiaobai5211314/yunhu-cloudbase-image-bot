const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

function buildTokenUrl(baseUrl, token) {
  return `${baseUrl}?token=${encodeURIComponent(token)}`;
}

function ensureYunhuConfig() {
  if (!config.yunhu.botToken) {
    const err = new Error('YUNHU_BOT_TOKEN is not configured');
    err.status = 500;
    throw err;
  }
}

function assertRecvId(recvId, type) {
  if (!recvId) {
    const err = new Error(`recvId is required for Yunhu ${type} message`);
    err.status = 400;
    throw err;
  }
}

function ensureYunhuApiSuccess(response) {
  const data = response.data;

  // TODO / 待核实: 云湖成功响应 code 取值需用真实接口响应确认。当前把明确非 0/200 的 code 视为业务错误。
  if (data && typeof data.code === 'number' && data.code !== 0 && data.code !== 200) {
    logger.error('Yunhu API returned error response', {
      status: response.status,
      data
    });

    const err = new Error(`Yunhu API error: ${data.msg || data.message || data.code}`);
    err.status = 502;
    err.yunhuResponse = data;
    throw err;
  }
}

async function postYunhuPayload(payload) {
  ensureYunhuConfig();
  const url = buildTokenUrl(config.yunhu.sendApi, config.yunhu.botToken);

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    ensureYunhuApiSuccess(response);

    return {
      ok: true,
      status: response.status,
      data: response.data
    };
  } catch (err) {
    if (err.response) {
      logger.error('Yunhu API HTTP error response', {
        status: err.response.status,
        data: err.response.data
      });
    }

    throw err;
  }
}

async function sendText({
  recvId,
  recvType = 'group',
  text
}) {
  assertRecvId(recvId, 'text');

  const payload = {
    recvId,
    recvType,
    contentType: 'text',
    content: {
      text
    }
  };

  logger.info('Sending Yunhu text message', {
    recvId,
    recvType,
    contentType: payload.contentType
  });

  return postYunhuPayload(payload);
}

async function sendTextMessage({
  chatId,
  chatType,
  recvId,
  recvType,
  text
}) {
  return sendText({
    recvId: recvId || chatId,
    recvType: recvType || chatType || 'group',
    text
  });
}

async function uploadImage({
  imageUrl,
  imageBuffer,
  filename
}) {
  // TODO / 待核实: 云湖上传图片接口 URL、鉴权方式、字段名和文件表单字段需以官方最终文档或真实样例为准。
  throw new Error('Yunhu uploadImage() is reserved but not implemented. Payload fields are TODO / 待核实.');
}

async function sendImageMessage({
  recvId,
  recvType = 'group',
  imageUrl
}) {
  assertRecvId(recvId, 'image');

  if (!imageUrl) {
    const err = new Error('imageUrl is required for Yunhu image message');
    err.status = 400;
    throw err;
  }

  // TODO / 待核实: 云湖图片消息 payload 字段需以官方最终文档或真实接口响应为准。
  const payload = {
    recvId,
    recvType,
    contentType: 'image',
    content: {
      imageUrl
    }
  };

  logger.info('Sending Yunhu image message', {
    recvId,
    recvType,
    contentType: payload.contentType
  });

  return postYunhuPayload(payload);
}

module.exports = {
  sendText,
  sendTextMessage,
  uploadImage,
  sendImageMessage
};
