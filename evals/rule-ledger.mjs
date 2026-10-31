#!/usr/bin/env node
/**
 * 规则台账（2026-11-01，整改方案阶段 0.5）：把提示词里的规则句全部抽出来，相似的聚成一类，标出在哪些节点出现、源码在哪。
 *
 * 输入：一次干跑产出的提示词目录（evals/chain-eval 用 EVAL_DRY=1 跑出来的某个档案目录），加上 Dify 系统提示词。
 * 输出：docs/规则台账.md（给人看）和 docs/规则台账.json（给后续脚本用）。
 * 用法：node evals/rule-ledger.mjs <干跑的档案目录>
 * 只读源码，不改任何文件（除了写这两份产出）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const promptDir = process.argv[2];
if (!promptDir) { console.error('用法：node evals/rule-ledger.mjs <干跑的档案目录>'); process.exit(1); }

/** 一行里出现这些，就算一条规则 */
const RULE_RE = /不写|不要|不许|不能|禁止|一律|不得|必须|只用|只写|只留|只给|优先|硬性|红线|⚠️|别把|不准|不用|不编|不补|不加|严禁|务必|不超过|以内/;

const CATEGORIES = [
  ['事实', /编|事实|出处|依据|待确认|占位|核实|虚构|真实|见证|经历|假设|材料/],
  ['目的', /目的|流量型|人设型|变现型|成交理由|出发点|爆款元素|三有|人货场|人、货、场/],
  ['真实性', /现实|生活逻辑|对比|反差|主角|前后变化|技巧/],
  ['方法', /36\s*计|四大脚本|拍法|公式|知识库|方法库|打法/],
  ['配比', /配比|百分|比例|占比/],
  ['篇幅', /字数|篇幅|不超过|以内|上限|字以|多少字|句以内/],
  ['禁忌', /禁忌|红线|违规|绝对化|敏感|不能说|平台/],
  ['口吻', /口吻|语气|说话人|称呼|第一人称|「我」|口语/],
  ['结构', /结构|开头|结尾|钩子|顺序|段落|分段|第\d步|镜头|行动指令/],
  ['格式', /格式|输出|标题|列表|JSON|json|一句一行|加粗|表格|代码块/],
];

const clean = (line) => line.replace(/^[\s>*#\-–—•·\d.、)）(（]+/, '').replace(/\*\*/g, '').trim();
const norm = (s) => s.replace(/[\s，。、；：:！!？?「」“”"'（）()【】\[\]《》*#`\-—–…·,.;]/g, '');
const bigrams = (s) => { const set = new Set(); for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2)); return set; };
const jaccard = (a, b) => { let inter = 0; for (const x of a) if (b.has(x)) inter++; return inter / (a.size + b.size - inter || 1); };

// 1. 读提示词：干跑目录下的 *.prompt.txt，加上 Dify 系统提示词
const sources = fs.readdirSync(promptDir).filter((f) => f.endsWith('.prompt.txt')).sort()
  .map((f) => ({ node: f.replace('.prompt.txt', ''), text: fs.readFileSync(path.join(promptDir, f), 'utf8') }));
const sysPrompt = path.join(ROOT, 'docs/dify/system-prompt.md');
if (fs.existsSync(sysPrompt)) sources.push({ node: 'Dify系统提示词', text: fs.readFileSync(sysPrompt, 'utf8') });

// 2. 源码语料：lib、app 下的 ts/tsx，加上系统提示词，用来反查规则写在哪
const corpus = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) corpus.push({ file: path.relative(ROOT, p).replace(/\\/g, '/'), lines: fs.readFileSync(p, 'utf8').split('\n') });
  }
};
walk(path.join(ROOT, 'lib'));
walk(path.join(ROOT, 'app'));
if (fs.existsSync(sysPrompt)) corpus.push({ file: 'docs/dify/system-prompt.md', lines: fs.readFileSync(sysPrompt, 'utf8').split('\n') });

function locate(text) {
  // 取一段中间的原文（前后的序号、符号拼装时常被改）去源码里找
  const t = text.replace(/\*\*/g, '');
  const probes = [t.slice(4, 22), t.slice(0, 16), t.slice(-16)].filter((p) => p.length >= 8);
  const hits = [];
  for (const probe of probes) {
    for (const { file, lines } of corpus) {
      const i = lines.findIndex((l) => l.replace(/\*\*/g, '').includes(probe));
      if (i >= 0 && !hits.some((h) => h.startsWith(file + ':'))) hits.push(`${file}:${i + 1}`);
    }
    if (hits.length) break;
  }
  return hits;
}

