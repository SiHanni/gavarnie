module.exports = {
  apps: [
    {
      name: 'catarie-worker',
      cwd: '/home/ssm-user/catarie/gavarnie/apps/worker',
      script: '/home/ssm-user/catarie/gavarnie/apps/worker/start-worker.sh',
      interpreter: 'bash',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 10,
      time: true,
      out_file: '/home/ssm-user/.pm2/logs/catarie-worker-out.log',
      error_file: '/home/ssm-user/.pm2/logs/catarie-worker-error.log',
    },
  ],
};
