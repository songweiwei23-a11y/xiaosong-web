/**
 * 账号作品概况：三种视频的确定配比、分类型反馈、下一批建议、模型输出的解析、提示词，以及同步给创作上下文。
 * 全部是纯函数，不调用模型和数据库。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROLE_SPECS } from '@/lib/content-roles';
import { summarizePerformance, type PerformanceRow } from '@/lib/performance';
import {
  insightPrompt,
  mixReport,
  nextBatchHint,
  parseInsightJson,
  roleFeedback,
  roleOfPurpose,
  sharesOf,
  workInsightPromptBlock,
  type WorkInsight,
} from '@/lib/work-insight';
import { buildWorkInsight, insightPromptFor, type SettingsOf } from '@/lib/work-insight-build';
import { buildContextBlock, type CreatorContext } from '@/lib/creator-context';

const PLAN = { 流量型: 45, 人设型: 10, 变现型: 45 };

function insightWith(over: Partial<WorkInsight> = {}): WorkInsight {
  const mix = mixReport([{ purpose: '流量型' }, { purpose: '流量型' }, { purpose: '人设型' }, { purpose: '变现型' }], PLAN);
  return {
    generatedAt: '2026-10-21T08:00:00.000Z',
    overview: { works: 4, shot: 4, published: 3, withData: 0, materials: 0 },
    mix,
    feedback: roleFeedback(summarizePerformance([])),
    dataNotes: [],
    materialMix: null,
    items: [],
    planning: ['下一批多拍变现型'],
    reviewNotes: [],
    materialNotes: [],
    modelUsed: true,
    caveats: [],
    ...over,
  };
}

describe('三种视频的判断（确定配比只认作品记录的目的）', () => {
  it('只认写明的单一目的；多目的和「按配比」这类不算进某一类', () => {
    expect(roleOfPurpose('流量型')).toBe('流量型');
    expect(roleOfPurpose('人设型')).toBe('人设型');
    expect(roleOfPurpose('变现型')).toBe('变现型');
    expect(roleOfPurpose('人设型+变现型')).toBe('多目的');
    expect(roleOfPurpose('按配比')).toBe('未记录');
    expect(roleOfPurpose('')).toBe('未记录');
    expect(roleOfPurpose(null)).toBe('未记录');
  });

  it('三类占比合计正好 100，按最大余数分配', () => {
    const s = sharesOf({ 流量型: 1, 人设型: 1, 变现型: 1 })!;
    expect(s.流量型 + s.人设型 + s.变现型).toBe(100);
    expect(sharesOf({ 流量型: 0, 人设型: 0, 变现型: 0 })).toBeNull();
  });

  it('配比报告：计数、占比、没有目的的作品单独说明', () => {
    const m = mixReport([{ purpose: '流量型' }, { purpose: '变现型' }, { purpose: null }, { purpose: '人设型+变现型' }], PLAN);
    expect(m.counts).toEqual({ 流量型: 1, 人设型: 0, 变现型: 1, 多目的: 1, 未记录: 1 });
    expect(m.shares).toEqual({ 流量型: 50, 人设型: 0, 变现型: 50 });
    expect(m.gaps.join('')).toContain('2 条作品没有记录视频目的');
  });

  it('偏差超过 10 个点才提示；样本少于 3 条不下结论', () => {
    const few = mixReport([{ purpose: '变现型' }], PLAN);
    expect(few.gaps.some((g) => g.includes('偏'))).toBe(false);
    const many = mixReport([{ purpose: '变现型' }, { purpose: '变现型' }, { purpose: '变现型' }, { purpose: '人设型' }], PLAN);
    const hint = many.gaps.join('');
    expect(hint).toContain('变现型实际占 75%，档案计划 45%，偏多 30 个百分点');
    expect(hint).toContain('流量型实际占 0%，档案计划 45%，偏少 45 个百分点');
  });
});

describe('分类型数据反馈和下一批建议', () => {
  const rows: PerformanceRow[] = [
    { title: 'a', purpose: '变现型', tactic: null, scriptType: null, platform: '抖音', publishedAt: null, metrics: { views: 1000, completion: 40, inquiries: 5 } as PerformanceRow['metrics'] },
    { title: 'b', purpose: '变现型', tactic: null, scriptType: null, platform: '抖音', publishedAt: null, metrics: { views: 2000, completion: 30, inquiries: 9 } as PerformanceRow['metrics'] },
    { title: 'c', purpose: '变现型', tactic: null, scriptType: null, platform: '抖音', publishedAt: null, metrics: { views: 3000, completion: 20, inquiries: 3 } as PerformanceRow['metrics'] },
  ];

  it('每类的反馈只用录了数据的作品；样本不够标明不下结论', () => {
    const fb = roleFeedback(summarizePerformance(rows));
    const sell = fb.find((f) => f.role === '变现型')!;
    expect(sell.n).toBe(3);
    expect(sell.enough).toBe(true);
    expect(sell.line).toContain('平均播放 2000');
    const flow = fb.find((f) => f.role === '流量型')!;
    expect(flow.n).toBe(0);
    expect(flow.line).toBe('还没有录了数据的作品');
  });

  it('下一批建议：指出计划比实际缺得最多的一类；样本够才给', () => {
    const m = mixReport([{ purpose: '变现型' }, { purpose: '变现型' }, { purpose: '变现型' }, { purpose: '人设型' }], PLAN);
    const hint = nextBatchHint(m)!;
    expect(hint).toContain('流量型（计划 45%，实际 0%）');
    expect(hint).toContain('仍以本次创作目标为准');
    expect(nextBatchHint(mixReport([{ purpose: '变现型' }], PLAN))).toBeNull();
    const even = mixReport([{ purpose: '流量型' }, { purpose: '变现型' }, { purpose: '变现型' }, { purpose: '流量型' }, { purpose: '人设型' }], { 流量型: 40, 人设型: 20, 变现型: 40 });
    // 三类都在计划的 5 个点以内：不列缺口，只说基本一致
    expect(nextBatchHint(even)).toContain('基本一致');
  });
});

describe('模型输出的解析', () => {
  it('能从夹杂文字的回答里取出 JSON，并规范化标签', () => {
    const raw = `好的，分析如下：\n{"planning":["下一批拍 3 条变现型"],"feedback":["开头太长"],"materials":["一份选题表"],"items":[{"title":"摊主的一句实话","role":"人设型","scriptType":"讲故事","published":true,"views":"1.2 万"},{"title":"无法判断的标题","role":"别的"}]}\n以上。`;
    const p = parseInsightJson(raw)!;
    expect(p.planning).toEqual(['下一批拍 3 条变现型']);
    expect(p.reviewNotes).toEqual(['开头太长']);
    expect(p.items[0]).toMatchObject({ title: '摊主的一句实话', role: '人设型', scriptType: '讲故事', published: true, views: '1.2 万' });
    expect(p.items[1]).toMatchObject({ title: '无法判断的标题', role: '不确定', scriptType: null, published: null });
  });

  it('格式不对就返回 null，界面只显示确定的部分', () => {
    expect(parseInsightJson('没有 json 的回答')).toBeNull();
    expect(parseInsightJson('{坏的 json}')).toBeNull();
  });
});

describe('提示词：三种视频的定义统一取自 ROLE_SPECS', () => {
  it('系统提示里逐字带着三种视频的用途，用户提示里带配比和作品清单', () => {
    const p = insightPrompt({
      profileSummary: '- 档案名称：锦园',
      works: [{ title: '摊主的一句实话', role: '人设型', tactic: null, status: '已发布', metrics: null }],
      mix: mixReport([{ purpose: '人设型' }], PLAN),
      feedback: roleFeedback(summarizePerformance([])),
      dataNotes: [],
      materialTexts: [{ name: '选题表.csv', text: '标题,类型\n摊主,人设' }],
    });
    expect(p.system).toContain(ROLE_SPECS.流量型.job);
    expect(p.system).toContain(ROLE_SPECS.变现型.metrics);
    expect(p.user).toContain('「摊主的一句实话」｜目的：人设型');
    expect(p.user).toContain('### 文件：选题表.csv');
    expect(p.system).toContain('只输出一个 JSON 对象');
  });
});

describe('组装：确定的配比来自作品记录，文件和模型的结果单独放', () => {
  const settingsOf: SettingsOf = new Map([
    ['w1', { purpose: '变现型', tactic: '案例引入型' }],
    ['w2', { purpose: '流量型' }],
  ]);
  const profile = { id: 'p1', profile_name: '锦园', content_mix: null };

  it('没有模型也能给出配比、数据和注意事项，并说明缺什么', () => {
    const insight = buildWorkInsight({
      profile,
      works: [
        { id: 'w1', title: 'A', is_done: true, shoot_status: 'published', published_at: '2026-10-01', metrics: null },
        { id: 'w2', title: 'B', is_done: true, shoot_status: 'shot', published_at: null, metrics: null },
        { id: 'w3', title: 'C', is_done: false, shoot_status: 'none', published_at: null, metrics: null },
      ],
      settingsOf,
      materials: [],
      model: { used: false, parsed: null, notes: ['分析模型还没有配置'] },
      now: new Date('2026-10-21T08:00:00Z'),
    });
    // 「已拍」包含已发布（已发布的作品一定已经拍过）
    expect(insight.overview).toEqual({ works: 3, shot: 2, published: 1, withData: 0, materials: 0 });
    expect(insight.mix.counts.变现型).toBe(1);
    expect(insight.mix.counts.未记录).toBe(1);
    expect(insight.modelUsed).toBe(false);
    expect(insight.caveats).toContain('还没有能读出文字的导入文件，识别配比只看作品记录');
    expect(insight.caveats).toContain('分析模型还没有配置');
    expect(insight.materialMix).toBeNull();
  });

  it('模型识别出的标题单独计数，标为推测，不混进确定配比', () => {
    const insight = buildWorkInsight({
      profile,
      works: [{ id: 'w1', title: 'A', is_done: true, shoot_status: 'none', published_at: null, metrics: null }],
      settingsOf,
      materials: [{ filename: '选题.csv', status: 'ok', content: 'x' }],
      model: {
        used: true,
        parsed: {
          planning: ['多拍变现型'],
          reviewNotes: [],
          materialNotes: ['一份选题表'],
          items: [
            { title: 'x', role: '流量型', scriptType: null, structure: null, style: null, opening: null, audience: null, published: null, views: null, file: null },
            { title: 'y', role: '不确定', scriptType: null, structure: null, style: null, opening: null, audience: null, published: null, views: null, file: null },
          ],
        },
        notes: [],
      },
    });
    expect(insight.materialMix).toEqual({ counts: { 流量型: 1, 人设型: 0, 变现型: 0, 不确定: 1 }, total: 2 });
    expect(insight.mix.counts.流量型).toBe(0);
    expect(insight.modelUsed).toBe(true);
  });

  it('提示词的组装和分析用的是同一批数据', () => {
    const p = insightPromptFor({
      profile,
      works: [{ id: 'w2', title: 'B', is_done: true, shoot_status: 'shot', published_at: null, metrics: null }],
      settingsOf,
      materials: [{ filename: '表.csv', status: 'ok', content: '内容' }],
    });
    expect(p.user).toContain('「B」｜目的：流量型');
    expect(p.user).toContain('### 文件：表.csv');
  });
});

describe('同步给创作上下文：规划类板块能拿到，其它板块不乱塞', () => {
  // 上下文块需要档案才会拼（没有档案整块为空），所以这里给一个档案
  const ctx = {
    profile: { id: 'p1', profile_name: '锦园', account_track: ['本地服务'] },
    positioning: null,
    dealReasons: [],
    workInsight: insightWith(),
  } as unknown as CreatorContext;

  it('账号作品概况的块里有确定的配比和下一批建议，没有分析就是空串', () => {
    const block = workInsightPromptBlock(insightWith());
    expect(block).toContain('确定的配比（按作品记录的目的，4 条）');
    expect(block).toContain('下一批建议：');
    expect(block).toContain('下一批优先补');
    expect(workInsightPromptBlock(null)).toBe('');
  });

  it('选题板块的上下文里有它；脚本板块保持原来的只给档案（方案 D）', () => {
    // 概况块的标题是「这个账号的作品概况（日期 分析）」
    expect(buildContextBlock(ctx, 'topic')).toContain('这个账号的作品概况');
    expect(buildContextBlock(ctx, 'script')).not.toContain('这个账号的作品概况');
  });

  it('客户端和服务端的上下文都加载这份概况，接口是同一个', () => {
    const hook = fs.readFileSync(path.join(process.cwd(), 'hooks/useCreatorContext.ts'), 'utf8');
    const board = fs.readFileSync(path.join(process.cwd(), 'lib/assistant/board-context.ts'), 'utf8');
    expect(hook).toContain('/api/work-insights?profileId=');
    expect(board).toContain('/api/work-insights?profileId=');
    expect(hook).toContain('workInsight');
    expect(board).toContain('workInsight');
  });

  it('作品的删除、拍摄发布状态、录数据、导入文件都会让上下文缓存失效', () => {
    const works = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/works/page.tsx'), 'utf8');
    const panel = fs.readFileSync(path.join(process.cwd(), 'components/works/MaterialsPanel.tsx'), 'utf8');
    expect((works.match(/invalidateCreatorContext\(\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(panel.match(/invalidateCreatorContext\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('接口与迁移的约定', () => {
  it('路由文件只导出 HTTP 方法和 dynamic（Next 不允许其它导出）', () => {
    for (const f of ['app/api/work-materials/route.ts', 'app/api/work-insights/route.ts']) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
      const exported = [...src.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((m) => m[1]);
      for (const name of exported) expect(['GET', 'POST', 'DELETE', 'dynamic']).toContain(name);
    }
  });

  it('迁移表都开启了行级安全，并登记在迁移清单里', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261021_account_materials.sql'), 'utf8');
    expect(sql).toContain('enable row level security');
    expect(sql).not.toMatch(/create policy/i);
    const reg = fs.readFileSync(path.join(process.cwd(), 'lib/migration-registry.ts'), 'utf8');
    expect(reg).toContain('file: "20261021_account_materials.sql"');
    expect(reg).toContain('"account_work_insights"');
  });
});
