const config = require('../config');
const cloudbaseProvider = require('../providers/cloudbaseProvider');
const openaiProvider = require('../providers/openaiProvider');
const volcengineProvider = require('../providers/volcengineProvider');
const customProvider = require('../providers/customProvider');

const providers = {
  [cloudbaseProvider.name]: cloudbaseProvider,
  [openaiProvider.name]: openaiProvider,
  [volcengineProvider.name]: volcengineProvider,
  [customProvider.name]: customProvider
};

function listProviders() {
  return Object.values(providers).map((provider) => ({
    name: provider.name,
    implemented: provider.implemented,
    defaultModel: provider.defaultModel
  }));
}

async function generateImage({
  provider,
  model,
  prompt,
  size,
  n,
  seed,
  options
}) {
  const providerName = provider || config.defaults.imageProvider;
  const selectedProvider = providers[providerName];

  if (!selectedProvider) {
    const err = new Error(`Unsupported image provider: ${providerName}`);
    err.status = 400;
    throw err;
  }

  if (!selectedProvider.implemented) {
    const err = new Error(`Image provider is not implemented: ${providerName}`);
    err.status = 501;
    throw err;
  }

  return selectedProvider.generateImage({
    provider: providerName,
    model: model || selectedProvider.defaultModel || config.defaults.imageModel,
    prompt,
    size: size || config.defaults.imageSize,
    n: n || 1,
    seed,
    options: options || {}
  });
}

module.exports = {
  listProviders,
  generateImage
};
