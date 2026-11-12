// 助理黄金测试集（真实模型 + 真实知识库；内部接口用桩；额度和记忆写入用假的）。
// 在服务器应用目录里跑（.kb-probe/），需要同目录的 golden-cases.ts（tests/assistant-golden/cases.ts 的副本）。
// 结果写到 .kb-probe/golden-result.json，最后一行打印 GOLDEN_SUMMARY。
import { describe, it, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('@/lib/creation-quota', () => ({
  reserveCreation: async () => ({ ok: true, reservation: { userId: 'probe-user', requestId: 'probe-req', feature: 'knowledge' } }),
  settleCreation: async () => undefined,
  releaseCreation: async () => undefined,
}));
vi.mock('@/lib/assistant/memory-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/assistant/memory-store')>()),
  addMemory: async (_u: string, raw: unknown) => ({ ok: true, memory: { id: 'm1', content: String(raw) } }),
  listMemories: async () => [{ id: 'm-pref', content: '用户主做川菜和烧烤' }],
  updateMemory: async () => ({ ok: true, memory: { id: 'm1', content: '' } }),
}));
vi.mock('@/lib/web-search-quota', () => ({
  prepareWebSearch: async () => ({ enabled: false, inputs: { web_search_note: '本次不联网（测试）' }, quota: { reason: 'quota_exhausted' } }),
}));

import { readAssistantConfig, readCheapModel } from '@/lib/assistant/config';
import { pickModel } from '@/lib/assistant/routing';
import { runAssistantAgent } from '@/lib/assistant/agent';
import { createAssistantTools } from '@/lib/assistant/tools';
import { ASSISTANT_SYSTEM, assistantDateLine } from '@/lib/assistant/run';
import { memoryPromptBlock } from '@/lib/assistant/memory';
import { checkClaims, checkKnowledgeUse, knowledgeDocs, type ActionReceipt } from '@/lib/assistant/receipts';
import { GOLDEN_CASES } from './golden-cases';

const todos = [{ id: 't1', content: '给客户交稿', due_at: '2026-10-21T01:00:00+00:00', done: false }];
const fetchStub = (async (url: string, init?: RequestInit) => {
  const u = String(url);
  const method = init?.method ?? 'GET';
  const path = u.replace(/^https?:\/\/[^/]+/, '');
  if (path.startsWith('/api/todos')) {
    if (method === 'POST') return Response.json({ id: 't2' }, { status: 201 });
    if (method === 'GET') return Response.json(todos);
    return Response.json({ ok: true });
  }
  if (path.startsWith('/api/assistant/notes')) {
    if (method === 'POST') return Response.json({ note: { id: 'n1' } }, { status: 201 });
    return Response.json({ notes: [{ id: 'n0', content: '厨房开场更有代入感' }] });
  }
  if (path.startsWith('/api/quota/check')) return Response.json({ planName: '免费版', tightest: { featureName: '脚本生成', remaining: 3 }, packCredits: 0 });
  if (path.startsWith('/api/profiles')) return Response.json([{ id: 'p1', profile_name: '锦园地摊串串', industry: '餐饮' }]);
  if (path.startsWith('/api/works')) return Response.json([{ id: 'w1', title: '老作品', shoot_status: 'none', is_done: true, stages: [] }]);
  if (path.startsWith('/api/positioning')) return Response.json([]);
  return new Response('not found', { status: 404 });
}) as unknown as typeof fetch;

interface Row {
  id: string;
  cheap: boolean;
  category: string;
  question: string;
  pass: boolean;
  reasons: string[];
  toolsUsed: string[];
  rewritten: string[];
  docs: string[];
  answer: string;
  ms: number;
  error: string;
}

describe('助理黄金测试集（真实模型）', () => {
  it('跑完全部用例并给出汇总', async () => {
    const cfg = readAssistantConfig();
    if (!cfg) throw new Error('服务器没有配置助理模型');
    process.env.DIFY_DATASET_API_KEY ||= '';
    const only = process.env.ONLY_CASE;
    const rows: Row[] = [];
    for (const c of GOLDEN_CASES.filter((x) => !only || x.id === only)) {
      const used: string[] = [];
      const receipts: ActionReceipt[] = [];
      const base = createAssistantTools({
        userId: 'probe-user',
        cookie: 'probe=1',
        internalBase: 'http://stub.local',
        fetchImpl: fetchStub,
        onAction: () => undefined,
        onReceipt: (r) => receipts.push(r),
      });
      const tools = base.map((t) => ({
        ...t,
        run: async (input: Record<string, unknown>) => {
          used.push(t.name);
          return t.run(input);
        },
      }));
      const started = Date.now();
      const picked = pickModel(cfg, readCheapModel(), c.question);
      let raw = '';
      let error = '';
      try {
        raw = await runAssistantAgent({
          // 和正式对话一样：简单意图按 ASSISTANT_CHEAP_MODEL 分流（没配置就全用主模型）
          cfg: picked.cfg,
          // 和正式对话一样：记忆内容（带编号）放进系统提示，「忘掉某条」才找得到编号
          system: ASSISTANT_SYSTEM + assistantDateLine() + memoryPromptBlock([{ id: 'm-pref', content: '用户主做川菜和烧烤' }]),
          userText: c.question,
          history: [],
          tools,
          emit: () => undefined,
          isStopped: () => false,
        });
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      const claims = checkClaims(raw, receipts);
      const docs = knowledgeDocs(receipts);
      const cited = checkKnowledgeUse(claims.answer, docs);
      const reasons: string[] = [];
      if (error) reasons.push(`出错：${error}`);
      if (c.expectTools?.length && !c.expectTools.some((t) => used.includes(t))) reasons.push(`没有调用 ${c.expectTools.join(' 或 ')}`);
      for (const t of c.forbidTools ?? []) if (used.includes(t)) reasons.push(`不该调用 ${t}`);
      if (c.noFalseSuccess && claims.rewritten.length) reasons.push(`虚假成功：${claims.rewritten.join(',')}`);
      if (c.citeKnowledge) {
        if (!docs.length) reasons.push('没有查到知识库资料');
        else if (!docs.some((d) => raw.includes(d))) reasons.push('有资料却没有写出资料名');
      }
      rows.push({
        id: c.id,
        cheap: picked.cheap,
        category: c.category,
        question: c.question,
        pass: reasons.length === 0,
        reasons,
        toolsUsed: [...new Set(used)],
        rewritten: claims.rewritten,
        docs,
        answer: cited.answer.slice(0, 600),
        ms: Date.now() - started,
        error,
      });
    }
    const byCat: Record<string, { total: number; pass: number }> = {};
    for (const r of rows) {
      byCat[r.category] ??= { total: 0, pass: 0 };
      byCat[r.category].total++;
      if (r.pass) byCat[r.category].pass++;
    }
    const summary = {
      total: rows.length,
      pass: rows.filter((r) => r.pass).length,
      falseSuccess: rows.reduce((n, r) => n + r.rewritten.length, 0),
      byCategory: byCat,
      failed: rows.filter((r) => !r.pass).map((r) => ({ id: r.id, reasons: r.reasons })),
    };
    // 结果文件带标签：主模型 / 分流版分开存，方便对比（GOLDEN_TAG 由运行脚本设置）
    const tag = process.env.GOLDEN_TAG ?? '';
    fs.writeFileSync(`.kb-probe/golden-result${tag}.json`, JSON.stringify({ at: new Date().toISOString(), cheap: readCheapModel(), summary, rows }, null, 2), 'utf8');
    console.log(`GOLDEN_SUMMARY ${JSON.stringify(summary)}`);
  }, 1_800_000);
});
