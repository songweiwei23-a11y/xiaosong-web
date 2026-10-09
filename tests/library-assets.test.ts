/**
 * 素材库分页 / 真实素材 / 好稿 / 选题索引 / 风格预设（2026-10-03）——真实路由 + 内存数据库的行为测试。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';

const env = vi.hoisted(() => ({ userId: 'user-a', db: null as any }));
vi.mock('@/lib/api-guard', () => ({ requireUser: async () => ({ ok: true, userId: env.userId }) }));
vi.mock('@/lib/admin-auth', () => ({ getServerSupabase: async () => env.db }));

import * as library from '@/app/api/library/route';
import * as outputs from '@/app/api/library/outputs/route';
import * as exporter from '@/app/api/library/export/route';
import * as presets from '@/app/api/creator-presets/route';
import { SYNC_BATCH } from '@/lib/library-topic-index';
import { buildContextBlock } from '@/lib/creator-context';
import { pickActivePreset, presetPromptBlock, toPreset } from '@/lib/creator-presets';
import { cleanKeyword, dateRange, readRealFields, realMaterialContent } from '@/lib/library';

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const uuid = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString();
const get = (h: any, url: string) => h.GET(new Request(`https://local${url}`));
const send = (h: any, method: string, url: string, body: unknown) =>
  h[method](new Request(`https://local${url}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const json = async (r: Response) => ({ status: r.status, body: await r.json() });

const MATERIAL_UNIQUE = { material_library: [{ cols: ['user_id', 'content_hash'] }] };

describe('收藏与全部产出承接原意', () => {
  beforeEach(() => {
    env.userId = 'user-a';
    env.db = createFakeDb({ material_library: [], script_history: [{ id: uuid(9900), user_id: 'user-a', task_type: '脚本生成', result: '返乡青年讨论稿', input_data: { originContent: '做大众讨论，禁止促销', creationSettings: { purpose: '流量型', userIntent: '最初想法', audience: '返乡青年' } } }] }, { unique: MATERIAL_UNIQUE });
  });
  it('从全部产出取全文同时取生成时的设置；他人不能读取', async () => {
    const r = await json(await get(outputs, `/api/library/outputs?id=${uuid(9900)}`));
    expect(r.body.creationContext.settings.userIntent).toBe('最初想法');
    expect(r.body.creationContext.originContent).toBe('做大众讨论，禁止促销');
    env.userId = 'user-b';
    expect((await json(await get(outputs, `/api/library/outputs?id=${uuid(9900)}`))).status).toBe(404);
  });
  it('收藏后重新取用保留目的、人群、原意，不只保存正文', async () => {
    const creationContext = { settings: { purpose: '流量型', userIntent: '不卖课', audience: '青年' }, originContent: '原始讨论角度' };
    const r = await json(await send(library, 'POST', '/api/library', { items: [{ title: '返乡讨论', content: '返乡要考虑什么？', category: 'script', source: '脚本生成', creationContext }] }));
    expect(r.status).toBe(200);
    expect(env.db.tables.material_library[0].fields.creationContext).toEqual(creationContext);
  });
});

function fav(n: number, extra: Record<string, unknown> = {}) {
  return { id: uuid(n), user_id: 'user-a', profile_id: P1, category: 'script', source: '脚本', title: `素材${n}`, content: `第${n}条正文 ${'很长的内容'.repeat(40)}`, note: '', content_hash: `h${n}`, kind: 'ai', fields: null, created_at: at(n), ...extra };
}

beforeEach(() => { env.userId = 'user-a'; });

describe('我的收藏：服务端分页、搜索、隔离', () => {
  beforeEach(() => {
    const rows = Array.from({ length: 1205 }, (_, i) => fav(i + 1));
    rows.push(fav(5000, { user_id: 'user-b', title: '别人的素材', content: '别人家的秘方 牛油' }));
    rows.push(fav(5001, { profile_id: P2, title: '另一个档案的', content: '二号店 牛油' }));
    rows.push(fav(5002, { title: '藏在正文里', content: `${'前面很长'.repeat(80)}关键词：老灶牛油` }));
    env.db = createFakeDb({ material_library: rows }, { unique: MATERIAL_UNIQUE });
  });

  it('翻到第 1200 条以后照样拿得到（原来最多 500 条），列表只有预览不带正文', async () => {
    const { body } = await json(await get(library, `/api/library?profileId=${P1}&offset=1200&limit=20`));
    expect(body.total).toBe(1206);
    expect(body.items).toHaveLength(6);
    expect(body.items[0]).not.toHaveProperty('content');
    expect(body.items[0].preview.length).toBeLessThanOrEqual(140);
    expect(body.items[0].length).toBeGreaterThan(140);
  });

  it('计数不受数据库一次 1000 行的上限影响；只在第一页带', async () => {
    const first = (await json(await get(library, `/api/library?profileId=${P1}`))).body;
    expect(first.counts.all).toBe(1206);
    expect(first.counts.categories.script).toBe(1206);
    expect(first.counts.kinds.ai).toBe(1206);
    expect((await json(await get(library, `/api/library?profileId=${P1}&offset=20`))).body.counts).toBeUndefined();
  });

  it('搜索在服务端做，能搜到正文深处；只搜本人、本档案', async () => {
    const r = (await json(await get(library, `/api/library?profileId=${P1}&q=${encodeURIComponent('牛油')}`))).body;
    expect(r.items.map((x: any) => x.title)).toEqual(['藏在正文里']);
    const all = (await json(await get(library, `/api/library?q=${encodeURIComponent('牛油')}`))).body;
    expect(all.items.map((x: any) => x.title).sort()).toEqual(['另一个档案的', '藏在正文里']);
  });

  it('搜索词里的逗号、括号、百分号不会拼坏查询或匹配全部', async () => {
    expect(cleanKeyword('50%,(牛油)*')).toBe('50 牛油');
    const r = await json(await get(library, `/api/library?q=${encodeURIComponent('%')}`));
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(1207); // 只剩空关键词 = 不筛，而不是 % 通配
  });

  it('没选档案（default）只看没挂档案的，不会把各档案的混在一起', async () => {
    env.db.tables.material_library.push(fav(6000, { profile_id: null, title: '没挂档案的' }));
    const r = (await json(await get(library, '/api/library?profileId=default'))).body;
    expect(r.items.map((x: any) => x.title)).toEqual(['没挂档案的']);
  });

  it('按时间筛（北京时间，含当天）', async () => {
    expect(dateRange('2026-01-01', '2026-01-01')).toEqual({ gte: '2025-12-31T16:00:00.000Z', lt: '2026-01-01T16:00:00.000Z' });
    expect(dateRange('乱写', null)).toEqual({});
  });

  it('正文点开再取；别人的取不到', async () => {
    expect((await json(await get(library, `/api/library?id=${uuid(3)}`))).body.item.content).toContain('第3条正文');
    expect((await get(library, `/api/library?id=${uuid(5000)}`)).status).toBe(404);
  });
});

describe('真实素材与好稿', () => {
  beforeEach(() => { env.db = createFakeDb({ material_library: [fav(1), fav(2, { content: '一样的正文', content_hash: 'dup' })] }, { unique: MATERIAL_UNIQUE }); });

  it('记录真实素材：各栏拼成正文，带「真实」和许可待确认；单独一类', async () => {
    const r = await json(await send(library, 'POST', '/api/library', { profileId: P1, real: { fields: { question: '一元火锅料够不够', quote: '老板你这个一块钱的能吃饱吗', result: '那桌加了 6 份', hack: 'x' } } }));
    expect(r.status).toBe(200);
    const row = env.db.tables.material_library.find((x: any) => x.kind === 'real');
    expect(row).toMatchObject({ category: 'material', profile_id: P1, title: '一元火锅料够不够', source: '手动记录' });
    expect(row.content).toContain('原话：老板你这个一块钱的能吃饱吗');
    expect(row.content).toContain('使用许可：待确认');
    expect(row.fields).not.toHaveProperty('hack');
    expect((await json(await get(library, '/api/library?kind=real'))).body.items).toHaveLength(1);
  });

  it('客户问题、原话、结果一项都没有：不收', async () => {
    expect((await send(library, 'POST', '/api/library', { real: { fields: { shots: '后厨' } } })).status).toBe(400);
    expect(readRealFields({ question: '  ' })).toBeNull();
    expect(realMaterialContent({ permission: 'granted', question: '问' })).toContain('已获同意');
  });

  it('AI 稿可以认可为好稿 / 取消；真实素材不能变成好稿', async () => {
    expect((await send(library, 'PATCH', `/api/library?id=${uuid(1)}`, { kind: 'approved' })).status).toBe(200);
    expect(env.db.tables.material_library[0].kind).toBe('approved');
    env.db.tables.material_library[1].kind = 'real';
    expect((await send(library, 'PATCH', `/api/library?id=${uuid(2)}`, { kind: 'approved' })).status).toBe(400);
  });

  it('改正文：和另一条一模一样时明确报重复，原内容不动', async () => {
    expect((await send(library, 'PATCH', `/api/library?id=${uuid(2)}`, { content: '一样的正文' })).status).toBe(200);
    const r = await send(library, 'PATCH', `/api/library?id=${uuid(1)}`, { content: '一样的 正文' });
    expect(r.status).toBe(409);
    expect(env.db.tables.material_library[0].content).toContain('第1条正文');
  });

  it('别人的素材改不了', async () => {
    env.userId = 'user-b';
    expect((await send(library, 'PATCH', `/api/library?id=${uuid(1)}`, { title: '偷改' })).status).toBe(404);
  });

  it('数据库没升级（没有 kind/fields 列）：列表照常、标明要跑哪个迁移；按来源筛不乱给结果', async () => {
    env.db = createFakeDb({ material_library: [fav(1)] }, { missingColumns: { material_library: ['kind', 'fields'] } });
    const r = (await json(await get(library, '/api/library'))).body;
    expect(r.items).toHaveLength(1);
    expect(r.items[0].kind).toBe('ai');
    expect(r.notice).toContain('20261003_library_assets.sql');
    expect((await json(await get(library, '/api/library?kind=real'))).body.items).toEqual([]);
    expect((await send(library, 'POST', '/api/library', { real: { fields: { question: '问' } } })).status).toBe(503);
  });

  it('导出：全部条目带全文，超过 1000 条也不少', async () => {
    env.db = createFakeDb({ material_library: Array.from({ length: 1003 }, (_, i) => fav(i + 1)) });
    const text = await (await get(exporter, '/api/library/export')).text();
    expect(text).toContain('共 1003 条');
    expect(text).toContain('第1003条正文');
    const j = JSON.parse(await (await get(exporter, '/api/library/export?format=json')).text());
    expect(j.count).toBe(1003);
  });
});

/* ---------- 全部产出 ---------- */

