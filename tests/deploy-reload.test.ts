import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource } from './helpers/source';

const SCRIPT = path.join(process.cwd(), 'scripts/deploy-reload.sh');

function writeExec(file: string, body: string) {
  fs.writeFileSync(file, body, { mode: 0o755 });
}

function run(mode: 'ok' | 'fail' | 'wrong' | 'front-fail', extra?: { memKb?: number; nginxTestFail?: boolean; portBusy?: boolean; preflight?: boolean }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiwu-reload-'));
  const bin = path.join(dir, 'bin');
  const app = path.join(dir, 'app');
  fs.mkdirSync(bin);
  fs.mkdirSync(app);
  fs.writeFileSync(path.join(app, 'ecosystem.config.cjs'), 'module.exports = { apps: [] };\n');
  const upstream = path.join(dir, 'upstream.conf');
  fs.writeFileSync(upstream, 'server 127.0.0.1:3000;\n');
  const log = path.join(dir, 'log');
  const mem = path.join(dir, 'meminfo');
  fs.writeFileSync(mem, `MemAvailable: ${extra?.memKb ?? 2_000_000} kB\n`);
  const jlist = path.join(dir, 'jlist.json');
  const started = path.join(dir, 'started');
  const portBusy = path.join(dir, 'port-busy');
  if (extra?.portBusy) fs.writeFileSync(portBusy, '1');
  fs.writeFileSync(jlist, JSON.stringify([{
    name: 'xiaosong-web',
    pid: 1111,
    pm2_env: { status: 'online', pm_cwd: app, args: ['start', '-p', '3000'], env: { PORT: '3000' } },
  }]));
  const nginxFail = path.join(dir, 'nginx-fail');
  if (extra?.nginxTestFail) fs.writeFileSync(nginxFail, '1');
  writeExec(path.join(bin, 'pm2'), `#!/bin/bash
echo "pm2 $*" >> "$LOG"
if [ "$1" = "jlist" ]; then
  if [ -f "$STARTED" ]; then
    node -e 'const fs=require("fs"); const base=JSON.parse(fs.readFileSync(process.env.JLIST,"utf8")); base.push({name:"xiaosong-web-next", pid:4242, pm2_env:{status:"online", pm_cwd:base[0].pm2_env.pm_cwd, env:{PORT:"3001"}}}); process.stdout.write(JSON.stringify(base));'
    exit 0
  fi
  cat "$JLIST"
  exit 0
fi
if [ "$1" = "start" ]; then touch "$STARTED"; exit 0; fi
if [ "$1" = "delete" ]; then echo "delete name=$2" >> "$LOG"; exit 0; fi
exit 0
`);
  writeExec(path.join(bin, 'curl'), `#!/bin/bash
echo "curl $*" >> "$LOG"
body=""
prev=""
for a in "$@"; do
  if [ "$prev" = "-o" ]; then body="$a"; fi
  prev="$a"
done
if [ "$MODE" = "fail" ]; then
  printf '%s' '{"ok":false}' > "$body"
  printf '500'
  exit 0
fi
if [ "$MODE" = "wrong" ]; then
  printf '%s' '{"ok":true,"pid":1111,"boot":"stale"}' > "$body"
  printf '200'
  exit 0
fi
url=""
for a in "$@"; do
  case "$a" in
    http://*) url="$a" ;;
  esac
done
if [ "$MODE" = "front-fail" ] && [ "$url" = "http://127.0.0.1/api/health" ]; then
  printf '%s' '{"ok":false}' > "$body"
  printf '502'
  exit 0
fi
printf '%s' "{\\"ok\\":true,\\"pid\\":4242,\\"boot\\":\\"$KAIWU_BOOT_ID\\"}" > "$body"
printf '200'
exit 0
`);
  writeExec(path.join(bin, 'ss'), `#!/bin/bash
echo "ss $*" >> "$LOG"
if [ -f "$PORT_BUSY" ]; then
  echo "LISTEN 0 128 127.0.0.1:3001 0.0.0.0:*"
fi
exit 0
`);
  writeExec(path.join(bin, 'nginx'), `#!/bin/bash
echo "nginx $*" >> "$LOG"
if [ "$1" = "-t" ]; then
  if [ -f "$NGINX_FAIL" ]; then exit 1; fi
  exit 0
fi
if [ "$1" = "-T" ]; then
  echo "include /etc/nginx/snippets/xiaosong-upstream.conf;"
  cat "$UPSTREAM"
  exit 0
fi
if [ "$1" = "-s" ]; then exit 0; fi
exit 1
`);
  const args = extra?.preflight ? ['--preflight', app] : [app];
  const result = spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      LOG: log,
      JLIST: jlist,
      MODE: mode,
      UPSTREAM: upstream,
      UPSTREAM_FILE: upstream,
      NGINX_FAIL: nginxFail,
      USE_SUDO: '0',
      MEMINFO_FILE: mem,
      HEALTH_TRIES: '2',
      HEALTH_INTERVAL: '0',
      DRAIN_SECONDS: '0',
      STARTED: started,
      PORT_BUSY: portBusy,
    },
  });
  const recorded = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, upstream: fs.readFileSync(upstream, 'utf8'), log: recorded };
}

