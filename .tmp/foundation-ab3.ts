// 按板块分配的候选版 D 对比现在版本 A：每组 4 次。简报、行业建议沿用之前生成的同一份（控制变量）。
// 结果写到 /tmp/foundation-ab/results3.json，不写库、不进任何用户会话。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE, readDifyAnswer } from '../lib/quality-regression';
import { buildContextBlock, type CreatorContext } from '../lib/creator-context';
import { topicTagBlock } from '../lib/output-tags';

const OUT = '/tmp/foundation-ab';
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

const POSITIONING = '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。';
const CONTENT = '## 内容定位（长期拍什么）\n- 系列A「烧烤做法」：目的人设。拍刷料、穿串、备料，讲清做法的讲究。\n- 系列B「到店实拍」：目的变现。拍客人点餐、结账、小票，金额用占位。\n- 系列C「夜宵日常」：目的流量。拍南乐夜里的烟火气，结尾只留关注或评论。\n排除：公益营销、直播规划、教学型做法教程。';

async function ask(query: string): Promise<string> {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'foundation-ab-experiment', response_mode: 'streaming', query,
      inputs: { query, search_query: '短视频 创作 按板块分配复测', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为对照，不联网。' },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  return readDifyAnswer(res);
}

const profile = REGRESSION_PROFILE;
const briefA = fs.readFileSync(`${OUT}/briefA.md`, 'utf8');
const advice = fs.readFileSync(`${OUT}/advice.md`, 'utf8');
const stripTags = (s: string) => s.split(topicTagBlock()).join('');
const POS_OBJ = { name: '账号定位', summary: POSITIONING.slice(0, 120), full: POSITIONING };

async function main() {
  // A：现在版本。选题拿简报（没有定位原文），脚本拿简报
  const ctxATopic: CreatorContext = { profile, positioning: POS_OBJ, dealReasons: [], brief: briefA };
  const ctxAScript: CreatorContext = { profile, positioning: null, dealReasons: [], brief: briefA };
  // D：按板块分配。选题：档案 + 账号定位 + 内容定位 + 行业建议（不带简报）；脚本：只有档案
  const ctxDTopic: CreatorContext = { profile, positioning: POS_OBJ, dealReasons: [], brief: null, advice, adviceAt: new Date().toISOString(), adviceStale: [], contentPositioning: CONTENT };
  const ctxDScript: CreatorContext = { profile, positioning: null, dealReasons: [] };

  const TASKS = [
    { key: 'topic', module: 'topic' as const, request: '请为抖音出 3 个带拍摄角度的选题，严格分为 ## 选题1、## 选题2、## 选题3，每节包含标题和拍摄角度。' },
    { key: 'script', module: 'script' as const, request: '请写一条 30 秒抖音到店引流口播脚本，分为 ## 开头、## 正文、## 结尾 三节，只写可直接念的台词。' },
  ];
  const ARMS = [
    { arm: 'A', topic: ctxATopic, script: ctxAScript, strip: true },
    { arm: 'D', topic: ctxDTopic, script: ctxDScript, strip: false },
  ];
  const results: { arm: string; task: string; rep: number; output: string }[] = [];
  for (const a of ARMS) {
    for (const t of TASKS) {
      const ctx = t.module === 'topic' ? a.topic : a.script;
      for (const rep of [1, 2, 3, 4]) {
        let block = buildContextBlock(ctx, t.module);
        if (a.strip) block = stripTags(block);
        const output = await ask(`${block}\n\n${t.request}`);
        results.push({ arm: a.arm, task: t.key, rep, output });
        console.log(`done ${a.arm} ${t.key} ${rep} len=${output.length}`);
      }
    }
  }
  fs.writeFileSync(`${OUT}/results3.json`, JSON.stringify(results, null, 2));
  console.log('DONE');
}

main().catch((e) => {
  fs.writeFileSync(`${OUT}/error3.txt`, String(e?.stack || e));
  console.log('ERROR', String(e?.message || e).slice(0, 300));
});
