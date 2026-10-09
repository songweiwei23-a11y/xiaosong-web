/**
 * 创作进度分页、分组计数（2026-10-04）；首页辅助区收起按账号分开记。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
import { readCode } from './helpers/source';

const env = vi.hoisted(() => ({ userId: 'user-a', db: null as any }));
vi.mock('@/lib/api-guard', () => ({ requireUser: async () => ({ ok: true, userId: env.userId }) }));
vi.mock('@/lib/admin-auth', () => ({ getServerSupabase: async () => env.db }));
vi.mock('@/lib/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }));
import { GET } from '@/app/api/works/route';

const uuid = (n: number) => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString();
const get = async (url: string) => { const r = await GET(new Request(`https://local${url}`)); return { status: r.status, body: await r.json() }; };

describe('作品列表：分组、翻页、计数', () => {
  beforeEach(() => {
    const works: any[] = [];
    // 60 条创作中、7 条待拍摄、3 条已拍、2 条已发；另有别人的
    for (let i = 0; i < 72; i++) {
      const g = i < 60 ? ['none', false] : i < 67 ? ['none', true] : i < 70 ? ['shot', true] : ['published', true];
      works.push({ id: uuid(i), user_id: 'user-a', title: `作品${i}`, profile_id: null, shoot_status: g[0], is_done: g[1], updated_at: at(i), created_at: at(i) });
    }
    works.push({ id: uuid(999), user_id: 'user-b', title: '别人的', shoot_status: 'none', is_done: true, updated_at: at(999), created_at: at(0) });
    // 第 0 条作品有 1200 版历史：环节不能因为一次 1000 行上限被算成没做
    const items = Array.from({ length: 1200 }, (_, i) => ({ id: uuid(5000 + i), user_id: 'user-a', work_id: uuid(0), task_type: i === 1199 ? '标题封面' : '脚本生成', created_at: at(i) }));
    env.db = createFakeDb({ works, script_history: items });
  });

  it('各组数量是数据库计数，超过 50 条也准；不混别人的', async () => {
    const { body } = await get('/api/works?counts=1');
    expect(body).toEqual({ active: 60, toShoot: 7, shot: 3, published: 2, all: 72 });
  });

  it('按组在服务端筛、翻页，最后一页拿得到最早的作品', async () => {
    const p1 = (await get('/api/works?group=active&limit=20')).body;
    expect(p1).toHaveLength(20);
    expect(p1[0].title).toBe('作品59');
    const p3 = (await get('/api/works?group=active&limit=20&offset=40')).body;
    expect(p3.map((w: any) => w.title).at(-1)).toBe('作品0');
    expect((await get('/api/works?group=toShoot&limit=20')).body.map((w: any) => w.title)).toEqual(['作品66', '作品65', '作品64', '作品63', '作品62', '作品61', '作品60']);
  });

  it('作品的环节按页取完：第 1200 版（标题封面）也算上', async () => {
    const last = (await get('/api/works?group=active&limit=20&offset=40')).body.find((w: any) => w.id === uuid(0));
    expect(last.stages.find((s: any) => s.name === '标题封面').done).toBe(true);
  });

  it('创作进度页：地址 ?group= 打开指定组；数量拿不到不显示成 0；有「再加载」', () => {
    const page = readCode('app/dashboard/works/page.tsx');
    expect(page).toMatch(/new URLSearchParams\(window\.location\.search\)\.get\("group"\)/);
    expect(page).toMatch(/counts \? \(f === "all" \? counts\.all : counts\[f\]\) : null/);
    expect(page).toMatch(/再加载 \{PAGE\} 条/);
    expect(readCode('components/works/WorkCard.tsx')).toMatch(/<ProductionPack work=\{detail\} \/>/);
  });
});

describe('作品按档案隔离（档案 1 的作品档案 2 看不到）', () => {
  const P1 = '11111111-1111-4111-8111-111111111111';
  const P2 = '22222222-2222-4222-8222-222222222222';
  beforeEach(() => {
    env.db = createFakeDb({ works: [
      { id: uuid(1), user_id: 'user-a', title: '档案一的作品', profile_id: P1, shoot_status: 'none', is_done: false, updated_at: at(1) },
      { id: uuid(2), user_id: 'user-a', title: '档案二的作品', profile_id: P2, shoot_status: 'none', is_done: true, updated_at: at(2) },
      { id: uuid(3), user_id: 'user-a', title: '没挂档案的旧作品', profile_id: null, shoot_status: 'none', is_done: false, updated_at: at(3) },
    ], script_history: [] });
  });

  it('列表、分组、计数都只算当前档案的；default 只看没挂档案的', async () => {
    expect((await get(`/api/works?profileId=${P1}`)).body.map((w: any) => w.title)).toEqual(['档案一的作品']);
    expect((await get(`/api/works?profileId=${P2}&group=toShoot`)).body.map((w: any) => w.title)).toEqual(['档案二的作品']);
    expect((await get(`/api/works?profileId=${P1}&group=toShoot`)).body).toEqual([]);
    expect((await get(`/api/works?counts=1&profileId=${P1}`)).body).toMatchObject({ active: 1, toShoot: 0, all: 1 });
    expect((await get('/api/works?profileId=default')).body.map((w: any) => w.title)).toEqual(['没挂档案的旧作品']);
    expect((await get('/api/works?profileId=乱写')).status).toBe(400);
  });

  it('前端取作品一律带上当前档案（顶栏进行中、创作进度、首页、选题页都走这里）', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => { calls.push(url); return new Response('[]'); });
    vi.stubGlobal('localStorage', { getItem: () => P2, setItem() {}, removeItem() {} });
    vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} });
    const works = await import('@/lib/works');
    await works.listWorks(12);
    await works.listWorksPage({ group: 'active' });
    await works.workGroupCounts();
    expect(calls.every((u) => u.includes(`profileId=${P2}`))).toBe(true);
    expect(calls).toHaveLength(3);
    vi.unstubAllGlobals();
  });

  it('切换档案后各处重新取：顶栏进行中、创作进度、首页、历史、素材库、选题页', () => {
    expect(readCode('components/dashboard/InProgressStrip.tsx')).toMatch(/onActiveProfileChange\(\(\) => setProfileTick/);
    expect(readCode('app/dashboard/works/page.tsx')).toMatch(/onActiveProfileChange\(\(\) => \{ refreshCounts\(\); setProfileTick/);
    expect(readCode('app/dashboard/page.tsx')).toMatch(/loadProfileWork\(\)\.catch/);
    expect(readCode('app/history/page.tsx')).toMatch(/profileHistoryQuery\(getActiveProfileId\(\)\)/);
    const lib = readCode('app/dashboard/library/page.tsx');
    expect(lib).not.toMatch(/全部档案/);
    expect(lib).toMatch(/getActiveProfileId\(\) \|\| DEFAULT_PROFILE_SCOPE/);
    expect(readCode('app/dashboard/topic/page.tsx')).toMatch(/onActiveProfileChange\(\(\) => \{ listWorks\(50\)/);
  });
});

describe('首页辅助区：收起按账号分开记', () => {
  const store: Record<string, string> = {};
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } });
  });

  it('A 收起的，B 登录看到的还是展开；老的公共键沿用一次', async () => {
    const { readCollapsed, writeCollapsed } = await import('@/lib/home-prefs');
    writeCollapsed('A', 'today', true);
    expect(readCollapsed('A', 'today')).toBe(true);
    expect(readCollapsed('B', 'today')).toBeNull();
    store['kaiwu:launch-plan-collapsed'] = '1';
    expect(readCollapsed('B', 'launchPlan')).toBe(true);
    writeCollapsed('B', 'launchPlan', false);
    expect(readCollapsed('B', 'launchPlan')).toBe(false);
  });

  it('首页首屏三个入口；今日看板可收起且收起时仍挂着（白噪音不断）', () => {
    const home = readCode('app/dashboard/page.tsx');
    expect(home.indexOf('<QuickStart')).toBeLessThan(home.indexOf('<TodayBoard'));
    expect(home).toMatch(/<div hidden=\{todayCollapsed\}>\s*<TodayBoard \/>/);
    const qs = readCode('components/dashboard/QuickStart.tsx');
    for (const t of ['接着上次', '导入文案审稿', '今天拍什么']) expect(qs).toContain(t);
    expect(qs).toContain('/dashboard/works?group=toShoot');
  });
});
