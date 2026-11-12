#!/usr/bin/env bash
set -euo pipefail
live=/var/www/xiaosong-web
stage=/var/www/xiaosong-stage-20261007_topic_quality
test ! -e "$stage"
cd "$live"
test "$(sha256sum app/dashboard/topic/page.tsx | cut -d' ' -f1)" = "69856440b832240d0cb6dbc600889c6d0d79acf9bf365115cd2b16d50a160e87"
test "$(sha256sum lib/topic-library.ts | cut -d' ' -f1)" = "9fe4cae6bdc44f252361f66a314da6252ad6a943124b4fbc988b28d603d7c0ee"
cp .next/BUILD_ID /tmp/kaiwu-topic-quality-baseline-build_20261007.txt
find app lib components hooks -type f -print0 | sort -z | xargs -0 sha256sum > /tmp/kaiwu-topic-quality-baseline-all_20261007.sha256
sha256sum package.json package-lock.json next.config.js tsconfig.json >> /tmp/kaiwu-topic-quality-baseline-all_20261007.sha256
mkdir "$stage"
tar -cf - --exclude='./node_modules' --exclude='./.next' --exclude='./.tmp' . | tar -xf - -C "$stage"
cp -al "$live/node_modules" "$stage/node_modules"
tar -xzf /tmp/kaiwu-topic-quality_20261007.tar.gz -C "$stage"
cd "$stage"
NODE_OPTIONS=--max-old-space-size=1400 npm run build
test -s .next/BUILD_ID
printf 'STAGE_BUILD_OK\n'
cat .next/BUILD_ID

