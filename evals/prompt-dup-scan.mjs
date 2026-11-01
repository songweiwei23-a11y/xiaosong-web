// 提示词重复扫描（2026-11-01，整改阶段 3）：同一份提示词里原样出现两遍以上的长句（≥ 25 字），按板块列出来。
// 线上的毛病多是「同一段被两处代码各拼一遍」（上游方案、写作底线、承接要求、档案），一行一行比就看得出。只读、不调模型。
// 用法：node evals/prompt-dup-scan.mjs <评测目录> [档案编号]   目录是 chain-eval 用 EVAL_DRY=1 构造出来的
import fs from 'node:fs';

const [dir, code = 'D'] = process.argv.slice(2);
const base = `${dir}/${code}`;
const rows = [];
for (const f of fs.readdirSync(base).filter((f) => f.endsWith('.prompt.txt')).sort()) {
  const text = fs.readFileSync(`${base}/${f}`, 'utf8');
  const count = new Map();
  for (const l of text.split('\n').map((s) => s.trim()).filter((s) => [...s].length >= 25 && !/^\|[-:| ]+\|$/.test(s))) count.set(l, (count.get(l) ?? 0) + 1);
  const dups = [...count].filter(([, n]) => n >= 2).sort((a, b) => b[0].length * (b[1] - 1) - a[0].length * (a[1] - 1));
  const dupChars = dups.reduce((s, [l, n]) => s + [...l].length * (n - 1), 0);
  rows.push({ node: f.replace('.prompt.txt', ''), chars: [...text].length, dupLines: dups.length, dupChars, top: dups.slice(0, 3).map(([l, n]) => `×${n} ${l.slice(0, 50)}`) });
}
console.log('| 板块 | 字数 | 重复的长句 | 重复多出来的字 | 例子 |\n|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.node} | ${r.chars} | ${r.dupLines} | ${r.dupChars}（${Math.round((r.dupChars / r.chars) * 100)}%） | ${r.top.join(' ‖ ')} |`);
