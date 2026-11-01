// 新旧对照的评估（2026-11-01）：把 A（旧）、B（新）两个目录的稿子交替排成评估器条目，评完按标准分开数合格。
// 评估器不知道哪份是新版；条目按 A1、B1、A2、B2…排，评也在同一时段。
//
// 用法：
//   node evals/ab-judge.mjs topics  <A目录> <B目录> <条目.json> [取第几条，默认 0,3]   选题：每份选题稿取几条
//   node evals/ab-judge.mjs scripts <A目录> <B目录> <条目.json> [选题目录]            脚本：每个档案一条；选题目录是写脚本用的 09
//   node evals/ab-judge.mjs report  <条目.json> <评估输出目录> [报告.md]
// 目录写 evals/runs 下的名字（如 ab-topic-old）。
import fs from 'node:fs';

const RUNS = 'E:/小宋/腾讯云生产版同步_20260918/evals/runs';
// 和 evals/materials.ts、线上 lib/topic-library 一样认 1–4 级标题
const TOPIC_HEAD = /^#{1,4}\s*(?:✅\s*)?选题\s*[\d一二三四五六七八九十]+/;

function topicSections(text) {
  return text.split(/(?=^#{1,4}\s*(?:✅\s*)?选题\s*[\d一二三四五六七八九十]+)/m).filter((p) => TOPIC_HEAD.test(p)).map((p) => p.trim());
}
const codesOf = (dir, node) => fs.readdirSync(`${RUNS}/${dir}`).filter((c) => fs.existsSync(`${RUNS}/${dir}/${c}/${node}.out.md`)).sort();

function topics([A, B, out, picks = '0,3']) {
  const idx = picks.split(',').map(Number);
  const items = [];
  for (const code of codesOf(A, '09-选题').filter((c) => codesOf(B, '09-选题').includes(c))) {
    const secs = Object.fromEntries([A, B].map((d) => [d, topicSections(fs.readFileSync(`${RUNS}/${d}/${code}/09-选题.out.md`, 'utf8'))]));
    for (const i of idx) {
      for (const [side, dir] of [['A', A], ['B', B]]) {
        const text = secs[dir][i];
        if (text) items.push({ no: items.length + 1, board: '选题', code, side, dir, idx: i, text });
      }
    }
  }
  fs.writeFileSync(out, JSON.stringify(items, null, 2), 'utf8');
  console.log(`选题条目 ${items.length}（A ${items.filter((x) => x.side === 'A').length}，B ${items.filter((x) => x.side === 'B').length}）`);
}

function scripts([A, B, out, topicDir]) {
  const items = [];
  for (const code of codesOf(A, '10-脚本').filter((c) => codesOf(B, '10-脚本').includes(c))) {
    // 这条脚本写的是哪条选题：给了选题目录就取那里 09 的第一条（和评测带去写脚本的是同一条），
    // 不给就让评估器按 run 去找；找不到它会退回基线的选题，那就对不上了
    const topicFile = topicDir && `${RUNS}/${topicDir}/${code}/09-选题.out.md`;
    const topic = topicFile && fs.existsSync(topicFile) ? topicSections(fs.readFileSync(topicFile, 'utf8'))[0] : undefined;
    for (const [side, dir] of [['A', A], ['B', B]]) {
      items.push({ no: items.length + 1, board: '脚本', code, side, run: dir, file: `${dir}/${code}/10-脚本.out.md`, ...(topic ? { topic } : {}) });
    }
  }
  fs.writeFileSync(out, JSON.stringify(items, null, 2), 'utf8');
  console.log(`脚本条目 ${items.length}`);
}

/** 评估输出目录可以写几个（逗号分隔）：同一批判了几遍，合起来数（分母 = 条数 × 遍数），单份的格子里每遍各占一段 */
function report([itemsFile, judgeDir, md]) {
  const items = JSON.parse(fs.readFileSync(itemsFile, 'utf8'));
  const res = judgeDir.split(',').flatMap((dir, pass) => items.map((it) => {
    const p = `${RUNS}/${dir}/${it.no}.json`;
    return fs.existsSync(p) ? { it: { ...it, pass }, j: JSON.parse(fs.readFileSync(p, 'utf8')) } : null;
  })).filter(Boolean);
  const ids = [...new Set(res.flatMap((r) => r.j.criteria.map((c) => c.id)))].sort();
  const count = (side, f) => res.filter((r) => r.it.side === side && f(r.j)).length;
  const total = (side) => res.filter((r) => r.it.side === side).length;
  const lines = [`# 新旧对照：${items[0]?.board ?? ''}（${judgeDir}）`, '', `| 标准 | 旧版（A）合格 | 新版（B）合格 |`, '|---|---|---|'];
  for (const id of ids) {
    const f = (j) => j.criteria.find((c) => c.id === id)?.verdict === '合格';
    lines.push(`| ${id} | ${count('A', f)} / ${total('A')} | ${count('B', f)} / ${total('B')} |`);
  }
  lines.push(`| **整体** | **${count('A', (j) => j.overall === '合格')} / ${total('A')}** | **${count('B', (j) => j.overall === '合格')} / ${total('B')}** |`, '');
  lines.push('| 档案 | 条 | 旧版 | 新版 |', '|---|---|---|---|');
  const key = (r) => `${r.it.code}|${r.it.idx ?? ''}`;
  for (const k of [...new Set(res.map(key))]) {
    const cell = (side) => {
      const rs = res.filter((x) => key(x) === k && x.it.side === side);
      return rs.length ? rs.map((r) => `${r.j.overall} ${r.j.criteria.map((c) => `${c.id}${c.verdict === '合格' ? '✓' : c.verdict === '不合格' ? '✗' : '?'}`).join('')}`).join('；') : '—';
    };
    const [code, idx] = k.split('|');
    lines.push(`| ${code} | ${idx === '' ? '' : Number(idx) + 1} | ${cell('A')} | ${cell('B')} |`);
  }
  const text = lines.join('\n') + '\n';
  if (md) fs.writeFileSync(md, text, 'utf8');
  console.log(text);
}

const [cmd, ...args] = process.argv.slice(2);
const fn = { topics, scripts, report }[cmd];
if (fn) fn(args); else console.log('用法见文件头');
