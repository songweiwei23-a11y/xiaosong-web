/**
 * 「越用越懂你」二期 · C 阶段（docs/越用越懂你_二期方案_20261017.md 4.5、4.7）：
 *   - 事实记忆：生成时反复用到、档案里却没有（或写得不一样）的拍摄条件，提示一句；只提示，点了才写
 *   - 忽略过的不再提示；只能写四个结构化字段；只能看、写本人的档案
 *   - 选题选择：挑出来拿去写脚本的选题，进入学习（学的是内容取向）
 *   - 夜间学习：近一天有新脚本生成的档案也会被看一次
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
import { readCode } from './helpers/source';
import { FACT_MIN, FACT_WINDOW, factSuggestions, nextProfileValue, FACT_PROFILE_FIELDS, factKey } from '@/lib/fact-memory';

const env = vi.hoisted(() => ({ db: null as any, userId: 'u1', ask: null as any }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => env.db }));
vi.mock('@/lib/api-guard', () => ({ requireUser: async () => ({ ok: true, userId: env.userId }) }));
vi.mock('@/lib/dify-task', () => ({ askDify: (...a: unknown[]) => env.ask(...a), sseTask: () => new Response('') }));

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const P1 = '33333333-3333-4333-8333-333333333333';
const NOW = Date.parse('2026-10-17T02:00:00Z');
const NOW_ISO = new Date(NOW).toISOString();

const settings = (o: Record<string, unknown>) => ({ device: '手机', personnel: '一人', budget: '低成本(0-500)', scene: '店内', ...o });

/* ------------------------------ 事实记忆：判断 ------------------------------ */

describe('事实记忆：什么时候提示', () => {
  const profile = { equipment: ['单反'], team_structure: '一人', budget_per_video: '低成本(0-500)', shooting_location: ['店内'] };

  it('次数够、占多数、档案里没有 → 提示（多选追加）', () => {
    const recs = [settings({}), settings({}), settings({}), settings({ device: '单反' }), settings({})];
    const s = factSuggestions(recs, { ...profile, equipment: [] }, new Set());
    expect(s.find((x) => x.field === 'equipment')).toMatchObject({ value: '手机', kind: 'multi', current: '', n: 4, of: 5 });
  });

  it('档案里已经有的、次数不够的、「自动/AI」的，都不提示', () => {
    expect(FACT_MIN).toBe(3);
    // 两次，不到 3 次门槛
    expect(factSuggestions([settings({}), settings({})], profile, new Set()).find((x) => x.field === 'equipment')).toBeUndefined();
    expect(factSuggestions([settings({ device: '手机' }), settings({ device: '手机' })], profile, new Set())).toEqual([]);
    const auto = [settings({ device: 'AI推荐' }), settings({ device: 'AI推荐' }), settings({ device: 'AI推荐' }), settings({ device: 'AI推荐' })];
    expect(factSuggestions(auto, { ...profile, equipment: [] }, new Set())).toEqual([]);
  });

  it('单选：档案写的是「低成本」，他反复选「中成本」→ 提示「要改成这个吗？」', () => {
    const recs = [1, 2, 3, 4].map(() => settings({ budget: '中成本(500-2000)' }));
    const s = factSuggestions(recs, profile, new Set()).find((x) => x.field === 'budget_per_video')!;
    expect(s).toMatchObject({ kind: 'single', value: '中成本(500-2000)', current: '低成本(0-500)' });
  });

  it('忽略过的同一个字段、同一个值，不再提示', () => {
    const recs = [1, 2, 3, 4].map(() => settings({}));
    const key = factKey('equipment', '手机');
    expect(factSuggestions(recs, { ...profile, equipment: [] }, new Set([key])).find((x) => x.field === 'equipment')).toBeUndefined();
  });

  it('只看最近 10 次', () => {
    expect(FACT_WINDOW).toBe(10);
    const old = Array.from({ length: 12 }, (_, i) => settings({ device: i < 10 ? '单反' : '手机' }));
    expect(factSuggestions(old, { ...profile, equipment: [] }, new Set()).find((x) => x.value === '手机')).toBeUndefined();
  });
});

