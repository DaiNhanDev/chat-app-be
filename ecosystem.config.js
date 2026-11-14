module.exports = {
  apps: [
    {
      name: 'chat-be',
      script: 'dist/server.js',
      interpreter: process.execPath,
      env: { NODE_ENV: 'production' },
    },
  ],
};
