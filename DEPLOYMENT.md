# 开物现网部署（腾讯云 + PM2）

现网是一台腾讯云虚拟机上的 **PM2 fork 单进程**，不是 Vercel。发布用仓库根目录的 `同步到服务器.ps1`（`一键部署.ps1` 会先做本地检查再调用它）。本文只写变量名和占位符，不要把真实密钥写回仓库。

## 环境变量

在服务器项目目录的环境里配置（不要写进 Git）：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的匿名密钥
SUPABASE_SERVICE_ROLE_KEY=你的服务角色密钥
DIFY_API_KEY=app-xxxxxxxx
DIFY_BASE_URL=https://api.dify.ai/v1
NEXT_PUBLIC_APP_NAME=小宋编导工作台
NEXT_PUBLIC_APP_URL=https://你的域名
```

代码读的是 `DIFY_BASE_URL`。写成 `DIFY_API_URL` 不会生效。

仓库历史里曾经出现过明文 `DIFY_API_KEY` 和服务角色密钥。改文档删不掉历史，上线前要在 Dify 和 Supabase 里作废旧密钥，服务器只保留新值。作废和更换必须人工做，本仓库的改动不会连上控制台。

## 为什么不用 cluster

`lib/creation-window-lock.ts` 把同一档案的创作窗口放在**进程内存**里。生产注释写明应用是单进程。若 `exec_mode: 'cluster'` 或 `instances` 大于 1，每个进程各有一把锁，同一档案可以并行开两轮创作，锁不再正确。

因此：

- `ecosystem.config.cjs` 固定 `exec_mode: 'fork'`、`instances: 1`。
- **不要**设 `instances: 'max'`，也不要为了零停机把 instances 固定成 2。这台机器物理内存 2G，常驻两个 `next start` 会把内存打满。
- `wait_ready` 保持关闭。`next start` 不会 `process.send('ready')`，打开后 `pm2 reload` 会空等到 `listen_timeout` 再误判失败。

发布时的空窗用换端口解决，不靠多进程常驻。切换过程中会短暂存在两个进程（见下文「剩余空窗」），稳态仍然只有一个，锁恢复有效。

## 一次性：Nginx 指到 upstream 片段

脚本只改 `/etc/nginx/snippets/xiaosong-upstream.conf`，不改 Nginx 主配置。第一次上这套切换之前，由人工把反代改成 include 这个文件，并确认 `ubuntu` 对 `nginx -t`、`nginx -T`、`nginx -s reload` 和写这个文件有免密 sudo（脚本用 `sudo -n`，要密码就会失败并停在旧进程上）。

```nginx
upstream xiaosong_backend {
    include /etc/nginx/snippets/xiaosong-upstream.conf;
}

