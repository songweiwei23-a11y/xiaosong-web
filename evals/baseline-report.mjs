#!/usr/bin/env node
/**
 * 基线汇总（2026-11-01，整改方案阶段 0.4）：把一次或多次评测的 metrics.jsonl 按节点、按档案形态汇总成一份 markdown。
 * 用法：node evals/baseline-report.mjs <输出.md> <评测目录1> [评测目录2 …]
 */
import fs from 'node:fs';
import path from 'node:path';

const [outFile, ...dirs] = process.argv.slice(2);
if (!outFile || !dirs.length) { console.error('用法：node evals/baseline-report.mjs <输出.md> <评测目录…>'); process.exit(1); }

const rows = [];
const metas = [];
for (const d of dirs) {
  const label = path.basename(d);
  // 重算过的（metrics.v2.jsonl，见 evals/recompute.eval.ts）优先
  const m = fs.existsSync(path.join(d, 'metrics.v2.jsonl')) ? path.join(d, 'metrics.v2.jsonl') : path.join(d, 'metrics.jsonl');
  if (fs.existsSync(m)) for (const line of fs.readFileSync(m, 'utf8').split('\n').filter(Boolean)) rows.push({ ...JSON.parse(line), run: label });
  const mm = path.join(d, 'meta.jsonl');
  if (fs.existsSync(mm)) for (const line of fs.readFileSync(mm, 'utf8').split('\n').filter(Boolean)) metas.push({ ...JSON.parse(line), run: label });
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const group = (xs, key) => xs.reduce((m, x) => ((m[key(x)] ??= []).push(x), m), {});

const md = [];
md.push('# 阶段 0 基线报告', '');
md.push(`- 生成时间：${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
md.push(`- 评测目录：${dirs.map((d) => path.basename(d)).join('、')}`);
md.push(`- 样本：${rows.length} 份输出；调用 ${metas.length} 次，失败 ${metas.filter((m) => !m.ok).length} 次`);
md.push('- 口径：「新出现的具体细节」= 输出里的时段、日期、金额、百分数、年份、带单位的事实数字、经历句式，在本次输入（档案、上游内容）里找不到的（lib/noise-check）。「诱饵」= 其他行业的标志性词和知识库已知示例。量的是生成本身，不含线上的后检。', '');

md.push('## 一、按节点', '', '| 节点 | 份数 | 平均字数 | 平均新细节 | 有新细节的比例 | 诱饵命中的比例 | 平均占位 | 平均耗时（秒） |', '|---|---|---|---|---|---|---|---|');
const byNode = group(rows, (r) => r.node);
for (const node of Object.keys(byNode).sort()) {
  const xs = byNode[node];
  md.push(`| ${node} | ${xs.length} | ${Math.round(avg(xs.map((x) => x.chars)))} | ${f1(avg(xs.map((x) => x.novel)))} | ${Math.round((xs.filter((x) => x.novel > 0).length / xs.length) * 100)}% | ${Math.round((xs.filter((x) => x.decoys.length > 0).length / xs.length) * 100)}% | ${f1(avg(xs.map((x) => x.placeholders)))} | ${Math.round(avg(xs.map((x) => x.ms)) / 1000)} |`);
}

md.push('', '## 二、按档案形态', '', '| 形态 | 份数 | 平均新细节 | 有新细节的比例 | 诱饵命中的比例 | 平均占位 |', '|---|---|---|---|---|---|');
const byShape = group(rows, (r) => r.shape);
for (const shape of ['full', 'sparse', 'ambiguous'].filter((s) => byShape[s])) {
  const xs = byShape[shape];
  md.push(`| ${shape} | ${xs.length} | ${f1(avg(xs.map((x) => x.novel)))} | ${Math.round((xs.filter((x) => x.novel > 0).length / xs.length) * 100)}% | ${Math.round((xs.filter((x) => x.decoys.length > 0).length / xs.length) * 100)}% | ${f1(avg(xs.map((x) => x.placeholders)))} |`);
}

md.push('', '## 三、新出现的具体细节：按类别', '', '| 类别 | 次数 |', '|---|---|');
const kinds = {};
for (const r of rows) for (const [k, v] of Object.entries(r.novelByKind || {})) kinds[k] = (kinds[k] ?? 0) + v;
const KIND_LABEL = { time: '时段', date: '日期', money: '金额', percent: '百分数', year: '年份', quantity: '带单位的数字', experience: '经历句式' };
for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) md.push(`| ${KIND_LABEL[k] ?? k} | ${v} |`);

md.push('', '## 四、诱饵命中明细', '');
const hits = rows.filter((r) => r.decoys.length);
if (!hits.length) md.push('没有诱饵命中。');
else {
  md.push('| 评测 | 档案 | 节点 | 命中的词 |', '|---|---|---|---|');
  for (const r of hits) md.push(`| ${r.run} | ${r.industry} | ${r.node} | ${r.decoys.join('、')} |`);
}

md.push('', '## 五、新细节最多的输出（前 15）', '', '| 评测 | 档案 | 节点 | 新细节数 | 例子 |', '|---|---|---|---|---|');
for (const r of [...rows].sort((a, b) => b.novel - a.novel).slice(0, 15)) md.push(`| ${r.run} | ${r.industry} | ${r.node} | ${r.novel} | ${(r.novelSamples || []).slice(0, 6).join('、')} |`);

// 两次采样对比：同样的输入跑两次差多少。2026-11-01 实测，差别不只是随机波动——不同时段模型那边的表现也会变，
// 所以新旧对照要在同一时段交替跑，不能拿存档的基线去比
const runs = [...new Set(rows.map((r) => r.run))];
if (runs.length >= 2) {
  const [a, b] = runs;
  md.push('', `## 六、两次采样对比（${a} / ${b}）`, '', '同样的档案、同样的提示词跑两次的差别 = 随机波动 + 两次不在同一时段时模型那边的变化。之后做新旧对照，要在同一时段把新旧两版交替跑，不能拿这里存档的数字去比。', '');
  md.push('| 节点 | 平均字数 | 平均新细节 | 有新细节的比例 | 诱饵命中的比例 | 平均占位 |', '|---|---|---|---|---|---|');
  const byRunNode = group(rows, (r) => `${r.run}|${r.node}`);
  const nodes = [...new Set(rows.filter((r) => r.run === b).map((r) => r.node))].sort();
  const pct = (xs, f) => (xs.length ? `${Math.round((xs.filter(f).length / xs.length) * 100)}%` : '—');
  for (const node of nodes) {
    const xa = byRunNode[`${a}|${node}`] ?? [];
    const xb = byRunNode[`${b}|${node}`] ?? [];
    const pair = (fa, fb) => `${fa} / ${fb}`;
    md.push(`| ${node} | ${pair(Math.round(avg(xa.map((x) => x.chars))), Math.round(avg(xb.map((x) => x.chars))))} | ${pair(f1(avg(xa.map((x) => x.novel))), f1(avg(xb.map((x) => x.novel))))} | ${pair(pct(xa, (x) => x.novel > 0), pct(xb, (x) => x.novel > 0))} | ${pair(pct(xa, (x) => x.decoys.length > 0), pct(xb, (x) => x.decoys.length > 0))} | ${pair(f1(avg(xa.map((x) => x.placeholders))), f1(avg(xb.map((x) => x.placeholders))))} |`);
  }
}

// 规则清单漏进输出：提示词里给模型挑用的参考清单（起号 36 计），被整段抄进结果。抄 5 计以上才算
const LIST_LINE = /第\d{1,2}计\s*\*{0,2}[^\s*【]{2,12}\*{0,2}\s*【[^】]+】\s*[:：]/g;
const copied = [];
for (const d of dirs) {
  const byNodeRun = {};
  for (const r of rows.filter((x) => x.run === path.basename(d))) {
    const f = path.join(d, r.industry, `${r.node}.out.md`);
    if (!fs.existsSync(f)) continue;
    const n = (fs.readFileSync(f, 'utf8').match(LIST_LINE) || []).length;
    const s = (byNodeRun[r.node] ??= { total: 0, hit: [] });
    s.total += 1;
    if (n >= 5) s.hit.push(`${r.industry}（${n}）`);
  }
  for (const [node, s] of Object.entries(byNodeRun)) if (s.hit.length) copied.push(`| ${path.basename(d)} | ${node} | ${s.hit.length} / ${s.total} | ${s.hit.join('、')} |`);
}
md.push('', '## 七、提示词里的清单被抄进输出', '');
if (!copied.length) md.push('没有输出整段抄提示词里的 36 计清单。');
else md.push('| 评测 | 节点 | 抄了的份数 | 档案（抄了几计） |', '|---|---|---|---|', ...copied);

fs.writeFileSync(outFile, md.join('\n') + '\n', 'utf8');
console.log(`written ${outFile}: ${rows.length} rows`);
