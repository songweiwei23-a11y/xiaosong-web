#!/usr/bin/env bash
set -euo pipefail
live=/var/www/xiaosong-web
stage=/var/www/xiaosong-stage-20261007_free_chat_detail
pkg=/tmp/kaiwu-free-chat-detail_20261007.tar.gz
baseline=/tmp/kaiwu-free-chat-baseline_20261007.sha256
test -d "$live"
test ! -e "$stage"
test -f "$pkg"
cd "$live"
cat >"$baseline" <<'HASHES'
11c9a96058927a02f837c7dfd5f5099433faaeb92c1e7c9d639b64d4144b7c4f  app/api/dify/chat/route.ts
61f2c0cf248aabfcdd82fc9b208014440fb0358d770e8b3671fc7c8ab7eaec5b  lib/ali-search.ts
88003bbc31a2bccad7ccb19ace4eb236af5a9bbfc6f88f37b736104d321f24d3  lib/web-search-quota.ts
77f139a68f6cd4959cae3dbea7a1c6f79fd445ab91d5e5aa77e3cad70efff0d7  lib/web-query.ts
HASHES
sha256sum -c "$baseline"
test ! -e lib/free-chat-answer.ts
test ! -e lib/free-chat-web.ts
cat .next/BUILD_ID >/tmp/kaiwu-free-chat-baseline-build_20261007.txt
mkdir "$stage"
cp -a "$live/." "$stage/"
tar -xzf "$pkg" -C "$stage"
cd "$stage"
NODE_OPTIONS=--max-old-space-size=1400 npm run build
test -s .next/BUILD_ID
printf 'STAGE_BUILD_OK\n'
cat .next/BUILD_ID
