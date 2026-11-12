/* 摸底考试：用夜间回归的固定题（同一份题、同一套体检），真跑一遍线上「开物」，保存完整回答。
 * 调用方式与夜间回归一致：user 用独立标识，不写任何人的历史、不扣额度。 */
const fs = require('node:fs');
const path = require('node:path');

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const b = require('./bundle.cjs');
const base = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
// 输出目录可用 EXAM_OUT 指定，默认 out；修改前后两轮分开存，互不覆盖
const outDir = path.join(__dirname, process.env.EXAM_OUT || 'out');
fs.mkdirSync(outDir, { recursive: true });

const full = [];
const ask = async (query) => {
  const res = await fetch(`${base}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'exam-20261016', response_mode: 'streaming', query,
      inputs: { query, search_query: '短视频 创作 质检', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为摸底考试，不联网。' },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  const answer = await b.readDifyAnswer(res);
  full.push({ query, answer, at: new Date().toISOString() });
  return answer;
};

(async () => {
  const started = Date.now();
  const cases = b.regressionCases();
  const outcomes = await b.runRegression(ask);
  // 按题目的 query 对回答（某题出错时没有回答，不能按下标对）
  const rows = outcomes.map((o, i) => {
    const got = full.find((f) => f.query === cases[i].query);
    return { task: o.task, passed: o.result.passed && !o.error, issues: o.result.issues, error: o.error || null, answer: got ? got.answer : null };
  });
  rows.forEach((r, i) => {
    const name = `${String(i + 1).padStart(2, '0')}_${r.task.replace(/[^\p{L}\p{N}]+/gu, '_')}`;
    fs.writeFileSync(path.join(outDir, `${name}.md`), `# ${r.task}\n\npassed: ${r.passed}\n\n## 体检问题\n${r.issues.map(x => `- [${x.kind}] ${x.detail}`).join('\n') || '（无）'}\n\n## 完整回答\n\n${r.answer ?? '（无回答）' + (r.error ? `\n错误：${r.error}` : '')}\n`);
  });
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ finishedAt: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000), rows }, null, 2));
  console.log(JSON.stringify({ done: rows.length, passed: rows.filter(r => r.passed).length, seconds: Math.round((Date.now() - started) / 1000) }));
})().catch((e) => { console.error('RUN FAILED', e); process.exitCode = 1; });
