/* 跨板块链路验证：创作方向 → 脚本 → 审稿 → 分镜。
 * 每一步的输入都经线上的交接代码（buildCreationHandoff / resolveCreationSettings）得到，不手工改写。
 * 模型调用与线上一样走正式「开物」应用；用独立测试身份，不写任何人的历史、不扣额度。 */
const fs = require('node:fs');
const path = require('node:path');

for (const line of fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const b = require('./bundle.cjs');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

// ---- 测试档案（虚构的家具店，不是真实客户）----
const profile = {
  id: '00000000-0000-4000-8000-0000000000c1',
  profile_name: '测试_青禾家具店_链路验收',
  account_platform: ['抖音'],
  account_track: ['家居装修'],
  product_category: ['沙发', '床', '衣柜'],
  account_stage: '刚起号',
  target_region: '苏州',
  persona_facts: { host: '店主老陈', origin: '苏州本地人', yearsInTrade: '家具从业12年', yearsLocal: '来苏州3年', others: '门店开了2年；只卖家具，不承接装修', mainProducts: '沙发、床、衣柜' },
  taboo_settings: { excluded: [] },
};
const ctx = { profile, positioning: null, dealReasons: [] };

// ---- 用户的原始诉求（整条链路都要守住）----
const INTENT = '国庆过完这一周店里冷清了，进店的人少了一半。想拍几条视频把客人拉回来，但不想拍成甩卖降价';
const CONSTRAINTS = '只有店主一个人，用手机拍，不请演员；视频 30 秒；不降价、不甩卖、不做促销打折；只用档案里已有的事实，没有的数字、客户经历、经营承诺不要编。';
const DURATION = '30秒';
const PLATFORM = '抖音';

async function ask(label, query) {
  const res = await fetch(`${BASE}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'chain-20261017', response_mode: 'streaming', query,
      inputs: { query, search_query: '短视频 创作', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为跨板块链路验证，不联网。' },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  const answer = await b.readDifyAnswer(res);
  fs.writeFileSync(path.join(OUT, `${label}.md`), answer);
  console.log(`[${label}] 已生成 ${answer.length} 字`);
  return answer;
}

/** 从创作方向的回答里取出第 1 个方向的完整段落（用户勾选它带去下一步） */
function firstDirection(markdown) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => /^#{2,4}\s*方向\s*1|^#{2,4}\s*方向1|方向\s*1[：:]/.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^#{2,4}\s*方向\s*\d|^---\s*$|^#{1,2}\s/.test(lines[i]) && i > start + 1) { end = i; break; }
  const block = lines.slice(start, end).join('\n').trim();
  const title = lines[start].replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
  return { title, block };
}

const STAGE_TASK = { direction: '创作方向', script: '脚本生成', review: '审稿优化', storyboard: '分镜脚本' };

(async () => {
  const report = { at: new Date().toISOString(), intent: INTENT, stages: {} };

  // A：创作方向（引流到店，快速版）
  const dirPrompt = b.buildDirectionPrompt({
    purposes: ['store'], customGoal: INTENT, formats: ['any'], count: 5, depth: 'quick',
    profileSummary: b.buildProfileSummary(profile), contextBlock: b.buildContextBlock(ctx, 'direction'),
  });
  const dirAnswer = await ask('A_创作方向', dirPrompt);
  const dir = firstDirection(dirAnswer);
  if (!dir) throw new Error('没有解析到方向 1：' + dirAnswer.slice(0, 300));
  report.stages.direction = { title: dir.title, prompt: dirPrompt, answer: dirAnswer };
  console.log(`  勾选方向 1：${dir.title}`);

  // A → B：交接到脚本
  const hB = b.buildCreationHandoff('direction', 'script', dir.block, {
    from: '创作方向', title: dir.title, settings: { userIntent: INTENT, focusContent: dir.title, duration: DURATION, platform: PLATFORM, purposeText: '引流到店' },
  });
  const sB = b.resolveCreationSettings(hB, ctx);
  const srcB = b.creationReference(hB);
  const scriptPrompt = b.buildAdaptiveScriptPrompt({
    topic: sB.topic || dir.title, platform: PLATFORM, duration: DURATION,
    context: b.buildContextBlock(ctx, 'script'), source: srcB, requirements: CONSTRAINTS, settings: sB,
  });
  const scriptAnswer = await ask('B_脚本', scriptPrompt);
  report.stages.script = { prompt: scriptPrompt, answer: scriptAnswer, handoffSettings: { userIntent: sB.userIntent, focusContent: sB.focusContent, topic: sB.topic } };

  // B → C：交接到审稿
  const hC = b.buildCreationHandoff('script', 'review', scriptAnswer, {
    from: '脚本生成', settings: { userIntent: INTENT, focusContent: dir.title, duration: DURATION, platform: PLATFORM },
  });
  const draftC = hC.settings?.workingScript || hC.sourceContent;
  const reviewPrompt = b.buildReviewPrompt({
    draftContent: draftC, platform: PLATFORM, duration: DURATION, scriptType: '', reviewDimensions: '', optimizationGoals: '保留「引流到店、把客人拉回来」的目的；不降价、不甩卖；只用给定事实',
    benchmarkScript: '', compareMode: false, severityLabels: true,
    contextBlock: b.buildContextBlock(ctx, 'review'), personalRequirements: `${INTENT}。${CONSTRAINTS}`,
  });
  const reviewAnswer = await ask('C_审稿', reviewPrompt);
  const optimizedC = b.reviewedQualityOutput(reviewAnswer) || reviewAnswer;
  report.stages.review = { prompt: reviewPrompt, answer: reviewAnswer, optimized: optimizedC, draftFromHandoff: draftC.slice(0, 200) };

  // C → D：交接到分镜（用审稿后的稿子）
  const hD = b.buildCreationHandoff('review', 'storyboard', optimizedC, {
    from: '审稿优化', settings: { userIntent: INTENT, focusContent: dir.title, duration: DURATION, platform: PLATFORM },
  });
  const scriptD = hD.settings?.workingScript || hD.sourceContent;
  const style = b.VISUAL_STYLES.find((s) => s.value === 'cinematic') || b.VISUAL_STYLES[0];
  const storyPrompt = b.buildStoryboardPrompt({
    scriptContent: scriptD, platform: PLATFORM, duration: DURATION, contentType: 'product',
    visualStyle: style.value, visualStyleLabel: style.label, additionalInfo: `${INTENT}。${CONSTRAINTS}`,
    contextBlock: b.buildContextBlock(ctx, 'storyboard'),
  });
  const storyAnswer = await ask('D_分镜', storyPrompt);
  report.stages.storyboard = { prompt: storyPrompt, answer: storyAnswer };

  // 逐段质检：与线上同一套体检（事实、禁忌、排除、年限）
  const profileKnown = b.buildProfileSummary(profile);
  const checks = {};
  checks.direction = b.runQualityChecks({ output: dirAnswer, taskType: '创作方向', profile, source: INTENT });
  checks.script = b.runQualityChecks({ output: scriptAnswer, taskType: '脚本生成', profile, source: `${INTENT}\n${CONSTRAINTS}` });
  checks.review = b.runQualityChecks({ output: reviewAnswer, taskType: '审稿优化', profile, source: `${INTENT}\n${CONSTRAINTS}` });
  checks.storyboard = b.runQualityChecks({ output: storyAnswer, taskType: '分镜脚本', profile, source: `${INTENT}\n${CONSTRAINTS}` });
  report.checks = checks;
  report.profileKnown = profileKnown.slice(0, 200);
  fs.writeFileSync(path.join(OUT, 'chain.json'), JSON.stringify(report, null, 2));
  console.log('DONE');
})().catch((e) => { console.error('CHAIN FAILED', e); process.exitCode = 1; });
