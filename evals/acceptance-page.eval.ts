// 阶段 0 验收页（2026-11-01）：把基线的全部稿子、每个板块的整体表现、创作方向修复前后，做成一页给产品方看。
// 编出来的细节标黄、别的行业的词标红、【待确认】标灰、照抄的 36 计清单标红底。
//
// 环境变量：ACCEPT_PAGE=1、ACCEPT_OUT（输出的 html 路径）
// 用法：npx vitest run --config vitest.eval.config.ts evals/acceptance-page.eval.ts
import fs from 'node:fs';
import { it } from 'vitest';
import { buildProfileSummary } from '@/lib/profile-summary';
import { EVAL_INDUSTRIES } from './fixtures/profiles';

const RUNS = 'E:/小宋/腾讯云生产版同步_20260918/evals/runs';
const RUN_LABEL: Record<string, string> = {
  'baseline-s1': '第一次（10-31 晚）',
  'baseline-s2': '第二次（11-01 凌晨）',
  'fix-08-old': '修复对照·旧版',
  'fix-08-new': '修复对照·新版',
};
const SHAPE_LABEL: Record<string, string> = { full: '完整档案', sparse: '稀疏档案', ambiguous: '模糊档案' };
const LIST_LINE = /第\d{1,2}计\s*\*{0,2}[^\s*【]{2,12}\*{0,2}\s*【[^】]+】\s*[:：]/g;

/** 每个板块的大白话结论：逐份看过被标出的地方之后写的 */
const NOTES: Record<string, { level: 'ok' | 'warn' | 'bad'; text: string }> = {
  '01-账号定位': { level: 'warn', text: '基本没编造。问题是篇幅：平均 9000 多字，很难读完。「主赛道约 70%」这类题材比例是模板要它填的规划数字，不算编造。' },
  '03-内容定位': { level: 'warn', text: '基本没编造。被标出的多是示例标题里的「我通常先问顾客这一句」，意思和档案里的「剪前先聊脸型」一致，是换了说法。问题同样是篇幅：平均 9000 多字。' },
  '07-内容规划': { level: 'ok', text: '干净，没有编造。' },
  '08-创作方向': { level: 'bad', text: '编造几乎没有。大问题是 24 份里有 8 份把提示词里整张 36 计清单抄进结果，连着「适合：理发、汽修」这类别的行业的字。本地已修好（见第二节），新版 8 份一份没抄。' },
  '09-选题': { level: 'warn', text: '被标出的大多是街头采访的执行建议（「选 3-5 家店」），不算编造，真编出来的事实很少。篇幅长：平均 7000 多字。' },
  '10-脚本': { level: 'bad', text: '第一次采样很干净；第二次出现了编出来的对比案例和专业数字：「有人花 3 万做收纳还是挤，有人不到 1 万就够用」「节气门不到 2 万公里就不用清洗」，还有规则明确不让写的合格线「完播率 ≥ 40%」。' },
  '11-分镜': { level: 'ok', text: '干净。' },
  '12-标题封面': { level: 'ok', text: '基本干净。第二次采样出现了规则不让写的合格线（「完播率 ≥ 35% 就换 3 号标题」）。' },
  '13-开篇钩子': { level: 'bad', text: '第一次干净；第二次有 2 份直接编了具体的事：「今天下午三点，我在摊位上捣豆瓣，有个路过的阿姨停下来看了三分钟」「上个月帮一家量房，厨房只有 4 平米……一共 67 件」。两处都出自钩子卡「直接说具体的事」，这张卡的公式是「时间/地点/动作 + 一个具体发现」，等于要模型编一件事。' },
  '14-审稿': { level: 'ok', text: '干净。被标出的 1 处是举例（「若是真实观察，如每天接待 10 位」）。每份平均 3.8 处【待确认】。' },
  '15-跨行业二创': { level: 'bad', text: '编客户故事最集中的板块（第二次采样）：「昨天来了个妈妈，宝宝才三个月，大腿上勒了两道红印子」「前两天来个业主，拿着网上找的图」「我每次都要多问她三句」「下午三点半，我开始调今晚的锅底料」（档案写的是下午 4 点出摊）。' },
  '16-拆解爆款': { level: 'bad', text: '有编造：「同样 900 克的罐子，勺子一个是 4.5 克一个是 5 克」（没出处的专业数据）、「前两天接了个客户」「很多客人说来我们店就像来朋友家」。另一个问题是占位太多：每份平均 11.6 处【待确认】，拿到手要补很多。' },
};

