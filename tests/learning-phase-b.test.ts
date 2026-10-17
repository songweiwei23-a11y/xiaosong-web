/**
 * 「越用越懂你」二期 · B 阶段（docs/越用越懂你_二期方案_20261017.md 4.3、六）：
 *   - 作品写法特征：开头类型、口播长短；判不准的归「其他」
 *   - 开物验证过的写法：按完播数据验证，门槛 5 条观察、10 条生效；句子不带数字；依据写清楚「相关，不是因果」
 *   - 数据条目每次整体重算、用户删过的不放回、不被条数上限挤掉
 *   - 对照组效果：两边各 30 条才下结论
 * 行为测试用内存数据库，不只看源码。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
import { readCode } from './helpers/source';
import { firstSentence, featuresOf, lengthKind, openingKind, spokenChars, LONG_MIN, SHORT_MAX } from '@/lib/work-features';
import { VERIFY_MIN_ACTIVE, buildVerifiedItems, median, samplesSignature, withDataItems, type WorkSample } from '@/lib/verified-writing';
import { basisText, emptyEvidence, readStoredItems, settle, type PreferenceItem } from '@/lib/preferences';
import { compareControl, MIN_SAMPLE_PER_SIDE } from '@/lib/learning-stats';

const env = vi.hoisted(() => ({ db: null as any, userId: 'u1', ask: null as any, admin: null as any }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => env.db, requireAdmin: async () => env.admin }));
vi.mock('@/lib/dify-task', () => ({ askDify: (...a: unknown[]) => env.ask(...a), sseTask: () => new Response('') }));

const U1 = '11111111-1111-4111-8111-111111111111';
const P1 = '33333333-3333-4333-8333-333333333333';
const NOW = Date.parse('2026-10-17T02:00:00Z');
const NOW_ISO = new Date(NOW).toISOString();

const sample = (id: string, completion: number, opening: WorkSample['opening'] = 'other', length: WorkSample['length'] = 'short'): WorkSample =>
  ({ id, completion, opening, length, at: NOW_ISO });
const dataItem = (text: string, origin: PreferenceItem['origin'] = 'data'): PreferenceItem =>
  ({ id: text, category: 'opening', text, count: 10, from: emptyEvidence(), status: 'active', origin, firstSeen: NOW_ISO, lastSeen: NOW_ISO, activeAt: NOW_ISO, basis: origin === 'data' ? '依据：…' : undefined });

/* ------------------------------ 作品写法特征 ------------------------------ */

describe('写法特征：开头类型', () => {
  it('问句、数字或价格、直接给结论、从现场切入；判不准的归其他', () => {
    expect(openingKind('你是不是也踩过这个坑？')).toBe('question');
    expect(openingKind('这碗面只要15块，我们每天现煮。')).toBe('number');
    expect(openingKind('其实大多数人选错了沙发。')).toBe('conclusion');
    expect(openingKind('昨天店里来了一个老太太。')).toBe('scene');
    expect(openingKind('大家好，欢迎来到我的店。')).toBe('other');
    expect(openingKind('')).toBe('other');
  });

  it('第一句要去掉标题符号和引号；只看开头', () => {
    expect(firstSentence('「你好」吗？后面')).toBe('你好吗');
    expect(firstSentence('## 标题行\n「你好」吗？后面')).toBe('你好吗');
    expect(openingKind('## 纯文字文案\n今天讲讲装修')).toBe('scene');
  });
});

describe('写法特征：口播长短', () => {
  it('只数中文字，分三档：短、中、长', () => {
    expect(spokenChars('一二三ABC123')).toBe(3);
    expect(lengthKind(SHORT_MAX)).toBe('short');
    expect(lengthKind(SHORT_MAX + 1)).toBe('mid');
    expect(lengthKind(LONG_MIN - 1)).toBe('mid');
    expect(lengthKind(LONG_MIN)).toBe('long');
  });

  it('featuresOf 把两样放在一起', () => {
    const f = featuresOf('你是不是也这样？' + '字'.repeat(400));
    expect(f).toMatchObject({ opening: 'question', length: 'long' });
  });
});

/* ------------------------------ 开物验证过的写法 ------------------------------ */

