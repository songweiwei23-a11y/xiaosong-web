#!/usr/bin/env bash
set -euo pipefail
live=/var/www/xiaosong-web
stage=/var/www/xiaosong-stage-20261007_creation_intent_fact
test ! -e "$stage"
cd "$live"
sha256sum -c /tmp/kaiwu-intent-fact-baseline_20261007.sha256
cmp -s .next/BUILD_ID /tmp/kaiwu-intent-fact-baseline-build_20261007.txt
mkdir "$stage"
cp -a "$live/." "$stage/"
tar -xzf /tmp/kaiwu-intent-fact_20261007.tar.gz -C "$stage"
cd "$stage"
NODE_OPTIONS=--max-old-space-size=1400 npm run build
test -s .next/BUILD_ID
printf 'STAGE_BUILD_OK\n'
cat .next/BUILD_ID
