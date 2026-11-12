#!/usr/bin/env bash
set -euo pipefail
live=/var/www/xiaosong-web
stage=/var/www/xiaosong-stage-20261007_creation_intent_resume
backup=/var/www/xiaosong-backup-20261007_creation_intent_resume
test -d "$live"
test -s "$stage/.next/BUILD_ID"
test ! -e "$backup"
cd "$live"
sha256sum -c /tmp/kaiwu-intent-resume-baseline_20261007.sha256
cmp -s .next/BUILD_ID /tmp/kaiwu-intent-resume-baseline-build_20261007.txt
rollback_on_error() {
  code=$?
  if [ "$code" != 0 ] && [ -d "$backup" ]; then
    pm2 stop xiaosong-web || true
    if [ -d "$live" ]; then mv "$live" "$stage.failed"; fi
    mv "$backup" "$live"
    cd "$live"
    pm2 restart xiaosong-web --update-env || true
    printf 'DEPLOY_ERROR_RESTORED_BACKUP\n'
  fi
}
trap rollback_on_error EXIT
pm2 stop xiaosong-web
mv "$live" "$backup"
mv "$stage" "$live"
cd "$live"
pm2 restart xiaosong-web --update-env
healthy=0
for attempt in $(seq 1 20); do
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
