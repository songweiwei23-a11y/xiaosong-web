// 知识库具体示例扫描（2026-11-01，整改方案 2.3）：对知识库备份的全部文档跑无关信息检测器的确定性抽取（lib/noise-check），
// 找出带具体时段、日期、金额、带单位数字、第一人称经历的句子——这些是会被召回、再被模型当成本次事实写进稿子的东西。
// 只读、不调模型。产出清单给 2.4 改写用：哪个库、哪篇、哪句、属于哪类细节。
//
// 环境变量：KB_SCAN=1、KB_DIR（备份目录，dify-kb-maintain.mjs backup 的输出）、KB_OUT（清单 md 路径）
// 用法：npx vitest run --config vitest.eval.config.ts evals/kb-example-scan.eval.ts
import fs from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { extractConcrete, type ConcreteSpan } from '@/lib/noise-check';

const KIND: Record<string, string> = { time: '时段', date: '日期', year: '年份', money: '金额', percent: '百分数', quantity: '带单位数字', experience: '经历句式' };

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []));
}

it('知识库具体示例扫描', () => {
  if (!process.env.KB_SCAN) return;
  const dir = process.env.KB_DIR!;
  const rows: { lib: string; doc: string; line: string; kinds: string[] }[] = [];
  for (const file of walk(dir)) {
    const lib = path.relative(dir, file).split(path.sep)[0];
    const doc = path.basename(file, '.md');
    const body = fs.readFileSync(file, 'utf8').replace(/^---[\s\S]*?---\n/, '');
    for (const line of body.split('\n')) {
      const t = line.trim();
      if (t.length < 6) continue;
      const spans: ConcreteSpan[] = extractConcrete(t);
      if (spans.length) rows.push({ lib, doc, line: t.slice(0, 160), kinds: [...new Set(spans.map((s) => KIND[s.kind] ?? s.kind))] });
    }
  }
  const byKind = new Map<string, number>();
  for (const r of rows) for (const k of r.kinds) byKind.set(k, (byKind.get(k) ?? 0) + 1);
  const byDoc = new Map<string, number>();
  for (const r of rows) byDoc.set(`${r.lib}｜${r.doc}`, (byDoc.get(`${r.lib}｜${r.doc}`) ?? 0) + 1);
  const topDocs = [...byDoc.entries()].sort((a, b) => b[1] - a[1]);
  const md = [
    '# 知识库具体示例清单（2026-11-01）', '',
    `扫描 ${walk(dir).length} 篇文档（知识库备份 \`${path.basename(dir)}\`），${rows.length} 行带具体细节。检测器只认确定性的写法，地点、物件、人名这类名词不在里面。`, '',
    '## 按类别', '', '| 类别 | 行数 |', '|---|---|', ...[...byKind.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`), '',
    '## 按文档（行数从多到少）', '', '| 库 | 文档 | 行数 |', '|---|---|---|', ...topDocs.map(([k, n]) => { const [l, d] = k.split('｜'); return `| ${l} | ${d} | ${n} |`; }), '',
    '## 逐行', '', ...topDocs.flatMap(([k]) => [`### ${k.replace('｜', ' / ')}`, '', ...rows.filter((r) => `${r.lib}｜${r.doc}` === k).map((r) => `- 【${r.kinds.join('、')}】${r.line}`), '']),
  ].join('\n');
  fs.writeFileSync(process.env.KB_OUT!, md, 'utf8');
  console.log(`docs=${walk(dir).length} rows=${rows.length} ${[...byKind.entries()].map(([k, n]) => `${k}:${n}`).join(' ')}`);
});
