// 月度复盘真实模型探针：1 次调用，虚构档案，不碰数据库。用法：npx tsx .tmp/review-probe.ts
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { readAssistantConfig } from '../lib/assistant/config';
import { callAssistantLlm } from '../lib/assistant/llm';
import { buildReviewPrompt, parseReviewJson, reviewPromptBlock, installReview, reviewToMarkdown, type MonthlyReview } from '../lib/monthly-review';

async function main() {
  const cfg = readAssistantConfig();
  if (!cfg) throw new Error('没有 ASSISTANT_API_KEY');
  const prev: MonthlyReview = {
    month: '2026-09', generatedAt: '2026-10-01T01:00:00Z', through: '2026-09-30', source: 'auto', summary: '', worked: [], notWorked: [], experimentResults: [], dataGaps: [], materials: [],
    strategy: { focus: '多拍老板娘熬底料', mix: null, mixReason: '', doMore: [], doLess: [], boards: {},
      experiments: [{ name: '开头直接报价格', how: '3 条变现型开头第一句说人均价格', success: '咨询数比前 3 条变现型多' }] },
  };
  const p = buildReviewPrompt({
    month: '2026-10', today: '2026-11-08', through: '2026-10-31',
    profileSummary: '- 档案名称：老张火锅（县城火锅店，老板娘熬底料 12 年）\n- 平台：抖音\n- 目标人群：县城 25-40 岁家庭',
    works: [
      { title: '凌晨四点，老板娘在后厨熬底料', status: '已发布', purpose: '人设型', tactic: null, metrics: '播放 1.8万 · 完播率 31% · 评论 86 · 涨粉 140' },
      { title: '人均 58 吃到撑，开头报价格', status: '已发布', purpose: '变现型', tactic: null, metrics: '播放 6200 · 完播率 18% · 咨询 9' },
      { title: '人均 58 的锅底是怎么来的', status: '已发布', purpose: '变现型', tactic: null, metrics: '播放 5400 · 咨询 7' },
      { title: '新品毛肚上桌', status: '已发布', purpose: '流量型', tactic: null, metrics: '播放 2100 · 完播率 8%' },
      { title: '一桌客人吃哭了', status: '已拍摄', purpose: '人设型', tactic: null, metrics: null },
    ],
    performanceBlock: '### 📈 这个号发出去的真实数据（9 条录了数据）\n- 变现型（5 条）：平均播放 4800、咨询 21\n- 人设型（2 条）：平均播放 15000',
    insightBlock: '档案计划：流量型 40%、人设型 30%、变现型 30%', diagnosisKey: '', previous: prev, memory: { verified: [], dropped: [] }, collectedText: '', fileTexts: [],
  });
  const t0 = Date.now();
  const res = await callAssistantLlm(cfg, { system: p.system, messages: [{ role: 'user', content: p.user }], tools: [], maxTokens: 3500 }, { signal: AbortSignal.timeout(150_000) });
  const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
  const parsed = parseReviewJson(text);
  console.log('耗时', Math.round((Date.now() - t0) / 1000), '秒；解析', parsed ? '成功' : '失败');
  if (!parsed) { console.log(text.slice(0, 2000)); return; }
  const r: MonthlyReview = { ...parsed, month: '2026-10', generatedAt: new Date().toISOString(), through: '2026-10-31', source: 'manual', materials: ['探针'] };
  console.log(reviewToMarkdown(r));
  console.log('\n----- 选题板块拿到的 -----\n' + reviewPromptBlock(installReview({}, r), 'planning', '选题'));
  console.log('\n----- 脚本板块拿到的 -----\n' + reviewPromptBlock(installReview({}, r), 'single', '脚本'));
}
main().catch((e) => { console.error('失败：', e.message); process.exit(1); });
