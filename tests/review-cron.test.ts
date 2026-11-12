import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource } from './helpers/source';

describe('活动端口', () => {
  it('从 upstream 片段读当前端口', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiwu-port-'));
    const upstream = path.join(dir, 'upstream.conf');
    fs.writeFileSync(upstream, 'server 127.0.0.1:3001;\n');
    const result = spawnSync('bash', [path.join(process.cwd(), 'scripts/active-port.sh')], {
      encoding: 'utf8',
      env: { ...process.env, UPSTREAM_FILE: upstream },
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('3001');
  });

  it('复盘定时任务打到活动端口，不写死 3000', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiwu-cron-'));
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    const upstream = path.join(dir, 'upstream.conf');
    const envFile = path.join(dir, 'env');
    const log = path.join(dir, 'curl.log');
    fs.writeFileSync(upstream, 'server 127.0.0.1:3001;\n');
    fs.writeFileSync(envFile, 'REVIEW_CRON_SECRET=cron-placeholder\n');
    fs.writeFileSync(path.join(bin, 'curl'), `#!/bin/bash
echo "curl $*" >> "$LOG"
exit 0
`, { mode: 0o755 });
    const result = spawnSync('bash', [path.join(process.cwd(), 'scripts/review-cron-tick.sh')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        UPSTREAM_FILE: upstream,
        ENV_FILE: envFile,
        LOG: log,
      },
    });
    const recorded = fs.readFileSync(log, 'utf8');
    expect(result.status).toBe(0);
    expect(recorded).toContain('http://127.0.0.1:3001/api/admin/monthly-review/tick');
    expect(recorded).not.toContain('127.0.0.1:3000');
    expect(recorded).toContain('x-cron-secret:');
    expect(result.stdout).not.toContain('cron-placeholder');
    expect(result.stderr).not.toContain('cron-placeholder');
  });

  it('安装脚本和线上脚本不再把 127.0.0.1:3000 写死', () => {
    for (const file of [
      'scripts/install-review-cron.sh',
      'scripts/review-cron-tick.sh',
      'scripts/active-port.sh',
      'scripts/deploy-reload.sh',
      'app/api/admin/monthly-review/tick/route.ts',
      'app/api/admin/alerts/tick/route.ts',
    ]) {
      expect(readSource(file), file).not.toContain('127.0.0.1:3000');
    }
    expect(readSource('scripts/install-review-cron.sh')).toContain('review-cron-tick.sh');
    expect(readSource('scripts/review-cron-tick.sh')).toContain('active-port.sh');
  });
});
