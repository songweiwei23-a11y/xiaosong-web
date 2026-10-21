/**
 * 在线心跳（2026-10-21）：「正在用」只看这一刻有没有心跳；只在浏览的人也要列出来；
 * 心跳只在内存里，接口只收登录用户。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_BUILD,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_ONLINE_MS,
  cleanPath,
  markActive,
  onlinePresenceCount,
  presenceLabel,
  presenceRevision,
  presenceSnapshot,
  resetPresence,
  sanitizeBuild,
  touchPresence,
} from '@/lib/presence';
import { activeUsers, buildDirectory } from '@/lib/monitor';
import { createJob, finishJob, runningJobCount } from '@/lib/assistant/jobs';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const now = 1_800_000_000_000;
const dir = buildDirectory({ users: [{ id: 'u9', email: 'looker@x.com' }] });

beforeEach(() => resetPresence());

describe('心跳：在线只看这一刻有没有心跳', () => {
  it('心跳在 90 秒内算在线，之后算离线；离线的人仍然保留在 24 小时的列表里', () => {
    touchPresence('u9', '/dashboard/script', now);
    expect(onlinePresenceCount(now + 60_000)).toBe(1);
    expect(onlinePresenceCount(now + PRESENCE_ONLINE_MS + 1)).toBe(0);
    expect(presenceSnapshot(now + PRESENCE_ONLINE_MS + 1).has('u9')).toBe(true);
  });

  it('只有从离线变成在线，版本号才加一；一直在线的心跳不加（大屏不会被每 30 秒刷一次）', () => {
    const r0 = presenceRevision();
    touchPresence('u9', '/dashboard', now);
    const r1 = presenceRevision();
    expect(r1).toBe(r0 + 1);
    touchPresence('u9', '/dashboard', now + PRESENCE_HEARTBEAT_MS);
    expect(presenceRevision()).toBe(r1);
    touchPresence('u9', '/dashboard', now + PRESENCE_HEARTBEAT_MS + PRESENCE_ONLINE_MS + 1);
    expect(presenceRevision()).toBe(r1 + 1);
  });

  it('超过 24 小时没有心跳的人被清掉', () => {
    touchPresence('old', '', now);
    touchPresence('new', '', now + 24 * 60 * 60 * 1000 + 1);
    expect(presenceSnapshot(now + 24 * 60 * 60 * 1000 + 1).has('old')).toBe(false);
  });

  it('心跳间隔不能太长：超时线至少能容忍两次丢失', () => {
    expect(PRESENCE_ONLINE_MS).toBeGreaterThanOrEqual(2 * PRESENCE_HEARTBEAT_MS);
  });

  it('页面路径只留站内路径，去掉查询参数和锚点；外链和乱填的一律记成空', () => {
    expect(cleanPath('/dashboard/script?x=1#a')).toBe('/dashboard/script');
    expect(cleanPath('https://evil.example/x')).toBe('');
    expect(cleanPath(123)).toBe('');
    expect(cleanPath('/' + 'a'.repeat(300))).toBe('');
  });

  it('页面名：子页面按前缀匹配；认不出来写「工作台」', () => {
    expect(presenceLabel('/dashboard/script/abc')).toBe('脚本生成');
    expect(presenceLabel('/dashboard/works')).toBe('创作进度');
    expect(presenceLabel('/dashboard')).toBe('工作台首页');
    expect(presenceLabel('/dashboard/free-chat')).toBe('工作台');
    expect(presenceLabel('/admin/monitor')).toBe('后台实时监控');
    expect(presenceLabel('/admin/orders')).toBe('后台管理');
    expect(presenceLabel('')).toBe('工作台');
  });
});

describe('列表：只在浏览的人也算；在线只看心跳', () => {
  it('只在浏览（没有登录、生成、使用记录）的人：列出来、在线、写「只在浏览」、显示正在哪一页', () => {
    const list = activeUsers({ dir, now, presence: new Map([['u9', { at: now - 10_000, path: '/dashboard/works', build: '' }]]) });
    expect(list).toHaveLength(1);
    expect(list[0].online).toBe(true);
    expect(list[0].currentPage).toBe('创作进度');
    expect(list[0].lastAction).toBe('只在浏览');
  });

  it('只有操作记录、没有心跳的人：不算在线（之前「15 分钟内有操作」就算在线，已经不对）', () => {
    const list = activeUsers({
      dir,
      now,
      generations: [{ id: 'g1', user_id: 'u9', task_type: '脚本生成', created_at: new Date(now - 60_000).toISOString(), input_data: { topic: '猫粮' } }],
    });
    expect(list[0].online).toBe(false);
    expect(list[0].currentPage).toBe('');
    expect(list[0].lastAction).toBe('脚本生成 · 主题：猫粮');
  });

  it('心跳超过 90 秒：离线，但仍按最近动静排在列表里', () => {
    const list = activeUsers({ dir, now, presence: new Map([['u9', { at: now - 120_000, path: '/dashboard/works', build: '' }]]) });
    expect(list[0].online).toBe(false);
    expect(list[0].minutesAgo).toBe(2);
  });
});

describe('接线：心跳从工作台发出，接口只收登录用户，大屏按心跳算在线', () => {
  it('心跳接口只收登录用户，只记心跳，不写数据库', () => {
    const route = read('app/api/presence/route.ts');
    expect(route).toContain('requireUser()');
    expect(route).toContain('touchPresence(guard.userId!, body?.path');
    const lib = read('lib/presence.ts');
    expect(lib).not.toMatch(/getServiceSupabase|\.from\(/);
  });

  it('工作台和后台布局都挂了心跳组件（管理员自己在后台也算在线）', () => {
    expect(read('app/dashboard/layout.tsx')).toContain('<PresenceBeat />');
    expect(read('app/admin/layout.tsx')).toContain('<PresenceBeat />');
    const beat = read('components/dashboard/PresenceBeat.tsx');
    expect(beat).toContain('fetch("/api/presence"');
    expect(beat).toContain('PRESENCE_HEARTBEAT_MS');
    expect(beat).toContain('[pathname]');
    expect(beat).toContain('document.visibilityState !== "visible"');
  });

  it('大屏数据：快照键带上心跳版本和时间片；在线人数来自心跳，不再用「最近有操作」', () => {
    const route = read('app/api/admin/monitor/route.ts');
    expect(route).toContain('presenceSnapshot(now)');
    expect(route).toContain('presenceRevision()');
    expect(route).toContain('onlineCount: active.filter((u) => u.online).length');
    expect(route).not.toContain('ONLINE_WINDOW_MIN');
  });

  it('通知源：心跳版本变了也要推送刷新；大屏每 1 秒兜底刷新一次，离线能及时降下来', () => {
    expect(read('lib/admin-monitor-signal.ts')).toContain('presenceRevision()');
    expect(read('hooks/useRealtimeMonitor.ts')).toContain('setInterval(refresh, 1_000)');
  });
});

describe('版本：旧代码的页面要被看出来，并提醒刷新', () => {
  it('版本号只收字母、数字、下划线、连字符，长度有限，乱填的记成空', () => {
    expect(sanitizeBuild('BUILD_20261021120000')).toBe('BUILD_20261021120000');
    expect(sanitizeBuild('<script>')).toBe('');
    expect(sanitizeBuild('x'.repeat(65))).toBe('');
    expect(sanitizeBuild(42)).toBe('');
    expect(typeof APP_BUILD).toBe('string');
    expect(APP_BUILD.length).toBeGreaterThan(0);
  });

  it('心跳记下页面版本；列表里能分出旧版本的人', () => {
    touchPresence('u9', '/dashboard/works', now, 'BUILD_OLD');
    const list = activeUsers({ dir, now, presence: presenceSnapshot(now) });
    expect(list[0].build).toBe('BUILD_OLD');
    expect(list[0].build).not.toBe(APP_BUILD);
  });
});

describe('接口请求也算在用：页面是旧代码、不发心跳，只要在用就能看见', () => {
  it('登录用户的接口请求会更新「最后出现」的时间，但不改页面和版本', () => {
    touchPresence('u9', '/dashboard/script', now - 200_000, 'BUILD_OLD');
    markActive('u9', now);
    const e = presenceSnapshot(now).get('u9')!;
    expect(e.at).toBe(now);
    expect(e.path).toBe('/dashboard/script');
    expect(e.build).toBe('BUILD_OLD');
    expect(onlinePresenceCount(now)).toBe(1);
  });

  it('从离线变成在线（只有接口请求，没有心跳）：版本号加一，大屏会推送刷新', () => {
    const r0 = presenceRevision();
    markActive('u9', now);
    expect(presenceRevision()).toBe(r0 + 1);
    markActive('u9', now + 1000);
    expect(presenceRevision()).toBe(r0 + 1);
  });

  it('只有接口请求、没有页面的人：在线，写「只在浏览」，页面名为空', () => {
    markActive('u9', now);
    const list = activeUsers({ dir, now, presence: presenceSnapshot(now) });
    expect(list[0].online).toBe(true);
    expect(list[0].currentPage).toBe('');
  });
});

describe('系统状态：助理进行中的任务数', () => {
  it('创建任务计数加一，结束后减一', () => {
    const before = runningJobCount();
    const job = createJob('u-status-test');
    expect(runningJobCount()).toBe(before + 1);
    finishJob(job, 'done');
    expect(runningJobCount()).toBe(before);
  });
});

describe('接线：版本号从构建注入，页面和服务器用同一个值比较', () => {
  it('部署脚本的构建命令注入版本号（和 buildTag 同一个值）', () => {
    const deploy = read('同步到服务器.ps1');
    expect(deploy).toContain('NEXT_PUBLIC_APP_BUILD=$buildTag');
  });

  it('接口请求的鉴权处会记在线；心跳接口回传服务器版本', () => {
    expect(read('lib/api-guard.ts')).toContain('markActive(user.id)');
    expect(read('app/api/presence/route.ts')).toContain('build: APP_BUILD');
  });

  it('心跳组件：发送自己的版本号，发现不一样就提示刷新（只提示，不自动刷新）', () => {
    const beat = read('components/dashboard/PresenceBeat.tsx');
    expect(beat).toContain('build: APP_BUILD');
    expect(beat).toContain('d.build !== APP_BUILD');
    expect(beat).toContain('刷新页面');
  });

  it('大屏状态：快照耗时、旧版本在线数放在快照里，数据库延迟、运行时长、助理进行中每次现取', () => {
    const route = read('app/api/admin/monitor/route.ts');
    expect(route).toContain('staleOnline:');
    expect(route).toContain('dbLatencyMs');
    expect(route).toContain('runningJobCount()');
    expect(route).toContain('process.uptime()');
  });
});
