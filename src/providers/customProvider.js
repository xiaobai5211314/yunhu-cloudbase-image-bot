async function generateImage() {
  // TODO: Implement custom image provider with the same generateImage() contract.
  const err = new Error('custom provider is TODO and not implemented');
  err.status = 501;
  throw err;
}

module.exports = {
  name: 'custom',
  implemented: false,
  defaultModel: undefined,
  generateImage
};
