#!/usr/bin/env bash
set -euo pipefail
live=/var/www/xiaosong-web
stage=/var/www/xiaosong-stage-20261007_topic_quality_final
backup=/var/www/xiaosong-backup-20261007_topic_quality_final
test -d "$live"
test -s "$stage/.next/BUILD_ID"
test ! -e "$backup"
test ! -e "$stage.failed"
cd "$live"
sha256sum -c /tmp/kaiwu-topic-quality-final-baseline-all_20261007.sha256 >/dev/null
cmp -s .next/BUILD_ID /tmp/kaiwu-topic-quality-final-baseline-build_20261007.txt
cd "$stage"
sha256sum -c /tmp/topic-quality-final-source_20261007.sha256
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
test "$healthy" = 1
pm2 save
printf 'DEPLOY_OK\n'
cat .next/BUILD_ID

