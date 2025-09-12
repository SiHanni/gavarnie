module.exports = {
  apps: [
    {
      name: 'catarie-api',
      cwd: '/home/ec2-user/catarie/gavarnie/apps/api',
      script: '/home/ec2-user/catarie/gavarnie/apps/api/start-api.sh',
      interpreter: 'bash',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 10,
      time: true,
      out_file: '/home/ec2-user/.pm2/logs/catarie-api-out.log',
      error_file: '/home/ec2-user/.pm2/logs/catarie-api-error.log',
    },
  ],
};
