const express = require('express');
const config = require('../config');
const imageService = require('../services/imageService');
const yunhuApi = require('../services/yunhuApi');
const logger = require('../utils/logger');
const { PROMPT_REQUIRED_MESSAGE, parseImagePrompt } = require('../utils/parseCommand');

const router = express.Router();

function normalizeBody(body) {
  if (Buffer.isBuffer(body)) {
    const text = body.toString('utf8');

    try {
      return JSON.parse(text);
    } catch (err) {
      return {
        text
      };
    }
  }

  if (typeof body !== 'string') {
    return body || {};
  }

  try {
    return JSON.parse(body);
  } catch (err) {
    return {
      text: body
    };
  }
}

function getFirstString(payload, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      return current[key];
    }, payload);

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function hasStringAtPath(payload, path) {
  const value = path.split('.').reduce((current, key) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return current[key];
  }, payload);

  return typeof value === 'string' && value.trim();
}

function listPayloadKeys(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value).flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...listPayloadKeys(value[key], path)];
  });
}

function getYunhuRecipientFields(payload) {
  const recvIdPaths = [
    'recvId',
    'targetId',
    'groupId'
  ];

  const recvTypePaths = [
    'recvType'
  ];

  const idField = recvIdPaths.some((path) => hasStringAtPath(payload, path)) ? 'recvId' : 'chatId';
  const typeField = recvTypePaths.some((path) => hasStringAtPath(payload, path)) ? 'recvType' : (idField === 'recvId' ? 'recvType' : 'chatType');

  return {
    idField,
    typeField
  };
}

function extractYunhuMessage(payload) {
  const recipientFields = getYunhuRecipientFields(payload);

  return {
    // TODO / 待核实: 云湖 webhook 最终消息文本字段需用真实请求体确认。
    text: getFirstString(payload, [
      'content.text',
      'message.content.text',
      'message.text',
      'text',
      'content',
      'msg',
      'event.message.content.text',
      'event.message.text'
    ]),
    // TODO / 待核实: 云湖 webhook 最终 chatId 字段需用真实请求体确认。
    chatId: getFirstString(payload, [
      'chatId',
      'chat.id',
      'conversationId',
      'recvId',
      'targetId',
      'groupId',
      'sender.id',
      'event.chat.chatId',
      'event.chat.id',
      'message.chatId',
      'chat.chatId'
    ]),
    // TODO / 待核实: 云湖 webhook 最终 userId 字段需用真实请求体确认。
    userId: getFirstString(payload, [
      'userId',
      'sender.id',
      'user.id',
      'fromUserId',
      'from.id',
      'event.sender.senderId',
      'event.sender.userId',
      'message.senderId',
      'sender.senderId',
      'sender.userId'
    ]),
    recvType: getFirstString(payload, [
      'recvType',
      'chat.type',
      'chat.chatType',
      'event.chat.chatType',
      'message.chatType',
      'chatType'
    ]) || 'group',
    idField: recipientFields.idField,
    typeField: recipientFields.typeField
  };
}

function getImageReference(imageResult) {
  const firstImage = imageResult && Array.isArray(imageResult.images) ? imageResult.images[0] : null;

  return {
    imageUrl: imageResult && (imageResult.imageUrl || imageResult.url) || firstImage && (firstImage.url || firstImage.imageUrl) || '',
    imageKey: imageResult && imageResult.imageKey || firstImage && firstImage.imageKey || ''
  };
}

function buildImageFailureText(imageReference) {
  const reference = imageReference.imageUrl || imageReference.imageKey || '图片已生成，但没有公网可访问链接';
  return `图片生成成功，但图片直发失败：${reference}`;
}

function verifyYunhuWebhook(req) {
  if (!config.yunhu.webhookSecret) {
    return true;
  }

  // TODO / 待核实: 云湖 webhook 签名请求头、签名算法和参与签名字段需以官方最终文档或真实样例为准。
  logger.warn('YUNHU_WEBHOOK_SECRET is configured, but signature verification is still TODO / 待核实.');
  return true;
}

