#!/bin/bash
# 读当前对外端口。
# 来源是 Nginx upstream 片段，和 scripts/deploy-reload.sh 写入的是同一份文件。
set -euo pipefail

UPSTREAM_FILE="${UPSTREAM_FILE:-/etc/nginx/snippets/xiaosong-upstream.conf}"
if [ ! -f "$UPSTREAM_FILE" ]; then
  echo "没有活动端口文件：$UPSTREAM_FILE" >&2
  exit 1
fi
port=$(sed -nE 's/^[[:space:]]*server[[:space:]]+127\.0\.0\.1:([0-9]+);[[:space:]]*$/\1/p' "$UPSTREAM_FILE" | head -n 1)
if [ -z "$port" ]; then
  echo "活动端口文件里没有 127.0.0.1 端口：$UPSTREAM_FILE" >&2
  exit 1
fi
printf '%s\n' "$port"