describe('事实记忆：写进档案的方式', () => {
  it('多选追加、不丢原来的；单选替换；重复不加', () => {
    expect(nextProfileValue(['单反'], 'multi', '手机')).toEqual(['单反', '手机']);
    expect(nextProfileValue(['单反', '手机'], 'multi', '手机')).toEqual(['单反', '手机']);
    expect(nextProfileValue('低成本', 'single', '中成本')).toBe('中成本');
  });

  it('只允许四个结构化字段，价格、产品这些自由的一律不碰', () => {
    expect([...FACT_PROFILE_FIELDS].sort()).toEqual(['budget_per_video', 'equipment', 'shooting_location', 'team_structure']);
  });
});

/* ------------------------------ 事实记忆接口 ------------------------------ */

describe('事实记忆接口：只看、只写本人的档案', () => {
  const route = () => import('@/app/api/fact-suggestions/route');
  const hist = (id: string, o: Record<string, unknown>) => ({ id, user_id: U1, task_type: '脚本生成', created_at: NOW_ISO, input_data: { profileId: P1, creationSettings: settings(o) } });
  const profileRow = (id = P1, user = U1) => ({ id, user_id: user, equipment: ['单反'], team_structure: '一人', budget_per_video: '低成本(0-500)', shooting_location: ['店内'], price_range: ['中端'] });

  beforeEach(() => {
    env.userId = U1;
    env.db = createFakeDb({
      user_profiles: [profileRow(), profileRow('44444444-4444-4444-8444-444444444444', U2)],
      script_history: [1, 2, 3, 4].map((n) => hist(`h${n}`, { device: '手机' })),
      user_signals: [],
    });
  });

  it('GET：返回这个档案的提示（只看本人、本档案）', async () => {
    const { GET } = await route();
    const data = await (await GET(new Request(`http://localhost/api/fact-suggestions?profileId=${P1}`) as any)).json();
    expect(data.suggestions.map((s: { value: string }) => s.value)).toEqual(['手机']);
  });

  it('别人的档案：404，不泄露', async () => {
    const { GET } = await route();
    expect((await GET(new Request('http://localhost/api/fact-suggestions?profileId=44444444-4444-4444-8444-444444444444') as any)).status).toBe(404);
  });

  it('接受：写进档案（多选追加），返回新值', async () => {
    const { POST } = await route();
    const res = await POST(new Request('http://localhost/api/fact-suggestions', { method: 'POST', body: JSON.stringify({ profileId: P1, action: 'accept', field: 'equipment', value: '手机' }) }) as any);
    expect(res.status).toBe(200);
    expect((await res.json()).value).toEqual(['单反', '手机']);
    expect(env.db.tables.user_profiles.find((r: Record<string, unknown>) => r.id === P1).equipment).toEqual(['单反', '手机']);
  });

  it('不在四个字段里的（比如价格区间）：拒绝，不改档案', async () => {
    const { POST } = await route();
    const res = await POST(new Request('http://localhost/api/fact-suggestions', { method: 'POST', body: JSON.stringify({ profileId: P1, action: 'accept', field: 'price_range', value: '高端' }) }) as any);
    expect(res.status).toBe(400);
    expect(env.db.tables.user_profiles.find((r: Record<string, unknown>) => r.id === P1).price_range).toEqual(['中端']);
  });

  it('忽略：记下，之后同一条不再出现', async () => {
    const { POST, GET } = await route();
    const r = await POST(new Request('http://localhost/api/fact-suggestions', { method: 'POST', body: JSON.stringify({ profileId: P1, action: 'dismiss', field: 'equipment', value: '手机' }) }) as any);
    expect(r.status).toBe(200);
    const data = await (await GET(new Request(`http://localhost/api/fact-suggestions?profileId=${P1}`) as any)).json();
    expect(data.suggestions).toEqual([]);
  });

  it('别人的档案：写不进去', async () => {
    const { POST } = await route();
    const res = await POST(new Request('http://localhost/api/fact-suggestions', { method: 'POST', body: JSON.stringify({ profileId: '44444444-4444-4444-8444-444444444444', action: 'accept', field: 'equipment', value: '手机' }) }) as any);
    expect(res.status).toBe(404);
  });
});

/* ------------------------------ 选题选择进入学习 ------------------------------ */

