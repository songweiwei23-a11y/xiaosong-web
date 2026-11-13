#!/bin/bash
# 测试流式输出是否真的工作

echo "测试选题生成流式输出..."

curl -X POST https://您的域名/api/dify/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: 您的登录cookie" \
  -d '{
    "taskType": "选题策划",
    "inputs": {
      "requirement": "测试流式输出"
    }
  }' \
  --no-buffer \
  2>&1 | while IFS= read -r line; do
    echo "[$(date +%H:%M:%S.%3N)] $line"
  done
