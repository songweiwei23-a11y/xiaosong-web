#!/bin/sh
set -eu
current=/var/www/xiaosong-web
candidate=/var/www/xiaosong-candidate-content-repair-20261008
backup=/var/www/xiaosong-backup-content-repair-20261008
failed=/var/www/xiaosong-failed-content-repair-20261008
test ! -e "$backup"
test ! -e "$failed"
test "$(cat "$current/.next/BUILD_ID")" = VF2jcy8WLgiU0KsNJIvez
test "$(cat "$candidate/.next/BUILD_ID")" = i-_ar1_VNXMmSW7YiCveb
cd "$current"
sha256sum -c /tmp/content-repair-before_20261008.sha256
cd "$candidate"
sha256sum -c /tmp/content-repair-after_20261008.sha256
pm2 delete xiaosong-content-repair-preview
swapped=0
rollback() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$swapped" -eq 1 ]; then
    pm2 stop xiaosong-web || true
    if [ -d "$current" ]; then mv "$current" "$failed"; fi
    mv "$backup" "$current"
    pm2 restart xiaosong-web || true
    echo 'RELEASE_FAILED_ROLLED_BACK'
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
  if curl -fsS http://127.0.0.1:3000/login -o /tmp/content-repair-production-login.html; then ready=1; break; fi
  sleep 2
done
test "$ready" -eq 1
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/public/ping)" = 204
test "$(curl -s -X POST -H 'Content-Type: application/json' -d '{}' -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/dify/stream)" = 401
sha256sum -c /tmp/content-repair-after_20261008.sha256
pm2 save
echo 'RELEASE_OK'
date -u '+%Y-%m-%dT%H:%M:%SZ'
cat .next/BUILD_ID
