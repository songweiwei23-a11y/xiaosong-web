// 盲评页面（2026-11-01，整改方案阶段 0.4）：从一次评测里，每个关键节点抽 4 篇，打乱顺序做成一个本地网页。
// 每篇可以点「合格 / 不合格」、打 1–5 分、写一句原因；浏览器本机自动保存；评完点「导出」，把结果贴回对话。
// 编号和档案的对应关系写到 BLIND_KEY（不放进文档）。
//
// 环境变量：BLIND_SHEET=1、BLIND_RUN（评测目录）、BLIND_OUT（网页路径）、BLIND_KEY（对应关系 json 路径）
// 用法：npx vitest run --config vitest.eval.config.ts evals/blind-sheet.eval.ts
import fs from 'node:fs';
import { it } from 'vitest';
import { buildProfileSummary } from '@/lib/profile-summary';
import { EVAL_INDUSTRIES } from './fixtures/profiles';

const NODES: [string, string][] = [
  ['08-创作方向', '创作方向'], ['09-选题', '选题策划'], ['10-脚本', '脚本生成'], ['11-分镜', '分镜脚本'], ['12-标题封面', '标题封面'],
  ['13-开篇钩子', '开篇钩子'], ['14-审稿', '审稿优化'], ['15-跨行业二创', '跨行业二创'], ['16-拆解爆款', '拆解爆款'],
];
const FULL = ['A', 'D', 'G', 'J'];
const SPARSE = ['B-s', 'E-s', 'H-s', 'K-s'];
const AMBIG = ['C-a', 'F-a', 'I-a', 'L-a'];
const SHAPE_LABEL: Record<string, string> = { full: '完整档案', sparse: '稀疏档案', ambiguous: '有歧义的档案' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

it('生成盲评页面', () => {
  if (!process.env.BLIND_SHEET) return;
  const run = process.env.BLIND_RUN!;
  const out = process.env.BLIND_OUT!;
  const keyPath = process.env.BLIND_KEY!;

  // 每个节点 4 篇：完整、稀疏、有歧义各一篇，再加一篇完整的；节点之间轮换，尽量每个行业都出现
  const picks: { node: string; label: string; code: string }[] = [];
  NODES.forEach(([node, label], i) => {
    for (const code of [FULL[i % 4], SPARSE[(i + 1) % 4], AMBIG[(i + 2) % 4], FULL[(i + 2) % 4]]) {
      if (fs.existsSync(`${run}/${code}/${node}.out.md`)) picks.push({ node, label, code });
    }
  });

  const items = shuffle(picks).map((p, i) => {
    const ind = EVAL_INDUSTRIES.find((x) => x.code === p.code)!;
    const text = fs.readFileSync(`${run}/${p.code}/${p.node}.out.md`, 'utf8');
    return { no: i + 1, ...p, industry: ind.name, shape: SHAPE_LABEL[ind.shape], summary: buildProfileSummary(ind.profile as never), text };
  });
  fs.writeFileSync(keyPath, JSON.stringify(items.map(({ no, node, code, industry, shape }) => ({ no, node, code, industry, shape })), null, 2), 'utf8');

  const cards = items.map((x) => `
<section class="card" data-no="${x.no}">
  <header><span class="no">编号 ${x.no}</span><span class="board">${esc(x.label)}</span><span class="who">${esc(x.industry)} · ${esc(x.shape)}</span></header>
  <details><summary>这条的档案（判断贴不贴、像不像本人用）</summary><pre class="ctx">${esc(x.summary)}</pre></details>
  <pre class="body">${esc(x.text)}</pre>
  <div class="rate">
    <label><input type="radio" name="v${x.no}" value="合格"> 合格</label>
    <label><input type="radio" name="v${x.no}" value="不合格"> 不合格</label>
    <span class="score">分数 ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="s${x.no}" value="${n}"> ${n}</label>`).join(' ')}</span>
    <input class="why" name="w${x.no}" placeholder="一句原因：好在哪 / 哪里不行">
  </div>
</section>`).join('\n');

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>基线盲评</title>
<style>
  :root { --fg:#1d1d1f; --bg:#fafaf7; --card:#ffffff; --mut:#6b6b6b; --line:#dcdcd6; --acc:#2f5bd3; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --fg:#e8e8e6; --bg:#1b1b1a; --card:#232321; --mut:#9a9a94; --line:#3a3a37; --acc:#7da0ff; } }
  :root[data-theme="dark"] { --fg:#e8e8e6; --bg:#1b1b1a; --card:#232321; --mut:#9a9a94; --line:#3a3a37; --acc:#7da0ff; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.65 system-ui, "Microsoft YaHei", sans-serif; }
  main { max-width: 920px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 22px; margin: 4px 0 6px; }
  .note { color: var(--mut); font-size: 13px; }
  .bar { position: sticky; top: 0; background: var(--bg); padding: 10px 0; border-bottom: 1px solid var(--line); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; z-index: 1; }
  button { font: inherit; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--fg); cursor: pointer; }
  button.primary { background: var(--acc); color: #fff; border-color: var(--acc); }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; margin: 14px 0; padding: 12px 14px; }
  header { display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; }
  .no { font-weight: 600; }
  .board { color: var(--acc); }
  .who { color: var(--mut); font-size: 13px; }
  pre { white-space: pre-wrap; word-break: break-word; font: 14px/1.7 system-ui, "Microsoft YaHei", sans-serif; margin: 8px 0; }
  .ctx { color: var(--mut); font-size: 13px; }
  .body { max-height: 520px; overflow: auto; border-top: 1px dashed var(--line); padding-top: 8px; }
  .rate { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; border-top: 1px solid var(--line); padding-top: 10px; }
  .why { flex: 1 1 260px; font: inherit; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); }
  textarea { width: 100%; min-height: 160px; font: 13px/1.5 ui-monospace, monospace; margin-top: 8px; }
</style>
</head>
<body>
<main>
<h1>基线盲评（${items.length} 篇）</h1>
<p class="note">这是测评档案（虚构）跑出来的稿子，是整改前的基线。每篇点「合格 / 不合格」，打 1–5 分，写一句原因。浏览器会自动保存，评完点「导出结果」，把下面框里的文字贴回对话。</p>
<div class="bar"><button class="primary" id="export">导出结果</button><span id="progress" class="note"></span></div>
<textarea id="out" readonly placeholder="点「导出结果」后，结果会出现在这里"></textarea>
${cards}
</main>
<script>
(function () {
  var KEY = 'blind-baseline-' + ${JSON.stringify(new Date().toISOString().slice(0, 10))};
  var total = ${items.length};
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {} }
  document.querySelectorAll('input').forEach(function (el) {
    var v = saved[el.name];
    if (v !== undefined) { if (el.type === 'radio') el.checked = el.value === v; else el.value = v; }
    el.addEventListener('input', function () { if (el.type !== 'radio' || el.checked) { saved[el.name] = el.value; persist(); progress(); } });
    el.addEventListener('change', function () { if (el.type !== 'radio' || el.checked) { saved[el.name] = el.value; persist(); progress(); } });
  });
  function progress() {
    var done = 0;
    for (var i = 1; i <= total; i++) if (saved['v' + i]) done++;
    document.getElementById('progress').textContent = '已判 ' + done + ' / ' + total;
  }
  progress();
  document.getElementById('export').addEventListener('click', function () {
    var lines = [];
    for (var i = 1; i <= total; i++) lines.push(i + '\\t' + (saved['v' + i] || '未判') + '\\t' + (saved['s' + i] || '-') + '\\t' + (saved['w' + i] || ''));
    var box = document.getElementById('out');
    box.value = '编号\\t判断\\t分数\\t原因\\n' + lines.join('\\n');
    box.select();
    try { navigator.clipboard.writeText(box.value); } catch (e) {}
  });
})();
</script>
</body>
</html>
`;
  fs.writeFileSync(out, html, 'utf8');
  console.log(`written ${out}: ${items.length} items`);
});
