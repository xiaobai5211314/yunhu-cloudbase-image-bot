const tcb = require('@cloudbase/node-sdk');
const config = require('../config');
const logger = require('../utils/logger');

let app;
let imageModel;

function getImageModel() {
  if (!config.cloudbase.envId) {
    const err = new Error('CLOUDBASE_ENV_ID is not configured');
    err.status = 500;
    throw err;
  }

  if (!app) {
    logger.info('Initializing CloudBase SDK', {
      envId: config.cloudbase.envId,
      timeout: config.cloudbase.timeout
    });

    app = tcb.init({
      env: config.cloudbase.envId,
      timeout: config.cloudbase.timeout
    });
  }

  if (!imageModel) {
    const ai = app.ai();
    imageModel = ai.createImageModel(config.cloudbase.imageProvider);
  }

  return imageModel;
}

async function generateImage({
  model,
  prompt,
  size,
  n,
  seed,
  options
}) {
  const selectedModel = model || config.cloudbase.imageModel;
  const imageCount = Number(n || 1);
  const request = {
    model: selectedModel,
    prompt,
    size: size || config.defaults.imageSize,
    ...options
  };

  if (Number.isInteger(imageCount) && imageCount > 0) {
    request.n = imageCount;
  }

  if (seed !== undefined && seed !== null && seed !== '') {
    request.seed = Number(seed);
  }

  logger.info('Calling CloudBase image generation', {
    provider: 'cloudbase',
    cloudbaseImageProvider: config.cloudbase.imageProvider,
    model: request.model,
    size: request.size,
    n: request.n || 1,
    hasSeed: request.seed !== undefined
  });

  const modelClient = getImageModel();
  const res = await modelClient.generateImage(request);
  const imageUrl = res && res.data && res.data[0] && res.data[0].url;

  if (!imageUrl) {
    const err = new Error('CloudBase response did not include res.data[0].url');
    err.status = 502;
    err.raw = res;
    throw err;
  }

  return {
    ok: true,
    provider: 'cloudbase',
    model: selectedModel,
    imageUrl,
    images: res.data.map((item) => ({
      url: item.url
    })),
    raw: res
  };
}

module.exports = {
  generateImage
};