describe('换端口切换', () => {
  it('新进程 /api/health 失败时不改 Nginx、不停旧进程，并且非零退出', () => {
    const out = run('fail');
    expect(out.status).not.toBe(0);
    expect(out.stdout).not.toContain('SWITCH_OK');
    expect(out.stdout).toContain('旧进程继续服务');
    expect(out.upstream).toContain('127.0.0.1:3000');
    expect(out.upstream).not.toContain('127.0.0.1:3001');
    expect(out.log).toContain('delete name=xiaosong-web-next');
    expect(out.log).not.toContain('delete name=xiaosong-web\n');
    expect(out.log).not.toContain('nginx -s');
    expect(out.log).not.toContain('nginx -t');
    expect(out.log).toContain('/api/health');
    expect(out.log).not.toMatch(/http:\/\/127\.0\.0\.1:3001\/(\s|$)/);
  });

  it('健康检查的 boot 和 pid 对不上时，不把旧进程当成新进程', () => {
    const out = run('wrong');
    expect(out.status).not.toBe(0);
    expect(out.stdout).toContain('不是这次拉起的进程');
    expect(out.stdout).not.toContain('SWITCH_OK');
    expect(out.upstream).toContain('127.0.0.1:3000');
    expect(out.upstream).not.toContain('127.0.0.1:3001');
    expect(out.log).not.toContain('delete name=xiaosong-web\n');
    expect(out.log).not.toContain('nginx -s');
  });

  it('经过 Nginx 的健康检查失败时回滚，不停旧进程', () => {
    const out = run('front-fail');
    expect(out.status).not.toBe(0);
    expect(out.stdout).toContain('经过 Nginx');
    expect(out.stdout).not.toContain('SWITCH_OK');
    expect(out.upstream).toContain('server 127.0.0.1:3000;');
    expect(out.log).toContain("Host: biandao.icu");
    expect(out.log).toContain('http://127.0.0.1/api/health');
    expect(out.log).not.toContain('delete name=xiaosong-web\n');
    expect(out.log).toContain('delete name=xiaosong-web-next');
  });

  it('上传前检查只确认 Nginx、内存和 ecosystem，不启动新进程', () => {
    const out = run('ok', { preflight: true });
    expect(out.status).toBe(0);
    expect(out.stdout).toContain('PRECHECK_OK');
    expect(out.log).not.toContain('pm2 start');
    expect(out.upstream).toContain('127.0.0.1:3000');
    expect(out.log).not.toContain('delete name=xiaosong-web\n');
  });

  it('健康检查通过才把 upstream 切到新端口，并停掉旧进程', () => {
    const out = run('ok');
    expect(out.status).toBe(0);
    expect(out.stdout).toContain('SWITCH_OK');
    expect(out.upstream).toContain('server 127.0.0.1:3001;');
    expect(out.log).toContain('delete name=xiaosong-web\n');
    expect(out.log).toContain('nginx -s reload');
    expect(out.log).toContain('http://127.0.0.1:3001/api/health');
    expect(out.log).toContain("Host: biandao.icu");
    expect(out.log).toContain('http://127.0.0.1/api/health');
    expect(out.log).not.toContain('http://localhost:3000/');
  });

  it('新端口已被占用时不起第二个进程', () => {
    const out = run('ok', { portBusy: true });
    expect(out.status).not.toBe(0);
    expect(out.stdout).toContain('已被占用');
    expect(out.log).not.toContain('pm2 start');
    expect(out.upstream).toContain('127.0.0.1:3000');
    expect(out.log).not.toContain('delete name=xiaosong-web\n');
  });

  it('Nginx 配置检查失败时恢复旧 upstream，旧进程继续服务', () => {
    const out = run('ok', { nginxTestFail: true });
    expect(out.status).not.toBe(0);
    expect(out.stdout).not.toContain('SWITCH_OK');
    expect(out.stdout).toContain('旧进程继续服务');
    expect(out.upstream).toContain('server 127.0.0.1:3000;');
    expect(out.log).not.toContain('delete name=xiaosong-web\n');
    expect(out.log).toContain('delete name=xiaosong-web-next');
  });

  it('可用内存不够时不起第二个进程', () => {
    const out = run('ok', { memKb: 1000 });
    expect(out.status).not.toBe(0);
    expect(out.stdout).toContain('不启动第二个进程');
    expect(out.log).not.toContain('pm2 start');
    expect(out.upstream).toContain('127.0.0.1:3000');
  });

  it('部署脚本不再用首页 200 当就绪', () => {
    const ps1 = readSource('同步到服务器.ps1');
    const sh = readSource('scripts/deploy-reload.sh');
    expect(ps1).not.toContain('http://localhost:3000/');
    expect(ps1).not.toContain('pm2 restart xiaosong-web');
    expect(ps1).toContain('deploy-reload.sh');
    expect(sh).toContain('/api/health');
    expect(sh).toContain('creation-window-lock');
    expect(sh).toContain('KAIWU_BOOT_ID');
    expect(sh).toContain('DRAIN_SECONDS:-90');
    expect(sh).toContain('已被占用');
    expect(sh).not.toContain("instances: 'max'");
    expect(readSource('ecosystem.config.cjs')).toContain("exec_mode: 'fork'");
    expect(readSource('ecosystem.config.cjs')).toContain('instances: 1');
    expect(readSource('ecosystem.config.cjs')).toContain('KAIWU_BOOT_ID');
    expect(readSource('ecosystem.config.cjs')).not.toContain("instances: 'max'");
  });
});
