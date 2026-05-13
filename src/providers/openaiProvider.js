async function generateImage() {
  // TODO: Implement OpenAI image provider with the same generateImage() contract.
  const err = new Error('openai provider is TODO and not implemented');
  err.status = 501;
  throw err;
}

module.exports = {
  name: 'openai',
  implemented: false,
  defaultModel: undefined,
  generateImage
};