const many = (n: number, completion: number, opening: WorkSample['opening'], prefix: string, length: WorkSample['length'] = 'short') =>
  Array.from({ length: n }, (_, i) => sample(`${prefix}${i}`, completion, opening, length));

describe('验证过的写法：门槛与方向', () => {
  it('不到 5 条作品什么都不给', () => {
    expect(buildVerifiedItems(many(4, 60, 'question', 'a'), NOW)).toEqual([]);
  });

  it('问句开头的完播比其他高 20 个点（6 条）→ 观察中；句子不带数字，依据写清楚相关不是因果', () => {
    const items = buildVerifiedItems([...many(6, 60, 'question', 'q'), ...many(6, 40, 'other', 'o')], NOW);
    const q = items.find((i) => i.id === 'data-opening-question-up')!;
    expect(q).toMatchObject({ origin: 'data', category: 'opening', count: 6, status: 'watching', text: '开头用一个具体的问题切入，让人想知道答案' });
    expect(q.text).not.toMatch(/\d/);
    expect(q.basis).toContain('6 条已录数据的作品');
    expect(q.basis).toContain('相关，不代表一定是这个写法的功劳');
    expect(q.activeAt).toBeUndefined();
  });

  it('同样的写法在 10 条以上 → 生效，并记下生效时间', () => {
    expect(VERIFY_MIN_ACTIVE).toBe(10);
    const items = buildVerifiedItems([...many(10, 60, 'question', 'q'), ...many(6, 40, 'other', 'o')], NOW);
    expect(items.find((i) => i.id === 'data-opening-question-up')).toMatchObject({ status: 'active', activeAt: NOW_ISO });
  });

  it('比其他低了 5 个点以上，给「少用」的建议；差距不够大就不给', () => {
    const bad = buildVerifiedItems([...many(6, 30, 'question', 'q'), ...many(6, 40, 'other', 'o')], NOW);
    expect(bad.find((i) => i.id === 'data-opening-question-down')?.text).toBe('少用反问开场，直接说事情');
    const flat = buildVerifiedItems([...many(6, 42, 'question', 'q'), ...many(6, 40, 'other', 'o')], NOW);
    expect(flat).toEqual([]);
  });

  it('对比的另一边也要有 5 条，不然没有比较', () => {
    expect(buildVerifiedItems([...many(6, 60, 'question', 'q'), ...many(2, 40, 'other', 'o')], NOW)).toEqual([]);
  });

  it('口播长短也能验证：短的比长的好，给「口播紧凑」', () => {
    const items = buildVerifiedItems([...many(6, 60, 'other', 's', 'short'), ...many(6, 40, 'other', 'l', 'long')], NOW);
    const s = items.find((i) => i.id === 'data-length-short-up');
    expect(s).toMatchObject({ category: 'structure', text: '口播尽量紧凑，一分钟以内讲完' });
  });

  it('样本的指纹：作品或数据变了，指纹就变', () => {
    const a = samplesSignature(many(3, 50, 'question', 'a'));
    expect(samplesSignature(many(3, 51, 'question', 'a'))).not.toBe(a);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('数据条目：每次重算、不被删的复活、不挤学习条目的上限', () => {
  it('withDataItems：旧的数据条目换掉；用户删过的不放回；学习出来的、手写的保留', () => {
    const learned: PreferenceItem = { ...dataItem('不用「家人们」', 'learned'), origin: 'learned', category: 'tone' };
    const manual = { ...dataItem('我自己加的', 'manual'), origin: 'manual' as const };
    const old = dataItem('旧的数据条目');
    const fresh = dataItem('新的数据条目');
    const rejected = [fresh.text];
    const out = withDataItems([learned, manual, old], [fresh], rejected);
    expect(out.map((i) => i.text)).toEqual(['不用「家人们」', '我自己加的']);
    expect(withDataItems([learned], [dataItem('新的数据条目')], []).map((i) => i.text)).toContain('新的数据条目');
  });

  it('settle：数据条目不按学习的规则改状态，也不占学习条目的上限', () => {
    const learnedItems: PreferenceItem[] = Array.from({ length: 13 }, (_, i) => ({
      id: `l${i}`, category: 'tone', text: `偏好${i}`, count: 1, from: emptyEvidence(), status: 'watching', origin: 'learned', firstSeen: NOW_ISO, lastSeen: NOW_ISO,
    }));
    const data = { ...dataItem('数据条目', 'data'), status: 'watching' as const, count: 20 };
    const out = settle([...learnedItems, data], NOW);
    expect(out.find((i) => i.id === 'data-item' || i.text === '数据条目')?.status).toBe('watching');
    expect(out.filter((i) => i.origin === 'data')).toHaveLength(1);
    expect(out.filter((i) => i.origin === 'learned').length).toBeLessThanOrEqual(8); // 观察中最多 8 条
  });

  it('存进库里读回来，数据条目的来源和依据还在', () => {
    const [back] = readStoredItems([{ ...dataItem('问句开头'), basis: '依据：…' }]);
    expect(back).toMatchObject({ origin: 'data', basis: '依据：…' });
    expect(basisText(back)).toBe('依据：…');
  });
});

/* ------------------------------ 对照组效果 ------------------------------ */

describe('对照组效果：两边各 30 条才下结论', () => {
  const rows = (control: boolean, n: number, up: number) => [
    ...Array.from({ length: up }, () => ({ control, rating: 1 })),
    ...Array.from({ length: n - up }, () => ({ control, rating: -1 })),
  ];

  it('样本够：给出差距（带偏好的有用比例 − 对照组）', () => {
    const r = compareControl([...rows(false, 40, 24), ...rows(true, 40, 16)]);
    expect(MIN_SAMPLE_PER_SIDE).toBe(30);
    expect(r.treatment).toEqual({ n: 40, up: 24, rate: 60 });
    expect(r.control).toEqual({ n: 40, up: 16, rate: 40 });
    expect(r.liftPoints).toBe(20);
    expect(r.enoughSample).toBe(true);
  });

  it('样本不够：数照给，但不说「有效」', () => {
    const r = compareControl([...rows(false, 10, 9), ...rows(true, 10, 2)]);
    expect(r.liftPoints).toBe(70);
    expect(r.enoughSample).toBe(false);
  });

  it('没有对照组的数据：差距为空，不瞎算', () => {
    expect(compareControl(rows(false, 40, 20)).liftPoints).toBeNull();
  });
});

/* ------------------------------ 数据库层：学习流程写入数据条目；迁移缺列时照常学 ------------------------------ */

// 作品状态用 draft：不进「已拍已发」的文字证据，只看它的完播数据（那是这一块的数据来源）
const work = (id: string, completion: number) => ({ id, user_id: U1, profile_id: P1, metrics: { completion }, updated_at: NOW_ISO, shoot_status: 'draft' });
const hist = (id: string, workId: string, spoken: string) => ({ id, user_id: U1, work_id: workId, task_type: '脚本生成', created_at: NOW_ISO, result: `## 纯文字文案\n${spoken}` });

describe('学习流程：数据条目写进偏好卡', () => {
  beforeEach(() => {
    env.userId = U1;
    const works: Record<string, unknown>[] = [];
    const history: Record<string, unknown>[] = [];
    // 开头不带数字（否则会被归成「数字开头」）
    for (let i = 0; i < 6; i++) { works.push(work(`q${i}`, 62)); history.push(hist(`hq${i}`, `q${i}`, `你是不是也踩过这个坑${'abcdef'[i]}`)); }
    for (let i = 0; i < 6; i++) { works.push(work(`o${i}`, 40)); history.push(hist(`ho${i}`, `o${i}`, `大家好欢迎来到店里${'abcdef'[i]}`)); }
    env.db = createFakeDb({ works, script_history: history, creator_preferences: [], chat_conversations: [], material_library: [], result_feedback: [], user_profiles: [{ id: P1, user_id: U1 }] });
  });

  it('作品都录了完播：不够 5 条文字证据也会写入「验证过的写法」，且记下指纹', async () => {
    const { learnPreferences } = await import('@/lib/preference-learner');
    const r = await learnPreferences(U1, P1, { now: NOW });
    expect(r.status).toBe('not_enough');
    const row = env.db.tables.creator_preferences.find((x: Record<string, unknown>) => x.profile_key === P1)!;
    const data = row.items.filter((i: PreferenceItem) => i.origin === 'data');
    expect(data.map((i: PreferenceItem) => i.id)).toEqual(['data-opening-question-up']);
    expect(data[0].count).toBe(6);
    expect(row.verified_signature).toEqual(expect.any(String));
  });

  it('不带档案的作品不算（只看本档案）', async () => {
    env.db.tables.works.push({ ...work('x1', 90), profile_id: null });
    const { learnPreferences } = await import('@/lib/preference-learner');
    await learnPreferences(U1, P1, { now: NOW });
    const row = env.db.tables.creator_preferences.find((x: Record<string, unknown>) => x.profile_key === P1)!;
    expect(row.items.find((i: PreferenceItem) => i.id === 'data-opening-question-up')?.count).toBe(6);
  });

  it('投流的作品不算：投流的数据不反映写法', async () => {
    env.db.tables.works.forEach((w: Record<string, any>) => { if (w.id.startsWith('q')) w.metrics = { completion: 62, paidPromotion: true }; });
    const { learnPreferences } = await import('@/lib/preference-learner');
    await learnPreferences(U1, P1, { now: NOW });
    const row = env.db.tables.creator_preferences.find((x: Record<string, unknown>) => x.profile_key === P1)!;
    expect(row.items.some((i: PreferenceItem) => i.origin === 'data')).toBe(false);
  });

  it('迁移没跑（creator_preferences 没有 verified_signature 列）：照常写入，不报失败', async () => {
    env.db = createFakeDb({ works: env.db.tables.works, script_history: env.db.tables.script_history, creator_preferences: [], chat_conversations: [], material_library: [], result_feedback: [], user_profiles: [{ id: P1, user_id: U1 }] }, { missingColumns: { creator_preferences: ['verified_signature'] } });
    const { learnPreferences } = await import('@/lib/preference-learner');
    const r = await learnPreferences(U1, P1, { now: NOW });
    expect(r.status).toBe('not_enough');
    const row = env.db.tables.creator_preferences.find((x: Record<string, unknown>) => x.profile_key === P1)!;
    expect(row.items.some((i: PreferenceItem) => i.origin === 'data')).toBe(true);
    expect(row.verified_signature).toBeUndefined();
  });
});

/* ------------------------------ 管理员统计接口 ------------------------------ */

describe('对照组统计接口：只给管理员', () => {
  it('非管理员 403；管理员拿到带偏好与对照组的对比', async () => {
    const { GET } = await import('@/app/api/admin/learning-stats/route');
    env.admin = null;
    expect((await GET()).status).toBe(403);
    env.admin = { role: 'owner' };
    env.db = createFakeDb({
      result_feedback: [...Array.from({ length: 30 }, () => ({ control: false, rating: 1, created_at: NOW_ISO })), ...Array.from({ length: 30 }, () => ({ control: true, rating: -1, created_at: NOW_ISO }))],
      user_signals: [{ id: 1, kind: 'generation', created_at: NOW_ISO }],
    });
    const data = await (await GET()).json();
    expect(data.treatment.rate).toBe(100);
    expect(data.control.rate).toBe(0);
    expect(data.enoughSample).toBe(true);
    expect(data.liftPoints).toBe(100);
  });
});

/* ------------------------------ 接线 ------------------------------ */

describe('接线：首页有卡片，迁移和路由都在', () => {
  it('首页放了「开物验证过的写法」卡片', () => {
    expect(readCode('app/dashboard/page.tsx')).toMatch(/<LearningCard \/>/);
    expect(readCode('components/preferences/LearningCard.tsx')).toMatch(/origin === "data" && i\.status === "active"/);
  });

  it('学习写入走 saveRow（缺列时兼容）', () => {
    const learner = readCode('lib/preference-learner.ts');
    expect(learner).toMatch(/async function saveRow/);
    expect(learner).toMatch(/verified_signature/);
  });

  it('迁移里有 verified_signature 列', () => {
    expect(readCode('supabase/migrations/20261017_learning_signals.sql')).toMatch(/ALTER TABLE creator_preferences ADD COLUMN IF NOT EXISTS verified_signature/);
  });
});
