// 选题对照按目的挑条目（2026-11-01，整改阶段 3）：改动只影响某类目的的选题时（如「爆款句式只管流量型」），
// 固定取第 1 条可能一条人设、变现型都判不到。这里每份 A、B 各挑 1 条流量型、1 条人设或变现型，按同一类配对排成评估器条目。
// 用法：node evals/ab-judge-by-purpose.mjs <A目录> <B目录> <条目.json>   目录写 evals/runs 下的名字
import fs from 'node:fs';

const RUNS = 'E:/小宋/腾讯云生产版同步_20260918/evals/runs';
const TOPIC_HEAD = /^#{1,4}\s*(?:✅\s*)?选题\s*[\d一二三四五六七八九十]+/;
const sections = (text) => text.split(/(?=^#{1,4}\s*(?:✅\s*)?选题\s*[\d一二三四五六七八九十]+)/m).filter((p) => TOPIC_HEAD.test(p)).map((p) => p.trim());
// 选题卡的「0️⃣ 视频目的」在下一行写目的；同一行写的也认
const purposeOf = (sec) => (sec.replace(/\*\*/g, '').match(/视频目的[^\n]*\n?\s*[-*]?\s*(流量型|人设型|变现型)/) || [])[1];

const [A, B, out] = process.argv.slice(2);
const items = [];
for (const code of fs.readdirSync(`${RUNS}/${A}`).filter((c) => fs.existsSync(`${RUNS}/${A}/${c}/09-选题.out.md`) && fs.existsSync(`${RUNS}/${B}/${c}/09-选题.out.md`)).sort()) {
  const pick = (dir) => {
    const secs = sections(fs.readFileSync(`${RUNS}/${dir}/${code}/09-选题.out.md`, 'utf8')).map((text, idx) => ({ text, idx, p: purposeOf(text) }));
    return { traffic: secs.find((s) => s.p === '流量型'), other: secs.find((s) => s.p === '人设型' || s.p === '变现型') };
  };
  const [a, b] = [pick(A), pick(B)];
  for (const kind of ['traffic', 'other']) {
    if (!a[kind] || !b[kind]) continue;
    for (const [side, dir, s] of [['A', A, a[kind]], ['B', B, b[kind]]]) items.push({ no: items.length + 1, board: '选题', code, side, dir, idx: s.idx, kind, purpose: s.p, text: s.text });
  }
}
fs.writeFileSync(out, JSON.stringify(items, null, 2), 'utf8');
console.log(`选题条目 ${items.length}（流量型 ${items.filter((x) => x.kind === 'traffic').length}，人设/变现 ${items.filter((x) => x.kind === 'other').length}）`);
