#!/bin/bash
# 换端口切换，不使用 PM2 cluster。
#
# 稳态只有一个 fork 进程，创作窗口锁（lib/creation-window-lock.ts）仍然有效。
# 发布时短暂再起一个进程，只为在切流量之前打 /api/health。
# 健康检查要看到这次启动的 boot 和 pid，避免把还在服务的旧进程当成新进程。
# 健康检查失败或 Nginx 没切过去：删掉新进程，旧进程继续服务，退出码非 0。
# 切过去之后先等约 90 秒，让旧进程上还在流式输出的生成跑完，再停旧进程。
# 机器只有 2G。可用内存不够时不起第二个进程。新端口被占用时也不起。
#
# 用法：deploy-reload.sh <部署目录>
# 依赖：已在跑的 xiaosong-web 或 xiaosong-web-next、ecosystem.config.cjs、
#       Nginx 已 include /etc/nginx/snippets/xiaosong-upstream.conf
set -euo pipefail

APP_DIR="${1:-}"
UPSTREAM_FILE="${UPSTREAM_FILE:-/etc/nginx/snippets/xiaosong-upstream.conf}"
PM2="${PM2:-pm2}"
CURL="${CURL:-curl}"
NGINX="${NGINX:-nginx}"
SS="${SS:-ss}"
USE_SUDO="${USE_SUDO:-1}"
MEMINFO_FILE="${MEMINFO_FILE:-/proc/meminfo}"
# 可用内存低于约 500MB 时，第二个 next start 可能把 2G 机器打满
MIN_FREE_KB="${MIN_FREE_KB:-512000}"
HEALTH_TRIES="${HEALTH_TRIES:-40}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-3}"
# 切流之后、停旧进程之前，留给已经开始的流式生成
DRAIN_SECONDS="${DRAIN_SECONDS:-90}"
SWITCHED=0
BACKUP=""

if [ -z "$APP_DIR" ] || [ ! -d "$APP_DIR" ]; then
  echo "部署目录不存在，未切换，旧进程继续服务"
  exit 1
fi

nginx_bin() {
  if [ "$USE_SUDO" = "1" ]; then
    sudo -n "$NGINX" "$@"
  else
    "$NGINX" "$@"
  fi
}

put_upstream() {
  local src="$1"
  if [ -w "$UPSTREAM_FILE" ]; then
    cp "$src" "$UPSTREAM_FILE"
  else
    sudo -n tee "$UPSTREAM_FILE" < "$src" >/dev/null
  fi
}

drop_staging() {
  "$PM2" delete "$STAGING_NAME" >/dev/null 2>&1 || true
}

revert_traffic() {
  if [ -n "$BACKUP" ] && [ -f "$BACKUP" ]; then
    put_upstream "$BACKUP" || true
  fi
  if [ "$SWITCHED" = "1" ]; then
    nginx_bin -s reload >/dev/null 2>&1 || true
  fi
  drop_staging
}

fail_closed() {
  echo "$1"
  echo "未切换，旧进程继续服务"
  revert_traffic
  exit 1
}

# 参数：响应文件、期望的 boot、期望的 pid。对得上才算这次拉起的进程。
match_health() {
  node -e '
    const fs = require("fs");
    let body;
    try { body = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); }
    catch (e) { process.exit(1); }
    const boot = process.argv[2];
    const pid = Number(process.argv[3]);
    if (!body || body.ok !== true) process.exit(1);
    if (!boot || body.boot !== boot) process.exit(1);
    if (!pid || Number(body.pid) !== pid) process.exit(1);
  ' "$1" "$2" "$3"
}

health_ok() {
  local port="$1" boot="$2" pid="$3" body code
  body=$(mktemp)
  code="000"
  if code=$("$CURL" -sS -o "$body" -w '%{http_code}' --max-time 5 --retry 0 "http://127.0.0.1:${port}/api/health"); then
    :
  else
    code="000"
  fi
  local ok=0
  if [ "$code" = "200" ] && match_health "$body" "$boot" "$pid"; then
    ok=1
  fi
  rm -f "$body"
  [ "$ok" = "1" ]
}