router.post('/webhook', async (req, res) => {
  try {
    const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {}));
    logger.info('Yunhu webhook raw body', {
      rawBody
    });

    if (!verifyYunhuWebhook(req)) {
      return res.status(401).json({
        ok: false,
        error: 'invalid_webhook_signature'
      });
    }

    const payload = normalizeBody(req.body);
    const message = extractYunhuMessage(payload);

    const parsedPrompt = parseImagePrompt(message.text, 'all');

    if (!parsedPrompt.ok && parsedPrompt.error === 'missing_prompt') {
      logger.info('Yunhu prompt is empty', {
        recvId: message.chatId || undefined,
        recvType: message.recvType
      });

      if (message.chatId) {
        try {
          await yunhuApi.sendText({
            recvId: message.chatId,
            recvType: message.recvType,
            idField: message.idField,
            typeField: message.typeField,
            text: PROMPT_REQUIRED_MESSAGE
          });
        } catch (sendErr) {
          logger.error('Yunhu prompt hint message failed', {
            message: sendErr.message,
            yunhuResponse: sendErr.yunhuResponse
          });
        }
      }

      return res.json({
        ok: true,
        message: PROMPT_REQUIRED_MESSAGE
      });
    }

    if (!parsedPrompt.ok) {
      return res.json({
        ok: true,
        message: 'ignored'
      });
    }

    if (!message.chatId) {
      logger.warn('Yunhu webhook missing chatId', {
        availableKeys: listPayloadKeys(payload)
      });

      return res.status(400).json({
        ok: false,
        error: 'missing_chat_id',
        detail: 'Yunhu chatId field is TODO / 待核实. Check webhook raw body in logs.'
      });
    }

    logger.info('Yunhu image prompt received', {
      [message.idField]: message.chatId,
      [message.typeField]: message.recvType,
      userId: message.userId || undefined,
      prompt: parsedPrompt.prompt
    });

    const imageResult = await imageService.generateImage({
      provider: config.defaults.imageProvider,
      model: config.defaults.imageModel,
      prompt: parsedPrompt.prompt,
      size: config.defaults.imageSize,
      n: 1,
      options: {}
    });

    let sendResult = null;
    const imageReference = getImageReference(imageResult);

    if (config.yunhu.replyMode === 'text_url') {
      sendResult = await yunhuApi.sendText({
        recvId: message.chatId,
        recvType: message.recvType,
        idField: message.idField,
        typeField: message.typeField,
        text: imageReference.imageUrl || imageReference.imageKey
      });
    } else {
      try {
        sendResult = await yunhuApi.sendImageMessage({
          recvId: message.chatId,
          recvType: message.recvType,
          idField: message.idField,
          typeField: message.typeField,
          imageUrl: imageReference.imageUrl,
          imageKey: imageReference.imageKey
        });
      } catch (sendErr) {
        logger.error('Yunhu image message failed', {
          message: sendErr.message,
          yunhuResponse: sendErr.yunhuResponse
        });

        sendResult = await yunhuApi.sendText({
          recvId: message.chatId,
          recvType: message.recvType,
          idField: message.idField,
          typeField: message.typeField,
          text: buildImageFailureText(imageReference)
        });
      }
    }

    res.json({
      ok: true,
      imageUrl: imageReference.imageUrl,
      imageKey: imageReference.imageKey || undefined,
      replyMode: config.yunhu.replyMode,
      yunhu: sendResult
    });
  } catch (err) {
    logger.error('Yunhu webhook failed', {
      message: err.message,
      stack: config.nodeEnv === 'production' ? undefined : err.stack
    });

    res.status(err.status || 500).json({
      ok: false,
      error: 'yunhu_webhook_failed',
      detail: err.message
    });
  }
});

module.exports = router;
