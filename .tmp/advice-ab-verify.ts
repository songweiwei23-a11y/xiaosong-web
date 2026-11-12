// 复测：修正提示词（价格/阈值约束）+ 注入上限 6000 后，只跑带行业建议的一组（选题、脚本各两次）。
// 结果写到 /tmp/advice-verify/，不写库、不进任何用户会话。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE, readDifyAnswer } from '../lib/quality-regression';
import { buildContextBlock, type CreatorContext } from '../lib/creator-context';
import { buildIndustryAdvicePrompt, adviceContextBlock } from '../lib/industry-advice';
import { buildProfileSummary } from '../lib/profile-summary';
import { runQualityChecks } from '../lib/quality-checks';

const OUT = '/tmp/advice-verify';
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

const POSITIONING = {
  name: '账号定位',
  summary: '川味地摊，主打一元串串火锅和川味烧烤，目标是本地年轻人到店吃。',
  full: '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。',
};

async function ask(query: string): Promise<string> {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'advice-verify-experiment', response_mode: 'streaming', query,
      inputs: { query, search_query: '短视频 创作 药方复测', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为复测，不联网。' },
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
    input: { purpose: 'monetize', stage: 'accumulate', situation: '发了 6 条，最好的一条 3000 播放，咨询基本是老客户转介绍，没有新客。' },
  }));
  fs.writeFileSync(`${OUT}/advice.md`, advice);
  const ctx: CreatorContext = { profile, positioning: POSITIONING, dealReasons: [], advice };
  const block = adviceContextBlock(advice);
  const report: Record<string, unknown> = { adviceLength: advice.length, injectedBlockHasTailSection: block.includes('进入下一阶段'), injectedWasTruncated: block.includes('（以下略）') };

  const TASKS = [
    { key: 'topic', module: 'topic' as const, checkAs: '选题策划', request: '请为抖音出 3 个带拍摄角度的选题，严格分为 ## 选题1、## 选题2、## 选题3，每节包含标题和拍摄角度。' },
    { key: 'script', module: 'script' as const, checkAs: '脚本生成', request: '请写一条 30 秒抖音到店引流口播脚本，分为 ## 开头、## 正文、## 结尾 三节，只写可直接念的台词。' },
  ];
  const results: { task: string; rep: number; output: string; issues: string[] }[] = [];
  for (const t of TASKS) {
    for (const rep of [1, 2]) {
      const output = await ask(`${buildContextBlock(ctx, t.module)}\n\n${t.request}`);
      const checks = runQualityChecks({ output, profile, mix: null, taskType: t.checkAs });
      results.push({ task: t.key, rep, output, issues: checks.issues.map((i) => i.detail) });
      console.log(`done ${t.key} ${rep} len=${output.length} issues=${checks.issues.length}`);
    }
  }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log('DONE');
}

main().catch((e) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/error.txt`, String(e?.stack || e));
  console.log('ERROR', String(e?.message || e).slice(0, 300));
});
