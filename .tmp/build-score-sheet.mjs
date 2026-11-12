// 生成盲评表：把两个档位的回答随机编成 A / B，打分的人看不到哪个是哪一档。
// 用法：X=medium Y=high node .tmp/build-score-sheet.mjs
//   输入：.tmp/answers-<X>.json、.tmp/answers-<Y>.json
//   输出：.tmp/score-sheet-<X>-vs-<Y>.md（给打分的人看）、.tmp/score-key-<X>-vs-<Y>.json（对照关系，打分前不要打开）
import fs from 'node:fs';

const X = process.env.X;
const Y = process.env.Y;
if (!X || !Y) { console.error('请设置 X 和 Y，例如 X=medium Y=high'); process.exit(1); }

const left = JSON.parse(fs.readFileSync(`.tmp/answers-${X}.json`, 'utf8'));
const right = JSON.parse(fs.readFileSync(`.tmp/answers-${Y}.json`, 'utf8'));

const key = {};
const lines = [];
lines.push(`# 盲评表：开物自由对话，${X} vs ${Y}`);
lines.push('');
lines.push('打分说明：每个问题看 A 和 B 两份回答，分别给 1–5 分（5 分最好）。');
lines.push('评分维度：是否切题、分析是否具体有依据、是否严格遵守问题里的约束（比如「三句话」「不超过 80 字」）、是否有多余的延伸或废话。');
lines.push('');

for (const l of left.items) {
  const r = right.items.find((h) => h.id === l.id);
  if (!r) continue;
  const aIsX = Math.random() < 0.5;
  const a = aIsX ? l : r;
  const b = aIsX ? r : l;
  key[l.id] = { A: aIsX ? X : Y, B: aIsX ? Y : X };

  lines.push(`## ${l.id}：${l.name}`);
  lines.push('');
  lines.push(`问题：${l.query}`);
  lines.push('');
  lines.push('### A');
  lines.push('');
  lines.push(a.visible);
  lines.push('');
  lines.push('### B');
  lines.push('');
  lines.push(b.visible);
  lines.push('');
  lines.push('| 评分 | A | B |');
  lines.push('|---|---|---|');
  lines.push('| 分数（1–5） | | |');
  lines.push('| 一句话理由 | | |');
  lines.push('');
  lines.push('---');
  lines.push('');
}

fs.writeFileSync(`.tmp/score-sheet-${X}-vs-${Y}.md`, lines.join('\n'), 'utf8');
fs.writeFileSync(`.tmp/score-key-${X}-vs-${Y}.json`, JSON.stringify(key, null, 2), 'utf8');
console.log(`已生成 .tmp/score-sheet-${X}-vs-${Y}.md（盲评表）和 .tmp/score-key-${X}-vs-${Y}.json（对照关系，打分前不要打开）`);
