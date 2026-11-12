#!/bin/bash
# 每月复盘的实际请求。端口在运行时从 Nginx upstream 片段读取，不写死。
# 由 scripts/install-review-cron.sh 放进 crontab。密钥只放在请求头里，不写日志。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="${APP_DIR:-/var/www/xiaosong-web}"
ENV_FILE="${ENV_FILE:-$APP/.env.local}"
CURL="${CURL:-curl}"

PORT="$("$ROOT/active-port.sh")"
SECRET="$(grep '^REVIEW_CRON_SECRET=' "$ENV_FILE" | head -n 1 | cut -d= -f2- || true)"
if [ -z "$SECRET" ]; then
  echo "没有 REVIEW_CRON_SECRET，未调用复盘接口" >&2
  exit 1
fi
"$CURL" -sS -m 30 -X POST -H "x-cron-secret: ${SECRET}" "http://127.0.0.1:${PORT}/api/admin/monthly-review/tick"
