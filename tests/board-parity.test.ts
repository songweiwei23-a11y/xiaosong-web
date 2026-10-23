/**
 * 助理替编导填表时，给板块的内容要和编导在页面上手动操作（不改任何选项）一样。
 * 这里检查：页面默认值、共用的创作设置、助理实际发出去的请求体、记忆预填。全部用假接口，不调用真实模型。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runTopicBoard, runScriptBoard, runReviewBoard, type BoardContext, type ReviewInput, type ScriptInput, type TopicInput } from '@/lib/assistant/boards';
import { ASSISTANT_SYSTEM } from '@/lib/assistant/run';
import { SCRIPT_PAGE_DEFAULTS, scriptMemoryPatch, scriptResultWithQuality } from '@/lib/boards/script-query';
import { AI_DURATION } from '@/lib/review-standards';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (answer: string) =>
  new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

/**
 * 板块的执行：助理派活经用户确认后，真正跑的就是 lib/assistant/boards.ts 里的这三个函数。
 * 这里按旧的工具名调用它们，返回板块的文字（失败返回原因）。
 */
function boardRunner(name: string, ctx: BoardContext) {
  return {
    name,
    run: async (input: Record<string, unknown>): Promise<string> => {
      const r = name === 'run_topic'
        ? await runTopicBoard(ctx, { count: 10, role: '按配比', ...input } as TopicInput)
        : name === 'run_script'
          ? await runScriptBoard(ctx, input as unknown as ScriptInput)
          : await runReviewBoard(ctx, input as unknown as ReviewInput);
      return r.ok ? r.text : r.error ?? '';
    },
  };
}

/** 假接口：档案 p1；记忆接口按 memory 返回；板块接口记下请求体 */
function harness(memory: unknown | null) {
  const sent: Record<string, Record<string, unknown>> = {};
  const memoryCalls: string[] = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/dify/stream')) {
      const body = JSON.parse(String(init?.body));
      sent[body.taskType] = body;
      return sse('ok');
    }
    if (u.includes('/api/settings-memory')) {
      memoryCalls.push(u);
      return memory ? json(memory) : json({}, 404);
    }
    if (u.includes('/api/profiles')) return json([{ id: 'p1', profile_name: 'A号', account_track: ['本地服务'] }]);
    return json([]);
  }) as unknown as typeof fetch;
  const ctx: BoardContext = { userId: 'u1', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl: fakeFetch, memoryOn: memory !== undefined ? true : false };
  const find = (name: string) => boardRunner(name, ctx);
  return { sent, memoryCalls, find, fakeFetch };
}

describe('页面默认值：助理替编导填表时用的就是这些', () => {
  const page = read('app/dashboard/script/page.tsx');
  const topicPage = read('app/dashboard/topic/page.tsx');
  const reviewPage = read('app/dashboard/review/page.tsx');

  it('脚本页的初始值和 SCRIPT_PAGE_DEFAULTS 一致', () => {
    expect(page).toContain('useState("teach")');
    expect(page).toContain("useState<'自动' | ContentRole>('自动')");
    expect(page).toContain('useState("抖音")');
    expect(page).toContain('useState("60秒")');
    expect(page).toContain('useState<"preset" | "custom" | "ai">("ai")');
    expect(page).toContain('useState("专业")');
    expect(page).toContain('useState(AUTO_TACTIC)');
    expect(page).toContain('useState("室内")');
    expect(page).toContain('useState("手机")');
    expect(page).toContain('useState("低成本(0-500)")');
    expect(page).toContain('useState("一人")');
    expect(page).toContain('useState<string[]>(["emotion", "picture"])');
    expect(SCRIPT_PAGE_DEFAULTS.platform).toBe('抖音');
    expect(SCRIPT_PAGE_DEFAULTS.durationMode).toBe('ai');
    expect(SCRIPT_PAGE_DEFAULTS.style).toBe('专业');
  });

  it('选题页的初始值：条数 10、按配比、两种都出', () => {
    expect(topicPage).toContain('useState(10)');
    expect(topicPage).toContain("useState<'按配比' | ContentRole>('按配比')");
    expect(topicPage).toContain("useState<CreativeRoute>('两种都出')");
  });

  it('审稿页的初始值：平台抖音、时长 AI 推荐', () => {
    expect(reviewPage).toContain('useState("抖音")');
    expect(reviewPage).toContain('useState(AI_DURATION)');
  });

  it('三个页面的创作设置都调用共用函数，不再各拼一份', () => {
    expect(page).toContain('scriptCreationSettings({');
    expect(page).toContain('scriptMemoryPatch(d, { durationMode, scriptRole, scriptStructure, platform })');
    expect(page).not.toContain("from: '脚本生成'");
    expect(topicPage).toContain('topicCreationSettings({');
    expect(topicPage).not.toContain("from: '选题策划'");
    expect(reviewPage).toContain('reviewCreationSettings({');
    expect(reviewPage).not.toContain("from: '审稿优化'");
  });
});

