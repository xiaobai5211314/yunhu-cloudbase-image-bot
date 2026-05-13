const express = require('express');
const config = require('./config');
const logger = require('./utils/logger');
const imageApiRouter = require('./routes/imageApi');
const yunhuWebhookRouter = require('./routes/yunhuWebhook');

const app = express();

function rawBodySaver(req, res, buf) {
  if (buf && buf.length) {
    req.rawBody = buf.toString('utf8');
  }
}

app.get('/health', (req, res) => {
  res.type('text/plain').send('ok');
});

app.use('/yunhu', express.raw({
  type: '*/*',
  limit: '2mb',
  verify: rawBodySaver
}), yunhuWebhookRouter);

app.use(express.json({
  limit: '2mb',
  verify: rawBodySaver
}));

app.use(express.text({
  type: 'text/plain',
  limit: '2mb',
  verify: rawBodySaver
}));

app.use('/api/v1', imageApiRouter);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'not_found'
  });
});

app.use((err, req, res, next) => {
  if (req.path === '/yunhu/webhook') {
    logger.info('Yunhu webhook raw body', {
      rawBody: req.rawBody || ''
    });
  }

  logger.error('Unhandled request error', {
    message: err.message,
    stack: config.nodeEnv === 'production' ? undefined : err.stack
  });

  res.status(err.status || 500).json({
    ok: false,
    error: err.message || 'internal_server_error'
  });
});

app.listen(config.port, () => {
  logger.info('Server started', {
    port: config.port,
    nodeEnv: config.nodeEnv
  });
});
