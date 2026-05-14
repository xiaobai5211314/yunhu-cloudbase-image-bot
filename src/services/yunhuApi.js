const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

function buildTokenUrl(baseUrl, token) {
  return `${baseUrl}?token=${encodeURIComponent(token)}`;
}

function maskTokenInUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', '***');
    }
    return parsed.toString();
  } catch (err) {
    return String(url).replace(/([?&]token=)[^&]+/i, '$1***');
  }
}

function ensureYunhuConfig() {
  if (!config.yunhu.botToken) {
    const err = new Error('YUNHU_BOT_TOKEN is not configured');
    err.status = 500;
    throw err;
  }
}

function getRecipient({
  recvId,
  recvType,
  chatId,
  chatType,
  idField,
  typeField
}, messageType) {
  const recipientId = recvId || chatId;
  const recipientType = recvType || chatType || 'group';
  const recipientIdField = idField || (chatId && !recvId ? 'chatId' : 'recvId');
  const recipientTypeField = typeField || (chatType && !recvType ? 'chatType' : 'recvType');

  if (!recipientId) {
    const err = new Error(`${recipientIdField} is required for Yunhu ${messageType} message`);
    err.status = 400;
    throw err;
  }

  return {
    recipientId,
    recipientType,
    recipientIdField,
    recipientTypeField
  };
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function ensureYunhuApiSuccess(response) {
  const data = response.data;
  const hasCode = data && Object.prototype.hasOwnProperty.call(data, 'code');
  const hasOk = data && Object.prototype.hasOwnProperty.call(data, 'ok');
  const failedByCode = hasCode && data.code !== 0;
  const failedByOk = hasOk && data.ok !== true;

  if (failedByCode || failedByOk) {
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

async function postYunhuPayload(payload, apiUrl = config.yunhu.sendApi) {
  ensureYunhuConfig();
  const url = buildTokenUrl(apiUrl, config.yunhu.botToken);

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    logger.info('Yunhu API response', {
      url: maskTokenInUrl(url),
      status: response.status,
      data: response.data
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
  chatId,
  chatType,
  idField,
  typeField,
  text
}) {
  const recipient = getRecipient({
    recvId,
    recvType,
    chatId,
    chatType,
    idField,
    typeField
  }, 'text');

  const payload = {
    [recipient.recipientIdField]: recipient.recipientId,
    [recipient.recipientTypeField]: recipient.recipientType,
    contentType: 'text',
    content: {
      text
    }
  };

  logger.info('Sending Yunhu text message', {
    [recipient.recipientIdField]: recipient.recipientId,
    [recipient.recipientTypeField]: recipient.recipientType,
    contentType: payload.contentType
  });

  return postYunhuPayload(payload);
}

async function sendTextMessage({
  chatId,
  chatType,
  recvId,
  recvType,
  idField,
  typeField,
  text
}) {
  return sendText({
    recvId: recvId || chatId,
    recvType: recvType || chatType || 'group',
    idField,
    typeField,
    text
  });
}

function detectBase64Image(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const dataUrlMatch = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1],
      base64: dataUrlMatch[2],
      filename: 'image'
    };
  }

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length > 100) {
    return {
      mimeType: 'image/png',
      base64: value,
      filename: 'image.png'
    };
  }

  return null;
}

function getMimeType(filename) {
  const ext = path.extname(filename || '').toLowerCase();

  if (ext === '.jpg' || ext === '.jpeg') {
    return 'image/jpeg';
  }

  if (ext === '.gif') {
    return 'image/gif';
  }

  if (ext === '.webp') {
    return 'image/webp';
  }

  return 'image/png';
}

function extractImageKey(data) {
  if (!data || typeof data !== 'object') {
    return '';
  }

  return data.imageKey ||
    data.image_key ||
    (data.data && (data.data.imageKey || data.data.image_key || data.data.key)) ||
    (data.result && (data.result.imageKey || data.result.image_key || data.result.key)) ||
    '';
}

