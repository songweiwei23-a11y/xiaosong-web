/* 离线复核：用修好的体检程序，重算已经保存的完整回答。不调用模型。
 * RESCORE_FROM 指定读哪一轮（out = 摸底时的回答，out-after-fix = 修改提示词后的回答）。 */
const fs = require('node:fs');
const path = require('node:path');
const b = require('./bundle.cjs');

const dir = __dirname;
const from = process.env.RESCORE_FROM || 'out';
const saved = JSON.parse(fs.readFileSync(path.join(dir, from, 'results.json'), 'utf8'));
const cases = b.regressionCases();
const answerByQuery = new Map();
saved.rows.forEach((row, i) => {
  if (row.answer) answerByQuery.set(cases[i].query, row.answer);
});

(async () => {
  const outcomes = await b.runRegression(async (q) => {
    const a = answerByQuery.get(q);
    if (a === undefined) throw new Error('找不到这道题保存的回答');
    return a;
  });
  const rows = outcomes.map((o, i) => ({
    task: o.task,
    before: saved.rows[i].passed,
    after: o.result.passed && !o.error,
    blockingIssues: o.result.issues.filter((x) => x.blocking !== false).map((x) => `[${x.kind}] ${x.detail}`),
    noteIssues: o.result.issues.filter((x) => x.blocking === false).map((x) => `[${x.kind}] ${x.detail}`),
    error: o.error || null,
  }));
  const outFile = path.join(dir, `rescore-${from}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ rescoredAt: new Date().toISOString(), from, rows }, null, 2));
  for (const r of rows) {
    console.log(`${r.task}: 当时 ${r.before ? '过' : '不过'} → 修检查后 ${r.after ? '过' : '不过'}`);
    for (const x of r.blockingIssues) console.log(`    判不过: ${x.slice(0, 140)}`);
    for (const x of r.noteIssues) console.log(`    仅提醒: ${x.slice(0, 140)}`);
  }
  console.log(`修检查后通过 ${rows.filter((r) => r.after).length}/${rows.length}（当时 ${rows.filter((r) => r.before).length}/${rows.length}）`);
})().catch((e) => { console.error('RESCORE FAILED', e); process.exitCode = 1; });
