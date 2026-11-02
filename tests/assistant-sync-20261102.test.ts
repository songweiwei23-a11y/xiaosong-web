// 开物助理体检（2026-11-02）：近期更新同步给助理。
// 1. 能打开的页面从 7 个补到侧边栏的主要页面，而且每个都真的存在（静默失效要靠扫描守）；
// 2. 能读老板存的对标账号和拆解要点（read_benchmarks）；
// 3. 系统提示词知道对标拆解的新拆法、自由对话的分工、深度研究、AI 推荐讲完为止。
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OPEN_PAGES } from '@/lib/assistant/client-action-spec';
import { benchmarkDigest, reportGist } from '@/lib/assistant/benchmark-read';
import { ASSISTANT_SYSTEM } from '@/lib/assistant/run';
import { createAssistantTools } from '@/lib/assistant/tools';

describe('助理能打开的页面', () => {
  it('侧边栏的主要页面都能去：自由对话、对标 & 热点、素材库、定位、简报……', () => {
    for (const key of ['free-chat', 'benchmark', 'library', 'positioning', 'brief', 'storyboard', 'title', 'direction', 'content-plan', 'membership', 'help']) {
      expect(OPEN_PAGES[key], key).toBeTruthy();
    }
  });

  it('每个页面的路径都对应一个真的页面文件（扫描非空）', () => {
    const entries = Object.entries(OPEN_PAGES);
    expect(entries.length).toBeGreaterThanOrEqual(25);
    for (const [key, { path }] of entries) {
      expect(fs.existsSync(`app${path}/page.tsx`), `${key} → ${path}`).toBe(true);
    }
  });

  it('open_page 工具的可选项就是这份清单', () => {
    const tool = createAssistantTools({ userId: 'u', cookie: 'c=1' }).find((t) => t.name === 'open_page')!;
    const schema = tool.input_schema as { properties: { page: { enum: string[] } } };
    expect(schema.properties.page.enum.sort()).toEqual(Object.keys(OPEN_PAGES).sort());
  });
});

describe('助理读对标账号', () => {
  const newReport = ['### 一、材料清单', '插件采集：作品 40 条', '### 二、核心结论（先看这 8 条）', '1. **这是什么号**：县城剪发师傅', '### 三、一句话定位（倒推）', '替你剪不翻车的发型', '### 四、六维拆解', '很长很长'].join('\n');
  const oldReport = ['### 一、材料清单', 'x', '### 二、账号定位拆解', '- 人设：老师傅', '### 三、内容拆解', '- 选题：翻车救援', '### 四、对我们的参考', 'y'].join('\n');

  it('新框架取核心结论和一句话定位，旧框架取定位和内容两段，不带材料清单和后面的长内容', () => {
    const g = reportGist(newReport);
    expect(g).toContain('县城剪发师傅');
    expect(g).toContain('替你剪不翻车的发型');
    expect(g).not.toContain('材料清单');
    expect(g).not.toContain('很长很长');
    const o = reportGist(oldReport);
    expect(o).toContain('老师傅');
    expect(o).toContain('翻车救援');
    expect(o).not.toContain('对我们的参考');
  });

  it('摘要：最新的账号在前，带作品数据、最近一次拆解的要点、热点线索', () => {
    const text = benchmarkDigest({
      accounts: [
        { name: '老账号', platform: '抖音', summary: { count: 0 }, analyses: [] },
        { name: '阿杰剪发', platform: '抖音', link: 'https://www.douyin.com/user/abc', summary: { count: 3, avgViews: 12000, best: { title: '剪坏了怎么救', views: 50000 } }, analyses: [{ report: newReport, created_at: '2026-11-02T10:00:00Z' }] },
      ],
      hotTopics: [{ title: '秋冬发色', seen_on: '2026-11-01' }],
    });
    expect(text.indexOf('阿杰剪发')).toBeLessThan(text.indexOf('老账号'));
    expect(text).toContain('录了 3 条作品，平均播放 12000，播放最高「剪坏了怎么救」');
    expect(text).toContain('最近一次拆解（2026-11-02）的要点');
    expect(text).toContain('还没有拆解报告');
    expect(text).toContain('- 秋冬发色（2026-11-01）');
  });

  it('什么都没存：告诉助理怎么拆（粘贴链接、一键采集并拆解）', () => {
    expect(benchmarkDigest({ accounts: [], hotTopics: [] })).toContain('一键采集并拆解');
    expect(benchmarkDigest(null)).toContain('对标 & 热点');
  });
});

describe('系统提示词同步了近期更新', () => {
  it('对标：不能替老板去抖音采集，打开对标页指路；借鉴前先 read_benchmarks，不照抄', () => {
    expect(ASSISTANT_SYSTEM).toContain('不能替他去抖音上采集');
    expect(ASSISTANT_SYSTEM).toContain('一键采集并拆解');
    expect(ASSISTANT_SYSTEM).toContain('read_benchmarks');
    expect(ASSISTANT_SYSTEM).toContain('不照抄对方的标题和文案');
  });

  it('自由对话的分工、深度研究、AI 推荐讲完为止', () => {
    expect(ASSISTANT_SYSTEM).toContain('open_page 打开 free-chat');
    expect(ASSISTANT_SYSTEM).toContain('propose_research');
    expect(ASSISTANT_SYSTEM).toContain('讲完为止');
  });
});