async function uploadImage({
  imageUrl,
  imageBuffer,
  filename
}) {
  ensureYunhuConfig();

  let buffer = imageBuffer;
  let uploadFilename = filename || 'image.png';
  let mimeType = getMimeType(uploadFilename);
  let sourceType = 'buffer';

  if (!buffer && imageUrl) {
    const base64Image = detectBase64Image(imageUrl);

    if (base64Image) {
      buffer = Buffer.from(base64Image.base64.replace(/\s/g, ''), 'base64');
      uploadFilename = filename || base64Image.filename;
      mimeType = base64Image.mimeType;
      sourceType = 'base64';
    } else if (!isHttpUrl(imageUrl) && fs.existsSync(imageUrl)) {
      buffer = fs.readFileSync(imageUrl);
      uploadFilename = filename || path.basename(imageUrl);
      mimeType = getMimeType(uploadFilename);
      sourceType = 'local_path';
    }
  }

  if (!buffer) {
    const err = new Error('Yunhu uploadImage() requires a local image path, base64 image, or imageBuffer for non-http image results.');
    err.status = 400;
    throw err;
  }

  const form = new FormData();
  form.append('image', new Blob([buffer], {
    type: mimeType
  }), uploadFilename);

  const url = buildTokenUrl(config.yunhu.uploadImageApi, config.yunhu.botToken);

  logger.info('Uploading image to Yunhu', {
    url: maskTokenInUrl(url),
    sourceType,
    fieldName: 'image',
    filename: uploadFilename,
    mimeType
  });

  const response = await axios.post(url, form, {
    timeout: 60000
  });

  logger.info('Yunhu image upload response', {
    url: maskTokenInUrl(url),
    status: response.status,
    data: response.data
  });

  ensureYunhuApiSuccess(response);

  const imageKey = extractImageKey(response.data);

  if (!imageKey) {
    const err = new Error('Yunhu image upload response did not include imageKey');
    err.status = 502;
    err.yunhuResponse = response.data;
    throw err;
  }

  return {
    ok: true,
    status: response.status,
    imageKey,
    data: response.data
  };
}

async function sendImageMessage({
  recvId,
  recvType = 'group',
  chatId,
  chatType,
  idField,
  typeField,
  imageUrl,
  imageKey
}) {
  const recipient = getRecipient({
    recvId,
    recvType,
    chatId,
    chatType,
    idField,
    typeField
  }, 'image');

  if (!imageUrl && !imageKey) {
    const err = new Error('imageUrl or imageKey is required for Yunhu image message');
    err.status = 400;
    throw err;
  }

  let finalImageKey = imageKey;
  const finalImageUrl = imageUrl;
  const hasHttpImageUrl = isHttpUrl(finalImageUrl);
  let uploadedToYunhu = false;

  if (!finalImageKey && finalImageUrl) {
    let uploadInput = {
      imageUrl: finalImageUrl,
      filename: 'generated.png'
    };

    if (hasHttpImageUrl) {
      logger.info('Downloading image before Yunhu upload', {
        imageUrlIsHttp: true,
        filename: uploadInput.filename
      });

      const imageResponse = await axios.get(finalImageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });

      uploadInput = {
        imageBuffer: Buffer.from(imageResponse.data),
        filename: 'generated.png'
      };
    }

    const uploadResult = await uploadImage(uploadInput);
    finalImageKey = uploadResult.imageKey;
    uploadedToYunhu = true;
  }

  const payload = {
    [recipient.recipientIdField]: recipient.recipientId,
    [recipient.recipientTypeField]: recipient.recipientType,
    contentType: 'image',
    content: finalImageKey ? {
      imageKey: finalImageKey
    } : {
      imageUrl: finalImageUrl
    }
  };

  logger.info('Sending Yunhu image message', {
    [recipient.recipientIdField]: recipient.recipientId,
    [recipient.recipientTypeField]: recipient.recipientType,
    contentType: payload.contentType,
    imageUrlIsHttp: hasHttpImageUrl,
    hasImageKey: Boolean(finalImageKey),
    uploadedToYunhu
  });

  return postYunhuPayload(payload);
}

module.exports = {
  sendText,
  sendTextMessage,
  uploadImage,
  sendImageMessage,
  isHttpUrl,
  maskTokenInUrl
};
