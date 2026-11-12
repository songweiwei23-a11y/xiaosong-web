#!/usr/bin/env bash
set -euo pipefail
cd /var/www/xiaosong-web
baseline=/tmp/kaiwu-free-chat-baseline_20261007.sha256
for entry in \
 '6ed31b80b3aef712654a64639e21a8e3a505e7622d194b827952cc18623ac0b2  lib/html-text.ts' \
 '990284297a703a594778fa05554898d3adcb1002d3e2a5b414d3070916820184  lib/research-runner.ts' \
 '71848be6f4c41aac9668c2239cec9b341910ae5a010747fa5e7cbecefd93fa98  lib/research.ts'; do
  grep -Fxq "$entry" "$baseline" || printf '%s\n' "$entry" >> "$baseline"
done
sha256sum -c "$baseline"
cd /var/www/xiaosong-stage-20261007_free_chat_detail
tar -xzf /tmp/kaiwu-free-chat-detail_20261007.tar.gz
NODE_OPTIONS=--max-old-space-size=1400 npm run build
