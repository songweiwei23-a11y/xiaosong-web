#!/bin/bash
# 健康探测。服务器 cron 每 5 分钟执行一次，部署位置 /home/ubuntu/health-probe.sh。
#
# 探测公网 /api/health：
#   - 每次结果写到 health-last.txt；失败的追加到 health-fail.log
#   - 状态变化时发通知：正常→失败发一条；失败期间每 30 分钟提醒一次；恢复后发一条
#   - 通知渠道在 health-alert.env 里配置（模板见 scripts/health-alert.env.example）
#   - 没有配置 health-alert.env 时不发送，只写 health-alert.log，不影响探测本身
#
# 环境变量只用于测试时覆盖：HEALTH_URL、HEALTH_BASE
set -u

BASE="${HEALTH_BASE:-/home/ubuntu}"
URL="${HEALTH_URL:-https://www.biandao.icu/api/health}"
ENV_FILE="$BASE/health-alert.env"
STATE="$BASE/health-state.txt"
REMIND_SECONDS=1800

now=$(date '+%F %T')
epoch=$(date +%s)
code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$URL")
echo "$now $code" > "$BASE/health-last.txt"
if [ "$code" != "200" ]; then echo "$now health=$code" >> "$BASE/health-fail.log"; fi

notify() {
  local text="$1"
  echo "$now NOTIFY $text" >> "$BASE/health-alert.log"
  [ -f "$ENV_FILE" ] || return 0
  local HEALTH_ALERT_WEBHOOK="" HEALTH_ALERT_KIND="wecom"
  . "$ENV_FILE"
  [ -n "$HEALTH_ALERT_WEBHOOK" ] || return 0
  local body
  if [ "$HEALTH_ALERT_KIND" = "feishu" ]; then
    body="{\"msg_type\":\"text\",\"content\":{\"text\":\"$text\"}}"
  else
    # 企业微信、钉钉的群机器人都用这个格式
    body="{\"msgtype\":\"text\",\"text\":{\"content\":\"$text\"}}"
  fi
  # 把群机器人的返回也记下来：返回里有 errcode 非 0 时，说明地址或格式不对，要看得见
  local resp
  if resp=$(curl -s -m 10 -H 'Content-Type: application/json' -d "$body" "$HEALTH_ALERT_WEBHOOK"); then
    echo "$now 通知已提交，返回：$resp" >> "$BASE/health-alert.log"
  else
    echo "$now 通知发送失败（网络）" >> "$BASE/health-alert.log"
  fi
}

# 状态文件内容：ok，或 "down <故障开始时间戳> <上次提醒时间戳>"
prev=ok; since=0; last=0
if [ -f "$STATE" ]; then read -r prev since last < <(tr -d '\r' < "$STATE"); fi
since=${since:-0}; last=${last:-0}

if [ "$code" = "200" ]; then
  if [ "$prev" = "down" ]; then
    mins=$(( (epoch - since) / 60 ))
    notify "【开物】健康检查已恢复（HTTP 200），本次故障约 ${mins} 分钟。"
  fi
  echo "ok" > "$STATE"
else
  if [ "$prev" != "down" ]; then
    notify "【开物】健康检查失败：$URL 返回 $code（000 表示连接失败或超时），时间 $now。请登录服务器查看。"
    echo "down $epoch $epoch" > "$STATE"
  elif [ $(( epoch - last )) -ge "$REMIND_SECONDS" ]; then
    mins=$(( (epoch - since) / 60 ))
    notify "【开物】健康检查仍然失败：返回 $code，已持续约 ${mins} 分钟。"
    echo "down $since $epoch" > "$STATE"
  fi
fi
