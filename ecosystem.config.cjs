module.exports = {
  apps: [
    {
      name: 'arstechnicai',
      // The repository itself — a hard-coded path outlived a move and left PM2
      // "online" in a directory that no longer existed.
      cwd: __dirname,
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
