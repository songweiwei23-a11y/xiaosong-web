#!/bin/sh
set -eu
current=/var/www/xiaosong-web
candidate=/var/www/xiaosong-candidate-title-check-20261008
test "$(cat "$current/.next/BUILD_ID")" = i-_ar1_VNXMmSW7YiCveb
test ! -e "$candidate"
mkdir "$candidate"
rsync -a --exclude=node_modules --exclude=.next --exclude=.git --exclude=.tmp --exclude=docs "$current/" "$candidate/"
cp -a --reflink=auto "$current/node_modules" "$candidate/node_modules"
tar -xzf /tmp/kaiwu-content-repair_20261008.tar.gz -C "$candidate"
cd "$candidate"
sha256sum -c /tmp/content-repair-after_20261008.sha256
npm run build > /tmp/kaiwu-content-repair-postverify-build_20261008.log 2>&1
cat .next/BUILD_ID
echo
tail -6 /tmp/kaiwu-content-repair-postverify-build_20261008.log
