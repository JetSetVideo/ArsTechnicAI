module.exports = {
  apps: [
    {
      name: 'arstechnicai',
      cwd: '/home/jetsetvideo/ArsTechnicAI',
      script: '/home/jetsetvideo/.deno/bin/deno',
      args: 'run -A npm:next@14.2.15 start -p 3002',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        HOME: '/home/jetsetvideo',
        DENO_DIR: '/home/jetsetvideo/.cache/deno',
      },
      restart_delay: 3000,
      max_restarts: 10,
      watch: false,
      autorestart: true,
    },
  ],
};
