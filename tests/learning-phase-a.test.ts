/**
 * 「越用越懂你」二期 · A 阶段（docs/越用越懂你_二期方案_20261017.md）：
 *   - 结果反馈进偏好学习（有用 / 没用 + 理由 + 节选），「有编造或事实不对」不学写法
 *   - 反馈要挂到本人的档案上；能对回生成记录的，记下是不是对照组
 *   - 设置记忆：常用设置预填，只看本人、本档案、不算画布改稿的重复版本
 *   - 偏好卡「看依据」：每条写清楚是从几次修改、收藏、反馈里看出来的
 * 行为测试用内存数据库（tests/helpers/fake-supabase），不只看源码有没有某段字。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
import { readCode, readScriptBoardCode } from './helpers/source';
import { parseFeedback, FEEDBACK_EXCERPT_MAX } from '@/lib/result-feedback';
import { basisText, emptyEvidence, feedbackEvidenceText, mergePreferences, type Evidence, type PreferenceItem } from '@/lib/preferences';
import { MEMORY_MIN, MEMORY_WINDOW, memorySummary, pickDefaults } from '@/lib/settings-memory';
import { CONTROL_PERCENT, headKey, isControlDay } from '@/lib/learning-signals';

const env = vi.hoisted(() => ({ db: null as any, userId: 'u1', ask: null as any }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => env.db }));
vi.mock('@/lib/api-guard', () => ({ requireUser: async () => ({ ok: true, userId: env.userId }) }));
vi.mock('@/lib/dify-task', () => ({ askDify: (...a: unknown[]) => env.ask(...a), sseTask: () => new Response('') }));

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const P1 = '33333333-3333-4333-8333-333333333333';
const P2 = '44444444-4444-4444-8444-444444444444';
const NOW = Date.parse('2026-10-17T02:00:00Z');
const LONG = '家人们今天讲讲这家店的故事，老板每天凌晨五点起来去市场挑肉，这个细节很打动人。';

/* ------------------------------ 反馈的解析与证据 ------------------------------ */

describe('反馈：带上档案和节选', () => {
  it('档案编号必须是 uuid，不对就当没有；节选去空白、按上限截断', () => {
    const f = parseFeedback({ board: 'script', rating: -1, reason: '不像我的口吻', profileId: P1, excerpt: `  ${'字'.repeat(900)}  ` })!;
    expect(f.profileId).toBe(P1);
    expect(f.excerpt!.length).toBe(FEEDBACK_EXCERPT_MAX);
    expect(parseFeedback({ board: 'script', rating: 1, profileId: 'default' })!.profileId).toBeNull();
    expect(parseFeedback({ board: 'script', rating: 1, excerpt: '   ' })!.excerpt).toBeNull();
  });

  it('有用时不记理由（理由只属于没用）', () => {
    expect(parseFeedback({ board: 'script', rating: 1, reason: '太长或太短' })!.reason).toBeNull();
    expect(parseFeedback({ board: 'script', rating: -1, reason: '太长或太短' })!.reason).toBe('太长或太短');
  });

  it('证据正文写清楚：有用 / 没用（带理由）＋ 节选，节选不超过 300 字', () => {
    expect(feedbackEvidenceText(-1, '不像我的口吻', LONG)).toContain('他说这条结果「没用」（理由：不像我的口吻）');
    expect(feedbackEvidenceText(1, null, LONG)).toContain('他说这条结果「有用」');
    expect(feedbackEvidenceText(1, null, '字'.repeat(999)).length).toBeLessThan(330);
  });

  it('合并：引用到的反馈证据计入「反馈」次数，依据里写出来', () => {
    const evidence: Evidence[] = [1, 2, 3].map((n) => ({ id: `E${n}`, kind: 'feedback' as const, board: 'script', at: '2026-10-16T00:00:00Z', text: 'x' }));
    const items = mergePreferences({
      current: [],
      learned: [{ category: 'tone', text: '不用「家人们」开场', evidence: ['E1', 'E2', 'E3'] }],
      evidence, rejected: [], now: NOW,
    });
    expect(items[0].from).toEqual({ edits: 0, saves: 0, published: 0, feedback: 3, choices: 0 });
    expect(basisText(items[0])).toBe('依据：反馈 3 次');
  });
});

/* ------------------------------ 偏好卡「看依据」 ------------------------------ */

describe('看依据：每条偏好写清楚从哪里来', () => {
  const base: PreferenceItem = { id: 'a', category: 'tone', text: '口语化', count: 3, from: emptyEvidence(), status: 'active', origin: 'learned', firstSeen: '', lastSeen: '' };
  it('学出来的：列出改稿、收藏、已拍已发、反馈各几次', () => {
    expect(basisText({ ...base, from: { edits: 2, saves: 1, published: 0, feedback: 3, choices: 0 } })).toBe('依据：改稿 2 次 · 收藏 1 条 · 反馈 3 次');
  });
  it('自己加的 / 还在积累的，有各自的说法', () => {
    expect(basisText({ ...base, origin: 'manual', count: 0 })).toBe('你自己加的');
    expect(basisText(base)).toBe('依据：还在积累');
  });
});

