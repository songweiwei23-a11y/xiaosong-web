#!/usr/bin/env bash
set -euo pipefail
live=/var/www/xiaosong-web
stage=/var/www/xiaosong-stage-20261007_topic_quality_final
test ! -e "$stage"
cd "$live"
sha256sum -c /tmp/kaiwu-topic-quality-source_20261007.sha256 >/dev/null
cp .next/BUILD_ID /tmp/kaiwu-topic-quality-final-baseline-build_20261007.txt
find app lib components hooks -type f -print0 | sort -z | xargs -0 sha256sum > /tmp/kaiwu-topic-quality-final-baseline-all_20261007.sha256
sha256sum package.json package-lock.json next.config.js tsconfig.json >> /tmp/kaiwu-topic-quality-final-baseline-all_20261007.sha256
mkdir "$stage"
tar -cf - --exclude='./node_modules' --exclude='./.next' --exclude='./.tmp' . | tar -xf - -C "$stage"
cp -al "$live/node_modules" "$stage/node_modules"
cd "$stage"
tar -xzf /tmp/kaiwu-topic-quality_20261007.tar.gz
sha256sum -c /tmp/topic-quality-final-source_20261007.sha256
NODE_OPTIONS=--max-old-space-size=1400 npm run build
test -s .next/BUILD_ID
printf 'FINAL_STAGE_BUILD_OK\n'
cat .next/BUILD_ID

