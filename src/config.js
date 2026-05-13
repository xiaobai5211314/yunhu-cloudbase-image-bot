require('dotenv').config();

const config = {
  port: Number(process.env.PORT || 8788),
  nodeEnv: process.env.NODE_ENV || 'development',
  imageApiToken: process.env.IMAGE_API_TOKEN || '',
  defaults: {
    imageProvider: process.env.DEFAULT_IMAGE_PROVIDER || 'cloudbase',
    imageModel: process.env.DEFAULT_IMAGE_MODEL || 'hunyuan-image-v3.0-v1.0.4',
    imageSize: process.env.DEFAULT_IMAGE_SIZE || '1024x1024'
  },
  cloudbase: {
    envId: process.env.CLOUDBASE_ENV_ID || '',
    imageProvider: process.env.CLOUDBASE_IMAGE_PROVIDER || 'hunyuan-image',
    imageModel: process.env.CLOUDBASE_IMAGE_MODEL || 'hunyuan-image-v3.0-v1.0.4',
    timeout: Number(process.env.CLOUDBASE_TIMEOUT || 60000)
  },
  yunhu: {
    botToken: process.env.YUNHU_BOT_TOKEN || '',
    sendApi: process.env.YUNHU_SEND_API || 'https://chat-go.jwzhd.com/open-apis/v1/bot/send',
    uploadImageApi: process.env.YUNHU_UPLOAD_IMAGE_API || '',
    webhookSecret: process.env.YUNHU_WEBHOOK_SECRET || '',
    imageTriggerMode: process.env.YUNHU_IMAGE_TRIGGER_MODE || 'all',
    replyMode: process.env.YUNHU_REPLY_MODE || 'image',
    imageFallbackToText: String(process.env.YUNHU_IMAGE_FALLBACK_TO_TEXT || 'false').toLowerCase() === 'true'
  }
};

module.exports = config;
