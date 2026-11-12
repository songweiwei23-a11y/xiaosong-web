#!/usr/bin/env bash
set -euo pipefail
live=/var/www/xiaosong-web
stage=/var/www/xiaosong-stage-20261008_review_regression
pkg=/tmp/kaiwu-review-regression_20261008.tar.gz
test -d "$live"
test ! -e "$stage"
test -f "$pkg"
mkdir "$stage"
cp -a "$live/." "$stage/"
tar -xzf "$pkg" -C "$stage"
cd "$stage"
NODE_OPTIONS=--max-old-space-size=1400 npm run build
test -s .next/BUILD_ID
printf 'STAGE_BUILD_OK\n'
cat .next/BUILD_ID
