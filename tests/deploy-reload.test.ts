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

function run(mode: 'ok' | 'fail', extra?: { memKb?: number; nginxTestFail?: boolean }) {
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
  fs.writeFileSync(jlist, JSON.stringify([{
    name: 'xiaosong-web',
    pm2_env: { status: 'online', pm_cwd: app, args: ['start', '-p', '3000'], env: { PORT: '3000' } },
  }]));
  const nginxFail = path.join(dir, 'nginx-fail');
  if (extra?.nginxTestFail) fs.writeFileSync(nginxFail, '1');
  writeExec(path.join(bin, 'pm2'), `#!/bin/bash
echo "pm2 $*" >> "$LOG"
if [ "$1" = "jlist" ]; then cat "$JLIST"; exit 0; fi
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
printf '%s' '{"ok":true}' > "$body"
printf '200'
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
  const result = spawnSync('bash', [SCRIPT, app], {
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

  it('健康检查通过才把 upstream 切到新端口，并停掉旧进程', () => {
    const out = run('ok');
    expect(out.status).toBe(0);
    expect(out.stdout).toContain('SWITCH_OK');
    expect(out.upstream).toContain('server 127.0.0.1:3001;');
    expect(out.log).toContain('delete name=xiaosong-web\n');
    expect(out.log).toContain('nginx -s reload');
    expect(out.log).toContain('http://127.0.0.1:3001/api/health');
    expect(out.log).not.toContain('http://localhost:3000/');
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
    expect(sh).not.toContain("instances: 'max'");
    expect(readSource('ecosystem.config.cjs')).toContain("exec_mode: 'fork'");
    expect(readSource('ecosystem.config.cjs')).toContain('instances: 1');
    expect(readSource('ecosystem.config.cjs')).not.toContain("instances: 'max'");
  });
});