server {
    # 原有的 server_name、证书照旧
    location / {
        proxy_pass http://xiaosong_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

片段当前内容应是正在服务的端口，一般是：

```
server 127.0.0.1:3000;
```

改完执行 `sudo nginx -t && sudo nginx -s reload`。这一次 reload 不换端口，不应出现 502。`sudo nginx -T` 里要能看到 `xiaosong-upstream.conf`。没做这一步时，发布脚本会拒绝启动第二个进程。

如果机器上还没有用 ecosystem 启动的进程，人工切一次（这一次会有短暂停顿，因为要换掉现在的 `pm2 start npm -- start`）：

```bash
cd /var/www/xiaosong-web
pm2 delete xiaosong-web
PORT=3000 PM2_APP_NAME=xiaosong-web APP_CWD=/var/www/xiaosong-web pm2 start ecosystem.config.cjs
pm2 save
```

确认 `curl -sS http://127.0.0.1:3000/api/health` 返回 HTTP 200，正文里有 `"ok":true`。这次是人工起的进程，`boot` 为空。之后的发布都走脚本，脚本会检查 `boot` 和 `pid`。

## 每次发布

改环境变量也走这一套：新进程会带上当前环境。不要对线上进程直接 `pm2 restart`，那会回到单进程空窗。

1. 找到唯一在线的 `xiaosong-web` 或 `xiaosong-web-next`，工作目录必须是部署目录。
2. 确认 Nginx 已经引用 upstream 片段。
3. `MemAvailable` 低于约 500MB 时**不起**第二个进程，旧进程继续服务，脚本非零退出。
4. 先清掉上次留下的暂存进程名，再确认另一个端口（3000 和 3001 对调）没有在听。被占用就不起新进程，旧进程继续服务。
5. 用 ecosystem 在新端口起新进程。fork、单实例。这次启动带一个新的 `KAIWU_BOOT_ID`。
6. 对本机 `http://127.0.0.1:<新端口>/api/health` 重试约 2 分钟。要 HTTP 200、`"ok":true`，并且 `boot`、`pid` 对得上这次拉起的进程（会读数据库）。对不上就当失败：可能探到的是还在服务的旧进程，不能拿它当新进程。首页 200 不算成功。
7. 没通过：`pm2 delete` 只删新进程，不改 Nginx，不重启旧进程，退出码非 0。
8. 通过：改 upstream、`nginx -t`、`nginx reload`，再确认配置里是新端口，并再探一次 `/api/health`。任一步失败都把 upstream 改回去并删掉新进程，旧进程继续服务，退出码非 0。
9. 切流后再等 90 秒，让还挂在旧进程上的流式生成跑完。等完再探一次。仍对得上，才停掉旧进程，`pm2 save`，输出 `SWITCH_OK`。等的过程中新进程不健康，就把流量改回旧端口并删掉新进程。

失败之后**不要**对旧进程 `pm2 restart`。构建已经覆盖了磁盘上的 `.next`，restart 会让还在内存里的旧代码换成一份没通过健康检查的新构建。

## 剩余空窗

新请求在 Nginx 切走之前一直打到旧进程，不再出现「旧进程已死、新进程还没 listen」那种 502。下面几段仍然存在：

- Nginx reload 之后，新请求进新端口，已经连在旧进程上的流式生成还留在旧进程。两边的创作窗口锁互不相通。这段现在大约 90 秒（切流后故意不立刻停旧进程），停掉旧进程后只剩一把锁。
- 90 秒结束后才 `pm2 delete` 旧进程。删除时新进程的 `kill_timeout` 是 20 秒，旧进程若是这次脚本拉起的，也有同样的等待。**第一次**从旧的 `pm2 start npm` 切过来时，那个旧进程没有这个等待；90 秒的停留仍然留给已经开始的生成，到点后删除会马上发停止信号。
- 这 90 秒里两个 `next start` 同时占内存。2G 机器上，第二个进程起来之后仍可能把机器打满。脚本只在启动前看 `MemAvailable`，挡不住启动后的峰值，也挡不住这 90 秒的重叠。不要在生成高峰发布。内存不够时脚本会放弃，网站继续跑旧版本。
- 第一次改 Nginx 主配置那一下，要人工 reload。端口不变。

## 回滚

健康检查或 Nginx 检查失败时，脚本已经把流量留在（或改回）旧进程，一般不用再操作。确认 `pm2 status` 里旧名字仍是 online，然后看脚本打印的原因。不要 restart 它。

已经打印 `SWITCH_OK`、事后发现新版本有问题：

1. 磁盘上的 `.next` 已是新构建，把 upstream 改回旧端口**不能**找回旧代码，除非旧进程还没被删掉。脚本在健康检查通过后会删掉旧进程。
2. 把上一版代码放到部署目录，再跑一遍 `同步到服务器.ps1`。它会在另一个端口构建并启动，`/api/health` 通过后才切 Nginx。
3. 若新进程健康但 `pm2 delete` 旧进程失败，脚本会非零退出，两个进程会同时占内存。流量已经在新端口。手动 `pm2 delete <旧名字>`，名字在脚本输出里。

上一份 upstream 会抄在部署目录的 `.deploy-upstream.prev`（不在会被 prune 的子目录里）。那只是端口记录，不是旧代码。

日志：构建在 `/tmp/build.log`，进程用 `pm2 logs`。就绪看 `/api/health` 的 `ok`、`boot` 和 `pid`，不要用首页状态码。

## 上线检查单

换端口第一次生效前，在服务器上核对下面几项。不要把真实密钥写进仓库。

- **小助理的本机地址。** 代码读 `ASSISTANT_INTERNAL_URL`。留空时，进程用自己的 `PORT` 调自己，切到 3000 或 3001 都打得到。如果这个变量写成了 `http://127.0.0.1:3000` 或 `:3001`，代码会把端口改成当前进程的 `PORT`，避免切走之后打到已经停掉的端口。想固定走 Nginx 时，写成不带 3000/3001 的本机入口 `http://127.0.0.1`（Nginx 在 80 上，并且这个地址能进到本站）。上线前在服务器执行 `grep '^ASSISTANT_INTERNAL_URL=' .env.local`：应当没有这一行，或者是 Nginx 入口，不能是一个写死的应用端口。
- **月度复盘定时任务。** 重新执行 `bash scripts/install-review-cron.sh`。它会换掉 crontab 里旧的 `monthly-review/tick` 行。新行只调用 `scripts/review-cron-tick.sh`。这个脚本每次用 `scripts/active-port.sh` 读 `/etc/nginx/snippets/xiaosong-upstream.conf`，和发布脚本写入的是同一份文件。`crontab -l` 里不应再出现 `127.0.0.1:3000`。新写入的 `REVIEW_CRON_SECRET` 不要靠 `pm2 restart` 加载，下一次换端口发布会带上。
- **其他本机调用。** 告警接口 `/api/admin/alerts/tick` 如果已经写进 crontab，同样改成先跑 `scripts/active-port.sh` 再请求 `http://127.0.0.1:<端口>/...`，不要写死 `:3000`。公网探测 `scripts/health-probe.sh` 走的是站点域名，不经过应用端口，不用改。仓库里的 `localhost:3000` 出现在本地开发文档、浏览器插件和测试夹具里，不是线上内部调用。
- **发布脚本本身。** 新端口被占用时不会启动第二个进程。`/api/health` 必须返回这次的 `boot` 和 `pid`，对不上就不改 Nginx、不删正在服务的进程。切流后等 90 秒再删旧进程。这 90 秒两个进程同时在，创作窗口锁互不相通，2G 内存要避开生成高峰。
