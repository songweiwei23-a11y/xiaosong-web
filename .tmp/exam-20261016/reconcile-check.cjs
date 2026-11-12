/* 审稿评分：摸底时 02 题的原始回答，经过页面端的评分重算之后，还剩什么样的分数？ */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const saved = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'results.json'), 'utf8'));
const raw = saved.rows.find((r) => r.task === '回归:审稿优化').answer;
fs.writeFileSync(path.join(__dirname, 'out', 'review-raw.md'), raw);
console.log(execFileSync(process.execPath, ['-e', `
  const b = require('${path.join(__dirname, 'bundle-reconcile.cjs').replace(/\\/g, '\\\\')}');
  const fs = require('node:fs');
  const out = b.reconcileReviewScores(fs.readFileSync('${path.join(__dirname, 'out', 'review-raw.md').replace(/\\/g, '\\\\')}', 'utf8'));
  console.log(out.split('\\n').filter(l => /综合得分|合计|最终|总分/.test(l)).join('\\n'));
`], { encoding: 'utf8' }));