describe('选题选择：挑出来拿去写脚本的，进入学习', () => {
  beforeEach(() => {
    env.userId = U1;
    const topics = ['沙发怎么挑才不踩坑', '老板亲自讲后厨', '一张床的预算怎么分', '新店开业第一周怎么拍', '客人为什么回头'];
    env.db = createFakeDb({
      creator_preferences: [],
      user_profiles: [{ id: P1, user_id: U1 }],
      script_history: topics.map((t, i) => ({ id: `s${i}`, user_id: U1, task_type: '脚本生成', created_at: NOW_ISO, input_data: { profileId: P1, topic: t } })),
      works: [], material_library: [], chat_conversations: [], result_feedback: [],
    });
  });

  it('学习时把这些选题作为证据交给模型，并标注为选题', async () => {
    const { learnPreferences } = await import('@/lib/preference-learner');
    const prompts: string[] = [];
    env.ask = async (q: unknown) => { prompts.push(String(q)); return { ok: true, text: '{"items":[{"category":"content","text":"多讲老板亲自参与的真实过程","evidence":["E1","E2"]}]}' }; };
    const r = await learnPreferences(U1, P1, { now: NOW });
    expect(r.status).toBe('learned');
    expect(prompts[0]).toContain('他选了这个选题去写脚本：沙发怎么挑才不踩坑');
    expect(prompts[0]).toContain('选题：他从选题里挑出来');
    const row = env.db.tables.creator_preferences.find((x: Record<string, unknown>) => x.profile_key === P1)!;
    expect(row.items[0].from.choices).toBe(2);
    expect(row.items[0].text).toBe('多讲老板亲自参与的真实过程');
  });

  it('同一个选题只算一次', async () => {
    env.db.tables.script_history.push({ id: 'dup', user_id: U1, task_type: '脚本生成', created_at: NOW_ISO, input_data: { profileId: P1, topic: '沙发怎么挑才不踩坑' } });
    const { learnPreferences } = await import('@/lib/preference-learner');
    const prompts: string[] = [];
    env.ask = async (q: unknown) => { prompts.push(String(q)); return { ok: true, text: '{"items":[]}' }; };
    await learnPreferences(U1, P1, { now: NOW });
    expect(prompts[0].split('他选了这个选题去写脚本：沙发怎么挑才不踩坑').length - 1).toBe(1);
  });
});

/* ------------------------------ 夜间学习的触发 ------------------------------ */

describe('夜间学习：近一天有新的脚本生成，也会被看一次', () => {
  it('新生成的脚本所在档案被列入检查', async () => {
    env.db = createFakeDb({
      script_history: [{ id: 'x', user_id: U1, task_type: '脚本生成', created_at: new Date(NOW - 3600_000).toISOString(), input_data: { profileId: P1, topic: '新选题' } }],
      creator_preferences: [], user_profiles: [{ id: P1, user_id: U1 }], works: [], material_library: [], chat_conversations: [], result_feedback: [],
    });
    const { runNightlyPreferences } = await import('@/lib/preference-learner');
    env.ask = async () => ({ ok: true, text: '{"items":[]}' });
    const r = await runNightlyPreferences(NOW);
    expect(r.checked).toBe(1);
  });
});

/* ------------------------------ 接线 ------------------------------ */

describe('接线：档案页有事实提示；生成设置、学习都用上了', () => {
  it('档案编辑页放了事实提示卡，在偏好卡上面', () => {
    const page = readCode('app/dashboard/profiles/[id]/edit/page.tsx');
    expect(page.indexOf('<FactSuggestions')).toBeLessThan(page.indexOf('<PreferenceCard'));
    expect(readCode('components/profiles/FactSuggestions.tsx')).toMatch(/\/api\/fact-suggestions/);
  });

  it('事实提示只提示：写入只能通过「更新档案」按钮', () => {
    const route = readCode('app/api/fact-suggestions/route.ts');
    expect(route).toMatch(/body\.action === 'accept'/);
    // GET 那一段只读不写：写入只在 POST 里，且只有用户点了才会走到
    const get = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'));
    expect(get).not.toMatch(/\.update\(|\.insert\(/);
  });
});
