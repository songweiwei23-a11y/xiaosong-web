#!/usr/bin/env bash
set -euo pipefail
live=/var/www/xiaosong-web
stage=/var/www/xiaosong-stage-20261008_review_regression
backup=/var/www/xiaosong-backup-20261008_review_regression
test -d "$live"
test -s "$stage/.next/BUILD_ID"
test ! -e "$backup"
switched=0
rollback() {
  rc=$?
  trap - ERR
  if [ "$switched" = 1 ]; then
    pm2 stop xiaosong-web || true
    if [ -d "$live" ]; then mv "$live" "$stage.failed"; fi
    mv "$backup" "$live"
    cd "$live"
    pm2 restart xiaosong-web --update-env || true
    printf 'DEPLOY_FAILED_ROLLED_BACK\n'
  fi
  exit "$rc"
}
trap rollback ERR
pm2 stop xiaosong-web
mv "$live" "$backup"
switched=1
mv "$stage" "$live"
cd "$live"
pm2 restart xiaosong-web --update-env
healthy=0
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3000/login >/dev/null; then healthy=1; break; fi
  sleep 2
done
test "$healthy" = 1
pm2 save
trap - ERR
printf 'DEPLOY_OK\n'
cat .next/BUILD_ID
