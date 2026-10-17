import { describe, expect, it } from 'vitest';
import { parseQuickMetrics, pendingMetricsWorks } from '@/lib/quick-metrics';
import { learningProgressLine } from '@/lib/verified-writing';

const NOW = Date.parse('2026-10-17T12:00:00+08:00');
const DAY = 86_400_000;

describe('发布后 3 个数快速录入（整改 B1）', () => {
  it('只填播放也能存；完播率、点赞选填', () => {
    const r = parseQuickMetrics({ views: '12000', completion: '', likes: '' }, NOW);
    expect(r).toMatchObject({ ok: true, metrics: { views: 12000 } });
  });

  it('播放支持「1.2万」这种写法', () => {
    const r = parseQuickMetrics({ views: '1.2万', completion: '32%', likes: '860' }, NOW);
    expect(r).toMatchObject({ ok: true, metrics: { views: 12000, completion: 32, likes: 860 } });
  });

  it('播放没填：给一句能照着做的话，不存', () => {
    const r = parseQuickMetrics({ views: '', completion: '30', likes: '' }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/先填播放量/);
  });

  it('完播率超过 100 不存', () => {
    const r = parseQuickMetrics({ views: '100', completion: '120', likes: '' }, NOW);
    expect(r.ok).toBe(false);
  });

  it('点赞不是数字不存', () => {
    const r = parseQuickMetrics({ views: '100', completion: '', likes: '很多' }, NOW);
    expect(r.ok).toBe(false);
  });

  it('待录数据：只列已发布满一天、还没录过的，最久的排前面，最多 3 条', () => {
    const works = [
      { id: 'a', title: '昨天发的', shoot_status: 'published', published_at: new Date(NOW - 1.5 * DAY).toISOString(), metrics: null },
      { id: 'b', title: '十天前发的', shoot_status: 'published', published_at: new Date(NOW - 10 * DAY).toISOString(), metrics: null },
      { id: 'c', title: '已经录过', shoot_status: 'published', published_at: new Date(NOW - 10 * DAY).toISOString(), metrics: { views: 1 } },
      { id: 'd', title: '今天刚发', shoot_status: 'published', published_at: new Date(NOW - 3 * 3600_000).toISOString(), metrics: null },
      { id: 'e', title: '还没拍', shoot_status: 'none', published_at: null, metrics: null },
      { id: 'f', title: '没有发布时间', shoot_status: 'published', published_at: null, metrics: null },
    ];
    const pending = pendingMetricsWorks(works, NOW);
    expect(pending.map((w) => w.id)).toEqual(['b', 'a']);
    expect(pending[0].days).toBe(10);
  });

  it('待录数据最多 3 条', () => {
    const works = Array.from({ length: 5 }, (_, i) => ({
      id: `w${i}`, title: `t${i}`, shoot_status: 'published', published_at: new Date(NOW - (i + 2) * DAY).toISOString(), metrics: null,
    }));
    expect(pendingMetricsWorks(works, NOW)).toHaveLength(3);
  });
});

describe('学习进度的一句话（整改 B2）', () => {
  it('一条都没录：说清楚怎么开始', () => {
    expect(learningProgressLine(0, 10)).toContain('录 3 个数');
  });

  it('还没到门槛：说还差几条', () => {
    expect(learningProgressLine(6, 10)).toBe('已录 6 条数据，再录 4 条，开物才会开始验证你的写法');
  });

  it('过了门槛但没有明显差别：说继续录会更准，不再说「还差」', () => {
    const line = learningProgressLine(12, 10);
    expect(line).toContain('还没有明显差别');
    expect(line).not.toContain('再录');
  });
});
