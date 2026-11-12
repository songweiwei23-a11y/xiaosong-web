#!/bin/sh
set -eu
current=/var/www/xiaosong-web
candidate=/var/www/xiaosong-candidate-title-check-20261008
backup=/var/www/xiaosong-backup-title-check-20261008
failed=/var/www/xiaosong-failed-title-check-20261008
test ! -e "$backup"
test ! -e "$failed"
test "$(cat "$current/.next/BUILD_ID")" = i-_ar1_VNXMmSW7YiCveb
test "$(cat "$candidate/.next/BUILD_ID")" = 5ci4ToAYSLMAgjL97bKQp
cd "$current"
sha256sum -c /tmp/content-repair-first-release_20261008.sha256
cd "$candidate"
sha256sum -c /tmp/content-repair-after_20261008.sha256
pm2 start node_modules/next/dist/bin/next --name xiaosong-title-check-preview --cwd "$candidate" -- start -H 127.0.0.1 -p 3108
ready=0
for attempt in 1 2 3 4 5; do
  if curl -fsS http://127.0.0.1:3108/login -o /tmp/content-repair-postverify-preview-login.html; then ready=1; break; fi
  sleep 2
done
test "$ready" -eq 1
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3108/api/public/ping)" = 204
test "$(curl -s -X POST -H 'Content-Type: application/json' -d '{}' -o /dev/null -w '%{http_code}' http://127.0.0.1:3108/api/dify/stream)" = 401
pm2 delete xiaosong-title-check-preview
swapped=0
rollback() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$swapped" -eq 1 ]; then
    pm2 stop xiaosong-web || true
    if [ -d "$current" ]; then mv "$current" "$failed"; fi
    mv "$backup" "$current"
    pm2 restart xiaosong-web || true
    echo 'POSTVERIFY_RELEASE_FAILED_ROLLED_BACK'
  fi
  exit "$status"
}
trap rollback EXIT
pm2 stop xiaosong-web
mv "$current" "$backup"
swapped=1
mv "$candidate" "$current"
cd "$current"
pm2 restart xiaosong-web
ready=0
for attempt in 1 2 3 4 5; do
  if curl -fsS http://127.0.0.1:3000/login -o /tmp/content-repair-postverify-production-login.html; then ready=1; break; fi
  sleep 2
done
test "$ready" -eq 1
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/public/ping)" = 204
test "$(curl -s -X POST -H 'Content-Type: application/json' -d '{}' -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/dify/stream)" = 401
sha256sum -c /tmp/content-repair-after_20261008.sha256
pm2 save
echo 'POSTVERIFY_RELEASE_OK'
date -u '+%Y-%m-%dT%H:%M:%SZ'
cat .next/BUILD_ID
echo
