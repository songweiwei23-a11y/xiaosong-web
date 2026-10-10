#!/bin/bash
# 部署后清理：删掉上一次部署有、这一次没有的文件。
# 用法：deploy-prune.sh <部署目录>。新清单在 /tmp/deploy-manifest-new，部署完成后保存为 <部署目录>/.deploy-manifest。
# 只动同步目录里的文件（app、components、hooks、lib、types、supabase、public、tests），
# 其它路径一律跳过，所以不会碰上传的数据、环境变量和 .next 缓存。
set -e

ROOT="$1"
NEW=/tmp/deploy-manifest-new
OLD="$ROOT/.deploy-manifest"

cd "$ROOT"

if [ -f "$OLD" ]; then
  sort -u "$OLD" > /tmp/deploy-old.sorted
  sort -u "$NEW" > /tmp/deploy-new.sorted
  comm -23 /tmp/deploy-old.sorted /tmp/deploy-new.sorted | while IFS= read -r f; do
    case "$f" in
      app/*|components/*|hooks/*|lib/*|types/*|supabase/*|public/*|tests/*)
        if [ -f "$f" ]; then
          rm -f -- "$f"
          echo "已删除旧文件: $f"
        fi
        ;;
      *)
        echo "跳过（不在同步目录内）: $f"
        ;;
    esac
  done
  rm -f /tmp/deploy-old.sorted /tmp/deploy-new.sorted
else
  echo "首次写入部署清单，本次不删除任何文件"
fi

mv "$NEW" "$OLD"