describe('助理发出去的请求：和页面默认操作一致', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('脚本：没说的项用页面默认值；目的不填就是「自动」（不写进创作设置）', async () => {
    const { sent, find } = harness(null);
    await find('run_script').run({ request: '节前节后门店生意对比' });
    const body = sent['脚本生成'];
    expect(body.profileId).toBe('p1');
    const settings = body.creationSettings as Record<string, unknown>;
    expect(settings.platform).toBe('抖音');
    expect(settings.style).toBe('专业');
    expect(settings.purpose).toBeUndefined();
    expect(settings.tactic).toBeUndefined();
    expect(settings.structure).toBeUndefined();
    expect(String(body.query)).not.toContain('【账号定位-脚本创作参考】');
  });

  it('脚本：用户给了目的，就写进创作设置，不被记忆覆盖', async () => {
    const { sent, find } = harness({ defaults: { purpose: { value: '人设型' } }, summary: '上次的习惯' });
    await find('run_script').run({ request: '节前节后门店生意对比', role: '变现型' });
    expect((sent['脚本生成'].creationSettings as Record<string, unknown>).purpose).toBe('变现型');
  });

  it('脚本：记忆预填开着时，按页面的规则填上次的目的和时长', async () => {
    const { sent, memoryCalls, find } = harness({
      defaults: { purpose: { value: '人设型' }, duration: { value: '30秒' } },
      summary: '上次的习惯',
    });
    await find('run_script').run({ request: '节前节后门店生意对比' });
    expect(memoryCalls[0]).toContain('/api/settings-memory?board=script&profileId=p1');
    const settings = sent['脚本生成'].creationSettings as Record<string, unknown>;
    expect(settings.purpose).toBe('人设型');
    expect(settings.duration).toBe('30秒');
  });

  it('脚本：记忆预填关掉时不读记忆，也不按上次的习惯填', async () => {
    const { sent, memoryCalls, fakeFetch } = harness({ defaults: { purpose: { value: '人设型' } }, summary: '上次的习惯' });
    await boardRunner('run_script', { userId: 'u1', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl: fakeFetch, memoryOn: false }).run({ request: '节前节后门店生意对比' });
    expect(memoryCalls).toHaveLength(0);
    expect((sent['脚本生成'].creationSettings as Record<string, unknown>).purpose).toBeUndefined();
  });

  it('选题：没勾选的项是页面初始空值，条数默认 10，按配比（不写目的）', async () => {
    const { sent, find } = harness(null);
    await find('run_topic').run({ request: '想拍菜市场的真实故事' });
    const settings = sent['选题策划'].creationSettings as Record<string, unknown>;
    expect(settings.topicCount).toBe(10);
    expect(settings.purpose).toBeUndefined();
    // 页面没选平台时，创作设置里的平台也是解析函数给的默认值（抖音），助理同样如此
    expect(settings.platform).toBe('抖音');
  });

  it('审稿：平台抖音、时长 AI 推荐（连续设置里不写时长），不带脚本类型', async () => {
    const { sent, find } = harness(null);
    await find('run_review').run({ draft: '这是一段足够长的口播稿，用来测试审稿板块的设置，内容随便写写就行，要超过三十个字。' });
    const settings = sent['审稿优化'].creationSettings as Record<string, unknown>;
    expect(settings.platform).toBe('抖音');
    expect(settings.duration).toBeUndefined();
    expect(settings.scriptType).toBeUndefined();
    expect(AI_DURATION).toBe('AI推荐');
  });

  it('记忆预填规则：只填页面上还是默认值的那几项', () => {
    const defaults = { duration: { value: '30秒' }, purpose: { value: '人设型' }, platform: { value: '小红书' } } as never;
    const fresh = scriptMemoryPatch(defaults, { durationMode: 'ai', scriptRole: '自动', scriptStructure: 'auto', platform: '抖音' });
    expect(fresh.applied).toEqual(['duration', 'purpose', 'platform']);
    const picked = scriptMemoryPatch(defaults, { durationMode: 'preset', scriptRole: '变现型', scriptStructure: 'auto', platform: '视频号' });
    expect(picked.applied).toEqual([]);
  });
});

