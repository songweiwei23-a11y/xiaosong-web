/**
 * 转化漏斗。守的是"数不对、却没人发现"：比例算出 NaN、埋点漏了一个、
 * 公开接口被人拿来乱写、匿名统计却没在隐私政策里说。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { FUNNEL_KINDS, VISITOR_RE, buildFunnel, isFunnelKind } from '@/lib/funnel';
import { readCode, readSource } from './helpers/source';

describe('拼漏斗', () => {
  it('顺序固定，比例是占上一步的百分比', () => {
    const steps = buildFunnel({ landing_view: 200, landing_try: 50, register_view: 20, signup: 10, activated: 6, paid: 1 });
    expect(steps.map((s) => s.key)).toEqual(['landing_view', 'landing_try', 'register_view', 'signup', 'activated', 'paid']);
    expect(steps.map((s) => s.fromPrev)).toEqual([null, 25, 40, 50, 60, 17]);
  });

  it('上一步是 0 时不出 NaN / Infinity，脏数据当 0', () => {
    const steps = buildFunnel({ landing_view: 0, landing_try: 3, register_view: NaN as never, signup: -2, activated: 0, paid: 0 });
    expect(steps[1].fromPrev).toBeNull();
    expect(steps[2].count).toBe(0);
    expect(steps[3].count).toBe(0);
    expect(steps.every((s) => s.fromPrev === null || Number.isFinite(s.fromPrev))).toBe(true);
  });
});

describe('公开的记录接口', () => {
  it('事件名只认白名单，访客编号只认固定格式', () => {
    expect(isFunnelKind('landing_view')).toBe(true);
    expect(isFunnelKind('drop table')).toBe(false);
    expect(VISITOR_RE.test('3f2a9c1e-1111-4444-8888-abcdefabcdef')).toBe(true);
    expect(VISITOR_RE.test('<script>')).toBe(false);
    expect(VISITOR_RE.test('短')).toBe(false);
  });

  it('接口：白名单 + 格式 + 每 IP 限速；IP 不入库；出错也不让访客页面报错', () => {
    const api = readCode('app/api/funnel/route.ts');
    expect(api).toMatch(/if \(limited\(ip\)\)/);
    expect(api).toMatch(/isFunnelKind\(body\.kind\)/);
    expect(api).toMatch(/VISITOR_RE\.test\(body\.vid\)/);
    expect(api).toMatch(/insert\(\{ kind: body\.kind, visitor_id: body\.vid \}\)/);
    // 写进库的只有事件名和访客编号，没有 IP
    expect(api).not.toMatch(/insert\(\{[^}]*\bip/);
    expect(api).not.toMatch(/status: 500/);
  });

  it('表只能服务端写；迁移里的事件名和代码里的白名单一致', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260928_funnel_events.sql'), 'utf8');
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/);
    for (const k of FUNNEL_KINDS) expect(sql).toContain(`'${k}'`);
  });
});

describe('埋点都在', () => {
  it('打开首页、首页试用（输入和点行业两条路都记）、打开注册页', () => {
    const hero = readCode('components/landing/hero/TryHero.tsx');
    expect(hero).toMatch(/track\("landing_view"\)/);
    expect((hero.match(/track\("landing_try"\)/g) ?? []).length).toBe(2);
    expect(readCode('app/login/page.tsx')).toMatch(/if \(!isLogin\) track\("register_view"\)/);
  });

  it('同一访客同一事件一天只记一次；本机存不了就不记，不影响使用', () => {
    const lib = readCode('lib/funnel.ts');
    expect(lib).toMatch(/kaiwu:f:\$\{kind\}:\$\{day\}/);
    expect(lib).toMatch(/if \(!vid\) return;/);
  });
});

describe('后台', () => {
  it('漏斗接口要管理员；后三步按同一批注册的人算', () => {
    const api = readCode('app/api/admin/funnel/route.ts');
    expect(api).toContain('requireAdmin()');
    expect(api).toMatch(/filter\(\(id\) => signups\.has\(id\)\)/);
  });

  it('监控大屏上有漏斗', () => {
    expect(readCode('app/admin/monitor/page.tsx')).toContain('<FunnelPanel />');
  });
});

describe('隐私政策如实写了', () => {
  it('写明匿名访客编号、不记 IP；写明运营人员能看生成内容；不再说"没有任何访问统计"', () => {
    const privacy = readSource('app/privacy/page.tsx');
    expect(privacy).toContain('随机生成的匿名编号');
    expect(privacy).toContain('不记录你的 IP 地址');
    expect(privacy).toContain('运营人员可以在后台查看各账号的使用记录和生成内容');
    expect(privacy).not.toContain('本站没有使用任何访问统计');
  });
});
