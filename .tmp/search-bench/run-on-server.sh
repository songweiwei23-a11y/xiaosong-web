#!/usr/bin/env bash
# 在服务器上跑联网基准评测（不改线上文件、不改配置、不调 Dify）。后台跑，结果写到 out/<label>.json，日志在 out/<label>.log
# 用法：bash run-on-server.sh <label> [1=用 overlay 里本地改过的模块] [第二引擎，如 zhipu 或 bocha 或 zhipu,bocha]
set -euo pipefail
cd /var/www/xiaosong-web
mkdir -p .tmp/search-bench/out
LABEL="${1:-run}"
BENCH_LABEL="$LABEL" BENCH_OVERLAY="${2:-0}" BENCH_ENGINES="${3:-}" nohup npx vitest run -c .tmp/search-bench/vitest.config.ts > ".tmp/search-bench/out/$LABEL.log" 2>&1 &
echo "started $LABEL"
