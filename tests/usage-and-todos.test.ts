/**
 * 首页「本月已用」和待办。
 *
 * 线上 bug：企业版在额度检查里一进来就 return，"周期到期就重置"永远走不到；
 * 周期 9 月 9 日到期后，首页接口看到"周期已结束"一直显示 0——本月实际用了六十多次。
 * 这类"不报错、只是数不对"的毛病靠扫描守住。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { dayStartShanghai, monthStartShanghai } from '@/lib/usage-month';
import { carryOverNote, describeDue, normalizeTodoInput, shortDue, sortTodos, TODO_MAX_LEN, type Todo } from '@/lib/todos';
import { dayProgress, festivalOf, lunarDayName, lunarOf, periodOf } from '@/lib/clock';
import { readCode } from './helpers/source';

describe('本月按北京时间的自然月算', () => {
  it('北京时间 10 月 1 日凌晨四点，本月从北京时间 10 月 1 日零点算', () => {
    expect(monthStartShanghai(new Date('2026-09-30T20:00:00Z')).toISOString()).toBe('2026-09-30T16:00:00.000Z');
  });
  it('北京时间 9 月 30 日晚上，还是 9 月', () => {
    expect(monthStartShanghai(new Date('2026-09-30T15:00:00Z')).toISOString()).toBe('2026-08-31T16:00:00.000Z');
  });
});

describe('额度：企业版也要滚周期', () => {
  const guard = readCode('lib/api-guard.ts');

  it('"周期到期就重置"排在企业版放行之前', () => {
    const reset = guard.indexOf('now > periodEnd');
    const enterprise = guard.indexOf("planId === 'enterprise'");
    expect(reset).toBeGreaterThan(0);
    expect(enterprise).toBeGreaterThan(0);
    expect(reset, '企业版在重置之前就 return 了，周期永远不滚').toBeLessThan(enterprise);
  });

  it('每次扣减都记一条使用记录，带上任务名', () => {
    expect(guard).toMatch(/from\('usage_events'\)\s*\.insert\(\{ user_id: userId, feature, task_type/);
    expect(readCode('app/api/dify/stream/route.ts')).toMatch(/incrementUsageServer\(userId, getFeatureFromTaskType\(body\.taskType\), body\.taskType\)/);
  });

  it('额度接口每一种返回都带 monthUsed（少一个分支，那种套餐的首页就又是 0）', () => {
    const src = readCode('app/api/quota/check/route.ts');
    const returns = src.match(/NextResponse\.json\(\{[\s\S]*?\}\)/g) ?? [];
    const withTotal = returns.filter((r) => /totalUsed/.test(r) || /\.\.\.empty/.test(r));
    expect(withTotal.length).toBeGreaterThanOrEqual(4);
    for (const r of withTotal) expect(r).toMatch(/monthUsed|\.\.\.empty/);
    expect(src).toMatch(/const empty = \{[\s\S]*?monthUsed/);
    expect(src).toMatch(/monthStartShanghai\(\)/);
  });

  it('首页显示的是本月用量，会自己刷新，并挂了待办', () => {
    const src = readCode('app/dashboard/page.tsx');
    expect(src).toMatch(/\{quota\?\.monthUsed \?\? 0\}/);
    expect(src).toMatch(/addEventListener\("visibilitychange", refresh\)/);
    // 今日看板放在问候语下面、「开始创作」之前——进来第一眼就看到
    expect(src).toContain('<TodayBoard />');
    expect(src.indexOf('<TodayBoard />')).toBeLessThan(src.indexOf('lg:grid-cols-[1.35fr_1fr]'));
  });

  it('迁移：两张表都开了 RLS，用户只能动自己的', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260925_usage_events_todos.sql'), 'utf8');
    expect(sql).toMatch(/ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE user_todos ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ON user_todos\s+FOR ALL USING \(auth\.uid\(\) = user_id\) WITH CHECK/);
    // 使用记录用户只能读，不能自己加减
    expect(sql).toMatch(/ON usage_events\s+FOR SELECT USING/);
    expect(sql).not.toMatch(/ON usage_events\s+FOR (ALL|INSERT|UPDATE|DELETE)/);
  });
});

describe('待办', () => {
  const now = new Date(2026, 8, 25, 14, 0); // 本地时间 9 月 25 日 14:00
  const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).toISOString();

  it('截止时间说人话，分轻重', () => {
    expect(describeDue(null, now)).toBeNull();
    expect(describeDue(at(25, 18), now)).toEqual({ text: '今天 18:00', tone: 'soon' });
    expect(describeDue(at(26, 9, 30), now)).toEqual({ text: '明天 09:30', tone: 'soon' });
    expect(describeDue(at(25, 9), now)).toEqual({ text: '今天 09:00 已过', tone: 'overdue' });
    expect(describeDue(at(23, 9), now)).toEqual({ text: '已过 2 天', tone: 'overdue' });
    expect(describeDue(at(28, 9), now)?.tone).toBe('normal');
    expect(describeDue('不是时间', now)).toBeNull();
  });

  it('没做完的在前：有时间的按先后，没时间的排后面；做完的最后', () => {
    const t = (id: string, o: Partial<Todo>): Todo => ({
      id, content: id, due_at: null, done: false, done_at: null, created_at: at(20, 0), ...o,
    });
    const list = sortTodos([
      t('done', { done: true, done_at: at(24, 0) }),
      t('noDue', { created_at: at(24, 0) }),
      t('later', { due_at: at(28, 0) }),
      t('sooner', { due_at: at(26, 0) }),
    ]);
    expect(list.map((x) => x.id)).toEqual(['sooner', 'later', 'noDue', 'done']);
  });

  it('输入清洗：去空白、截长度、认不出的时间当没填', () => {
    expect(normalizeTodoInput({ content: '  拍门店  ' }).content).toBe('拍门店');
    expect(normalizeTodoInput({ content: 'x'.repeat(500) }).content).toHaveLength(TODO_MAX_LEN);
    expect(normalizeTodoInput({ content: 'a', dueAt: 'abc' }).dueAt).toBeNull();
    expect(normalizeTodoInput({ content: 'a', dueAt: '2026-09-26T10:00:00.000Z' }).dueAt).toBe('2026-09-26T10:00:00.000Z');
    expect(normalizeTodoInput(null)).toEqual({ content: '', dueAt: null });
  });

  it('接口：表没建时给前端能认的信号，改删都限定在自己名下', () => {
    const src = readCode('app/api/todos/route.ts');
    expect(src).toContain("code: 'TABLE_MISSING'");
    expect(src.match(/\.eq\('user_id', guard\.userId!\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});

describe('时钟', () => {
  it('农历日的叫法', () => {
    expect([1, 10, 15, 20, 21, 30].map(lunarDayName)).toEqual(['初一', '初十', '十五', '二十', '廿一', '三十']);
  });

  it('2026 年 9 月 25 日是农历八月十五，中秋', () => {
    const d = new Date(2026, 8, 25, 12, 0);
    expect(lunarOf(d)?.text).toBe('八月十五');
    expect(festivalOf(d)).toBe('中秋');
    expect(festivalOf(new Date(2026, 9, 1, 12))).toBe('国庆');
    expect(festivalOf(new Date(2026, 8, 24, 12))).toBeNull();
  });

  it('今天过了多少、钟点怎么说', () => {
    expect(dayProgress(new Date(2026, 8, 25, 12, 0))).toBeCloseTo(0.5, 5);
    expect(periodOf(new Date(2026, 8, 25, 23, 30))).toBe('深夜');
    expect(periodOf(new Date(2026, 8, 25, 9, 0))).toBe('上午');
  });
});

describe('待办时间线', () => {
  const now = new Date(2026, 8, 25, 14, 0);
  const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).toISOString();
  it('短时间：今天只写钟点，明天/昨天带前缀，更远写日期', () => {
    expect(shortDue(at(25, 18), now)).toBe('18:00');
    expect(shortDue(at(26, 9, 30), now)).toBe('明天 09:30');
    expect(shortDue(at(24, 12), now)).toBe('昨天 12:00');
    expect(shortDue(at(28, 10), now)).toBe('9月28日');
    expect(shortDue(null, now)).toBe('');
  });
});

describe('待办的记忆和清理', () => {
  const now = new Date(2026, 8, 26, 9, 0); // 9 月 26 日早上
  const at = (d: number, h: number) => new Date(2026, 8, d, h).toISOString();
  const t = (id: string, created: string, due: string | null = null): Todo =>
    ({ id, content: id, due_at: due, done: false, done_at: null, created_at: created });

  it('昨天没做完的留着，并说一声；过期的单独点出来', () => {
    expect(carryOverNote([t('a', at(25, 10)), t('b', at(25, 11))], now)).toBe('昨天没做完的 2 件，帮你留着了');
    expect(carryOverNote([t('a', at(25, 10), at(25, 18)), t('b', at(25, 11))], now))
      .toBe('昨天没做完的 2 件，帮你留着了，其中 1 件已经过了时间');
    expect(carryOverNote([t('a', at(20, 10))], now)).toBe('之前没做完的 1 件，帮你留着了');
  });

  it('今天新加的不算"留下来的"；今天的过期单独说；什么都没有就不提醒', () => {
    expect(carryOverNote([t('a', at(26, 7))], now)).toBeNull();
    expect(carryOverNote([t('a', at(26, 7), at(26, 8))], now)).toBe('有 1 件过了时间还没做');
    // 今天新加又过期的，不算进"其中"
    expect(carryOverNote([t('a', at(25, 10)), t('b', at(26, 7), at(26, 8))], now)).toBe('昨天没做完的 1 件，帮你留着了');
    expect(carryOverNote([], now)).toBeNull();
  });

  it('北京时间今天零点', () => {
    expect(dayStartShanghai(new Date('2026-09-25T20:00:00Z')).toISOString()).toBe('2026-09-25T16:00:00.000Z');
    expect(dayStartShanghai(new Date('2026-09-25T15:00:00Z')).toISOString()).toBe('2026-09-24T16:00:00.000Z');
  });

  it('接口：今天之前做完的删掉，没做完的不动；界面写明规则', () => {
    const src = readCode('app/api/todos/route.ts');
    expect(src).toMatch(/\.delete\(\)\s*\.eq\('user_id', guard\.userId!\)\.eq\('done', true\)\.lt\('done_at', today\)/);
    // 删除只针对做完的：逐条取出 .delete() 的调用链，没有一条带 done=false
    const chains = src.match(/\.delete\(\)(?:\s*\.\w+\([^)]*\))*/g) ?? [];
    expect(chains.length).toBeGreaterThanOrEqual(2); // 自动清理 + 用户手动删
    for (const c of chains) expect(c).not.toMatch(/eq\('done', false\)/);
    const ui = readCode('components/dashboard/TodayBoard.tsx');
    expect(ui).toContain('{TODO_RULE_NOTE}');
    expect(ui).toMatch(/carryOverNote\(t\.open, now\)/);
  });
});