describe('助理跑完板块后，历史记录和页面一样存下来', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('脚本：存进历史的结果带质检报告（和页面显示的一样），输入里有主题和档案', async () => {
    const rows: { taskType: string; inputData: Record<string, unknown>; result: string }[] = [];
    const { fakeFetch } = harness(null);
    const out = await boardRunner('run_script', {
      userId: 'u1', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl: fakeFetch,
      saveHistory: async (row) => { rows.push(row); },
    }).run({ request: '节前节后门店生意对比' });
    expect(rows).toHaveLength(1);
    expect(rows[0].taskType).toBe('脚本生成');
    expect(rows[0].result).toBe(scriptResultWithQuality('ok'));
    expect(out).toBe(scriptResultWithQuality('ok'));
    expect(rows[0].inputData.topic).toBe('节前节后门店生意对比');
    expect(rows[0].inputData.profileId).toBe('p1');
    expect(rows[0].inputData.duration).toBe('AI推荐');
  });

  it('选题、审稿：各自的历史类型，选题带上条数', async () => {
    const rows: { taskType: string; inputData: Record<string, unknown>; result: string }[] = [];
    const { fakeFetch } = harness(null);
    const boardCtx: BoardContext = {
      userId: 'u1', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl: fakeFetch,
      saveHistory: async (row) => { rows.push(row); },
    };
    const draft = '这是一段足够长的口播稿，用来测试审稿板块跑完以后存进历史的内容，要超过三十个字才会去审。';
    await boardRunner('run_topic', boardCtx).run({ request: '想拍菜市场的真实故事' });
    await boardRunner('run_review', boardCtx).run({ draft });
    expect(rows.map((r) => r.taskType)).toEqual(['选题策划', '审稿优化']);
    expect(rows[0].inputData.topicCount).toBe(10);
    expect(rows[1].inputData.draftContent).toBe(draft);
  });

  it('不传自定义保存时：选题走 /api/topics，脚本和审稿走 /api/script-history（用户的 Cookie 认人）', async () => {
    const posts: { url: string; body: Record<string, unknown>; cookie: string | null }[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/dify/stream')) return sse('ok');
      if (u.includes('/api/topics') || u.includes('/api/script-history')) {
        posts.push({ url: u, body: JSON.parse(String(init?.body)), cookie: new Headers(init?.headers).get('cookie') });
        return json({ id: 'h1' });
      }
      return json([]);
    }) as unknown as typeof fetch;
    const boardCtx: BoardContext = { userId: 'u1', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl: fakeFetch };
    const draft = '这是一段足够长的口播稿，用来测试审稿板块跑完以后存进历史的内容，要超过三十个字才会去审。';
    await boardRunner('run_topic', boardCtx).run({ request: '想拍菜市场的真实故事' });
    await boardRunner('run_script', boardCtx).run({ request: '节前节后门店生意对比' });
    await boardRunner('run_review', boardCtx).run({ draft });
    expect(posts.map((p) => p.url)).toEqual(['http://x/api/topics', 'http://x/api/script-history', 'http://x/api/script-history']);
    expect(posts[1].body.task_type).toBe('脚本生成');
    expect(posts[2].body.task_type).toBe('审稿优化');
    expect(posts.every((p) => p.cookie === 'c=1')).toBe(true);
  });

  it('存历史失败不影响结果返回', async () => {
    const { fakeFetch } = harness(null);
    const out = await boardRunner('run_topic', {
      userId: 'u1', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl: fakeFetch,
      saveHistory: async () => { throw new Error('db down'); },
    }).run({ request: '想拍菜市场的真实故事' });
    expect(out).toBe('ok');
  });
});

describe('助理的决策规则', () => {
  it('先查档案，能定的就用默认并说明，复杂的才问', () => {
    expect(ASSISTANT_SYSTEM).toContain('先调用 read_account、read_quota');
    expect(ASSISTANT_SYSTEM).toContain('一律用页面的默认设置');
    expect(ASSISTANT_SYSTEM).toContain('平台抖音');
    expect(ASSISTANT_SYSTEM).toContain('会重复扣额度');
  });
});