// 2026-11-02 产品方问「助理是否遵循之前的分工」：派活 → 老板确认 → 板块只跑一次 → 管理员验收、直接小改最多两次 → 交老板判断。
// 提示词里原来还写着「最多跑三次」（10-23 整份返工时期的说法），会让老板以为要扣三次额度，和代码对不上
describe('助理对老板说的派活规则和代码一致', () => {
  it('板块只跑一次、最多改两次；不再说「跑三次」', async () => {
    const { MAX_REVISIONS } = await import('@/lib/assistant/manager');
    expect(MAX_REVISIONS).toBe(2);
    expect(ASSISTANT_SYSTEM).toContain('板块只跑一次、扣一次额度；只有编造、碰禁忌这类硬问题我才直接改，最多改两次');
    expect(ASSISTANT_SYSTEM).not.toMatch(/跑三次|整份重跑板块。|重跑一次/);
    const job = fs.readFileSync('lib/assistant/board-job.ts', 'utf8');
    const fn = job.slice(job.indexOf('export async function runBoardWithReview'), job.indexOf('export async function runBoardJob'));
    expect(fn.match(/runAnyBoard\(/g)).toHaveLength(1);
  });
});

// 11-02 产品方：「重点是协调能力，是智能体的聪明；板块就是流水线，已经打磨到极致」
describe('助理的协调', () => {
  it('读对标：带「我们学什么」的新报告，取一句话定位 + 每招标题 + 能直接做的选题', () => {
    const report = [
      '## 第一部分　拆他', '### 一、材料清单', '- 作品 42 条', '### 三、一句话定位（倒推）', '> 县城剪发十年的老师傅',
      '## 第二部分　我们学什么', '### 十二、可借鉴的打法（逐招拆）',
      '#### 第 1 招：救场题材做反转', '- **他怎么做的**：……', '#### 第 2 招：评论区回地址', '- **我们怎么改了用**：……',
      '### 十三、可以直接做的 5 个选题', '1. **我把剪坏的刘海救回来了**', '   - 借的是第 1 招', '2. **来店里的第一句话**',
      '### 十四、不要学的', '- 不要学他的价格战',
    ].join('\n');
    const g = reportGist(report);
    expect(g).toContain('县城剪发十年的老师傅');
    expect(g).toContain('- 第 1 招：救场题材做反转');
    expect(g).toContain('- 第 2 招：评论区回地址');
    expect(g).toContain('- 我把剪坏的刘海救回来了');
    expect(g).toContain('- 来店里的第一句话');
    expect(g).not.toContain('不要学他的价格战');
  });

  it('提示词：派活单自己补全并说明来源、借对标点名第几招、交付先说结论再给下一步、大事一次列完', () => {
    expect(ASSISTANT_SYSTEM).toContain('6.2 协调是你的本事');
    expect(ASSISTANT_SYSTEM).toContain('在回复里用一句话说明补了什么、来自哪');
    expect(ASSISTANT_SYSTEM).toContain('点名借哪一招或哪个选题');
    expect(ASSISTANT_SYSTEM).toContain('用 propose_continue 带过去，不让老板复制粘贴');
    expect(ASSISTANT_SYSTEM).toContain('你不改写它的稿子');
  });

  it('每个板块交付时都有下一步建议；多步计划做完才给（按最后一步）', async () => {
    const { NEXT_STEPS, nextStepNote } = await import('@/lib/assistant/manager');
    const { BOARD_LABEL } = await import('@/lib/assistant/board-dispatch');
    for (const kind of Object.keys(BOARD_LABEL)) expect(NEXT_STEPS[kind as keyof typeof NEXT_STEPS], kind).toBeTruthy();
    expect(nextStepNote('script')).toContain('——下一步可以：拿去做分镜');
    const job = fs.readFileSync('lib/assistant/board-job.ts', 'utf8');
    expect(job).toContain('nextStepNote(input.board.kind)');
    expect(job).toContain('sections.length === total ? input.plan.steps[total - 1] : null');
  });

  it('长产出验收：看开头和结尾，中间省略处说明，不再只看前 6000 字', async () => {
    const { judgeBoardOutput } = await import('@/lib/assistant/manager');
    let seen = '';
    const llm = (async (_cfg: unknown, req: { messages: { content: string }[] }) => {
      seen = req.messages[0].content;
      return { content: [{ type: 'text', text: '{"pass": true, "problems": []}' }], stopReason: 'end_turn' };
    }) as never;
    const long = `开头${'中'.repeat(12000)}结尾的待核实清单`;
    expect(await judgeBoardOutput({ apiKey: 'k' } as never, 'positioning', '做账号定位', long, { llm })).toEqual({ ok: true, problems: [] });
    expect(seen).toContain('开头');
    expect(seen).toContain('结尾的待核实清单');
    expect(seen).toContain('不要因为看不到这部分就判缺内容');
  });
});
