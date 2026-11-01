// 校准表（2026-11-01）：产品方按标准卡判 20 份（10 条选题、10 条脚本），用来检验方法论评审和产品方的眼光对不对得上。
// 每份逐条判 4 条标准，再给整体判断、1–5 分、一句原因；浏览器本机自动保存，评完点「导出」把结果贴回对话。
// 同时写出标准卡 markdown（给人看）和编号对应表（不放进页面，免得看出是哪次采样）。
//
// 环境变量：CALIB_SHEET=1、CALIB_OUT（网页路径）、CALIB_MD（标准卡 md 路径）、CALIB_KEY（对应表 json 路径）
// 用法：npx vitest run --config vitest.eval.config.ts evals/calibration-sheet.eval.ts
import fs from 'node:fs';
import { it } from 'vitest';
import { buildProfileSummary } from '@/lib/profile-summary';
import { EVAL_INDUSTRIES } from './fixtures/profiles';
import { RUBRICS, type Criterion, type RubricBoard } from './rubrics';

const RUNS = 'E:/小宋/腾讯云生产版同步_20260918/evals/runs';
const SHAPE_LABEL: Record<string, string> = { full: '完整档案', sparse: '稀疏档案', ambiguous: '模糊档案' };

/**
 * 选题和脚本各 10 份：12 个行业轮着来，两次采样各一半；同一个档案的选题和脚本取自不同采样。
 * D 的第二次采样选题没出稿（模型反问「目的设置互相冲突」），换成第一次的，D 的脚本相应换成第二次的。
 */
