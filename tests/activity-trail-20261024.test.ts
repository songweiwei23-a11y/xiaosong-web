// 用户动态流水（2026-10-24）：登录、生成、对话、保存定位、充值都有记录；最近活跃和动态列表用同一份流水。
import { describe, expect, it } from 'vitest';
import { activeUsers, activityAction, activityEvents, buildDirectory, type ActivityRow } from '@/lib/monitor';

const NOW = Date.parse('2026-10-24T12:00:00Z');
const minutesBefore = (m: number) => new Date(NOW - m * 60_000).toISOString();
const dir = buildDirectory({
  users: [{ id: 'u-1', email: 'user@example.com', created_at: '2026-10-20T08:00:00Z' }],
});

describe('流水的动作描述', () => {
  it('登录、注册、保存定位、充值、生成、对话各有一句人话', () => {
    expect(activityAction({ kind: 'login', label: '登录' })).toBe('登录了');
    expect(activityAction({ kind: 'signup', label: '注册' })).toBe('注册了');
    expect(activityAction({ kind: 'positioning', label: '创作简报' })).toBe('保存了「创作简报」');
    expect(activityAction({ kind: 'order', label: '基础会员' })).toBe('下了充值订单（基础会员）');
    expect(activityAction({ kind: 'generation', label: '脚本生成' })).toBe('用了「脚本生成」');
    expect(activityAction({ kind: 'usage', label: '' })).toBe('用了「未知功能」');
  });
});

describe('流水转成动态卡片', () => {
  it('生成记录带上输入摘要、结果开头，并能点开看完整记录', () => {
    const rows: ActivityRow[] = [{ id: 7, user_id: 'u-1', kind: 'generation', label: '脚本生成', ref_kind: 'history', ref_id: 'h-7', created_at: minutesBefore(3) }];
    const contents = new Map([['history:h-7', { input: { topic: '川味烧烤' }, result: '老板凌晨四点开始腌肉' }]]);
    const [e] = activityEvents(rows, { dir, contents, now: NOW });
    expect(e.id).toBe('act:7');
    expect(e.title).toBe('user@example.com 用了「脚本生成」');
    expect(e.summary).toContain('主题：川味烧烤');
    expect(e.excerpt).toContain('老板凌晨四点开始腌肉');
    expect(e.ref).toEqual({ kind: 'history', id: 'h-7' });
  });

  it('没有内容（没权限）时只写动作，不编内容', () => {
    const rows: ActivityRow[] = [{ id: 8, user_id: 'u-1', kind: 'generation', label: '选题策划', ref_kind: 'history', ref_id: 'h-8', created_at: minutesBefore(3) }];
    const [e] = activityEvents(rows, { dir, now: NOW });
    expect(e.title).toBe('user@example.com 用了「选题策划」');
    expect(e.summary).toBeUndefined();
    expect(e.excerpt).toBeUndefined();
  });

  it('登录没有原始记录可点，也能显示在时间线里', () => {
    const [e] = activityEvents([{ id: 9, user_id: 'u-1', kind: 'login', label: '登录', created_at: minutesBefore(1) }], { dir, now: NOW });
    expect(e.title).toBe('user@example.com 登录了');
    expect(e.ref).toBeUndefined();
  });

  it('按时间从新到旧；时钟超前的未来记录不显示', () => {
    const rows: ActivityRow[] = [
      { id: 1, user_id: 'u-1', kind: 'login', label: '登录', created_at: minutesBefore(30) },
      { id: 2, user_id: 'u-1', kind: 'login', label: '登录', created_at: minutesBefore(5) },
      { id: 3, user_id: 'u-1', kind: 'login', label: '登录', created_at: new Date(NOW + 10 * 60_000).toISOString() },
    ];
    const events = activityEvents(rows, { dir, now: NOW });
    expect(events.map((e) => e.id)).toEqual(['act:2', 'act:1']);
  });
});

describe('最近活跃用的也是流水', () => {
  it('登录或保存定位比生成更近时，最后做了什么就是它', () => {
    const active = activeUsers({
      users: [{ id: 'u-1', email: 'user@example.com', created_at: '2026-10-20T08:00:00Z' }],
      generations: [{ id: 1, user_id: 'u-1', task_type: '脚本生成', created_at: minutesBefore(60) }],
      activity: [{ id: 2, user_id: 'u-1', kind: 'positioning', label: '创作简报', created_at: minutesBefore(2) }],
      dir,
      now: NOW,
    });
    expect(active).toHaveLength(1);
    expect(active[0].lastAction).toBe('保存了「创作简报」');
    expect(active[0].minutesAgo).toBe(2);
  });

  it('只有流水、没有生成记录的人也会出现在最近活跃里', () => {
    const active = activeUsers({
      users: [],
      activity: [{ id: 3, user_id: 'u-1', kind: 'login', label: '登录', created_at: minutesBefore(4) }],
      dir,
      now: NOW,
    });
    expect(active[0].lastAction).toBe('登录了');
  });
});
