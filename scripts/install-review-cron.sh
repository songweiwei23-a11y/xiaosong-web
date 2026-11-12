#!/usr/bin/env bash
# 每月 1 号自动复盘的定时任务（2026-11-08 产品方定）。可以重复执行：已经装过的不会重复装。
# 做两件事：
#   1. .env.local 里没有 REVIEW_CRON_SECRET 就生成一个（先备份 .env.local；新加了要重启服务才生效，脚本会提示）
#   2. crontab 加一行：每月 1 号 04:30 跑 scripts/review-cron-tick.sh（先备份 crontab；同一行不会加两遍）
#      这个脚本从 Nginx upstream 片段读当前端口，不把 3000 写进 crontab
# 不打印密钥。
set -euo pipefail
APP=/var/www/xiaosong-web
ENV_FILE="$APP/.env.local"
STAMP=$(date +%Y%m%d)

if ! grep -q '^REVIEW_CRON_SECRET=' "$ENV_FILE"; then
  cp "$ENV_FILE" "$ENV_FILE.bak-review-$STAMP"
  echo "REVIEW_CRON_SECRET=$(openssl rand -hex 24)" >> "$ENV_FILE"
  echo "NEW_SECRET=1（已写入 .env.local。不要 pm2 restart。下一次换端口发布会带上新密钥）"
else
  echo "NEW_SECRET=0（密钥已存在）"
fi

# 定时任务只调用仓库里的脚本。脚本每次从 Nginx upstream 片段读当前端口，
# 和 deploy-reload.sh 写的是同一份文件，切到另一个端口后仍然打得到。
TICK="$APP/scripts/review-cron-tick.sh"
LINE="30 4 1 * * $TICK >> \$HOME/monthly-review.log 2>&1"
crontab -l > "$HOME/crontab.bak-review-$STAMP" 2>/dev/null || true
( crontab -l 2>/dev/null | grep -vE 'monthly-review/tick|review-cron-tick\.sh' || true; echo "$LINE" ) | crontab -
echo "CRON_LINES=$(crontab -l | grep -c 'review-cron-tick.sh')"
