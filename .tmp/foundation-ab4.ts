// 分镜、审稿、标题的对照：CUR = 现在版本（档案 + 简报 + 行业建议）；D = 只给档案（同脚本方案 D）。
// 输入固定：分镜、标题用同一条脚本；审稿用埋了问题的草稿。每组 4 次。结果写到 /tmp/foundation-ab/results4.json。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE, readDifyAnswer } from '../lib/quality-regression';
import { buildContextBlock, type CreatorContext } from '../lib/creator-context';
import { buildReviewPrompt } from '../lib/review-standards';

const OUT = '/tmp/foundation-ab';
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

const SCRIPT = '## 开头\n南乐县城的川味地摊，下班路过就能吃上一口。\n## 正文\n一块钱一串，串串现穿现烫，锅底是我按成都的做法熬的，主厨做川菜9年。\n食材当天进货，价格摆在明面上，吃多少算多少。\n## 结尾\n位置放在评论区，想来的直接问。';
// 埋了问题的审稿草稿：「最好」（广告法红线）、公益营销（档案排除）、直播（档案排除）、早上六点（素材里没有）、人均两三块（素材里没有）
const DRAFT = '## 开头\n南乐最好吃的一元串串，老王每天早上六点去批发市场拿货。\n## 正文\n我们是公益店，每周给环卫工人送一顿饭，人均两三块。\n在成都做了9年川菜。\n## 结尾\n关注我，直播间见。';

const profile = REGRESSION_PROFILE;
const briefA = fs.readFileSync(`${OUT}/briefA.md`, 'utf8');
const advice = fs.readFileSync(`${OUT}/advice.md`, 'utf8');
const POSITIONING = '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。';

async function ask(query: string): Promise<string> {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'foundation-ab-experiment', response_mode: 'streaming', query,
      inputs: { query, search_query: '短视频 创作 分镜审稿标题复测', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为对照，不联网。' },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  return readDifyAnswer(res);
}

async function main() {
  const curCtx: CreatorContext = { profile, positioning: null, dealReasons: [], brief: briefA, advice, adviceAt: new Date().toISOString(), adviceStale: [] };
  const dCtx: CreatorContext = { profile, positioning: null, dealReasons: [] };
  const BOARDS = [
    { key: 'storyboard', module: 'storyboard' as const, input: SCRIPT, request: '把这条脚本拆成镜头表：每个镜头一行，写清景别、运镜、画面、时长、字幕。' },
    { key: 'title', module: 'title' as const, input: SCRIPT, request: '给这条脚本出 5 个标题方案，每个标题说明对应的钩子，并附封面大字建议（4–6 个字）。' },
    { key: 'review', module: 'review' as const, input: DRAFT, request: '' },
  ];
  const results: { arm: string; task: string; rep: number; output: string }[] = [];
  for (const b of BOARDS) {
    for (const rep of [1, 2, 3, 4]) {
      for (const [arm, ctx] of [['CUR', curCtx], ['D', dCtx]] as const) {
        const block = buildContextBlock(ctx, b.module);
        let query: string;
        if (b.key === 'review') {
          query = buildReviewPrompt({
            draftContent: DRAFT, platform: '抖音', duration: '30秒', scriptType: '晒过程型',
            contextBlock: block, personalRequirements: '请按账号事实审稿，指出所有问题',
          } as Parameters<typeof buildReviewPrompt>[0]);
        } else {
          query = `${block}\n\n【待处理的脚本】\n${b.input}\n\n${b.request}`;
        }
        const output = await ask(query);
        results.push({ arm, task: b.key, rep, output });
        console.log(`done ${arm} ${b.key} ${rep} len=${output.length}`);
      }
    }
  }
  fs.writeFileSync(`${OUT}/results4.json`, JSON.stringify(results, null, 2));
  console.log('DONE');
}

main().catch((e) => {
  fs.writeFileSync(`${OUT}/error4.txt`, String(e?.stack || e));
  console.log('ERROR', String(e?.message || e).slice(0, 300));
});
