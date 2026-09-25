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
import { monthStartShanghai } from '@/lib/usage-month';
import { describeDue, normalizeTodoInput, sortTodos, TODO_MAX_LEN, type Todo } from '@/lib/todos';
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
    expect(src).toContain('<TodoCard />');
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
