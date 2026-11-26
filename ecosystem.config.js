const path = require('node:path');

const deployCwd = process.env.CHAT_BE_CWD;

module.exports = {
  apps: [
    {
      name: 'chat-be',
      cwd: deployCwd || __dirname,
      script: 'dist/server.js',
      interpreter: process.execPath,
      env: {
        NODE_ENV: 'production',
        ...(deployCwd && {
          DOTENV_CONFIG_PATH: path.join(deployCwd, '.env'),
          DOTENV_CONFIG_OVERRIDE: 'true',
        }),
      },
    },
  ],
};
