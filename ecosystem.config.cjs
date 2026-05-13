module.exports = {
  apps: [
    {
      name: 'yunhu-cloudbase-image-bot',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      time: true,
      max_memory_restart: '512M'
    }
  ]
};
