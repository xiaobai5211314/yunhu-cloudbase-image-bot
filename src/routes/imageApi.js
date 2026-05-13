const express = require('express');
const config = require('../config');
const imageService = require('../services/imageService');
const logger = require('../utils/logger');

const router = express.Router();

function requireImageApiToken(req, res, next) {
  if (!config.imageApiToken) {
    return res.status(500).json({
      ok: false,
      error: 'IMAGE_API_TOKEN is not configured'
    });
  }

  const authHeader = req.headers.authorization || '';
  const expected = `Bearer ${config.imageApiToken}`;

  if (authHeader !== expected) {
    return res.status(401).json({
      ok: false,
      error: 'unauthorized'
    });
  }

  next();
}

router.get('/providers', (req, res) => {
  res.json({
    ok: true,
    providers: imageService.listProviders()
  });
});

router.use('/images', requireImageApiToken);

router.post('/images/generate', async (req, res) => {
  try {
    const body = req.body || {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
      return res.status(400).json({
        ok: false,
        error: 'prompt is required'
      });
    }

    logger.info('Image API generate request received', {
      provider: body.provider || config.defaults.imageProvider,
      model: body.model || config.defaults.imageModel,
      size: body.size || config.defaults.imageSize,
      n: body.n || 1
    });

    const result = await imageService.generateImage({
      provider: body.provider,
      model: body.model,
      prompt,
      size: body.size,
      n: body.n,
      seed: body.seed,
      options: body.options
    });

    res.json(result);
  } catch (err) {
    logger.error('Image API generate failed', {
      message: err.message,
      stack: config.nodeEnv === 'production' ? undefined : err.stack
    });

    res.status(err.status || 500).json({
      ok: false,
      error: 'image_generation_failed',
      detail: err.message
    });
  }
});

module.exports = router;