type Row = {
  id: string; run: string; code: string; node: string; chars: number; novel: number;
  samples: string[]; decoys: string[]; placeholders: number; copied: number; text: string;
};

it('阶段 0 验收页', () => {
  if (!process.env.ACCEPT_PAGE) return;
  const out = process.env.ACCEPT_OUT!;

  const rows: Row[] = [];
  for (const run of Object.keys(RUN_LABEL)) {
    const m = `${RUNS}/${run}/metrics.v2.jsonl`;
    if (!fs.existsSync(m)) continue;
    for (const line of fs.readFileSync(m, 'utf8').split('\n').filter(Boolean)) {
      const r = JSON.parse(line);
      const f = `${RUNS}/${run}/${r.industry}/${r.node}.out.md`;
      if (!fs.existsSync(f)) continue;
      const text = fs.readFileSync(f, 'utf8');
      rows.push({
        id: `${run}|${r.industry}|${r.node}`, run, code: r.industry, node: r.node, chars: r.chars, novel: r.novel,
        samples: r.novelSamples ?? [], decoys: r.decoys ?? [], placeholders: r.placeholders,
        copied: (text.match(LIST_LINE) || []).length, text,
      });
    }
  }

  const profiles = Object.fromEntries(EVAL_INDUSTRIES.map((ind) => [ind.code, {
    name: ind.name, shape: SHAPE_LABEL[ind.shape], summary: buildProfileSummary(ind.profile as never),
    interview: ind.interviewNotes,
  }]));

  // 第一节的表：只算两次基线采样
  const base = rows.filter((r) => r.run.startsWith('baseline'));
  const nodes = [...new Set(base.map((r) => r.node))].sort();
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const overview = nodes.map((node) => {
    const xs = base.filter((r) => r.node === node);
    const s1 = xs.filter((r) => r.run === 'baseline-s1');
    const s2 = xs.filter((r) => r.run === 'baseline-s2');
    const avg = (f: (r: Row) => number) => xs.reduce((a, r) => a + f(r), 0) / xs.length;
    return {
      node, n: xs.length,
      s1: `${s1.filter((r) => r.novel > 0).length} / ${s1.length}`,
      s2: s2.length ? `${s2.filter((r) => r.novel > 0).length} / ${s2.length}` : '沿用第一次',
      mixed: `${xs.filter((r) => r.decoys.length > 0 || r.copied >= 5).length} / ${xs.length}`,
      flaggedPct: pct(xs.filter((r) => r.novel > 0).length, xs.length),
      chars: Math.round(avg((r) => r.chars)),
      placeholders: Math.round(avg((r) => r.placeholders) * 10) / 10,
      copied: xs.filter((r) => r.copied >= 5).length,
      ...(NOTES[node] ?? { level: 'ok', text: '' }),
    };
  });

  const data = { rows, profiles, overview, runLabel: RUN_LABEL };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  fs.writeFileSync(out, PAGE.replace('__DATA__', json), 'utf8');
  console.log(`written ${out}: ${rows.length} 份稿子`);
});

const PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>阶段 0 验收</title>
<style>
:root { --bg:#f7f7f5; --card:#fff; --ink:#1f2328; --mute:#6b7280; --line:#e5e7eb; --accent:#2f6feb;
  --ok:#1a7f37; --okbg:#e7f5ec; --warn:#9a6700; --warnbg:#fff4d6; --bad:#cf222e; --badbg:#fde8e8;
  --hl:#ffe58a; --decoy:#ffc9c9; --ph:#e8e8e8; --copy:#ffe1e1; }
@media (prefers-color-scheme: dark) { :root { --bg:#16181d; --card:#1f2229; --ink:#e6e6e6; --mute:#9aa0a6; --line:#2e333b; --accent:#6ea0ff;
  --ok:#5fd17f; --okbg:#173322; --warn:#e3b341; --warnbg:#3a2f12; --bad:#ff7b72; --badbg:#3d1a1a;
  --hl:#6b5a12; --decoy:#7a2b2b; --ph:#3a3d44; --copy:#4a2222; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.7 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif; }
main { max-width:1100px; margin:0 auto; padding:24px 16px 80px; }
h1 { font-size:26px; margin:0 0 4px; } h2 { font-size:20px; margin:40px 0 12px; padding-top:8px; border-top:1px solid var(--line); }
.sub { color:var(--mute); margin:0 0 20px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px 18px; margin:12px 0; }
.steps li { margin:6px 0; } .key li { margin:8px 0; }
table { width:100%; border-collapse:collapse; font-size:14px; }
th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
th { color:var(--mute); font-weight:600; white-space:nowrap; }
.tag { display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; font-weight:600; white-space:nowrap; }
.tag.ok { color:var(--ok); background:var(--okbg); } .tag.warn { color:var(--warn); background:var(--warnbg); } .tag.bad { color:var(--bad); background:var(--badbg); }
button, select { font:inherit; font-size:14px; padding:4px 10px; border:1px solid var(--line); border-radius:6px; background:var(--card); color:var(--ink); cursor:pointer; }
button.link { border:none; background:none; color:var(--accent); padding:0; }
.filters { display:flex; flex-wrap:wrap; gap:10px; align-items:center; position:sticky; top:0; background:var(--bg); padding:10px 0; z-index:2; border-bottom:1px solid var(--line); }
.item { background:var(--card); border:1px solid var(--line); border-radius:8px; margin:8px 0; }
.item > .head { padding:10px 14px; cursor:pointer; display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; }
.item > .head b { font-size:15px; } .meta { color:var(--mute); font-size:13px; }
.chips span { display:inline-block; background:var(--hl); border-radius:4px; padding:0 6px; margin:2px 4px 2px 0; font-size:13px; }
.chips span.d { background:var(--decoy); }
.body { border-top:1px solid var(--line); padding:12px 14px; }
pre.text { white-space:pre-wrap; word-break:break-word; font:14px/1.75 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif; margin:0; max-height:70vh; overflow:auto; }
mark.n { background:var(--hl); color:inherit; } mark.d { background:var(--decoy); color:inherit; } mark.p { background:var(--ph); color:inherit; } mark.c { background:var(--copy); color:inherit; }
.legend mark { padding:0 4px; margin-right:4px; }
.profile { font-size:13px; color:var(--mute); white-space:pre-wrap; background:var(--bg); border-radius:6px; padding:8px 10px; margin-bottom:10px; max-height:220px; overflow:auto; }
.pair { display:grid; grid-template-columns:1fr 1fr; gap:12px; } @media (max-width:760px) { .pair { grid-template-columns:1fr; } }
.pair pre.text { max-height:60vh; border:1px solid var(--line); border-radius:8px; padding:10px; background:var(--card); }
.num { font-variant-numeric:tabular-nums; white-space:nowrap; }
.more { color:var(--mute); font-size:13px; }
</style>
</head>
<body>
<main>
<h1>阶段 0 验收</h1>
<p class="sub">2026-11-01 · 12 个行业 × 3 种档案形态的测评档案，全部虚构。两次采样共 252 份真实模型输出（只量生成本身，不含线上的后检）。</p>

<div class="card">
<b>这页怎么验收</b>
<ol class="steps">
<li>看<b>第一节</b>：每个板块现在什么水平、问题出在哪，一句话说清。</li>
<li>点每行的「看稿子」，翻<b>第三节</b>的原稿核对：我说的问题是不是真的，有没有我漏掉的。</li>
<li>看<b>第二节</b>：创作方向的修复前后对比，决定要不要上线。</li>
<li>最后做<b>第四节</b>的三件事：盲评打分、确认量化目标、定修复要不要上线。</li>
</ol>
<div class="legend meta">标记说明：<mark class="n">编出来的细节</mark>（输入和档案里都没有）<mark class="d">别的行业的词</mark><mark class="p">【待确认】占位</mark><mark class="c">照抄的 36 计清单</mark>。黄色是检测器自动标的，大约 8 成是模型自己写的，其中约 4 成是真编造，其余是举例、执行建议，要结合上下文看。它也会漏标：比如「有个路过的阿姨停下来看了三分钟」整句都是编的，只标出了「下午三点」。所以请以读原文为准。</div>
</div>

<h2>一、整体表现</h2>
<div class="card">
<b>结论</b>
<ul class="key">
<li><b>别的行业的词混进来，只在一个地方系统性出现</b>：创作方向把 36 计清单整张抄进结果。原因已查明，本地已修好，新版 8 份一份没抄。</li>
<li><b>编造集中在「写成稿」的板块</b>：跨行业二创、开篇钩子、拆解爆款、脚本。编的是客户故事（「昨天来了个妈妈」）、具体时间（「下午三点半」）、没出处的专业数字（「勺子 4.5 克」）。定位、规划、分镜、审稿基本干净。</li>
<li><b>同样的提示词，两次跑的表现差很多</b>：第一次（10-31 晚）整体干净；第二次（11-01 凌晨，充值后）编造明显变多。提示词一字没改，是模型那边在不同时段表现不一样。这意味着用户在不同时间用，质量会不稳定。</li>
<li><b>篇幅过长</b>：账号定位、内容定位平均 9000 多字，拆解爆款近 11000 字，选题 7000 多字。</li>
<li><b>占位过多</b>：拆解爆款每份平均 11.6 处【待确认】，审稿 3.8 处。</li>
<li><b>好不好看、有没有创意、像不像本人说的</b>：这些数字量不出来，要你在第四节盲评。</li>
</ul>
</div>
<div id="overview"></div>

<h2>二、创作方向：修复前后（同一时段、同样 8 个档案）</h2>
<div class="card">
<p><b>原因</b>：36 计清单被放在了「输出格式（标题和字段名原样保留）」下面，看起来就是输出模板的一部分，模型照「原样保留」把它抄了出来。<b>改法</b>：清单挪到输出格式前面当参考资料，删掉之前打补丁的那条「不要复述清单」。</p>
<table id="fixtable"><thead><tr><th>档案</th><th>旧版：抄了几计</th><th>新版：抄了几计</th><th>新版字数</th><th></th></tr></thead><tbody></tbody></table>
<div id="fixpair" style="margin-top:12px"></div>
</div>

<h2>三、全部稿子</h2>
<div class="filters">
<select id="fNode"><option value="">全部板块</option></select>
<select id="fCode"><option value="">全部档案</option></select>
<select id="fRun"><option value="">全部采样</option></select>
<label><input type="checkbox" id="fFlag"> 只看有标记的</label>
<span class="meta" id="count"></span>
</div>
<div id="list"></div>
<div id="pager" style="margin-top:10px"></div>

<h2>四、你要做的三件事</h2>
<div class="card">
<ol class="steps">
<li><b>盲评打分</b>：打开 <code>docs/开物使用报告_20261030/阶段0_基线盲评.html</code>（9 个板块 × 4 份，档案和采样都打乱了）。每份判合格或不合格，写一句原因，打 1–5 分，最后点导出发给我。这是判断「质量好不好」的唯一依据，也是后面每一步改动的对照。</li>
<li><b>确认量化目标</b>（整改方案第一节）：无关信息 0；编造降到基线的一半以下；盲评分不低于基线、目标高 0.5 分；创作板块提示词不超过 8000 字、定位类不超过 15000 字；一次生成平均调用不超过 2 次；等待时间中位数降 30%。认不认可，要不要改。</li>
<li><b>创作方向的修复要不要现在上线</b>：同意的话，我提交，你运行 <code>同步到服务器.ps1</code>。</li>
</ol>
</div>
</main>

<script>
const DATA = __DATA__;
const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LIST_LINE = /^.*第\\d{1,2}计\\s*\\*{0,2}[^\\s*【]{2,12}\\*{0,2}\\s*【[^】]+】\\s*[:：].*$/gm;
const LEVEL = { ok: '好', warn: '有问题', bad: '问题大' };
const pname = (code) => { const p = DATA.profiles[code]; return p ? p.name.replace(/（.*?）/, '') + '·' + p.shape : code; };

function highlight(r) {
  let h = esc(r.text);
  h = h.replace(LIST_LINE, (m) => '<mark class="c">' + m + '</mark>');
  h = h.replace(/【待确认[^】]*】/g, (m) => '<mark class="p">' + m + '</mark>');
  const terms = [...new Set(r.samples)].sort((a, b) => b.length - a.length);
  for (const t of terms) h = h.split(esc(t)).join('<mark class="n">' + esc(t) + '</mark>');
  for (const t of r.decoys) h = h.split(esc(t)).join('<mark class="d">' + esc(t) + '</mark>');
  return h;
}

// 一、整体表现
for (const o of DATA.overview) {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center">' +
    '<b style="font-size:16px">' + esc(o.node) + '</b><span class="tag ' + o.level + '">' + LEVEL[o.level] + '</span>' +
    '<button class="link" style="margin-left:auto" data-node="' + esc(o.node) + '">看这个板块的稿子 →</button></div>' +
    '<div class="meta" style="margin:4px 0 6px">' + o.n + ' 份 · 有编造标记：第一次 ' + o.s1 + '，第二次 ' + o.s2 +
    ' · 串进别的行业 ' + o.mixed + ' · 平均 ' + o.chars + ' 字 · 平均占位 ' + o.placeholders + ' 处</div>' +
    '<div>' + esc(o.text) + '</div>';
  $('#overview').appendChild(div);
}
$('#overview').addEventListener('click', (e) => {
  const n = e.target.dataset && e.target.dataset.node; if (!n) return;
  $('#fNode').value = n; $('#fRun').value = ''; $('#fCode').value = ''; $('#fFlag').checked = false; page = 0; render();
  document.querySelector('.filters').scrollIntoView({ behavior: 'smooth' });
});

// 二、修复前后
const fixOld = DATA.rows.filter((r) => r.run === 'fix-08-old');
const fixNew = DATA.rows.filter((r) => r.run === 'fix-08-new');
for (const n of fixNew) {
  const o = fixOld.find((x) => x.code === n.code);
  const tr = document.createElement('tr');
  tr.innerHTML = '<td>' + esc(pname(n.code)) + '</td><td class="num">' + (o ? (o.copied >= 5 ? '<span class="tag bad">抄了 ' + o.copied + ' 计</span>' : '没抄') : '—') + '</td>' +
    '<td class="num">' + (n.copied >= 5 ? '<span class="tag bad">抄了 ' + n.copied + ' 计</span>' : '<span class="tag ok">没抄</span>') + '</td>' +
    '<td class="num">' + n.chars + '</td><td><button class="link" data-code="' + esc(n.code) + '">并排看</button></td>';
  $('#fixtable tbody').appendChild(tr);
}
function showPair(code) {
  const o = fixOld.find((x) => x.code === code), n = fixNew.find((x) => x.code === code);
  $('#fixpair').innerHTML = '<div class="meta" style="margin-bottom:6px">' + esc(pname(code)) + ' · 创作方向</div><div class="pair">' +
    '<div><b>旧版</b><pre class="text">' + (o ? highlight(o) : '') + '</pre></div>' +
    '<div><b>新版</b><pre class="text">' + (n ? highlight(n) : '') + '</pre></div></div>';
}
$('#fixtable').addEventListener('click', (e) => { const c = e.target.dataset && e.target.dataset.code; if (c) showPair(c); });
const firstCopied = fixOld.find((r) => r.copied >= 5);
if (firstCopied) showPair(firstCopied.code);

// 三、全部稿子
const base = DATA.rows.filter((r) => r.run.startsWith('baseline'));
for (const n of [...new Set(base.map((r) => r.node))].sort()) $('#fNode').insertAdjacentHTML('beforeend', '<option>' + esc(n) + '</option>');
for (const c of Object.keys(DATA.profiles)) $('#fCode').insertAdjacentHTML('beforeend', '<option value="' + esc(c) + '">' + esc(pname(c)) + '</option>');
for (const [k, v] of Object.entries(DATA.runLabel)) if (k.startsWith('baseline')) $('#fRun').insertAdjacentHTML('beforeend', '<option value="' + k + '">' + esc(v) + '</option>');
const PAGE_SIZE = 30;
let page = 0;
function render() {
  const node = $('#fNode').value, code = $('#fCode').value, run = $('#fRun').value, flag = $('#fFlag').checked;
  const xs = base.filter((r) => (!node || r.node === node) && (!code || r.code === code) && (!run || r.run === run) && (!flag || r.novel > 0 || r.decoys.length || r.copied >= 5));
  $('#count').textContent = '共 ' + xs.length + ' 份';
  const shown = xs.slice(0, (page + 1) * PAGE_SIZE);
  $('#list').innerHTML = shown.map((r, i) =>
    '<div class="item" data-id="' + esc(r.id) + '"><div class="head"><b>' + esc(r.node) + '</b><span>' + esc(pname(r.code)) + '</span>' +
    '<span class="meta">' + esc(DATA.runLabel[r.run]) + ' · ' + r.chars + ' 字' + (r.placeholders ? ' · 占位 ' + r.placeholders : '') + (r.copied >= 5 ? ' · <span class="tag bad">抄清单 ' + r.copied + ' 计</span>' : '') + '</span>' +
    '<span class="chips">' + r.samples.map((s) => '<span>' + esc(s) + '</span>').join('') + r.decoys.map((s) => '<span class="d">' + esc(s) + '</span>').join('') + '</span>' +
    '<span class="meta" style="margin-left:auto">点开看全文 ▾</span></div></div>').join('');
  $('#pager').innerHTML = xs.length > shown.length ? '<button id="moreBtn">再显示 ' + Math.min(PAGE_SIZE, xs.length - shown.length) + ' 份（还有 ' + (xs.length - shown.length) + ' 份）</button>' : '';
  const mb = $('#moreBtn'); if (mb) mb.onclick = () => { page++; render(); };
}
$('#list').addEventListener('click', (e) => {
  const head = e.target.closest('.head'); if (!head) return;
  const item = head.parentElement;
  const open = item.querySelector('.body');
  if (open) { open.remove(); return; }
  const r = base.find((x) => x.id === item.dataset.id);
  const p = DATA.profiles[r.code];
  const div = document.createElement('div');
  div.className = 'body';
  div.innerHTML = '<details><summary class="meta">这个档案的原始输入（核对用：黄色的细节在这里找不到）</summary><div class="profile">' + esc(p.summary) + (p.interview ? '\\n\\n访谈要点：' + esc(p.interview) : '\\n\\n（稀疏档案，没有访谈）') + '</div></details>' +
    '<pre class="text">' + highlight(r) + '</pre>';
  item.appendChild(div);
});
for (const id of ['#fNode', '#fCode', '#fRun', '#fFlag']) $(id).addEventListener('change', () => { page = 0; render(); });
render();
</script>
</body>
</html>
`;