const TOPIC_PICKS: [string, string][] = [
  ['A', 'baseline-s1'], ['B-s', 'baseline-s2'], ['C-a', 'baseline-s1'], ['D', 'baseline-s1'], ['E-s', 'baseline-s1'],
  ['F-a', 'baseline-s2'], ['G', 'baseline-s1'], ['H-s', 'baseline-s2'], ['I-a', 'baseline-s1'], ['J', 'baseline-s2'],
];
const SCRIPT_PICKS: [string, string][] = [
  ['K-s', 'baseline-s1'], ['L-a', 'baseline-s2'], ['A', 'baseline-s2'], ['B-s', 'baseline-s1'], ['C-a', 'baseline-s2'],
  ['D', 'baseline-s2'], ['E-s', 'baseline-s2'], ['F-a', 'baseline-s1'], ['G', 'baseline-s2'], ['H-s', 'baseline-s1'],
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 选题稿按「## 选题N」切开，取第 n 条（轮着取，免得总是第 1 条） */
function nthTopic(text: string, n: number): { title: string; body: string } | null {
  const head = /^#{2,3}\s*(?:✅\s*)?选题\s*[\d一二三四五六七八九十]+/;
  const parts = text.split(/(?=^#{2,3}\s*(?:✅\s*)?选题\s*[\d一二三四五六七八九十]+)/m).filter((p) => head.test(p));
  if (!parts.length) return null;
  const body = parts[n % parts.length].trim();
  return { title: body.split('\n')[0].replace(/^#+\s*/, ''), body };
}

function criterionMd(c: Criterion): string {
  return [`### ${c.id} ${c.name}`, `- **判什么**：${c.question}`, `- **合格**：${c.pass}`, `- **不合格**：${c.fail}`, ...(c.note ? [`- **注意**：${c.note}`] : []), `- **出处**：${c.source}`, ''].join('\n');
}

it('生成校准表', () => {
  if (!process.env.CALIB_SHEET) return;
  const out = process.env.CALIB_OUT!;

  type Item = { no: number; board: RubricBoard; code: string; run: string; industry: string; shape: string; summary: string; title: string; text: string };
  const items: Item[] = [];
  const add = (board: RubricBoard, picks: [string, string][], node: string) => {
    picks.forEach(([code, run], i) => {
      const ind = EVAL_INDUSTRIES.find((x) => x.code === code)!;
      const raw = fs.readFileSync(`${RUNS}/${run}/${code}/${node}.out.md`, 'utf8');
      const t = board === '选题' ? nthTopic(raw, i) : { title: '整条脚本', body: raw.trim() };
      if (!t) return;
      items.push({
        no: items.length + 1, board, code, run, industry: ind.name, shape: SHAPE_LABEL[ind.shape],
        summary: buildProfileSummary(ind.profile as never) + (ind.interviewNotes ? `\n\n访谈要点：${ind.interviewNotes}` : ''),
        title: t.title, text: t.body,
      });
    });
  };
  add('选题', TOPIC_PICKS, '09-选题');
  add('脚本', SCRIPT_PICKS, '10-脚本');

  // 对应表连原文和档案一起存：评估器（evals/judge.eval.ts）判的必须和产品方看到的是同一段
  fs.writeFileSync(process.env.CALIB_KEY!, JSON.stringify(items.map(({ no, board, code, run, title, summary, text }) => ({ no, board, code, run, title, summary, text })), null, 2), 'utf8');

  const md = ['# 验收标准卡：选题与脚本', '', '- 2026-11-01 产品方选定：选题 4 条、脚本 4 条。依据知识库「编导知识大全」原文。', '- 评估器（`evals/judge.eval.ts`）按这份判，原文在 `evals/rubrics.ts`；11-01 按产品方对选题、脚本的判断收紧过。', '',
    '## 选题', '', ...RUBRICS.选题.map(criterionMd), '## 脚本', '', ...RUBRICS.脚本.map(criterionMd)].join('\n');
  fs.writeFileSync(process.env.CALIB_MD!, md, 'utf8');

  const rubricHtml = (board: RubricBoard) => RUBRICS[board].map((c) => `
<div class="crit"><b>${c.id} ${esc(c.name)}</b>：${esc(c.question)}
<div class="pf"><span class="ok">合格</span>${esc(c.pass)}</div>
<div class="pf"><span class="bad">不合格</span>${esc(c.fail)}</div>${c.note ? `<div class="pf"><span class="nt">注意</span>${esc(c.note)}</div>` : ''}
<div class="src">出处：${esc(c.source)}</div></div>`).join('');

  const cardHtml = (x: Item) => `
<section class="card" data-no="${x.no}">
  <header><span class="no">编号 ${x.no}</span><span class="board">${x.board}</span><span class="who">${esc(x.industry)} · ${esc(x.shape)}</span></header>
  <details><summary>这个档案的原始输入（判「只有这家店拍得出来」「拍得出来」「是不是真事」用）</summary><pre class="ctx">${esc(x.summary)}</pre></details>
  <pre class="body">${esc(x.text)}</pre>
  <div class="judge">
    ${RUBRICS[x.board].map((c) => `<div class="row"><span class="cn" title="${esc(c.question)}">${c.id} ${esc(c.name)}</span>
      <label><input type="radio" name="${x.no}-${c.id}" value="合格"> 合格</label>
      <label><input type="radio" name="${x.no}-${c.id}" value="不合格"> 不合格</label>
      <label><input type="radio" name="${x.no}-${c.id}" value="说不清"> 说不清</label></div>`).join('')}
    <div class="row total"><span class="cn">整体</span>
      <label><input type="radio" name="${x.no}-v" value="合格"> 合格</label>
      <label><input type="radio" name="${x.no}-v" value="不合格"> 不合格</label>
      <span class="score">分数 ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="${x.no}-s" value="${n}"> ${n}</label>`).join(' ')}</span></div>
    <input class="why" name="${x.no}-w" placeholder="一句原因：好在哪 / 哪里不行（比 4 条标准更重要的问题也写这里）">
  </div>
</section>`;
  const cardsOf = (board: RubricBoard) => items.filter((x) => x.board === board).map(cardHtml).join('\n');
  const range = (board: RubricBoard) => { const ns = items.filter((x) => x.board === board).map((x) => x.no); return `${ns[0]}–${ns[ns.length - 1]}`; };

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>评估器校准表</title>
<style>
  :root { --fg:#1d1d1f; --bg:#fafaf7; --card:#ffffff; --mut:#6b6b6b; --line:#dcdcd6; --acc:#2f5bd3; --ok:#1a7f37; --bad:#cf222e; --nt:#9a6700; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --fg:#e8e8e6; --bg:#1b1b1a; --card:#232321; --mut:#9a9a94; --line:#3a3a37; --acc:#7da0ff; --ok:#5fd17f; --bad:#ff7b72; --nt:#e3b341; } }
  :root[data-theme="dark"] { --fg:#e8e8e6; --bg:#1b1b1a; --card:#232321; --mut:#9a9a94; --line:#3a3a37; --acc:#7da0ff; --ok:#5fd17f; --bad:#ff7b72; --nt:#e3b341; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.65 system-ui, "Microsoft YaHei", sans-serif; }
  main { max-width: 940px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 22px; margin: 4px 0 6px; } h2 { font-size: 18px; margin: 28px 0 8px; }
  .note { color: var(--mut); font-size: 13px; }
  .bar { position: sticky; top: 0; background: var(--bg); padding: 10px 0; border-bottom: 1px solid var(--line); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; z-index: 1; }
  button { font: inherit; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--fg); cursor: pointer; }
  button.primary { background: var(--acc); color: #fff; border-color: var(--acc); }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; margin: 14px 0; padding: 12px 14px; }
  header { display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; }
  .no { font-weight: 600; } .board { color: var(--acc); } .who { color: var(--mut); font-size: 13px; }
  pre { white-space: pre-wrap; word-break: break-word; font: 14px/1.7 system-ui, "Microsoft YaHei", sans-serif; margin: 8px 0; }
  .ctx { color: var(--mut); font-size: 13px; }
  .body { max-height: 560px; overflow: auto; border-top: 1px dashed var(--line); padding-top: 8px; }
  .judge { border-top: 1px solid var(--line); padding-top: 8px; }
  .row { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; padding: 3px 0; }
  .row .cn { min-width: 150px; font-weight: 600; } .row.total { border-top: 1px dashed var(--line); margin-top: 4px; padding-top: 6px; }
  .why { width: 100%; margin-top: 8px; font: inherit; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); box-sizing: border-box; }
  .crit { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin: 8px 0; font-size: 14px; }
  .pf { margin-top: 4px; } .pf span { display: inline-block; font-size: 12px; font-weight: 600; margin-right: 6px; }
  .ok { color: var(--ok); } .bad { color: var(--bad); } .nt { color: var(--nt); }
  .src { color: var(--mut); font-size: 12px; margin-top: 4px; }
  textarea { width: 100%; min-height: 120px; font: 13px/1.5 ui-monospace, monospace; margin-top: 8px; box-sizing: border-box; }
  details.rub > summary { cursor: pointer; font-weight: 600; }
</style>
</head>
<body>
<main>
<h1>评估器校准表（${items.length} 份）</h1>
<p class="note">我要做一个按咱们自己方法论验收稿子的评估器。它能不能替你验收，先看它和你的眼光对不对得上：同样这 ${items.length} 份，你判一次，评估器判一次，比一致率。判得不一致的地方，就是标准卡没写清楚的地方。</p>
<p class="note"><b>怎么判</b>：每份先看内容，再按下面的标准卡逐条点「合格 / 不合格 / 说不清」，最后给整体判断、1–5 分和一句原因。不用每条都想很久，按你的第一感觉。浏览器会自动保存，可以分几次判完。全部判完点「导出结果」，把框里的文字贴回对话。稿子来自虚构的测评档案；采样批次不显示。</p>

<details class="rub" open><summary>标准卡：选题（4 条）</summary>${rubricHtml('选题')}</details>
<details class="rub"><summary>标准卡：脚本（4 条）</summary>${rubricHtml('脚本')}</details>

<div class="bar"><button class="primary" id="export">导出结果</button><span id="progress" class="note"></span></div>
<textarea id="out" readonly placeholder="点「导出结果」后，结果会出现在这里"></textarea>

<h2>一、选题（编号 ${range('选题')}）</h2>
${cardsOf('选题')}
<h2>二、脚本（编号 ${range('脚本')}）</h2>
${cardsOf('脚本')}

<h2>标准卡哪里不对？</h2>
<p class="note">哪条标准你不同意、哪条该加、哪条该删，写在这里，会一起导出。</p>
<input class="why" name="rubric-note" placeholder="例如：T2 人设型选题不用爆款元素；脚本还要看节奏……">
</main>
<script>
(function () {
  var KEY = 'calib-sheet-20261101';
  var items = ${JSON.stringify(items.map((x) => ({ no: x.no, board: x.board, crits: RUBRICS[x.board].map((c) => c.id) })))};
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {} }
  document.querySelectorAll('input').forEach(function (el) {
    var v = saved[el.name];
    if (v !== undefined) { if (el.type === 'radio') el.checked = el.value === v; else el.value = v; }
    var on = function () { if (el.type !== 'radio' || el.checked) { saved[el.name] = el.value; persist(); progress(); } };
    el.addEventListener('input', on); el.addEventListener('change', on);
  });
  function progress() {
    var done = items.filter(function (x) { return saved[x.no + '-v']; }).length;
    document.getElementById('progress').textContent = '已判 ' + done + ' / ' + items.length;
  }
  progress();
  document.getElementById('export').addEventListener('click', function () {
    var lines = ['编号\\t板块\\t条1\\t条2\\t条3\\t条4\\t整体\\t分数\\t原因'];
    items.forEach(function (x) {
      lines.push([x.no, x.board].concat(x.crits.map(function (c) { return c + ':' + (saved[x.no + '-' + c] || '-'); }), [saved[x.no + '-v'] || '未判', saved[x.no + '-s'] || '-', saved[x.no + '-w'] || '']).join('\\t'));
    });
    lines.push('标准卡意见\\t' + (saved['rubric-note'] || ''));
    var box = document.getElementById('out');
    box.value = lines.join('\\n');
    box.select();
    try { navigator.clipboard.writeText(box.value).catch(function () {}); } catch (e) {}
  });
})();
</script>
</body>
</html>
`;
  fs.writeFileSync(out, html, 'utf8');
  console.log(`written ${out}: ${items.length} items (选题 ${items.filter((x) => x.board === '选题').length}, 脚本 ${items.filter((x) => x.board === '脚本').length})`);
});
