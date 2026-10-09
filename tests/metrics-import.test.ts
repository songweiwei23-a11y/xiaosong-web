/**
 * 批量导入发布数据、数据对应稿子版本（2026-10-04）。
 */
import { describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
import { matchRowsToWorks, parseMetricsTable, parseNumber } from '@/lib/metrics-import';
import { readMetrics } from '@/lib/performance';

const env = vi.hoisted(() => ({ db: null as any }));
vi.mock('@/lib/api-guard', () => ({ requireUser: async () => ({ ok: true, userId: 'user-a' }) }));
vi.mock('@/lib/admin-auth', () => ({ getServerSupabase: async () => env.db }));
import { PUT } from '@/app/api/works/route';

describe('解析粘贴的数据表', () => {
  it('从表格复制的（制表符）：认出各列，1.2万、32%、1,200 都对', () => {
    const t = parseMetricsTable('作品名称\t播放量\t完播率\t3秒完播率\t平均播放时长\t点赞\t点赞率\t分享\t新增粉丝\n一元火锅怎么给料\t1.2万\t32%\t61.5%\t12秒\t1,200\t3%\t40\t25');
    expect(t.error).toBeUndefined();
    expect(t.rows[0].metrics).toEqual({ views: 12000, completion: 32, retention3s: 61.5, likes: 1200, shares: 40, follows: 25 });
    // 「平均播放时长」「点赞率」不能当成播放次数、点赞数
    expect(t.columns.filter((c) => !c.key).map((c) => c.name)).toEqual(['平均播放时长', '点赞率']);
  });

  it('CSV（逗号、带引号的标题）也认；没有标题列明确报错', () => {
    const t = parseMetricsTable('标题,播放,评论\n"老板说，太辣了",3000,12');
    expect(t.rows[0]).toMatchObject({ title: '老板说，太辣了', metrics: { views: 3000, comments: 12 } });
    expect(parseMetricsTable('播放,点赞\n100,2').error).toMatch(/标题列/);
    expect(parseNumber('2.5w')).toBe(25000);
    expect(parseNumber('abc')).toBeNull();
  });

  it('按标题对作品：完全一样优先；包含也算；对到多条不挂', () => {
    const works = [{ id: 'a', title: '一元火锅怎么给料' }, { id: 'b', title: '老板凌晨挑肉' }, { id: 'c', title: '老板凌晨挑肉（二）' }];
    const rows = parseMetricsTable('标题\t播放\n一元火锅怎么给料？\t100\n#老板凌晨挑肉\t200\n凌晨挑肉\t300\n不相干\t1').rows;
    const r = matchRowsToWorks(rows, works);
    expect(r[0].workId).toBe('a');
    expect(r[1].workId).toBe('b');
    expect(r[2]).toMatchObject({ workId: null, reason: expect.stringMatching(/2 条作品都像/) });
    expect(r[3].reason).toMatch(/没找到/);
  });
});

describe('数据对应哪一版稿子', () => {
  it('保存数据时服务端记下这条作品最新的审稿 / 脚本记录；前端传来的不信', async () => {
    const W = '55555555-5555-4555-8555-555555555555';
    env.db = createFakeDb({
      works: [{ id: W, user_id: 'user-a', title: 'T', updated_at: '2026-10-01T00:00:00Z' }],
      script_history: [
        { id: '66666666-6666-4666-8666-000000000001', user_id: 'user-a', work_id: W, task_type: '脚本生成', created_at: '2026-10-01T00:00:00Z' },
        { id: '66666666-6666-4666-8666-000000000002', user_id: 'user-a', work_id: W, task_type: '审稿优化', created_at: '2026-10-02T00:00:00Z' },
        { id: '66666666-6666-4666-8666-000000000003', user_id: 'user-a', work_id: W, task_type: '标题封面', created_at: '2026-10-03T00:00:00Z' },
      ],
    });
    const forged = { historyId: '66666666-6666-4666-8666-000000000009', taskType: '伪造', at: 'x' };
    const res = await PUT(new Request(`https://local/api/works?id=${W}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ metrics: { views: 100, contentVersion: forged } }) }));
    expect(res.status).toBe(200);
    expect(env.db.tables.works[0].metrics.contentVersion).toEqual({ historyId: '66666666-6666-4666-8666-000000000002', taskType: '审稿优化', at: '2026-10-02T00:00:00Z' });
    // 只有版本信息、没有任何数据：不算录了数据
    expect(readMetrics({ contentVersion: forged })).toBeNull();
  });
});