wait_health() {
  local port="$1" boot="$2" pid="$3" i
  for i in $(seq 1 "$HEALTH_TRIES"); do
    if health_ok "$port" "$boot" "$pid"; then return 0; fi
    if [ "$i" -lt "$HEALTH_TRIES" ]; then sleep "$HEALTH_INTERVAL"; fi
  done
  return 1
}

# 正在听这个端口才算占用。TIME_WAIT 不算。
port_busy() {
  local port="$1"
  if command -v "$SS" >/dev/null 2>&1; then
    if "$SS" -ltn 2>/dev/null | grep -Eq "[.:]${port}([^0-9]|$)"; then
      return 0
    fi
    return 1
  fi
  if (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

staging_pid() {
  "$PM2" jlist | node -e '
    const name = process.argv[1];
    let s = "";
    process.stdin.on("data", (d) => { s += d; });
    process.stdin.on("end", () => {
      let apps;
      try { apps = JSON.parse(s); }
      catch (e) { process.stderr.write("pm2 jlist 不是 JSON\n"); process.exit(2); }
      const live = (apps || []).filter((a) => a && a.name === name && a.pm2_env && a.pm2_env.status === "online");
      if (live.length !== 1) { process.stderr.write("新进程不在线 " + live.length + "\n"); process.exit(2); }
      const pid = Number(live[0].pid || 0);
      if (!Number.isInteger(pid) || pid <= 0) { process.stderr.write("新进程没有 pid\n"); process.exit(2); }
      process.stdout.write(String(pid));
    });
  ' "$STAGING_NAME"
}

set +e
live=$("$PM2" jlist | node -e 'let s="";process.stdin.on("data",d=>{s+=d});process.stdin.on("end",()=>{let apps;try{apps=JSON.parse(s)}catch(e){process.stderr.write("pm2 jlist 不是 JSON\n");process.exit(2)}const live=(apps||[]).filter(a=>a&&a.pm2_env&&a.pm2_env.status==="online"&&/^xiaosong-web(-next)?$/.test(a.name));if(live.length!==1){process.stderr.write("需要恰好一个在线的开物进程，当前 "+live.length+" 个\n");process.exit(2)}const a=live[0];const env=a.pm2_env.env||{};let port=String(env.PORT||"");const args=a.pm2_env.args;const joined=Array.isArray(args)?args.join(" "):String(args||"");const m=joined.match(/(?:^|\s)-p\s+(\d+)/);if(!port&&m)port=m[1];if(!port)port="3000";if(port!=="3000"&&port!=="3001"){process.stderr.write("不认识的端口 "+port+"\n");process.exit(2)}process.stdout.write([a.name,port,a.pm2_env.pm_cwd||""].join("\t"))});')
parse_status=$?
set -e
if [ "$parse_status" -ne 0 ] || [ -z "${live:-}" ]; then
  echo "没有唯一在线的开物进程，未切换，旧进程继续服务"
  exit 1
fi

IFS="$(printf '\t')" read -r LIVE_NAME LIVE_PORT LIVE_CWD <<EOF
$live
EOF
APP_NORM="${APP_DIR%/}"
CWD_NORM="${LIVE_CWD%/}"
if [ "$CWD_NORM" != "$APP_NORM" ]; then
  echo "进程目录和部署目录不一致，未切换，旧进程继续服务"
  exit 1
fi

if [ "$LIVE_NAME" = "xiaosong-web" ]; then
  STAGING_NAME="xiaosong-web-next"
else
  STAGING_NAME="xiaosong-web"
fi
if [ "$LIVE_PORT" = "3000" ]; then NEXT_PORT=3001; else NEXT_PORT=3000; fi

if [ ! -f "$UPSTREAM_FILE" ]; then
  echo "还没有 ${UPSTREAM_FILE}。请先按 DEPLOYMENT.md 配好 Nginx upstream，再发布。"
  echo "未切换，旧进程继续服务"
  exit 1
fi

dump=$(mktemp)
if ! nginx_bin -T >"$dump" 2>/dev/null; then
  rm -f "$dump"
  echo "读不到 Nginx 配置，未切换，旧进程继续服务"
  exit 1
fi
if ! grep -q "xiaosong-upstream.conf" "$dump"; then
  rm -f "$dump"
  echo "Nginx 没有引用 xiaosong-upstream.conf，未切换，旧进程继续服务"
  exit 1
fi
rm -f "$dump"

avail=$(awk '/^MemAvailable:/ {print $2; exit}' "$MEMINFO_FILE" 2>/dev/null || true)
if [ -z "${avail:-}" ] || [ "$avail" -lt "$MIN_FREE_KB" ]; then
  echo "可用内存不足 ${MIN_FREE_KB}KB（现在 ${avail:-未知}KB），不启动第二个进程"
  echo "未切换，旧进程继续服务"
  exit 1
fi

if [ ! -f "$APP_DIR/ecosystem.config.cjs" ]; then
  echo "缺少 ecosystem.config.cjs，未切换，旧进程继续服务"
  exit 1
fi

"$PM2" delete "$STAGING_NAME" >/dev/null 2>&1 || true

if port_busy "$NEXT_PORT"; then
  echo "新端口 ${NEXT_PORT} 已被占用，不起新进程"
  echo "未切换，旧进程继续服务"
  exit 1
fi

BOOT_ID="$(node -e "process.stdout.write(require('crypto').randomBytes(8).toString('hex'))")"
export KAIWU_BOOT_ID="$BOOT_ID"

if ! (cd "$APP_DIR" && PORT="$NEXT_PORT" PM2_APP_NAME="$STAGING_NAME" APP_CWD="$APP_DIR" KAIWU_BOOT_ID="$BOOT_ID" "$PM2" start "$APP_DIR/ecosystem.config.cjs" --update-env); then
  drop_staging
  echo "新进程没能启动，未切换，旧进程继续服务"
  exit 1
fi

set +e
STAGING_PID="$(staging_pid)"
pid_status=$?
set -e
if [ "$pid_status" -ne 0 ] || [ -z "${STAGING_PID:-}" ]; then
  drop_staging
  echo "读不到新进程的 pid，未切换，旧进程继续服务"
  exit 1
fi

if ! wait_health "$NEXT_PORT" "$BOOT_ID" "$STAGING_PID"; then
  drop_staging
  echo "新进程的 /api/health 未通过，或应答的不是这次拉起的进程，未改 Nginx"
  echo "未切换，旧进程继续服务"
  exit 1
fi

BACKUP="$APP_DIR/.deploy-upstream.prev"
cp "$UPSTREAM_FILE" "$BACKUP"
next_line=$(mktemp)
printf 'server 127.0.0.1:%s;\n' "$NEXT_PORT" > "$next_line"
if ! put_upstream "$next_line"; then
  rm -f "$next_line"
  fail_closed "写不了 Nginx upstream"
fi
rm -f "$next_line"

if ! nginx_bin -t; then
  fail_closed "nginx -t 失败，已恢复 upstream"
fi
if ! nginx_bin -s reload; then
  fail_closed "nginx reload 失败，已恢复 upstream"
fi
SWITCHED=1

dump=$(mktemp)
if ! nginx_bin -T >"$dump" 2>/dev/null || ! grep -q "127.0.0.1:${NEXT_PORT}" "$dump"; then
  rm -f "$dump"
  fail_closed "Nginx 配置里没有新端口"
fi
rm -f "$dump"

if ! health_ok "$NEXT_PORT" "$BOOT_ID" "$STAGING_PID"; then
  fail_closed "切换后新端口的 /api/health 对不上这次的进程，已把流量改回旧端口"
fi

if [ "$DRAIN_SECONDS" != "0" ]; then
  echo "流量已在新端口 ${NEXT_PORT}，等待 ${DRAIN_SECONDS} 秒让旧进程上的流式生成跑完"
  sleep "$DRAIN_SECONDS"
fi

if ! health_ok "$NEXT_PORT" "$BOOT_ID" "$STAGING_PID"; then
  fail_closed "等待结束后新进程的 /api/health 对不上，已把流量改回旧端口，旧进程继续服务"
fi

if ! "$PM2" delete "$LIVE_NAME"; then
  echo "流量已在新端口，但旧进程 ${LIVE_NAME} 没能停掉。请手动 pm2 delete ${LIVE_NAME}，避免两个进程一直占内存。"
  exit 1
fi
"$PM2" save >/dev/null 2>&1 || echo "pm2 save 失败，下次开机可能不会拉起新进程名。流量已经切到新端口。"
echo "SWITCH_OK ${STAGING_NAME} ${NEXT_PORT}"
