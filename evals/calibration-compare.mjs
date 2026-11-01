#!/usr/bin/env node
/**
 * 校准比对（2026-11-01）：产品方在校准表里导出的结果 vs 方法论评审（evals/judge.eval.ts）的结果。
 * 算每条标准、整体的一致率，列出判得不一样的条目（带评审引用的原文和理由），写成 markdown。
 * 「说不清」不算进一致率的分母。
 *
 * 用法：node evals/calibration-compare.mjs <产品方导出的 txt> <评审输出目录> <输出.md>
 */
import fs from 'node:fs';

const [humanFile, judgeDir, outFile] = process.argv.slice(2);
if (!humanFile || !judgeDir || !outFile) { console.error('用法：node evals/calibration-compare.mjs <导出.txt> <评审目录> <输出.md>'); process.exit(1); }

// 导出格式：编号\t板块\tT1:合格\tT2:-\t…\t整体\t分数\t原因
const human = new Map();
for (const line of fs.readFileSync(humanFile, 'utf8').split(/\r?\n/)) {
  const cols = line.split('\t');
  if (!/^\d+$/.test(cols[0] ?? '')) continue;
  const crits = Object.fromEntries(cols.slice(2, 6).map((c) => c.split(':')).filter((p) => p.length === 2));
  human.set(Number(cols[0]), { board: cols[1], crits, overall: cols[6], score: Number(cols[7]) || null, reason: cols[8] ?? '' });
}

const judge = new Map();
for (const f of fs.readdirSync(judgeDir).filter((x) => /^\d+\.json$/.test(x))) {
  const j = JSON.parse(fs.readFileSync(`${judgeDir}/${f}`, 'utf8'));
  judge.set(j.no, j);
}

const stat = {};
const bump = (key, same) => { const s = (stat[key] ??= { same: 0, total: 0 }); s.total += 1; if (same) s.same += 1; };
const diffs = [];
let scoreGap = [];
for (const [no, h] of [...human].sort((a, b) => a[0] - b[0])) {
  const j = judge.get(no);
  if (!j || h.overall === '未判') continue;
  for (const c of j.criteria) {
    const hv = h.crits[c.id];
    if (!hv || hv === '-' || hv === '说不清' || c.verdict === '说不清') continue;
    bump(c.id, hv === c.verdict);
    if (hv !== c.verdict) diffs.push(`| ${no} | ${h.board} | ${c.id} | ${hv} | ${c.verdict} | ${c.evidence.replace(/\|/g, '｜')} | ${c.reason.replace(/\|/g, '｜')} | ${h.reason.replace(/\|/g, '｜')} |`);
  }
  bump('整体', h.overall === j.overall);
  if (h.score && j.score) scoreGap.push(j.score - h.score);
}

const pct = (s) => (s.total ? `${Math.round((s.same / s.total) * 100)}%（${s.same} / ${s.total}）` : '—');
const md = ['# 校准比对：产品方 vs 评估器', '', `- 产品方判了 ${[...human.values()].filter((h) => h.overall !== '未判').length} 份；评估器判了 ${judge.size} 份`,
  `- 分数：评估器平均比产品方${scoreGap.length ? (scoreGap.reduce((a, b) => a + b, 0) / scoreGap.length >= 0 ? '高' : '低') : '—'} ${scoreGap.length ? Math.abs(scoreGap.reduce((a, b) => a + b, 0) / scoreGap.length).toFixed(1) : '—'} 分`,
  '- 一致率不算「说不清」。整体一致率到 80% 以上、每条标准都不低于 70%，才拿评估器去验收整批稿子。', '',
  '## 一致率', '', '| 标准 | 一致率 |', '|---|---|', ...Object.entries(stat).map(([k, s]) => `| ${k} | ${pct(s)} |`), '',
  '## 判得不一样的地方', '', diffs.length ? '| 编号 | 板块 | 标准 | 产品方 | 评估器 | 评估器引用的原文 | 评估器理由 | 产品方原因 |\n|---|---|---|---|---|---|---|---|\n' + diffs.join('\n') : '没有。'];
fs.writeFileSync(outFile, md.join('\n') + '\n', 'utf8');
console.log(`written ${outFile}`);
