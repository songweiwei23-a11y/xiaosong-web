import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { readAssistantConfig } from '@/lib/assistant/config';
import { messagesUrl } from '@/lib/assistant/llm';
import { readDifyStream, type TopicBatchStatus } from '@/lib/sse-stream';
import { finalizeTopicBatch, primaryTopicElement } from '@/lib/topic-delivery';
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
          completed_at: rows.length + 1, usage: args.p_usage, usage_metadata: args.p_usage,
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
  { name: '直选地域差异裂变选题', source: 'tactic' },
  { name: '截图双城老板模板回归', source: 'screenshot' },
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
  const upstream: { query: string; conversation_id?: string; inputs: { search_query: string } }[] = [];
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
    const timeout = AbortSignal.timeout(url === difyUrl ? 300_000 : 60_000);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    if (!source || url !== judgeUrl) return realFetch(input, { ...init, signal });
    const start = Date.now();
    try {
      const response = await realFetch(input, { ...init, signal });
      const payload = JSON.parse(String(init?.body));
      const system = typeof payload.system === 'string' ? payload.system : payload.system.map(({ text }: { text: string }) => text).join('\n');
      const kind = system.includes('审核编辑') ? 'audit' : 'plan';
      const reply = await response.clone().json().catch(() => null);
      const content = reply?.content?.filter((block: { type: string }) => block.type === 'text').map((block: { text: string }) => block.text).join('');
      console.log('语义核对响应', { kind, status: response.status, ms: Date.now() - start, ...(kind === 'audit' ? { decision: content?.slice(0, 900) } : {}) });
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
      let firstDraft = '';
      const text = await readDifyStream(response, {
        onChunk: (piece, full) => {
          if (piece && !batch) previewChunks++;
          if (full.length > firstDraft.length) firstDraft = full;
        },
        onTopicBatch: (event) => { batch = event; },
      }).catch((error) => {
        if (source) console.log('未交付的流式草稿', splitTopicSections(firstDraft).map((topic) => ({
          title: topic.title, element: primaryTopicElement(topic),
          excerpt: topic.body.split('\n').filter((line) => /爆款元素|承接|取材与内容推进/.test(line)).slice(0, 4),
        })));
        throw error;
      });
      if (source) {
        console.log('流式验收', { source, previewChunks, batch });
        for (const topic of splitTopicSections(text)) {
          console.log('合成选题：' + topic.title);
          const lines = topic.body.split('\n');
          console.log(lines.flatMap((line, index) => /承接|爆款元素|取材与内容推进|脚本结构/.test(line)
            ? [line, ...(/[:：]$|\*\*$/.test(line.trim()) && lines[index + 1] ? [lines[index + 1]] : [])] : []).slice(0, 8).join('\n'));
        }
      }
      expect(batch).toMatchObject({ requested: count, count, checked: true });
      expect(splitTopicSections(text)).toHaveLength(count);
      if (source) {
        expect(previewChunks).toBeGreaterThan(1);
        const elements = splitTopicSections(text).map(primaryTopicElement);
        expect(elements.every(Boolean)).toBe(true);
        expect(new Set(elements).size).toBeGreaterThanOrEqual(3);
        console.log('实际主爆款元素', elements);
      }
      return text;
    }
    if (source) {
      const screenshot = source === 'screenshot';
      const direction = screenshot ? [
        '### 方向1：南乐和郑州的街边小店',
        '- **内容方向**：小店与当地生活的关系，包括招牌、熟客、进货和门店日常。',
        '- **怎么拍**：南乐老板做 A，郑州老板做 B，然后让两地老板解释。',
      ].join('\n') : [
        '### 方向1：本地早餐里的地域差异',
        '- **视频目的**：流量型，帮助本地人与外地人理解不同的饮食习惯',
        '- **内容类型**：36计·第35计 街头采访',
        '- **内容方向**：围绕早餐的口味、称呼、制作过程和点单习惯，观察人们在生活中遇到的具体差别。',
        '- **怎么拍**：每期都让外地人提问，老板给出两地对比。',
        '- **开头示范**：南乐XXX，郑州XXX。',
      ].join('\n');
      const tactic = source === 'tactic' ? '南北/地域差异' : '';
      const incomingSetup = source === 'tactic' ? null : buildCreationHandoff(screenshot ? 'direction' : source, 'topic', direction, {});
      const sourceReference = incomingSetup ? topicReference(incomingSetup) : '';
      const topicCount = 5;
      const personalRequirement = screenshot ? [
        '以下是虚构测试档案里的已知素材。一位店主先在南乐开店，后把店搬到郑州，旧木招牌背面还有南乐街名，现用招牌印着郑州门牌。两块招牌可拍。',
        '店主可演示在南乐店里用纸本记下预约取货、在郑州店里用标签夹给预订袋排序的实际动作。留有一页遮住姓名的预约本和旧标签夹。',
        '有一张开店当天店主拍的南乐店门口的照片，拍到门口的取货小桌。店主可以讲搬店时留下这张照片的经过，答案须等采访。',
        '只有店主、现店柜台、上述旧物、一只空预订袋和手机可拍。没有顾客可采访，也没有已知价格或两地普遍习惯。',
      ].join('\n') : [
        '虚构的早餐店档案，以下是本轮已知拍摄素材。店员曾在甲地和乙地的两家店工作。甲店菜单曾把甜浆配点心印在一起，乙店旧菜单把咸浆和点心分开写。这只代表两家店。',
        '现在在同一个制作台能拍两款样品：甲店做法的甜浆和乙店做法的咸浆。店里留有甲店使用过的模具和两张菜单。只有这名店员、制作台、两款现成样品、模具、菜单和手机可用。',
        '可演示两家店曾用的实际操作，记录过程并做可重复小测试。可以拍店员本人对两家店的记忆，访谈结果须留待拍摄。没有已知的年代、价钱、涨幅、顾客反应或全地区普遍习惯。',
      ].join('\n');
      const creatorContext = { profile: null, positioning: null, dealReasons: [] } as unknown as CreatorContext;
      const { query } = buildTopicBoardQuery({
        creatorContext, selectedProfile: null, positioningForCtx: null, topicCount, topicType: '流量型选题',
        topicRole: '流量型', mode: 'custom', sourceReference, sourceFrom: incomingSetup?.from ?? '', incomingSetup,
        keyword1: '', keyword2: '', keyword3: '', personalRequirement, currentSettings: {}, accountStage: '',
        fansLevel: '', avgViewsInput: '', selectedPlatforms: [], selectedTracks: [], selectedContentTypes: [],
        selectedStyles: [], positioningExtra: '', selectedElements: [], dealReasonLabels: [],
        benchmarkAccounts: '', viralCases: '', difficulty: '中等创意', withHook: true, tactic,
        route: '两种都出', routeExplicit: false, resolvedMix: resolveMix(null, null, ''), quickTopics: false,
      });
      if (screenshot) state.tables.set('script_history', [{
        id: randomUUID(), user_id: state.userId, task_type: '选题策划', input_data: { profile_id: profileId },
        result: '## 选题1：南乐老板给店取名，会问街坊好不好记；郑州老板给店取名，会问网上好不好搜\n拍两地老板对答并让评论区投票。\n\n' +
          '## 选题2：南乐老板店里东西卖贵了会主动退；郑州老板店里东西卖贵了，客人不说就不退吗？\n拍两地老板对答并让评论区投票。',
      }]);
      const delivered = await deliver(await generate(request('/api/dify/stream', {
        taskType: '选题策划', profileId, query, webSearchMode: 'off',
        inputs: { topicCount, tactic, sourceFrom: incomingSetup?.from, sourceReference, personalRequirement },
      })), topicCount);
      expect(delivered).not.toMatch(/奇怪凹槽|透明杯|加醋|凝固时间|顾客当场|颜色不一样|这行字现在没了|倒[^\n]{0,10}手背|【待确认[：:]/);
      if (screenshot) {
        expect(upstream[0].query).not.toContain('南乐老板做 A');
        expect(delivered).not.toMatch(/南乐老板[^\n]*[；;][^\n]*郑州老板|郑州老板[^\n]*[；;][^\n]*南乐老板|评论区投票|标签夹[^\n]{0,16}(?:分颜色|不同颜色|颜色规则)|只带走一张/);
      }
      expect(upstream[0].query).not.toContain('南乐XXX，郑州XXX');
      expect(upstream[0].query).not.toContain('每期都让外地人提问');
      expect(upstream[0].inputs.search_query).toBe('');
      expect(upstream[0].query).toContain('保留每条自己的证据、镜头动作和看点');
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