/* ------------------------------ 设置记忆 ------------------------------ */

const script = (o: Record<string, unknown>) => ({ scriptRole: '变现型', duration: '60秒', scriptStructure: 'train', platform: '抖音', ...o });

describe('设置记忆：常用的才预填', () => {
  it('次数不够（少于 5 次）什么都不预填', () => {
    expect(MEMORY_MIN).toBe(5);
    expect(pickDefaults([script({}), script({}), script({}), script({})])).toEqual({});
  });

  it('同一个值占一半以上、且至少 5 次，才作为默认', () => {
    const d = pickDefaults(Array.from({ length: 5 }, () => script({})));
    expect(d.duration).toEqual({ value: '60秒', n: 5, of: 5 });
    expect(d.purpose?.value).toBe('变现型');
    expect(d.structure?.value).toBe('train');
  });

  it('「AI 推荐」本身是默认，不算常用值：AI 占多数时不预填时长', () => {
    const rows = [...Array.from({ length: 7 }, () => script({ duration: 'AI推荐' })), ...Array.from({ length: 3 }, () => script({ duration: '60秒' }))];
    expect(pickDefaults(rows).duration).toBeUndefined();
  });

  it('只看最近 20 次，更早的不算', () => {
    const recent = Array.from({ length: MEMORY_WINDOW }, () => script({ duration: '30秒' }));
    const older = Array.from({ length: 10 }, () => script({ duration: '90秒' }));
    expect(pickDefaults([...recent, ...older]).duration).toEqual({ value: '30秒', n: MEMORY_WINDOW, of: MEMORY_WINDOW });
  });

  it('预填后的一句话说明', () => {
    expect(memorySummary(pickDefaults(Array.from({ length: 5 }, () => script({}))))).toBe('按你常用的设置预填了：60秒 · 变现型 · train · 抖音');
    expect(memorySummary({})).toBe('');
  });
});

/* ------------------------------ 对照组与指纹 ------------------------------ */

describe('对照组：每人每天约 10%，同一天稳定', () => {
  it('同一个人同一天结果一样；一天之内不变', () => {
    const t = Date.parse('2026-10-17T10:00:00+08:00');
    expect(isControlDay('user-x', t)).toBe(isControlDay('user-x', t));
    expect(isControlDay('user-x', t)).toBe(isControlDay('user-x', t + 3600_000));
  });

  it('大量用户里大约 10%（允许 ±3 个百分点的波动）', () => {
    const t = Date.parse('2026-10-17T10:00:00+08:00');
    let hit = 0;
    for (let i = 0; i < 5000; i++) if (isControlDay(`user-${i}`, t)) hit++;
    const pct = (hit / 5000) * 100;
    expect(pct).toBeGreaterThan(CONTROL_PERCENT - 3);
    expect(pct).toBeLessThan(CONTROL_PERCENT + 3);
  });

  it('结果指纹：忽略空白和标点，太短不作指纹', () => {
    expect(headKey('家人们，今天讲讲这家店。')).toBe(headKey('家人们 今天讲讲这家店'));
    expect(headKey('太短了')).toBeNull();
    expect(headKey(LONG)).not.toBe(headKey(LONG.replace('老板', '店主')));
  });
});

/* ------------------------------ 数据库层：反馈进学习、反馈接口、设置记忆接口、对照组 ------------------------------ */

const fb = (id: string, o: Record<string, unknown>) => ({ id, user_id: U1, profile_id: P1, board: 'script', rating: -1, reason: null, excerpt: LONG, created_at: '2026-10-16T00:00:00Z', ...o });

