async function generateImage() {
  // TODO: Implement Volcengine image provider with the same generateImage() contract.
  const err = new Error('volcengine provider is TODO and not implemented');
  err.status = 501;
  throw err;
}

module.exports = {
  name: 'volcengine',
  implemented: false,
  defaultModel: undefined,
  generateImage
};
