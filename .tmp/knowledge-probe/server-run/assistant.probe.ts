// 助理能力测试（只读/模拟写入）：真实模型、真实知识库；内部接口（待办、额度、档案）用模拟返回；额度与记忆写入用假的。
// 在服务器应用目录里跑（.kb-probe/），跑完删除。
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
  listMemories: async () => [],
  updateMemory: async () => ({ ok: true, memory: { id: 'm1', content: '' } }),
}));
vi.mock('@/lib/web-search-quota', () => ({
  prepareWebSearch: async () => ({ enabled: false, inputs: { web_search_note: '本次不联网（测试）' }, quota: { reason: 'quota_exhausted' } }),
}));

import { readAssistantConfig } from '@/lib/assistant/config';
import { runAssistantAgent } from '@/lib/assistant/agent';
import { createAssistantTools } from '@/lib/assistant/tools';
import { ASSISTANT_SYSTEM, assistantDateLine } from '@/lib/assistant/run';

const SCENARIOS: { id: string; q: string; expectTools?: string[]; forbidTools?: string[] }[] = [
  { id: 'todo-add', q: '帮我记一下：下周三要把稿子交给客户', expectTools: ['add_todo'] },
  { id: 'todo-list', q: '我现在有什么要做的？', expectTools: ['list_todos'] },
  { id: 'ambient-play', q: '播放白噪音，专注 25 分钟', expectTools: ['play_ambient'] },
  { id: 'ambient-stop', q: '把声音停了', expectTools: ['stop_ambient'] },
  { id: 'quota', q: '我的额度还剩多少？', expectTools: ['read_quota'] },
  { id: 'review-no-draft', q: '帮我审一下这篇稿子：今天天气很好。', forbidTools: ['run_review'] },
  { id: 'delete-data', q: '帮我把我的所有脚本历史都删掉', forbidTools: ['run_script', 'run_topic', 'run_review'] },
  { id: 'method-knowledge', q: '选题怎么做，才有爆款的可能？', expectTools: ['search_knowledge'] },
  { id: 'create-profile', q: '帮我在工作台新建一个账号档案，叫「测试号」', forbidTools: ['run_topic', 'run_script'] },
  { id: 'edit-todo', q: '把「给客户交稿」那条待办改到周五', expectTools: ['list_todos'] },
];

const todos = [{ id: 't1', content: '给客户交稿', due_at: '2026-10-23T01:00:00+00:00', done: false }];
const apiCalls: { method: string; path: string; body?: string }[] = [];
const fetchStub = (async (url: string, init?: RequestInit) => {
  const u = String(url);
  const method = init?.method ?? 'GET';
  const path = u.replace(/^https?:\/\/[^/]+/, '');
  apiCalls.push({ method, path, body: typeof init?.body === 'string' ? init.body : undefined });
  if (path.startsWith('/api/todos') && method === 'POST') return Response.json({ id: 't2' }, { status: 201 });
  if (path.startsWith('/api/todos')) return Response.json(todos);
  if (path.startsWith('/api/quota/check')) return Response.json({ planName: '免费版', tightest: { featureName: '脚本生成', remaining: 3 }, packCredits: 0 });
  if (path.startsWith('/api/profiles')) return Response.json([{ id: 'p1', profile_name: '川菜号', industry: '餐饮' }]);
  if (path.startsWith('/api/positioning') || path.startsWith('/api/works')) return Response.json([]);
  return new Response('not found', { status: 404 });
}) as unknown as typeof fetch;

describe('助理能力测试', () => {
  it('10 个场景：选对工具、参数对、老实说明做不到的事', async () => {
    const cfg = readAssistantConfig();
    if (!cfg) throw new Error('服务器没有配置助理模型');
    const report: unknown[] = [];
    const only = process.env.ONLY_SCENARIO;
    for (const s of SCENARIOS.filter((x) => !only || x.id === only)) {
      apiCalls.length = 0;
      const used: { name: string; input: Record<string, unknown>; output?: string }[] = [];
      const actions: { name: string; args: Record<string, unknown> }[] = [];
      const base = createAssistantTools({
        userId: 'probe-user',
        cookie: 'probe=1',
        internalBase: 'http://stub.local',
        fetchImpl: fetchStub,
        onAction: (a) => actions.push(a),
      });
      const tools = base.map((t) => ({
        ...t,
        run: async (input: Record<string, unknown>) => {
          const out = await t.run(input);
          used.push({ name: t.name, input, output: out.slice(0, 300) });
          return out;
        },
      }));
      const started = Date.now();
      let answer = '';
      let error = '';
      try {
        answer = await runAssistantAgent({
          cfg,
          system: ASSISTANT_SYSTEM + assistantDateLine(),
          userText: s.q,
          history: [],
          tools,
          emit: () => {},
          isStopped: () => false,
        });
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      const names = used.map((u) => u.name);
      const checks = {
        expectOk: (s.expectTools ?? []).every((t) => names.includes(t)),
        forbidOk: (s.forbidTools ?? []).every((t) => !names.includes(t)),
      };
      report.push({
        id: s.id,
        question: s.q,
        ms: Date.now() - started,
        toolsUsed: used,
        actions,
        apiCalls: apiCalls.slice(),
        checks,
        error,
        answer: answer.slice(0, 900),
      });
    }
    fs.writeFileSync('.kb-probe/assistant-result.json', JSON.stringify(report, null, 2), 'utf8');
    console.log('ASSISTANT_PROBE_DONE');
  }, 1_500_000);
});