describe('学习：结果反馈进偏好', () => {
  beforeEach(() => {
    env.db = createFakeDb({
      creator_preferences: [],
      user_profiles: [{ id: P1, user_id: U1, profile_name: '锦园' }],
      script_history: [], chat_conversations: [], material_library: [], works: [],
      result_feedback: [
        fb('f1', { reason: '不像我的口吻', excerpt: '家人们今天讲讲这家店的故事' }),
        fb('f2', { reason: '太空太套话', excerpt: '这是一个非常好的店铺' }),
        fb('f3', { reason: '有编造或事实不对', excerpt: '这家店开了十年' }),
        fb('f4', { rating: 1, reason: null, excerpt: '老板每天凌晨五点去市场挑肉' }),
        fb('f5', { profile_id: P2, reason: '太长或太短', excerpt: '别的档案的节选' }),
        fb('f6', { user_id: U2, reason: '太长或太短', excerpt: '别人的节选' }),
        fb('f7', { reason: '太长或太短', excerpt: '第二段讲的是价格细节，有点啰嗦的口吻' }),
        fb('f8', { rating: 1, reason: null, excerpt: '直接说结论：这碗面十五块，我们每天现煮' }),
      ],
    });
    env.userId = U1;
  });

  it('没用（带理由）和有用都进证据；事实类的不进；别的档案、别人的不进', async () => {
    const { learnPreferences } = await import('@/lib/preference-learner');
    const prompts: string[] = [];
    env.ask = async (q: unknown) => { prompts.push(String(q)); return { ok: true, text: '{"items":[{"category":"tone","text":"不用「家人们」开场","evidence":["E1","E2","E3"]}]}' }; };
    const r = await learnPreferences(U1, P1, { now: NOW });
    expect(r.status).toBe('learned');
    expect(prompts[0]).toContain('他说这条结果「没用」（理由：不像我的口吻）');
    expect(prompts[0]).toContain('他说这条结果「有用」');
    expect(prompts[0]).not.toContain('这家店开了十年');
    expect(prompts[0]).not.toContain('别的档案的节选');
    expect(prompts[0]).not.toContain('别人的节选');
    const row = env.db.tables.creator_preferences.find((x: Record<string, unknown>) => x.profile_key === P1)!;
    expect(row.items[0].from.feedback).toBe(3);
  });
});

