import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { readAssistantConfig } from '@/lib/assistant/config';
import { messagesUrl } from '@/lib/assistant/llm';
import { readDifyStream, type TopicBatchStatus } from '@/lib/sse-stream';
import { finalizeTopicBatch } from '@/lib/topic-delivery';
import { splitTopicSections } from '@/lib/topic-library';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { topicReference } from '@/lib/creation-continuation';
import { buildTopicBoardQuery } from '@/lib/boards/topic-query';
import { resolveMix } from '@/lib/content-mix';
import type { CreatorContext } from '@/lib/creator-context';

const state = vi.hoisted(() => ({
  userId: '',
  tables: new Map<string, Record<string, any>[]>(),
  reservations: new Map<string, string>(),
  completed: 0,
}));

vi.mock('@/lib/api-guard', () => ({
  requireUser: async () => ({ ok: true, userId: state.userId }),
  requireUserWithQuota: async () => ({ ok: true, userId: state.userId }),
  incrementUsageServer: async () => { state.completed++; },
}));
vi.mock('@/lib/foundation-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/foundation-gate')>()),
  foundationGate: async () => null,
}));
vi.mock('@/lib/learning-signals', () => ({ recordGenerationSignal: async () => {} }));

vi.mock('@/lib/admin-auth', () => ({
  getServiceSupabase: () => ({
    from(table: string) {
      const rows = state.tables.get(table) ?? [];
      state.tables.set(table, rows);
      let selected = rows.slice();
      let deleting = false;
      const result = () => {
        if (deleting) {
          for (const row of selected) rows.splice(rows.indexOf(row), 1);
        }
        return { data: selected, error: null };
      };
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => { selected = selected.filter((row) => row[column] === value); return query; },
        in: (column: string, values: unknown[]) => { selected = selected.filter((row) => values.includes(row[column])); return query; },
        or: () => query,
        order: (column: string, options?: { ascending?: boolean }) => {
          const sign = options?.ascending === false ? -1 : 1;
          selected.sort((a, b) => (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) * sign);
          return query;
        },
        limit: (n: number) => { selected = selected.slice(0, n); return query; },
        maybeSingle: async () => ({ data: result().data[0] ?? null, error: null }),
        delete: () => { deleting = true; return query; },
        insert: async (row: Record<string, any>) => { rows.push(row); return { error: null }; },
        upsert: async (row: Record<string, any>, options: { ignoreDuplicates?: boolean }) => {
          const index = rows.findIndex((existing) => existing.user_id === row.user_id && existing.scope_key === row.scope_key);
          if (index < 0) rows.push(row);
          else if (!options.ignoreDuplicates) rows[index] = row;
          return { error: null };
        },
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return query;
    },
    async rpc(name: string, args: Record<string, any>) {
      expect(args.p_user_id).toBe(state.userId);
      if (name === 'kaiwu_reserve_creation') {
        state.reservations.set(args.p_request_id, args.p_fingerprint);
        return { data: { allowed: true }, error: null };
      }
      if (name === 'kaiwu_record_creation_completion') {
        const rows = state.tables.get('creation_completion_evidence') ?? [];
        rows.push({
          user_id: args.p_user_id, task_type: args.p_task_type, dify_conversation_id: args.p_conversation_id,
          result: args.p_result, request_fingerprint: state.reservations.get(args.p_request_id),
          completed_at: rows.length + 1, usage: args.p_usage,
        });
        state.tables.set('creation_completion_evidence', rows);
        return { data: { recorded: true }, error: null };
      }
      if (name === 'kaiwu_settle_creation') return { data: { settled: true }, error: null };
      throw new Error('Unexpected synthetic database RPC: ' + name);
    },
  }),
}));

const probes = [
  { name: '三轮创作沿用会话', source: null },
  { name: '创作方向裂变选题', source: 'direction' },
  { name: '内容规划裂变选题', source: 'content-plan' },
] as const;

