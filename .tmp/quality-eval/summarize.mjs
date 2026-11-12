// 汇总：读取每次运行的自动检查结果（out/*.json）和人工打分（scores.json），输出成绩单。
// 评分规则见 RUBRIC；有「事实硬伤」的单次结果总分封顶 79。
import fs from 'node:fs';
import path from 'node:path';

const DIR = '.tmp/quality-eval';
const OUT = path.join(DIR, 'out');
const RUBRIC = {
  A: { name: '事实忠实', max: 25 },
  B: { name: '指令遵循', max: 20 },
  C: { name: '档案贴合', max: 15 },
  D: { name: '可拍可用', max: 20 },
  E: { name: '表达质量', max: 10 },
  F: { name: '完整稳定', max: 10 },
};
const CASE_LABEL = { title: '标题封面', script: '脚本生成', topic: '选题策划', review: '审稿优化', remix: '跨行业二创', trap: '陷阱·无价格引流' };

const scores = JSON.parse(fs.readFileSync(path.join(DIR, 'scores.json'), 'utf8'));
const runs = fs.readdirSync(OUT).filter((f) => f.endsWith('.json') && !f.endsWith('.events.json')).map((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))).filter((r) => r.case !== 'direction');

const rows = [];
for (const run of runs) {
  const s = scores.find((x) => x.round === run.round && x.case === run.case);
  if (!s) { rows.push({ round: run.round, case: run.case, missing: true, auto: run.auto.issues }); continue; }
  const dims = Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, Number(s[k] ?? 0)]));
  let total = Object.values(dims).reduce((a, b) => a + b, 0);
  const capped = !!s.hardFact;
  if (capped) total = Math.min(total, 79);
  rows.push({ round: run.round, case: run.case, total, capped, dims, auto: run.auto.issues, firstAnswerMs: run.firstAnswerMs, totalMs: run.totalMs, replace: run.replaceEvents, errors: run.errors, notes: s.notes });
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f1 = (x) => (Number.isNaN(x) ? '—' : x.toFixed(1));
const grade = (t) => (t >= 90 ? '优秀' : t >= 80 ? '良好' : t >= 70 ? '勉强可用' : '不可用');

console.log('## 逐次结果\n');
console.log('| 轮 | 板块 | 总分 | 等级 | 封顶 | 首字(s) | 总耗时(s) | 自动检查问题 |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  if (r.missing) { console.log(`| ${r.round} | ${CASE_LABEL[r.case]} | 未打分 | | | | | ${r.auto.join('；') || '无'} |`); continue; }
  console.log(`| ${r.round} | ${CASE_LABEL[r.case]} | ${r.total} | ${grade(r.total)} | ${r.capped ? '是' : ''} | ${(r.firstAnswerMs / 1000).toFixed(1)} | ${(r.totalMs / 1000).toFixed(0)} | ${r.auto.join('；') || '无'} |`);
}

console.log('\n## 板块成绩（三轮平均，范围）\n');
console.log('| 板块 | 平均 | 最低 | 最高 | 等级 |');
console.log('|---|---|---|---|---|');
const byCase = {};
for (const r of rows.filter((x) => !x.missing)) (byCase[r.case] ??= []).push(r.total);
const caseMeans = [];
for (const [c, ts] of Object.entries(byCase)) {
  const m = mean(ts);
  caseMeans.push(m);
  console.log(`| ${CASE_LABEL[c]} | ${f1(m)} | ${Math.min(...ts)} | ${Math.max(...ts)} | ${grade(m)} |`);
}

console.log('\n## 维度成绩（全部轮次平均，占满分比例）\n');
console.log('| 维度 | 满分 | 平均 | 得分率 |');
console.log('|---|---|---|---|');
const valid = rows.filter((x) => !x.missing);
for (const [k, v] of Object.entries(RUBRIC)) {
  const m = mean(valid.map((r) => r.dims[k]));
  console.log(`| ${v.name} | ${v.max} | ${f1(m)} | ${Number.isNaN(m) ? '—' : Math.round((m / v.max) * 100)}% |`);
}

const overall = mean(valid.map((r) => r.total));
console.log(`\n总体平均：${f1(overall)}（${grade(overall)}）；单次最低 ${Math.min(...valid.map((r) => r.total))}；有事实硬伤封顶的 ${valid.filter((r) => r.capped).length}/${valid.length} 次。`);
const latency = (k) => { const xs = valid.map((r) => r[k]).filter((x) => typeof x === 'number').sort((a, b) => a - b); return xs.length ? `${(xs[Math.floor(xs.length / 2)] / 1000).toFixed(1)}s（中位数，范围 ${(xs[0] / 1000).toFixed(1)}–${(xs[xs.length - 1] / 1000).toFixed(1)}s）` : '—'; };
console.log(`首字延迟：${latency('firstAnswerMs')}；总耗时：${latency('totalMs')}。`);

fs.writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify({ rows, byCase: Object.fromEntries(Object.entries(byCase).map(([c, ts]) => [c, { mean: mean(ts), min: Math.min(...ts), max: Math.max(...ts) }])), overall }, null, 2));
