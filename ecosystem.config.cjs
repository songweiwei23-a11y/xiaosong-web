/**
 * 开物生产进程：fork、单实例。
 *
 * 不要改成 cluster，也不要把 instances 设成 "max" 或 2。
 * lib/creation-window-lock.ts 的创作窗口锁只活在当前进程内存里，
 * 常驻两个进程会各自放行同一档案，锁等于没有。
 * 这台机器物理内存 2G，常驻两个 next start 也容易把机器打满。
 *
 * 发布时的零停机不靠多进程常驻，靠 scripts/deploy-reload.sh 换端口：
 * 新进程先在另一个端口接受 /api/health，通过后才改 Nginx。
 *
 * wait_ready 保持关闭。next start 不会 process.send('ready')，
 * 打开的话 pm2 reload 会空等 listen_timeout，再误判启动失败。
 * listen_timeout 只是误用 reload 时的等待上限，当前发布脚本不用它做切换。
 */
const port = String(process.env.PORT || '3000');
const name = process.env.PM2_APP_NAME || 'xiaosong-web';

module.exports = {
  apps: [
    {
      name,
      cwd: process.env.APP_CWD || '/var/www/xiaosong-web',
      script: 'node_modules/next/dist/bin/next',
      args: `start -H 127.0.0.1 -p ${port}`,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      kill_timeout: 20000,
      listen_timeout: 120000,
      env: {
        NODE_ENV: 'production',
        PORT: port,
      },
    },
  ],
};