const topicBatch = (n: number, extra: Record<string, unknown> = {}) => ({
  id: uuid(n), user_id: 'user-a', task_type: '选题策划', created_at: at(n), work_id: null,
  input_data: { profile_id: P1 },
  result: `## 选题1：第${n}批甲\n内容甲${n}\n## 选题2：第${n}批乙\n内容乙${n}\n## 选题3：第${n}批丙\n内容丙${n} 秘密词${n}`,
  ...extra,
});

describe('全部产出：选题索引、分页、计数', () => {
  beforeEach(() => {
    const rows: any[] = Array.from({ length: SYNC_BATCH + 10 }, (_, i) => topicBatch(i + 1));
    rows.push(topicBatch(9000, { user_id: 'user-b' }));
    rows.push(topicBatch(9001, { input_data: { profile_id: P2 } }));
    for (let i = 0; i < 1050; i++) rows.push({ id: uuid(20000 + i), user_id: 'user-a', task_type: '脚本生成', created_at: at(20000 + i), work_id: null, input_data: { profileId: P1, topic: `脚本${i}` }, result: `# 脚本${i}\n口播内容${i}` });
    env.db = createFakeDb({ script_history: rows, library_topic_index: [] });
  });

  it('旧批次分几次补齐索引，补完后数量准确；其他库超过 1000 条也数得准', async () => {
    const first = (await json(await get(outputs, `/api/library/outputs?profileId=${P1}`))).body;
    expect(first.indexReady).toBe(true);
    expect(first.indexing).toBe(11); // 本人共 131 批，一次补 120
    expect(first.counts.script).toBe(1050);
    const second = (await json(await get(outputs, `/api/library/outputs?profileId=${P1}`))).body;
    expect(second.indexing).toBe(0);
    expect(second.counts.topic).toBe((SYNC_BATCH + 10) * 3);
    expect(env.db.tables.library_topic_index.every((r: any) => r.user_id === 'user-a')).toBe(true);
  });

  it('第二次打开不再拆全文（只取编号）', async () => {
    await get(outputs, '/api/library/outputs');
    await get(outputs, '/api/library/outputs');
    env.db.calls.length = 0;
    await get(outputs, '/api/library/outputs');
    const fullReads = env.db.calls.filter((c: any) => c.table === 'script_history' && c.op === 'select' && String(c.args[0]).includes('result'));
    expect(fullReads).toEqual([]);
  });

  it('选题按一条一条翻页到最后；最新的在前', async () => {
    await get(outputs, `/api/library/outputs?profileId=${P1}`);
    await get(outputs, `/api/library/outputs?profileId=${P1}`);
    const page1 = (await json(await get(outputs, `/api/library/outputs?profileId=${P1}&lib=topic&limit=4`))).body;
    expect(page1.total).toBe(390);
    expect(page1.items.map((x: any) => x.title)).toEqual(['第130批甲', '第130批乙', '第130批丙', '第129批甲']);
    const last = (await json(await get(outputs, `/api/library/outputs?profileId=${P1}&lib=topic&offset=388&limit=20`))).body;
    expect(last.items.map((x: any) => x.id)).toEqual([`${uuid(1)}#1`, `${uuid(1)}#2`]);
    const full = (await json(await get(outputs, `/api/library/outputs?id=${encodeURIComponent(`${uuid(1)}#2`)}`))).body;
    expect(full.body).toContain('内容丙1');
  });

  it('关键词按条筛（不是整批）；别的档案、别的账号不混进来', async () => {
    await get(outputs, '/api/library/outputs');
    await get(outputs, '/api/library/outputs');
    const r = (await json(await get(outputs, `/api/library/outputs?profileId=${P1}&lib=topic&q=${encodeURIComponent('秘密词7')}`))).body;
    expect(r.items.map((x: any) => x.title)).toEqual(expect.arrayContaining(['第7批丙']));
    expect(r.items.every((x: any) => /丙$/.test(x.title))).toBe(true);
    const p2 = (await json(await get(outputs, `/api/library/outputs?profileId=${P2}&lib=topic`))).body;
    expect(p2.total).toBe(3);
    expect(JSON.stringify(p2)).not.toContain(uuid(9000));
  });

  it('删过选题的批次重拆；历史删了的从索引里去掉', async () => {
    await get(outputs, '/api/library/outputs');
    await get(outputs, '/api/library/outputs');
    const b = env.db.tables.script_history.find((r: any) => r.id === uuid(5));
    b.result = '## 选题1：第5批甲\n内容甲5';
    b.input_data = { profile_id: P1, deletedTopics: ['第5批乙', '第5批丙'] };
    env.db.tables.script_history = env.db.tables.script_history.filter((r: any) => r.id !== uuid(6));
    const r = (await json(await get(outputs, `/api/library/outputs?profileId=${P1}`))).body;
    expect(r.counts.topic).toBe(390 - 2 - 3);
    expect(env.db.tables.library_topic_index.some((x: any) => x.history_id === uuid(6))).toBe(false);
  });

  it('其他库翻页：第 1041 条以后照样有', async () => {
    const r = (await json(await get(outputs, `/api/library/outputs?profileId=${P1}&lib=script&offset=1040&limit=20`))).body;
    expect(r.total).toBe(1050);
    expect(r.items).toHaveLength(10);
    expect(r.items[0]).not.toHaveProperty('result');
  });

  it('索引表没建：选题库退回全量现拆，结果一样不截断，并标明要跑迁移', async () => {
    env.db = createFakeDb({ script_history: Array.from({ length: 1010 }, (_, i) => topicBatch(i + 1)) }, { missingTables: ['library_topic_index'] });
    const r = (await json(await get(outputs, `/api/library/outputs?profileId=${P1}`))).body;
    expect(r.indexReady).toBe(false);
    expect(r.counts.topic).toBe(3030);
    const page = (await json(await get(outputs, `/api/library/outputs?profileId=${P1}&lib=topic&offset=3027`))).body;
    expect(page.items).toHaveLength(3);
  });
});

/* ---------- 风格预设 ---------- */

describe('风格预设', () => {
  const PRESET_UNIQUE = { creator_presets: [{ cols: [], where: (r: any) => r.is_active, key: (r: any) => `${r.user_id}|${r.profile_id ?? 'all'}` }] };
  beforeEach(() => {
    env.db = createFakeDb({
      material_library: [
        fav(1, { kind: 'approved', title: '认可的稿', content: '老板唠嗑：今天这锅底熬了四个钟头，你闻闻。' }),
        fav(2, { kind: 'ai', title: '没认可的', content: '普通 AI 稿子内容' }),
        fav(3, { user_id: 'user-b', kind: 'approved', content: '别人认可的' }),
      ],
      creator_presets: [],
    }, { unique: PRESET_UNIQUE });
  });

  it('示例只认本人认可的好稿，正文以服务端为准（不信前端传来的）', async () => {
    const ok = await json(await send(presets, 'POST', '/api/creator-presets', { name: '唠嗑风', style: '短句', profileId: P1, examples: [{ libraryId: uuid(1), title: 'x', content: '前端乱写的' }] }));
    expect(ok.status).toBe(200);
    expect(ok.body.preset.examples[0].content).toContain('熬了四个钟头');
    expect((await send(presets, 'POST', '/api/creator-presets', { name: 'a', examples: [{ libraryId: uuid(2), content: '' }] })).status).toBe(400);
    expect((await send(presets, 'POST', '/api/creator-presets', { name: 'b', examples: [{ libraryId: uuid(3), content: '' }] })).status).toBe(400);
    expect((await send(presets, 'POST', '/api/creator-presets', { name: 'c' })).status).toBe(400); // 风格、结构、示例全空
  });

  it('采用：同一档案只留一份在用；档案专用优先、其次全部档案；别的档案的不拿来用', async () => {
    const mk = async (name: string, profileId: string | null) => (await json(await send(presets, 'POST', '/api/creator-presets', { name, style: name, profileId }))).body.preset.id;
    const a = await mk('A', P1); const b = await mk('B', P1); const all = await mk('通用', null); await mk('二号店', P2);
    await send(presets, 'PATCH', `/api/creator-presets?id=${a}`, { action: 'adopt' });
    await send(presets, 'PATCH', `/api/creator-presets?id=${b}`, { action: 'adopt' });
    await send(presets, 'PATCH', `/api/creator-presets?id=${all}`, { action: 'adopt' });
    const rows = env.db.tables.creator_presets;
    expect(rows.filter((r: any) => r.is_active).map((r: any) => r.name).sort()).toEqual(['B', '通用']);
    expect((await json(await get(presets, `/api/creator-presets?active=1&profileId=${P1}`))).body.preset.name).toBe('B');
    expect((await json(await get(presets, `/api/creator-presets?active=1&profileId=${P2}`))).body.preset.name).toBe('通用');
    expect(pickActivePreset(rows.map(toPreset).filter((p: any) => p.profile_id === P2), P1)).toBeNull();
  });

  it('只看得到、改得了自己的', async () => {
    const id = (await json(await send(presets, 'POST', '/api/creator-presets', { name: 'A', style: 's' }))).body.preset.id;
    env.userId = 'user-b';
    expect((await json(await get(presets, '/api/creator-presets'))).body.presets).toEqual([]);
    expect((await send(presets, 'PATCH', `/api/creator-presets?id=${id}`, { action: 'adopt' })).status).toBe(404);
  });

  it('表没建：管理页说清楚跑哪个迁移；生成板块读不到就当没有，不报错', async () => {
    env.db = createFakeDb({}, { missingTables: ['creator_presets'] });
    const list = await json(await get(presets, '/api/creator-presets'));
    expect(list.status).toBe(503);
    expect(list.body.error).toContain('20261003_creator_presets.sql');
    const active = await json(await get(presets, '/api/creator-presets?active=1'));
    expect(active).toEqual({ status: 200, body: { preset: null, notReady: true } });
  });

  it('写稿类板块带上预设，规划类不带；提醒不搬示例里的事实', () => {
    const preset = toPreset({ id: 'p', profile_id: P1, name: '唠嗑风', style: '短句', structure: '先抛原话', examples: [{ title: '例', content: '二十年老店，38 元一锅' }], is_active: true });
    const ctx = { profile: { id: P1, profile_name: '店' }, positioning: null, dealReasons: [], preset };
    expect(buildContextBlock(ctx, 'script')).toContain('风格预设：唠嗑风');
    expect(buildContextBlock(ctx, 'freeChat')).toContain('先抛原话');
    expect(buildContextBlock(ctx, 'topic')).not.toContain('风格预设');
    expect(presetPromptBlock(preset)).toMatch(/店名、价格、数字、经历、地点\*\*不能搬进新稿/);
  });
});
