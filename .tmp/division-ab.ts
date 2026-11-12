// 分工方案复测（真实模型，结果写到 /tmp/division-ab/，不写库、不进任何用户会话）。
// 新版：行业建议用分工版提示词生成；选题、脚本的上下文按清单拿内容定位、商业定位，选题带四个标签。
// 旧版的结果已有（上一轮 /tmp/advice-verify），这里只跑新版。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE, readDifyAnswer } from '../lib/quality-regression';
import { buildContextBlock, type CreatorContext } from '../lib/creator-context';
import { buildIndustryAdvicePrompt } from '../lib/industry-advice';
import { buildProfileSummary } from '../lib/profile-summary';

const OUT = '/tmp/division-ab';
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

/** 与旧版实验同一份账号定位（只用于两版对照，与真实用户无关） */
const POSITIONING = {
  name: '账号定位',
  summary: '川味地摊，主打一元串串火锅和川味烧烤，目标是本地年轻人到店吃。',
  full: '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。',
};

/** 内容定位（新增的测试素材：三个系列，各有一个主目的） */
const CONTENT = '## 内容定位（长期拍什么）\n- 系列A「烧烤做法」：目的人设。拍刷料、穿串、备料，讲清做法的讲究。\n- 系列B「到店实拍」：目的变现。拍客人点餐、结账、小票，价格摆在明面。\n- 系列C「夜宵日常」：目的流量。拍南乐夜里的烟火气，结尾只留关注或评论。\n排除：公益营销、直播规划、教学型做法教程。';

/** 商业定位（新增的测试素材：成交路径） */
const BUSINESS = '## 商业定位（成交路径）\n1. 刷到视频，记住「南乐 + 位置或时间」\n2. 评论区问地址，或导航搜店名\n3. 到店点餐，结账时看到小票价格\n4. 复购靠老客户转介绍\n信任依据：主厨 9 年川菜经验，食材当日采购。';

const ADVICE_INPUT = { purpose: 'monetize' as const, stage: 'accumulate' as const, situation: '发了 6 条，最好的一条 3000 播放，咨询基本是老客户转介绍，没有新客。' };

async function ask(query: string): Promise<string> {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'division-ab-experiment', response_mode: 'streaming', query,
      inputs: { query, search_query: '短视频 创作 分工复测', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为分工方案复测，不联网。' },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  return readDifyAnswer(res);
}

const profile = REGRESSION_PROFILE;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const advice = await ask(buildIndustryAdvicePrompt({
    profileSummary: buildProfileSummary(profile as unknown as Record<string, unknown>),
    baseline: POSITIONING.full,
    contentBaseline: CONTENT,
    businessBaseline: BUSINESS,
    input: ADVICE_INPUT,
  }));
  fs.writeFileSync(`${OUT}/advice.md`, advice);

  const ctx: CreatorContext = {
    profile, positioning: POSITIONING, dealReasons: [], advice,
    adviceAt: new Date().toISOString(), adviceStale: [],
    contentPositioning: CONTENT, businessPositioning: BUSINESS,
  };
  const TASKS = [
    { key: 'topic', module: 'topic' as const, request: '请为抖音出 3 个带拍摄角度的选题，严格分为 ## 选题1、## 选题2、## 选题3，每节包含标题和拍摄角度。' },
    { key: 'script', module: 'script' as const, request: '请写一条 30 秒抖音到店引流口播脚本，分为 ## 开头、## 正文、## 结尾 三节，只写可直接念的台词。' },
  ];
  const results: { task: string; rep: number; query: string; output: string }[] = [];
  for (const t of TASKS) {
    for (const rep of [1, 2]) {
      const query = `${buildContextBlock(ctx, t.module)}\n\n${t.request}`;
      const output = await ask(query);
      results.push({ task: t.key, rep, query, output });
      console.log(`done ${t.key} ${rep} len=${output.length}`);
    }
  }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({
    adviceLength: advice.length,
    topicQueryLength: results.find((r) => r.task === 'topic')?.query.length,
    scriptQueryLength: results.find((r) => r.task === 'script')?.query.length,
  }, null, 2));
  console.log('DONE');
}

main().catch((e) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/error.txt`, String(e?.stack || e));
  console.log('ERROR', String(e?.message || e).slice(0, 300));
});
