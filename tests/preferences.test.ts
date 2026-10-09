/**
 * 我的创作偏好（2026-10-04，docs/越用越懂你_第一版方案_20261004.md）。
 * 规则：3 个不同内容才生效、次数由程序数、删过的不再学、自己改过的不被覆盖、60 天降级、不学事实、
 * 只带进写稿类板块、优先级在档案和预设之后、学习不扣次数、档案隔离。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
import {
  ACTIVE_MIN, diffEdit, editRatio, editTrend, looksLikeFact, mergePreferences, newSince, parseLearned, preferenceHint,
  preferencePromptBlock, readUserItem, sameMeaning, settle, type Evidence, type PreferenceItem,
} from '@/lib/preferences';
import { buildContextBlock, type CreatorContext } from '@/lib/creator-context';
import { readCode } from './helpers/source';

const env: { db: ReturnType<typeof createFakeDb>; ask: (...a: unknown[]) => Promise<unknown> } = { db: createFakeDb(), ask: async () => ({ ok: false, message: 'x' }) };
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => env.db }));
vi.mock('@/lib/dify-task', () => ({ askDify: (...a: unknown[]) => env.ask(...a), sseTask: () => new Response('') }));

const NOW = Date.parse('2026-10-04T10:00:00Z');
const ev = (n: number, kind: Evidence['kind'] = 'edit'): Evidence[] => Array.from({ length: n }, (_, i) => ({ id: `E${i + 1}`, kind, board: '脚本生成', at: '2026-10-01', text: 'x' }));
const item = (o: Partial<PreferenceItem>): PreferenceItem => ({ id: 'a', category: 'tone', text: '不用「家人们」', count: 3, from: { edits: 3, saves: 0, published: 0 }, status: 'active', origin: 'learned', firstSeen: '2026-09-01T00:00:00Z', lastSeen: '2026-10-01T00:00:00Z', ...o });

describe('改稿对比', () => {
  it('看得出删了哪句、新写了哪句、开头怎么换', () => {
    const d = diffEdit('家人们，今天给大家讲讲火锅。我们店开了十年。欢迎关注我！', '一元一串，就在锦园。我们店开了十年。');
    expect(d.removed.join('')).toContain('家人们');
    expect(d.removed.join('')).toContain('欢迎关注我');
    expect(d.added).toEqual(['一元一串，就在锦园。']);
    expect(d.openingBefore).toContain('家人们');
    expect(d.changed).toBeGreaterThan(0);
    expect(editRatio(d)).toBeGreaterThan(0.3);
  });
  it('没改就是 0；只改标点空格不算改', () => {
    expect(diffEdit('一样的。', '一样的。').changed).toBe(0);
    expect(diffEdit('今天 吃火锅。', '今天吃火锅！').changed).toBe(0);
  });
});

describe('改稿量变化（「比刚开始少了 X%」）', () => {
  it('不到 10 次修改不给数', () => expect(editTrend([0.5, 0.4, 0.3])).toBeNull());
  it('改得越来越少才给数', () => {
    expect(editTrend([0.6, 0.6, 0.6, 0.6, 0.6, 0.3, 0.3, 0.3, 0.3, 0.3])).toMatchObject({ reduction: 50, edits: 10 });
  });
  it('改得更多了或差不多：不显示，不拿它当卖点', () => {
    expect(editTrend([0.3, 0.3, 0.3, 0.3, 0.3, 0.6, 0.6, 0.6, 0.6, 0.6])).toBeNull();
    expect(editTrend(Array(10).fill(0.4))).toBeNull();
  });
});

describe('合并规则', () => {
  it('次数由程序数：只数真实存在的、不同的证据编号；够 3 个才生效', () => {
    const out = mergePreferences({ current: [], evidence: ev(5), rejected: [], now: NOW, learned: [
      { category: 'tone', text: '不用「家人们」「宝子们」', evidence: ['E1', 'E2', 'E2', 'E9'] },
      { category: 'opening', text: '开头直接说结论，不用反问开场', evidence: ['E1', 'E3', 'E5'] },
    ] });
    const tone = out.find((i) => i.category === 'tone')!;
    expect(tone.count).toBe(2);
    expect(tone.status).toBe('watching');
    const opening = out.find((i) => i.category === 'opening')!;
    expect(opening.count).toBe(ACTIVE_MIN);
    expect(opening.status).toBe('active');
    expect(opening.from).toEqual({ edits: 3, saves: 0, published: 0 });
  });

  it('删过的（意思相近也算）、像事实的、类别不对的、太短的不学', () => {
    const out = mergePreferences({ current: [], evidence: ev(4), rejected: ['不用「家人们」'], now: NOW, learned: [
      { category: 'tone', text: '不要用「家人们」这种称呼', evidence: ['E1', 'E2', 'E3'] },
      { category: 'content', text: '强调开店 10 年', evidence: ['E1', 'E2', 'E3'] },
      { category: 'content', text: '人均 30 元的价格写在开头', evidence: ['E1', 'E2', 'E3'] },
      { category: 'weird', text: '随便一条', evidence: ['E1', 'E2', 'E3'] },
      { category: 'tone', text: '短', evidence: ['E1', 'E2', 'E3'] },
    ] });
    expect(out).toEqual([]);
    expect(looksLikeFact('从业 9 年')).toBe(true);
    expect(looksLikeFact('句子短，一句一个意思')).toBe(false);
  });

  it('用户自己加的、改过的不被学习覆盖', () => {
    const manual = item({ id: 'm', text: '不用「家人们」', origin: 'manual', count: 0 });
    const out = mergePreferences({ current: [manual], evidence: ev(3), rejected: [], now: NOW, learned: [{ category: 'tone', text: '不用「家人们」', evidence: ['E1'] }] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'm', origin: 'manual', status: 'active', count: 0 });
  });

  it('旧证据滑出窗口不往下降次数；60 天没新证据降回观察中', () => {
    const old = item({ count: 5, lastSeen: '2026-07-01T00:00:00Z' });
    expect(settle([old], NOW)[0].status).toBe('watching');
    const recent = mergePreferences({ current: [item({ count: 5 })], evidence: ev(3), rejected: [], now: NOW, learned: [{ category: 'tone', text: '不用「家人们」', evidence: ['E1'] }] });
    expect(recent[0]).toMatchObject({ count: 5, status: 'active' });
  });

  it('生效最多 12 条、观察中最多 8 条', () => {
    const many = Array.from({ length: 30 }, (_, i) => item({ id: `i${i}`, text: `偏好第${'甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥天地人和山水风雷'[i]}条写法`, count: i % 2 ? 4 : 1 }));
    const out = settle(many, NOW);
    expect(out.filter((i) => i.status === 'active')).toHaveLength(12);
    expect(out.filter((i) => i.status === 'watching')).toHaveLength(8);
  });

  it('意思相近的判成同一条', () => {
    expect(sameMeaning('不用「家人们」', '不用家人们')).toBe(true);
    expect(sameMeaning('开头直接说结论', '结尾不喊关注')).toBe(false);
  });

  it('读模型的 JSON：包了 ```json 也能读；读不出返回 null', () => {
    expect(parseLearned('```json\n{"items":[{"category":"tone","text":"句子短","evidence":["E1"]}]}\n```')).toEqual([{ category: 'tone', text: '句子短', evidence: ['E1'] }]);
    expect(parseLearned('我不知道')).toBeNull();
  });

  it('用户自己加的直接生效、标成自己的', () => {
    expect(readUserItem({ text: '  不用感叹号 ', category: 'tone' }, NOW)).toMatchObject({ text: '不用感叹号', status: 'active', origin: 'manual' });
    expect(readUserItem({ text: ' ' }, NOW)).toBeNull();
  });
});

describe('用在生成里', () => {
  const prefs = [item({}), item({ id: 'w', text: '结尾留个问题', status: 'watching', count: 1 })];
  const ctx = (p: PreferenceItem[]): CreatorContext => ({ profile: { id: 'p', profile_name: '测试店' } as CreatorContext['profile'], positioning: null, dealReasons: [], preferences: p });

  it('只带生效的，写明优先级在档案、事实卡、禁忌、预设之后', () => {
    const block = preferencePromptBlock(prefs);
    expect(block).toContain('不用「家人们」');
    expect(block).not.toContain('结尾留个问题');
    expect(block).toMatch(/冲突时，以它们为准/);
    expect(preferencePromptBlock([])).toBe('');
  });

  it('写稿类板块带上；方向、拆解、成交理由不带', () => {
    expect(buildContextBlock(ctx(prefs), 'script')).toContain('这个号的创作偏好');
    expect(buildContextBlock(ctx(prefs), 'freeChat')).toContain('这个号的创作偏好');
    for (const b of ['direction', 'breakdown', 'dealReason'] as const) expect(buildContextBlock(ctx(prefs), b)).not.toContain('这个号的创作偏好');
  });

  it('提示词总长有上限', () => {
    const many = Array.from({ length: 12 }, (_, i) => item({ id: `x${i}`, text: `第${i}条：这是一条相当长的偏好描述，用来把长度撑满测试上限的情况`.slice(0, 60) }));
    expect(preferencePromptBlock(many).length).toBeLessThan(900);
  });

  it('结果下面那行小字、首页新学到几条', () => {
    expect(preferenceHint(prefs)).toBe('已按你的偏好写：不用「家人们」');
    expect(preferenceHint([])).toBe('');
    expect(newSince([item({ activeAt: '2026-10-03T00:00:00Z' })], '2026-10-02T00:00:00Z')).toBe(1);
    expect(newSince([item({ activeAt: '2026-10-01T00:00:00Z' })], '2026-10-02T00:00:00Z')).toBe(0);
  });
});

describe('学习（服务端，内存数据库 + 假模型）', () => {
  const user = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const P1 = '33333333-3333-4333-8333-333333333333';
  const P2 = '44444444-4444-4444-8444-444444444444';
  const canvas = (id: string, owner: string, profile: string | null, before: string, after: string) => ({
    id, user_id: owner, task_type: '脚本生成', created_at: '2026-10-0' + (Number(id.slice(-1)) % 9 + 1) + 'T00:00:00Z',
    input_data: { canvasOf: true, profileId: profile, canvasVersions: [{ content: before, at: 1, note: 'AI 原稿' }, { content: after, at: 2, note: '手动修改' }] },
  });
  beforeEach(() => {
    env.db = createFakeDb({
      creator_preferences: [],
      user_profiles: [{ id: P1, user_id: user, profile_name: '锦园' }],
      script_history: [
        ...[1, 2, 3, 4, 5].map((n) => canvas(`h${n}`, user, P1, `家人们，今天讲第${n}个。好吃。`, `第${n}个，直接说结论。好吃。`)),
        canvas('h6', user, P2, '别的档案家人们。', '别的档案改了。'),
        canvas('h7', other, P1, '别人家人们。', '别人改了。'),
      ],
      chat_conversations: [], material_library: [], works: [],
    });
  });

  it('攒够 5 个才学；学到的按证据编号数次数、存进本人本档案；同样的证据第二次不再调模型', async () => {
    const { learnPreferences } = await import('@/lib/preference-learner');
    const prompts: string[] = [];
    env.ask = async (q: unknown) => { prompts.push(String(q)); return { ok: true, text: '{"items":[{"category":"tone","text":"不用「家人们」开场","evidence":["E1","E2","E3","E4"]},{"category":"opening","text":"开头直接说结论","evidence":["E5"]}]}' }; };
    const r = await learnPreferences(user, P1, { now: NOW });
    expect(r.status).toBe('learned');
    expect(prompts[0]).toContain('家人们，今天讲第1个');
    expect(prompts[0]).not.toContain('别的档案');
    expect(prompts[0]).not.toContain('别人');
    const row = env.db.tables.creator_preferences.find((x: Record<string, unknown>) => x.user_id === user && x.profile_key === P1)!;
    expect(row.items.find((i: PreferenceItem) => i.category === 'tone')).toMatchObject({ count: 4, status: 'active' });
    expect(row.items.find((i: PreferenceItem) => i.category === 'opening')).toMatchObject({ count: 1, status: 'watching' });
    expect(await learnPreferences(user, P1, { now: NOW })).toMatchObject({ status: 'unchanged' });
    expect(prompts).toHaveLength(1);
  });

  it('不到 5 个信号不调模型；学习关了不学', async () => {
    const { learnPreferences } = await import('@/lib/preference-learner');
    let called = 0;
    env.ask = async () => { called++; return { ok: true, text: '{"items":[]}' }; };
    expect(await learnPreferences(user, P2, { now: NOW })).toMatchObject({ status: 'not_enough' });
    env.db.tables.creator_preferences.push({ user_id: user, profile_key: P1, enabled: false, items: [], rejected: [] });
    expect(await learnPreferences(user, P1, { now: NOW })).toMatchObject({ status: 'disabled' });
    expect(called).toBe(0);
  });

  it('学的这几十秒里用户删掉的，写回时不会又冒出来', async () => {
    const { learnPreferences } = await import('@/lib/preference-learner');
    env.ask = async () => {
      env.db.tables.creator_preferences.push({ user_id: user, profile_key: P1, enabled: true, items: [], rejected: ['不用「家人们」开场'] });
      return { ok: true, text: '{"items":[{"category":"tone","text":"不用「家人们」开场","evidence":["E1","E2","E3"]}]}' };
    };
    await learnPreferences(user, P1, { now: NOW });
    const row = env.db.tables.creator_preferences.find((x: Record<string, unknown>) => x.profile_key === P1)!;
    expect(row.items).toEqual([]);
  });

  it('模型失败：明说，不写坏数据', async () => {
    const { learnPreferences } = await import('@/lib/preference-learner');
    env.ask = async () => ({ ok: false, message: 'AI 服务暂时不可用' });
    expect(await learnPreferences(user, P1, { now: NOW })).toMatchObject({ status: 'failed' });
    expect(env.db.tables.creator_preferences).toEqual([]);
  });

  it('夜间学习只看最近有动静的档案', async () => {
    const { runNightlyPreferences } = await import('@/lib/preference-learner');
    env.ask = async () => ({ ok: true, text: '{"items":[]}' });
    const r = await runNightlyPreferences(Date.parse('2026-10-07T00:00:00Z'));
    expect(r.checked).toBe(3);
  });
});

describe('接到全站', () => {
  it('偏好卡在档案编辑页；结果下面、自由对话、首页都有提示', () => {
    expect(readCode('app/dashboard/profiles/[id]/edit/page.tsx')).toMatch(/<PreferenceCard profileId=\{id\} \/>/);
    expect(readCode('components/workspace/ResultPanel.tsx')).toMatch(/<PreferenceHint board=/);
    expect(readCode('app/dashboard/free-chat/page.tsx')).toMatch(/<PreferenceHint board="freeChat" \/>/);
    expect(readCode('app/dashboard/page.tsx')).toMatch(/<PreferenceNews \/>/);
  });
  it('名字叫「我的创作偏好」；默认开启；进数据导出；隐私政策写明了；每晚自动学', async () => {
    const { PREFERENCE_NAME } = await import('@/lib/preferences');
    expect(PREFERENCE_NAME).toBe('我的创作偏好');
    expect(readCode('supabase/migrations/20261004_creator_preferences.sql')).toMatch(/enabled boolean NOT NULL DEFAULT true/);
    expect(readCode('lib/account-export.ts')).toMatch(/creator_preferences/);
    expect(readCode('app/privacy/page.tsx')).toMatch(/我的创作偏好/);
    expect(readCode('instrumentation.ts')).toMatch(/startPreferenceSchedule\(\)/);
  });
  it('学习不扣次数：学习那条链路不碰额度', () => {
    for (const f of ['lib/preference-learner.ts', 'app/api/preferences/route.ts']) expect(readCode(f)).not.toMatch(/reserveCreation|incrementUsage|requireUserWithQuota/);
  });
});