describe('反馈接口：挂到本人档案、对回生成记录', () => {
  const route = () => import('@/app/api/feedback/route');
  const body = (o: Record<string, unknown>) => new Request('http://localhost/api/feedback', { method: 'POST', body: JSON.stringify(o) }) as any;

  beforeEach(() => {
    env.userId = U1;
    env.db = createFakeDb({
      user_profiles: [{ id: P1, user_id: U1 }, { id: P2, user_id: U2 }],
      user_signals: [{ id: 's1', user_id: U1, kind: 'generation', control: true, head_hash: headKey(LONG), created_at: new Date(NOW - 3600_000).toISOString() }],
      result_feedback: [],
    });
  });

  it('档案是本人的才记上；对回生成记录的，记下对照组标记', async () => {
    // 生成记录的时间在 NOW 附近，关联只认 7 天以内的记录：时钟固定在 NOW，结果才不随今天的日期变（2026-10-24 发现这里依赖今天的日期）
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    try {
      const { POST } = await route();
      const res = await POST(body({ board: 'script', rating: -1, reason: '不像我的口吻', profileId: P1, excerpt: LONG }));
      expect(res.status).toBe(200);
      const row = env.db.tables.result_feedback[0];
      expect(row).toMatchObject({ profile_id: P1, control: true, excerpt: LONG.slice(0, FEEDBACK_EXCERPT_MAX), reason: '不像我的口吻' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('别人的档案不记上（档案编号是伪造的也一样）', async () => {
    const { POST } = await route();
    await POST(body({ board: 'script', rating: 1, profileId: P2, excerpt: LONG }));
    expect(env.db.tables.result_feedback[0].profile_id).toBeNull();
  });

  it('对不上生成记录的，control 为空，反馈照常保存', async () => {
    const { POST } = await route();
    const res = await POST(body({ board: 'script', rating: 1, profileId: P1, excerpt: '完全不同的一段话，开头也不一样，长一点点的文字' }));
    expect(res.status).toBe(200);
    expect(env.db.tables.result_feedback[0].control).toBeNull();
  });

  it('二期的列还没加（迁移没跑）：照旧只存原字段，反馈不丢', async () => {
    env.db = createFakeDb({ user_profiles: [{ id: P1, user_id: U1 }], user_signals: [], result_feedback: [] }, { missingColumns: { result_feedback: ['profile_id', 'excerpt', 'control'] } });
    const { POST } = await route();
    const res = await POST(body({ board: 'script', rating: -1, reason: '太空太套话', profileId: P1, excerpt: LONG }));
    expect(res.status).toBe(200);
    expect(env.db.tables.result_feedback[0]).toMatchObject({ board: 'script', rating: -1, reason: '太空太套话' });
    expect(env.db.tables.result_feedback[0].excerpt).toBeUndefined();
  });
});

describe('设置记忆接口：只看本人、本档案，不算画布的重复版本', () => {
  const route = () => import('@/app/api/settings-memory/route');
  const hist = (id: string, o: Record<string, unknown>) => ({ id, user_id: U1, task_type: '脚本生成', created_at: '2026-10-16T00:00:00Z', input_data: { profileId: P1, scriptRole: '变现型', duration: '60秒', ...o } });

  beforeEach(() => {
    env.userId = U1;
    env.db = createFakeDb({
      script_history: [
        ...[1, 2, 3, 4, 5].map((n) => hist(`h${n}`, {})),
        hist('canvas1', { canvasOf: true, duration: '30秒' }),
        hist('canvas2', { canvasOf: true, duration: '30秒' }),
        { ...hist('other', { duration: '15秒' }), user_id: U2 },
        hist('p2', { profileId: P2, duration: '15秒' }),
      ],
    });
  });

  it('返回本人本档案的常用设置；画布版本和别人的记录不算', async () => {
    const { GET } = await route();
    const res = await GET(new Request(`http://localhost/api/settings-memory?board=script&profileId=${P1}`) as any);
    const data = await res.json();
    expect(data.sample).toBe(5);
    expect(data.defaults.duration).toEqual({ value: '60秒', n: 5, of: 5 });
    expect(data.summary).toContain('60秒');
  });

  it('不认识的板块、档案编号不对，都拒绝', async () => {
    const { GET } = await route();
    expect((await GET(new Request('http://localhost/api/settings-memory?board=topic&profileId=' + P1) as any)).status).toBe(400);
    expect((await GET(new Request('http://localhost/api/settings-memory?board=script&profileId=not-a-uuid') as any)).status).toBe(400);
  });
});

describe('对照组在偏好接口里生效：只影响生成，偏好卡照常显示', () => {
  const route = () => import('@/app/api/preferences/route');
  const activeItem = { id: 'i1', category: 'tone', text: '口语化一点', count: 4, from: emptyEvidence(), status: 'active', origin: 'learned', firstSeen: '', lastSeen: '' };
  // 找一个今天在对照组的用户（结果每天固定，测试按当天的真实日期来挑）
  const controlUser = Array.from({ length: 2000 }, (_, i) => `ctl-${i}`).find((u) => isControlDay(u))!;

  beforeEach(() => {
    env.userId = controlUser;
    env.db = createFakeDb({
      user_profiles: [{ id: P1, user_id: controlUser }],
      creator_preferences: [{ user_id: controlUser, profile_key: P1, enabled: true, items: [activeItem], rejected: [] }],
    });
  });

  it('生成时（purpose=generate）对照组那天：偏好为空', async () => {
    const { GET } = await route();
    const data = await (await GET(new Request(`http://localhost/api/preferences?profileId=${P1}&purpose=generate`) as any)).json();
    expect(data.control).toBe(true);
    expect(data.items).toEqual([]);
  });

  it('偏好卡（不带 purpose）照常看得到全部条目', async () => {
    const { GET } = await route();
    const data = await (await GET(new Request(`http://localhost/api/preferences?profileId=${P1}`) as any)).json();
    expect(data.items).toHaveLength(1);
    expect(data.control).toBeUndefined();
  });
});

/* ------------------------------ 接线：页面和路由确实用上了这些 ------------------------------ */

describe('接线：生成、反馈、脚本页都用上了二期的东西', () => {
  it('两条生成路径都记生成信号；对话页与板块页都带档案', () => {
    expect(readCode('app/api/dify/stream/route.ts')).toMatch(/void recordGenerationSignal\(/);
    expect(readCode('app/api/dify/chat/route.ts')).toMatch(/void recordGenerationSignal\(/);
  });

  it('结果反馈把正文作为节选带上', () => {
    expect(readCode('components/workspace/ResultPanel.tsx')).toMatch(/<ResultFeedback[^>]*excerpt=\{body\}/);
    expect(readCode('components/workspace/ResultFeedback.tsx')).toMatch(/profileId: getActiveProfileId\(\)/);
  });

  it('生成时取偏好走 purpose=generate（对照组才会生效）', () => {
    expect(readCode('lib/preferences-client.ts')).toMatch(/fetchPreferences\(profileId, 'generate'\)/);
  });

  it('脚本页：打开时预填常用设置，只填没动过的字段，有「改回默认」和「关闭」', () => {
    // 预填规则已经搬到 lib/boards/script-query（助理替编导填表用的是同一条），页面和模块合起来看
    const page = readScriptBoardCode();
    expect(page).toMatch(/\/api\/settings-memory\?board=script/);
    expect(page).toMatch(/if \(incomingSetup \|\| !memoryEnabled\(\)\) return;/);
    expect(page).toMatch(/defaults\.duration && state\.durationMode === 'ai'/);
    expect(page).toMatch(/defaults\.purpose && state\.scriptRole === '自动'/);
    expect(page).toMatch(/改回默认/);
    expect(page).toMatch(/关闭「记住我的常用设置」/);
  });

  it('二期的迁移：反馈加三列、学习信号表，两张表都只许服务端读写', () => {
    const sql = readCode('supabase/migrations/20261017_learning_signals.sql');
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS profile_id/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS excerpt/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS control/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS user_signals/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/);
  });
});