const probeMode = process.env.KAIWU_TOPIC_LIVE_PROBE;
it.skipIf(!['1', 'diversity'].includes(probeMode || '')).each(
  probes.filter(({ source }) => probeMode === 'diversity' ? !!source : !source),
)('真实 Dify：$name', async ({ source }) => {
  state.tables.clear();
  state.reservations.clear();
  state.completed = 0;
  state.userId = randomUUID();
  const profileId = randomUUID();
  state.tables.set('user_profiles', [{ user_id: state.userId, id: profileId, profile_name: '虚构自行车工作室' }]);
  const assistant = readAssistantConfig();
  if (!assistant) throw new Error('Semantic topic checking is required for this probe');
  const difyBase = new URL(process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1');
  expect(difyBase.origin).toBe('https://api.dify.ai');
  if (!process.env.DIFY_API_KEY) throw new Error('Missing Dify API configuration');
  const difyUrl = difyBase.href.replace(/\/$/, '') + '/chat-messages';
  const judgeUrl = messagesUrl(assistant.baseUrl);
  expect(new URL(judgeUrl).protocol).toBe('https:');
  const realFetch = globalThis.fetch;
  const upstream: { query: string; conversation_id?: string }[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === difyUrl) {
      const body = JSON.parse(String(init?.body));
      expect(body.user).toBe(state.userId);
      upstream.push(body);
    } else if (url.startsWith(difyBase.href.replace(/\/$/, '') + '/messages?')) {
      expect(new URL(url).searchParams.get('user')).toBe(state.userId);
      expect(init?.method ?? 'GET').toBe('GET');
    } else if (url !== judgeUrl) {
      throw new Error('Unexpected network destination during synthetic verification');
    }
    const timeout = AbortSignal.timeout(url === difyUrl ? 300_000 : 30_000);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    if (!source || url !== judgeUrl) return realFetch(input, { ...init, signal });
    const start = Date.now();
    try {
      const response = await realFetch(input, { ...init, signal });
      console.log('语义核对响应', { status: response.status, ms: Date.now() - start });
      return response;
    } catch (error) {
      console.log('语义核对异常', { name: (error as Error).name, ms: Date.now() - start });
      throw error;
    }
  });

  try {
    const { POST: generate } = await import('@/app/api/dify/stream/route');
    const { POST: followUp } = await import('@/app/api/dify/chat/route');
    const marker = 'KAIWU-' + randomUUID().slice(0, 8).toUpperCase();
    const body = {
      taskType: '选题策划', profileId, inputs: { topicCount: 3 }, webSearchMode: 'off',
      query: '这是一个虚构的自行车维修工作室的测试。请记住本对话约定的内部代号 ' + marker +
        '，本轮不输出代号。给 3 条可拍的短视频选题，每条选不同的零件和实拍动作。严格使用 Markdown 格式“## 选题1：标题”及下一行的一句拍摄说明。只给选题，不虚构经营事实、价格、测试结果或人物。',
    };
    const request = (path: string, payload: object) => new Request('https://synthetic.invalid' + path, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-generation-id': randomUUID() },
      body: JSON.stringify(payload),
    }) as NextRequest;
    async function deliver(response: Response, count = 3) {
      expect(response.ok).toBe(true);
      let batch: TopicBatchStatus | undefined;
      let previewChunks = 0;
      const text = await readDifyStream(response, {
        onChunk: (piece) => { if (piece && !batch) previewChunks++; },
        onTopicBatch: (event) => { batch = event; },
      });
      if (source) {
        console.log('流式验收', { source, previewChunks, batch });
        for (const topic of splitTopicSections(text)) {
          console.log('合成选题：' + topic.title);
          console.log(topic.body.split('\n').filter((line) => /承接|核心问题|取材与内容推进|脚本结构|打法/.test(line)).slice(0, 6).join('\n'));
        }
      }
      expect(batch).toMatchObject({ requested: count, count, checked: true });
      expect(splitTopicSections(text)).toHaveLength(count);
      if (source) expect(previewChunks).toBeGreaterThan(1);
      return text;
    }
    if (source) {
      const direction = [
        '### 方向1：本地早餐里的地域差异',
        '- **视频目的**：流量型，帮助本地人与外地人理解不同的饮食习惯',
        '- **内容类型**：36计·第35计 街头采访',
        '- **内容方向**：围绕早餐的口味、称呼、制作过程和点单习惯，观察人们在生活中遇到的具体差别。',
        '- **怎么拍**：每期都让外地人提问，老板给出两地对比。',
        '- **开头示范**：南乐XXX，郑州XXX。',
      ].join('\n');
      const incomingSetup = buildCreationHandoff(source, 'topic', direction, {});
      const sourceReference = topicReference(incomingSetup);
      const topicCount = 5;
      const personalRequirement = '虚构的早餐店档案，只能用现有早餐样品、菜单、制作台和一名可出镜店员。可策划如何观察或验证，不填写两地真实习惯、经营数据、客户经历或尚未取得的采访结果。';
      const creatorContext = { profile: null, positioning: null, dealReasons: [] } as unknown as CreatorContext;
      const { query } = buildTopicBoardQuery({
        creatorContext, selectedProfile: null, positioningForCtx: null, topicCount, topicType: '流量型选题',
        topicRole: '流量型', mode: 'custom', sourceReference, sourceFrom: incomingSetup.from, incomingSetup,
        keyword1: '', keyword2: '', keyword3: '', personalRequirement, currentSettings: {}, accountStage: '',
        fansLevel: '', avgViewsInput: '', selectedPlatforms: [], selectedTracks: [], selectedContentTypes: [],
        selectedStyles: [], positioningExtra: '', selectedElements: [], dealReasonLabels: [],
        benchmarkAccounts: '', viralCases: '', difficulty: '中等创意', withHook: true, tactic: '',
        route: '两种都出', routeExplicit: false, resolvedMix: resolveMix(null, null, ''), quickTopics: false,
      });
      await deliver(await generate(request('/api/dify/stream', {
        taskType: '选题策划', profileId, query, webSearchMode: 'off',
        inputs: { topicCount, sourceFrom: incomingSetup.from, sourceReference, personalRequirement },
      })), topicCount);
      expect(upstream[0].query).not.toContain('南乐XXX，郑州XXX');
      expect(upstream[0].query).not.toContain('每期都让外地人提问');
      return;
    }
    const first = await deliver(await generate(request('/api/dify/stream', body)));
    const nativeId = state.tables.get('dify_conversations')?.[0]?.conversation_id;
    expect(typeof nativeId).toBe('string');
    expect(nativeId).toBeTruthy();
    expect(first).not.toContain(marker);

    const secondStart = upstream.length;
    const second = await deliver(await generate(request('/api/dify/stream', body)));
    expect(upstream[secondStart].conversation_id).toBe(nativeId);
    expect(upstream[secondStart].query).toContain('再出 3 条新选题');
    expect(upstream[secondStart].query).not.toContain(marker);
    expect(second).not.toContain(marker);

    const followUpStart = upstream.length;
    const third = await deliver(await followUp(request('/api/dify/chat', {
      query: '再来三条新选题。正文前单独一行写出最初约定的内部测试代号。然后沿用主题及格式，三个拍摄零件和动作都避开前两批。',
      taskType: '选题策划', profileId, initialContent: second, conversationId: nativeId, webSearchMode: 'off',
    })));
    expect(upstream[followUpStart].conversation_id).toBe(nativeId);
    expect(upstream[followUpStart].query).not.toContain(marker);
    expect(third).toContain(marker);
    expect(state.tables.get('dify_conversations')).toHaveLength(1);
    expect(state.tables.get('creation_completion_evidence')?.map((row) => row.dify_conversation_id)).toEqual([nativeId, nativeId, nativeId]);
    expect(state.completed).toBe(3);

    const all = [first, second, third].flatMap(splitTopicSections);
    const combined = all.map((topic, index) => '## 选题' + (index + 1) + '：' + topic.title + '\n' + topic.body).join('\n\n');
    const audit = await finalizeTopicBatch(combined, [], 9, async () => '');
    expect(audit).toMatchObject({ checked: true, removed: 0, count: 9 });
    console.log('创作验收：3 轮共用同一个 Dify 会话。第三轮记起首轮代号。9 条交付选题交叉核对无撞题。');
    for (const topic of all) console.log('合成选题：' + topic.title);
  } finally {
    vi.unstubAllGlobals();
  }
}, 600_000);
