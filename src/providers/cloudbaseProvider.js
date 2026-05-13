const config = require('../config');
const cloudbaseImage = require('../services/cloudbaseImage');

async function generateImage({
  model,
  prompt,
  size,
  n,
  seed,
  options
}) {
  return cloudbaseImage.generateImage({
    model: model || config.cloudbase.imageModel,
    prompt,
    size,
    n,
    seed,
    options
  });
}

module.exports = {
  name: 'cloudbase',
  implemented: true,
  defaultModel: config.cloudbase.imageModel,
  generateImage
};
