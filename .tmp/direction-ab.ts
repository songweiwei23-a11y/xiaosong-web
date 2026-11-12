// 创作方向对照：X = 旧配置（方向读简报 + 账号定位原文不带）；D = 新配置（方向不读简报，拿账号定位 + 内容定位 + 行业建议）。
// 每组 4 次，真实模型。结果写到 /tmp/direction-ab/，不写库、不进任何用户会话。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE, readDifyAnswer } from '../lib/quality-regression';
import { buildContextBlock, type CreatorContext } from '../lib/creator-context';
import { BOARD_MANIFESTS } from '../lib/context-manifest';
import { buildDirectionPrompt } from '../lib/direction';
import { buildProfileSummary } from '../lib/profile-summary';
import { resolveMix, mixPromptBlock } from '../lib/content-mix';

const OUT = '/tmp/direction-ab';
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

const POSITIONING = '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。';
const CONTENT = '## 内容定位（长期拍什么）\n- 系列A「烧烤做法」：目的人设。拍刷料、穿串、备料，讲清做法的讲究。\n- 系列B「到店实拍」：目的变现。拍客人点餐、结账、小票，金额用占位。\n- 系列C「夜宵日常」：目的流量。拍南乐夜里的烟火气，结尾只留关注或评论。\n排除：公益营销、直播规划、教学型做法教程。';

async function ask(query: string): Promise<string> {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'direction-ab-experiment', response_mode: 'streaming', query,
      inputs: { query, search_query: '短视频 创作 方向对照', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为方向对照，不联网。' },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  return readDifyAnswer(res);
}

const profile = REGRESSION_PROFILE;
const profileSummary = buildProfileSummary(profile as unknown as Record<string, unknown>);
const briefA = fs.readFileSync('/tmp/foundation-ab/briefA.md', 'utf8');
const advice = fs.readFileSync('/tmp/foundation-ab/advice.md', 'utf8');
const POS_OBJ = { name: '账号定位', summary: POSITIONING.slice(0, 120), full: POSITIONING };
const OLD_DIRECTION_BRIEF_FIELDS = ['oneline', 'persona', 'audience', 'direction', 'trust', 'shooting', 'forbidden'];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const dirEntry = BOARD_MANIFESTS.find((m) => m.board === 'direction')!;
  const currentBriefFields = dirEntry.brief;

  // X：旧配置。临时把方向的简报字段改回旧清单，拼完再恢复
  dirEntry.brief = OLD_DIRECTION_BRIEF_FIELDS;
  const ctxX: CreatorContext = { profile, positioning: POS_OBJ, dealReasons: [], brief: briefA };
  const blockX = buildContextBlock(ctxX, 'direction');
  dirEntry.brief = currentBriefFields;

  // D：新配置（当前清单）：不读简报，拿账号定位原文、内容定位、行业建议
  const ctxD: CreatorContext = { profile, positioning: POS_OBJ, dealReasons: [], brief: null, advice, adviceAt: new Date().toISOString(), adviceStale: [], contentPositioning: CONTENT };
  const blockD = buildContextBlock(ctxD, 'direction');

  const mix = resolveMix(profile as unknown as Parameters<typeof resolveMix>[0]);
  const request = (contextBlock: string) => buildDirectionPrompt({
    purposes: ['fans', 'store'], formats: ['any'], count: 5, depth: 'quick',
    profileSummary, contextBlock, mixBlock: mixPromptBlock(mix, { count: 5, unit: '个' }),
  });

  fs.writeFileSync(`${OUT}/blockX.md`, blockX);
  fs.writeFileSync(`${OUT}/blockD.md`, blockD);

  const results: { arm: string; rep: number; output: string }[] = [];
  for (const rep of [1, 2, 3, 4]) {
    for (const [arm, block] of [['X', blockX], ['D', blockD]] as const) {
      const output = await ask(request(block));
      results.push({ arm, rep, output });
      console.log(`done ${arm} ${rep} len=${output.length}`);
    }
  }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  console.log('DONE');
}

main().catch((e) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/error.txt`, String(e?.stack || e));
  console.log('ERROR', String(e?.message || e).slice(0, 300));
});