// 3. 抽规则句
const items = [];
for (const s of sources) {
  for (const raw of s.text.split('\n')) {
    const line = clean(raw);
    if (line.length < 8 || line.length > 400 || !RULE_RE.test(line)) continue;
    items.push({ node: s.node, text: line, key: norm(line) });
  }
}

// 4. 相似的聚成一类（字符二元组的重合度 ≥ 0.55）
const clusters = [];
for (const it of items) {
  const bg = bigrams(it.key);
  let best = null;
  let bestScore = 0;
  for (const c of clusters) {
    const score = jaccard(bg, c.bg);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  if (best && bestScore >= 0.55) {
    best.items.push(it);
    best.nodes.add(it.node);
  } else {
    clusters.push({ bg, text: it.text, items: [it], nodes: new Set([it.node]) });
  }
}

const categoryOf = (text) => CATEGORIES.find(([, re]) => re.test(text))?.[0] ?? '其他';
const rows = clusters.map((c, i) => ({
  id: `R${String(i + 1).padStart(4, '0')}`,
  category: categoryOf(c.text),
  text: c.text,
  occurrences: c.items.length,
  nodes: [...c.nodes],
  variants: [...new Set(c.items.map((x) => x.text))].length,
  sources: locate(c.text),
})).sort((a, b) => b.nodes.length - a.nodes.length || b.occurrences - a.occurrences);

// 5. 汇总
const total = items.length;
const dupRows = rows.filter((r) => r.occurrences > 1);
const byCat = {};
for (const r of rows) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
const byNode = {};
for (const it of items) byNode[it.node] = (byNode[it.node] ?? 0) + 1;
const crossNode = rows.filter((r) => r.nodes.length >= 3);
const noSource = rows.filter((r) => !r.sources.length);

const md = [];
md.push('# 规则台账', '');
md.push(`- 生成时间：${new Date().toISOString().slice(0, 10)}`);
md.push(`- 来源：${path.basename(path.dirname(promptDir))}/${path.basename(promptDir)} 的 ${sources.length} 份提示词（含 Dify 系统提示词）`);
md.push('- 口径：一行里出现「不写、不要、不许、不能、禁止、一律、必须、只写、不超过……」就算一条规则句；字符二元组重合度 ≥ 0.55 的算同一条规则。', '');
md.push('## 一、总览', '');
md.push(`| 项 | 数 |`, `|---|---|`);
md.push(`| 规则句（所有提示词合计） | ${total} |`);
md.push(`| 去重后的规则 | ${rows.length} |`);
md.push(`| 出现不止一次的规则 | ${dupRows.length} |`);
md.push(`| 出现在 3 个及以上节点的规则 | ${crossNode.length} |`);
md.push(`| 源码里没找到出处的规则（多为拼装时改写过） | ${noSource.length} |`, '');
md.push('## 二、按类别', '', '| 类别 | 规则数 |', '|---|---|');
for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${v} |`);
md.push('', '## 三、按节点（每份提示词里的规则句数）', '', '| 节点 | 规则句 |', '|---|---|');
for (const [k, v] of Object.entries(byNode).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${v} |`);
md.push('', '## 四、重复最多的规则（出现在 3 个及以上节点）', '', '| 编号 | 类别 | 节点数 | 次数 | 写法数 | 源码 | 规则 |', '|---|---|---|---|---|---|---|');
for (const r of crossNode) md.push(`| ${r.id} | ${r.category} | ${r.nodes.length} | ${r.occurrences} | ${r.variants} | ${r.sources.slice(0, 3).join('<br>') || '—'} | ${r.text.replace(/\|/g, '｜').slice(0, 160)} |`);
md.push('', '## 五、全部规则', '', '| 编号 | 类别 | 节点 | 次数 | 源码 | 规则 |', '|---|---|---|---|---|---|');
for (const r of rows) md.push(`| ${r.id} | ${r.category} | ${r.nodes.map((n) => n.slice(0, 2)).join(' ')} | ${r.occurrences} | ${r.sources.slice(0, 2).join('<br>') || '—'} | ${r.text.replace(/\|/g, '｜').slice(0, 160)} |`);

fs.writeFileSync(path.join(ROOT, 'docs/规则台账.md'), md.join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(ROOT, 'docs/规则台账.json'), JSON.stringify({ total, unique: rows.length, rows }, null, 2), 'utf8');
console.log(JSON.stringify({ total, unique: rows.length, duplicated: dupRows.length, crossNode: crossNode.length, noSource: noSource.length, byCat }, null, 1));
