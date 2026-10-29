/**
 * 动态里的登录、保存定位（2026-10-29）：标题不能空，保存的定位正文要能看到。
 *
 * 线上现象：点开某个用户，「登录了」「保存了「账号定位」」这类卡片标题是空的，正文也没有。
 * 原因有两个：卡片标题取的是 feature，而流水只给生成和对话设了 feature；
 * 保存定位的正文在 account_positioning 里，流水只记了它的 id，没人去取。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { activityEvents, buildDirectory, type ActivityRow } from '@/lib/monitor';

const NOW = Date.parse('2026-10-29T12:00:00Z');
const minutesBefore = (m: number) => new Date(NOW - m * 60_000).toISOString();
const dir = buildDirectory({
  users: [{ id: 'u-1', email: 'user@example.com', created_at: '2026-10-20T08:00:00Z' }],
});

describe('动态卡片的标题', () => {
  it('登录、保存定位都有标题', () => {
    const [login] = activityEvents([{ id: 1, user_id: 'u-1', kind: 'login', label: '登录', created_at: minutesBefore(1) }], { dir, now: NOW });
    expect(login.feature).toBe('登录');

    const [pos] = activityEvents([{ id: 2, user_id: 'u-1', kind: 'positioning', label: '创作简报', ref_id: 'p-2', created_at: minutesBefore(2) }], { dir, now: NOW });
    expect(pos.feature).toBe('创作简报');
  });

  it('老数据 label 为空时，用类别兜底，不会空着', () => {
    const [pos] = activityEvents([{ id: 3, user_id: 'u-1', kind: 'positioning', label: '', ref_id: 'p-3', created_at: minutesBefore(2) }], { dir, now: NOW });
    expect(pos.feature).toBe('账号定位');
  });
});

describe('保存定位的正文', () => {
  it('按 positioning:<id> 找到正文，写进摘录（有权限、取到了的时候）', () => {
    const rows: ActivityRow[] = [{ id: 4, user_id: 'u-1', kind: 'positioning', label: '账号定位', ref_kind: null, ref_id: 'p-4', created_at: minutesBefore(2) }];
    const contents = new Map([['positioning:p-4', { result: '老板娘每天现做三道热菜' }]]);
    const [e] = activityEvents(rows, { dir, contents, now: NOW });
    expect(e.excerpt).toContain('老板娘每天现做三道热菜');
    // 保存定位没有可点开的原始记录（record 接口只认生成和对话）
    expect(e.ref).toBeUndefined();
  });

  it('没有内容（没权限或没取到）时不编正文', () => {
    const rows: ActivityRow[] = [{ id: 5, user_id: 'u-1', kind: 'positioning', label: '账号定位', ref_id: 'p-5', created_at: minutesBefore(2) }];
    const [e] = activityEvents(rows, { dir, now: NOW });
    expect(e.excerpt).toBeUndefined();
  });

  it('时间线和快照都会去取保存定位的正文', () => {
    const timeline = readFileSync(join(process.cwd(), 'app/api/admin/monitor/timeline/route.ts'), 'utf8');
    const snapshot = readFileSync(join(process.cwd(), 'app/api/admin/monitor/route.ts'), 'utf8');
    expect(timeline).toMatch(/from\('account_positioning'\)\.select\('id, full_content'\)/);
    expect(snapshot).toMatch(/from\('account_positioning'\)\.select\('id, full_content'\)/);
    expect(snapshot).toMatch(/contents: positioningContents/);
  });
});
