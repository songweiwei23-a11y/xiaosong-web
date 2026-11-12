#!/usr/bin/env bash
set -euo pipefail
live=/var/www/xiaosong-web
tag=20261004_optimization
stage=/var/www/xiaosong-stage-$tag
backup=/var/www/xiaosong-backup-$tag
pkg=/tmp/kaiwu-release_20261004.tar.gz
log=/tmp/kaiwu-release_20261004.log
test -d "$live"
test ! -e "$stage"
test ! -e "$backup"
test -f "$pkg"
mkdir "$stage"
cp -a "$live/." "$stage/"
tar -xzf "$pkg" -C "$stage"
cd "$stage"
npm ci --no-audit --no-fund
NODE_OPTIONS=--max-old-space-size=1400 npm run build
test -s .next/BUILD_ID
printf 'STAGE_BUILD_OK\n'
pm2 stop xiaosong-web
mv "$live" "$backup"
mv "$stage" "$live"
cd "$live"
pm2 restart xiaosong-web --update-env
healthy=0
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3000/login >/dev/null; then healthy=1; break; fi
  sleep 2
done
if [ "$healthy" != 1 ]; then
  pm2 stop xiaosong-web || true
  mv "$live" "$stage.failed"
  mv "$backup" "$live"
  cd "$live"
  pm2 restart xiaosong-web --update-env
  printf 'DEPLOY_FAILED_ROLLED_BACK\n'
  exit 1
fi
pm2 save
printf 'DEPLOY_OK\n'
cat .next/BUILD_ID
