// 老板现状（2026-11-02 产品方：「会调动整个开物，多维度、站在用户角度为用户办事」）：
// 每轮对话前把档案、地基、最近的创作、作品进度、对标、待办、额度看一遍，先替老板看出卡在哪
import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearSituationCache, loadSituation, situationBlock, situationSignals, type Situation } from '@/lib/assistant/situation';
import { ASSISTANT_SYSTEM } from '@/lib/assistant/run';

const base: Situation = {
  today: '2026-11-02',
  profileCount: 1,
  profile: { name: '阿杰剪发', industry: '理发' },
  positioningTypes: ['账号定位', '创作简报'],
  recent: [{ from: '脚本生成', title: '剪坏了怎么救', createdAt: '2026-11-01T10:00:00+08:00' }],
  works: [],
  todos: [],
  benchmarks: { accounts: 1, analyzed: 1, latestAt: '2026-11-01' },
  quota: { planName: '专业版', tightest: { featureName: '脚本', remaining: 20 } },
};

describe('看出来的事', () => {
  it('地基没打完排第一，并说清为什么要做', () => {
    const s = situationSignals({ ...base, positioningTypes: ['账号定位'] });
    expect(s[0]).toContain('下一步是「生成创作简报」');
    expect(s[0]).toContain('创作板块要等地基做完');
    expect(situationSignals({ ...base, profileCount: 0, profile: null, positioningTypes: [] })[0]).toContain('建一个账号档案');
  });

  it('待办过期、拍了没发、写完没拍、额度快没了都看得出来', () => {
    const s = situationSignals({
      ...base,
      todos: [{ content: '拍探店', done: false, due_at: '2026-10-30T10:00:00+08:00' }, { content: '发视频', done: false, due_at: '2026-11-02T18:00:00+08:00' }, { content: '旧的', done: true, due_at: '2026-10-01' }],
      works: [{ shoot_status: 'shot' }, { is_done: true, shoot_status: 'none' }, { is_done: true, shoot_status: 'none' }],
      quota: { planName: '基础版', tightest: { featureName: '选题', remaining: 1 } },
    }).join('\n');
    expect(s).toContain('过期 1 条，今天到期 1 条');
    expect(s).toContain('有 1 条拍完还没发');
    expect(s).toContain('有 2 条内容做完还没拍');
    expect(s).toContain('「选题」只剩 1 次');
  });

  it('出了选题没写脚本、好久没创作、发了几条还没对标、对标加了没拆', () => {
    expect(situationSignals({ ...base, recent: [{ from: '选题策划', title: '菜市场十条', createdAt: '2026-11-01T10:00:00+08:00' }] }).join('\n')).toContain('还没写成脚本');
    expect(situationSignals({ ...base, recent: [{ from: '脚本生成', title: 'x', createdAt: '2026-10-20T10:00:00+08:00' }] }).join('\n')).toContain('已经 13 天没有新的创作了');
    expect(situationSignals({ ...base, works: [{ shoot_status: 'published' }, { shoot_status: 'published' }, { shoot_status: 'published' }], benchmarks: { accounts: 0, analyzed: 0, latestAt: null } }).join('\n')).toContain('还没有对标账号');
    expect(situationSignals({ ...base, benchmarks: { accounts: 3, analyzed: 1, latestAt: null } }).join('\n')).toContain('有 2 个对标账号加了还没拆');
  });

  it('一切正常时不硬凑', () => {
    expect(situationSignals(base)).toEqual([]);
  });
});

describe('现状那一段', () => {
  it('写清档案、地基、最近创作、作品进度、对标、待办、额度；读不到的项不写', () => {
    const b = situationBlock({ ...base, works: [{ shoot_status: 'none' }, { shoot_status: 'published' }], todos: null });
    expect(b).toContain('【老板现状');
    expect(b).toContain('当前档案：阿杰剪发（理发）');
    expect(b).toContain('已有的定位类成果：账号定位、创作简报');
    expect(b).toContain('脚本生成「剪坏了怎么救」(11-01)');
    expect(b).toContain('没拍 1，拍完没发 0，已发布 1');
    expect(b).toContain('对标账号：1 个，拆过 1 个');
    expect(b).not.toContain('待办：未完成');
  });
});

describe('读现状', () => {
  beforeEach(() => clearSituationCache());

  const fake = (fail: string[] = []) => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      const path = new URL(url).pathname;
      calls.push(path);
      if (fail.includes(path)) return new Response('x', { status: 500 });
      const body: Record<string, unknown> = {
        '/api/profiles': [{ id: 'p1', profile_name: '阿杰剪发', industry: '理发' }],
        '/api/positioning': [{ positioning_type: '账号定位' }],
        '/api/creation-sessions': [],
        '/api/history': [],
        '/api/works': [{ shoot_status: 'shot' }],
        '/api/todos': [],
        '/api/benchmark': { accounts: [{ analyses: [{ created_at: '2026-11-01T00:00:00Z' }] }, { analyses: [] }] },
        '/api/quota/check': { planName: '专业版', tightest: null },
      };
      return Response.json(body[path] ?? []);
    }) as unknown as typeof fetch;
    return { calls, ctx: { userId: 'u1', cookie: 'c=1', internalBase: 'http://x', fetchImpl } };
  };

  it('各项并行读出来，组成现状；某一项读不到不影响别的', async () => {
    const { ctx } = fake(['/api/todos', '/api/quota/check']);
    const s = await loadSituation(ctx, 'p1');
    expect(s.profile).toEqual({ name: '阿杰剪发', industry: '理发' });
    expect(s.positioningTypes).toEqual(['账号定位']);
    expect(s.works).toHaveLength(1);
    expect(s.todos).toBeNull();
    expect(s.quota).toBeNull();
    expect(s.benchmarks).toEqual({ accounts: 2, analyzed: 1, latestAt: '2026-11-01' });
  });

  it('同一个老板 60 秒内复用，不每句话都读一遍', async () => {
    const { ctx, calls } = fake();
    await loadSituation(ctx, 'p1', 1_000);
    const n = calls.length;
    await loadSituation(ctx, 'p1', 30_000);
    expect(calls.length).toBe(n);
    await loadSituation(ctx, 'p1', 70_000);
    expect(calls.length).toBeGreaterThan(n);
  });
});

describe('接进助理', () => {
  it('每轮的系统提示词带上现状；读不到就不带，不影响对话', () => {
    const run = fs.readFileSync('lib/assistant/run.ts', 'utf8');
    expect(run).toContain('ASSISTANT_SYSTEM + assistantDateLine() + situation +');
    expect(run).toMatch(/loadSituation\([^)]*\)\s*\.then\(situationBlock\)\s*\.catch\(\(\) => ''\)/);
  });

  it('提示词：站在老板角度——看全局给最要紧的事并直接列出来、把想要的结果拆成开物的几步、派活说清对生意的用处、不每轮唠叨', () => {
    expect(ASSISTANT_SYSTEM).toContain('6.3 站在老板的角度办事（你能调动整个开物）');
    expect(ASSISTANT_SYSTEM).toContain('直接用 propose_plan 或对应的工具列出来，不只给建议');
    expect(ASSISTANT_SYSTEM).toContain('把它拆成开物里能做的几步');
    expect(ASSISTANT_SYSTEM).toContain('对他的生意有什么用');
    expect(ASSISTANT_SYSTEM).toContain('上一轮提过的不再提');
  });
});
