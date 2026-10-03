/**
 * 数据回流（2026-10-03）：发出去的视频录了数据 → 复盘 → 反哺选题、方向、起号、自由对话
 */
import { describe, it, expect } from 'vitest';
import { readMetrics, metricsLine, summarizePerformance, performancePromptBlock, workScore, MIN_SAMPLE, type PerformanceRow } from '@/lib/performance';
import { buildContextBlock } from '@/lib/creator-context';
import { readCode, readSource } from './helpers/source';

const row = (title: string, purpose: string, tactic: string, m: PerformanceRow['metrics']): PerformanceRow => ({ title, purpose, tactic, metrics: m });

describe('录数据', () => {
  it('只留认识的项；"1,200""32%"这种也认；负数和乱写的丢掉；全空返回 null', () => {
    const m = readMetrics({ views: '1,200', completion: '32.46%', likes: -5, inquiries: 3, hack: 1, note: ' 上了同城热榜 ' })!;
    expect(m).toMatchObject({ views: 1200, completion: 32.5, inquiries: 3, note: '上了同城热榜' });
    expect(m.likes).toBeUndefined();
    expect(readMetrics({ views: '' })).toBeNull();
    expect(readMetrics(null)).toBeNull();
  });

  it('完播率不超过 100', () => {
    expect(readMetrics({ completion: 250 })!.completion).toBe(100);
  });

  it('一行看完', () => {
    expect(metricsLine({ views: 12000, completion: 32, inquiries: 5 })).toBe('播放 1.2万 · 完播率 32% · 咨询 5');
    expect(metricsLine({ views: 12500 })).toBe('播放 1.25万'); // 不四舍五入成 1.3 万
    expect(metricsLine({ views: 1234567 })).toBe('播放 123.5万');
  });

  it('综合分：咨询、成交比播放值钱', () => {
    expect(workScore({ views: 1000, inquiries: 5 })).toBeGreaterThan(workScore({ views: 2000 }));
  });
});

describe('复盘', () => {
  const rows = [
    row('选题A', '流量型', '反向操作', { views: 20000, completion: 35 }),
    row('选题B', '流量型', '反向操作', { views: 15000, completion: 30 }),
    row('选题C', '变现型', '晒过程', { views: 3000, completion: 40, inquiries: 8, deals: 2 }),
    row('选题D', '变现型', '晒过程', { views: 2500, completion: 10, inquiries: 4 }),
    row('选题E', '人设型', '讲故事', { views: 800, completion: 12 }),
  ];

  it('按三种视频、拍法汇总；最好最差；看得出的规律', () => {
    const s = summarizePerformance(rows);
    expect(s.count).toBe(5);
    expect(s.byPurpose[0]).toMatchObject({ name: '流量型', n: 2, avgViews: 17500 });
    expect(s.best[0].title).toBe('选题A');
    expect(s.worst.map((r) => r.title)).toContain('选题E');
    expect(s.insights.join('|')).toMatch(/流量型平均播放（17500）明显高于变现型/);
    expect(s.insights.join('|')).toMatch(/咨询和成交主要来自变现型（共 12 个咨询、2 单）/);
    expect(s.insights.join('|')).toMatch(/完播率低于 15%/);
  });

  it(`样本少于 ${MIN_SAMPLE} 条：不下结论`, () => {
    const s = summarizePerformance(rows.slice(0, 2));
    expect(s.insights).toEqual([expect.stringMatching(/样本太少，先别下结论/)]);
    expect(performancePromptBlock(s)).toMatch(/样本还少，上面只当参考/);
  });

  it('写进提示词：有数据才写；告诉 AI 多做有效的、别丢掉已验证的', () => {
    expect(performancePromptBlock(null)).toBe('');
    expect(performancePromptBlock(summarizePerformance([]))).toBe('');
    const b = performancePromptBlock(summarizePerformance(rows));
    expect(b).toContain('这个号发出去的真实数据（5 条录了数据）');
    expect(b).toContain('- 流量型（2 条）：平均播放 17500');
    expect(b).toMatch(/数据好的方向、拍法多做/);
  });

  it('规划类板块（选题、方向、起号、自由对话）带上；写脚本、分镜不带', () => {
    const ctx = { profile: { id: 'p', profile_name: 'x' }, positioning: null, dealReasons: [], performance: summarizePerformance(rows) };
    for (const b of ['topic', 'direction', 'growth', 'freeChat'] as const) expect(buildContextBlock(ctx, b), b).toContain('真实数据');
    for (const b of ['script', 'storyboard', 'review'] as const) expect(buildContextBlock(ctx, b), b).not.toContain('真实数据');
  });
});

describe('接线', () => {
  it('作品接口存数据（校验后）；数据列没建时说清要跑哪个 SQL', () => {
    const api = readCode('app/api/works/route.ts');
    expect(api).toMatch(/patch\.metrics = body\.metrics === null \? null : readMetrics\(body\.metrics\)/);
    expect(api).toContain('20261003_work_metrics.sql');
  });

  it('复盘接口：取作品当时的创作设置（最新的脚本优先）', () => {
    const api = readCode('app/api/works/performance/route.ts');
    expect(api).toMatch(/fromScript && !had\.fromScript/);
    expect(api).toMatch(/summarizePerformance\(rows\)/);
  });

  it('已发布的作品能录数据；创作进度页有数据复盘；录完让各板块的上下文重新取', () => {
    expect(readCode('components/works/WorkCard.tsx')).toMatch(/onMetricsSave && status === "published"/);
    const page = readCode('app/dashboard/works/page.tsx');
    expect(page).toContain('<PerformanceReview revision={perfRev} />');
    expect(page).toMatch(/invalidateCreatorContext\(\)/);
  });

  it('账号上下文去取数据汇总；选题页自己拼上下文时也带上', () => {
    expect(readCode('hooks/useCreatorContext.ts')).toMatch(/\/api\/works\/performance\?profileId=/);
    expect(readCode('app/dashboard/topic/page.tsx')).toMatch(/performance: creatorContext\.performance/);
  });

  it('迁移文件', () => {
    expect(readSource('supabase/migrations/20261003_work_metrics.sql')).toMatch(/alter table public\.works add column if not exists metrics jsonb/);
  });
});
