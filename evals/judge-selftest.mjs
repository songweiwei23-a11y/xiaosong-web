// 评估器自检（2026-11-01）：上线当关卡之前，先证明它判得稳、也真能抓到毛病。
//   1. 稳定性：同一批稿子判两遍（r1、r2），看结论一不一样。
//   2. 改坏测试：拿判合格的好稿子，每份只改坏一处（换成套话结尾、塞一段编的客户故事……），
//      评估器应该在被改坏的那条标准上判不合格。例句都是新写的，不在标准卡里。
//
// 用法：node evals/judge-selftest.mjs make     生成三份条目（给 evals/judge.eval.ts 判）
//       node evals/judge-selftest.mjs report   读判定结果，出自检报告
import fs from 'node:fs';

const RUNS = 'E:/小宋/腾讯云生产版同步_20260918/evals/runs';
const OUT = {
  topics: `${RUNS}/selftest-topic-items.json`,
  scripts: `${RUNS}/selftest-script-items.json`,
  perturb: `${RUNS}/selftest-perturb-items.json`,
};
const DIRS = {
  topics: ['judge-selftest-topics-r1', 'judge-selftest-topics-r2'],
  scripts: ['judge-selftest-scripts-r1', 'judge-selftest-scripts-r2'],
  perturb: 'judge-selftest-perturb',
};

/** 原句里的逗号、问号全角半角都认：分镜里的台词常是半角 */
function loose(s) {
  return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[，,]/g, '[，,]').replace(/[？?]/g, '[？?]'), 'g');
}
function apply(text, edits, label) {
  let t = text;
  for (const [from, to] of edits) {
    const re = loose(from);
    if (!re.test(t)) throw new Error(`${label}：找不到原句「${from}」`);
    t = t.replace(loose(from), to);
  }
  return t;
}

/** 脚本改坏：code → 改哪条标准、怎么改。expect 是应该判不合格的标准（任一条判不合格就算抓到） */
const SCRIPT_PERTURB = [
  { code: 'I-a', expect: ['S1'], what: '开头换成自我介绍', edits: [['第一次来上私教课，为什么我们会先把器械放回去？', '大家好，我是工作室的教练，今天跟大家分享一下我们私教课的流程。']] },
  { code: 'I-a', expect: ['S3'], what: '塞一段档案里没有的客户故事', edits: [['好，我先记一下。', '好，我先记一下。上个月有个产后妈妈来，说在别家第一节课就被拉去跳绳，膝盖疼了两个星期。']] },
  { code: 'I-a', expect: ['S4'], what: '结尾换成泛道理', edits: [['我们这里第一节课先做体测，再定计划。', '其实每个人的身体都不一样，找到适合自己的节奏才最重要。']] },
  { code: 'B-s', expect: ['S4'], what: '结尾换成泛道理', edits: [['秋天衣服层次多，正面看完，记得再转一圈。', '穿衣服最重要的是自信，适合自己的就是最好的。']] },
  { code: 'B-s', expect: ['S2', 'S3'], what: '试穿过程换成「一种做法……另一种做法」的讲解', edits: [
    ['站直了，看衣长到哪儿，腰这块儿会不会堆。', '试衣服一般有两种做法。一种是只看正面，看着合适就买。'],
    ['看转身的时候，后背这儿服不服帖。', '另一种是正面侧面都看，信息更全面。'],
    ['看看抬手的时候，这儿会不会往上跑，或者勒。', '两种做法各有道理，关键看自己的需求。'],
  ] },
  { code: 'J', expect: ['S3'], what: '塞一段档案里没有的客户故事', edits: [['我做宠物洗护5年,最清楚主人进门时在担心什么。', '我做宠物洗护5年,最清楚主人进门时在担心什么。上周有只金毛在别家洗完，回来皮肤红了一大片，主人抱着它来找我，眼圈都是红的。']] },
  { code: 'J', expect: ['S4'], what: '结尾换成泛道理', edits: [
    ['这就是我们店里洗护全程可视的意思——', ''],
    ['不是只在门口等,而是你想看哪一步,就能看见哪一步。', '说到底，宠物就是家人，用心对待，它都感受得到。'],
  ] },
];

/** 选题改坏：校准表编号 → 改法 */
const TOPIC_PERTURB = [
  { no: 8, expect: ['T1'], what: '标题和钩子换成行内说法', edits: [
    ['车身划了一道,你第一眼看的那个地方,修车师傅根本不看', '钣金损伤评估：划痕部位、接缝与底漆层级的判定顺序'],
    ['"车身划了一道,你第一眼看长度,修车师傅第一眼看的根本不是这个。"', '"钣金损伤评估的第一步不是测划痕长度，而是判定损伤部位和漆层深度。"'],
  ] },
  { no: 9, expect: ['T1'], what: '标题和钩子换成行内说法', edits: [
    ['外行人绝对不知道的减脂记录：体重之外还要看什么？', '减脂周期的非体重指标：训练依从性、NEAT 与主观体感记录'],
    ['“减脂记录里，为什么教练不只问你轻了多少？”', '“减脂记录除了体重，还要监测训练依从性、NEAT 和主观疲劳度。”'],
  ] },
  { no: 9, expect: ['T4'], what: '取材里加一个档案里没有的学员案例和数字', edits: [
    ['1. 教练饰演“只问体重的人”', '1. 教练先讲自己带过的一位学员：3 个月减了 20 斤，体脂率从 32% 降到 24%；然后饰演“只问体重的人”'],
  ] },
  { no: 6, expect: ['T1'], what: '标题和钩子换成行内说法', edits: [
    ['孕妇来母婴店最常问的三句话,第一句就让人心疼', '孕期客群高频咨询话术拆解：需求分层与决策顾虑'],
    ['"在县医院对面开母婴店4年,孕妇来店里最常问三句话,第一句就让人心疼。"', '"在县医院对面开母婴店4年，孕期客群的高频咨询可以拆成三类决策顾虑。"'],
  ] },
  { no: 8, expect: ['T4'], what: '取材里加一个档案里没有的车主案例和金额', edits: [
    ['4. 交代为什么位置重要：接缝处的划痕容易进水锈蚀,塑料件和金属件的处理方式不同', '4. 交代为什么位置重要：接缝处的划痕容易进水锈蚀,塑料件和金属件的处理方式不同；再讲上个月一位车主没管接缝处的划痕，三个月后锈穿，换了整扇车门花了 4800 元'],
  ] },
];

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2), 'utf8');

function make() {
  const calib = read(`${RUNS}/calibration-key.json`);
  const topics = calib.filter((x) => x.board === '选题');
  write(OUT.topics, topics);
  const scripts = read(`${RUNS}/script-compare-items.json`).filter((x) => x.run === 'script-handoff');
  write(OUT.scripts, scripts);

  const perturb = [];
  SCRIPT_PERTURB.forEach((p, i) => {
    const base = scripts.find((x) => x.code === p.code);
    const text = apply(fs.readFileSync(`${RUNS}/${base.file}`, 'utf8'), p.edits, `${p.code} ${p.what}`);
    perturb.push({ no: 101 + i, board: '脚本', code: p.code, run: base.run, text, base: base.no, expect: p.expect, what: p.what });
  });
  TOPIC_PERTURB.forEach((p, i) => {
    const base = topics.find((x) => x.no === p.no);
    const text = apply(base.text, p.edits, `#${p.no} ${p.what}`);
    perturb.push({ no: 201 + i, board: '选题', code: base.code, summary: base.summary, text, base: base.no, expect: p.expect, what: p.what });
  });
  write(OUT.perturb, perturb);
  console.log(`选题 ${topics.length}、脚本 ${scripts.length}、改坏 ${perturb.length}`);
}

const verdictsOf = (dir, no) => {
  const p = `${RUNS}/${dir}/${no}.json`;
  if (!fs.existsSync(p)) return null;
  const j = read(p);
  return { overall: j.overall, ending: j.ending, c: Object.fromEntries(j.criteria.map((c) => [c.id, c.verdict])) };
};

function report() {
  const lines = ['# 评估器自检', ''];
  for (const kind of ['topics', 'scripts']) {
    const items = read(OUT[kind]);
    const [d1, d2] = DIRS[kind];
    let same = 0, cells = 0, sameCells = 0, n = 0;
    const rows = [];
    for (const it of items) {
      const a = verdictsOf(d1, it.no), b = verdictsOf(d2, it.no);
      if (!a || !b) continue;
      n++;
      if (a.overall === b.overall) same++;
      const ids = Object.keys(a.c);
      for (const id of ids) { cells++; if (a.c[id] === b.c[id]) sameCells++; }
      rows.push(`| #${it.no} ${it.code} | ${a.overall} / ${b.overall} | ${ids.map((id) => (a.c[id] === b.c[id] ? `${id} ${a.c[id]}` : `**${id} ${a.c[id]}→${b.c[id]}**`)).join('，')} |`);
    }
    lines.push(`## 稳定性：${kind === 'topics' ? '选题' : '脚本'}（判两遍）`, '',
      `- 整体结论一致：${same} / ${n}`, `- 单条标准一致：${sameCells} / ${cells}`, '',
      '| 稿子 | 整体（第一遍 / 第二遍） | 各条标准 |', '|---|---|---|', ...rows, '');
  }
  const perturb = read(OUT.perturb);
  let caught = 0, n = 0;
  const rows = [];
  for (const it of perturb) {
    const v = verdictsOf(DIRS.perturb, it.no);
    if (!v) continue;
    n++;
    const dirs = it.board === '选题' ? DIRS.topics : DIRS.scripts;
    const base = dirs.map((d) => verdictsOf(d, it.base)).filter(Boolean);
    const hit = it.expect.some((id) => v.c[id] === '不合格');
    if (hit) caught++;
    rows.push(`| ${it.code} | ${it.what} | ${it.expect.join(' 或 ')} | ${base.map((b) => it.expect.map((id) => b.c[id]).join('/')).join('，')} | ${it.expect.map((id) => v.c[id]).join('/')} | ${hit ? '抓到' : '**没抓到**'} |`);
  }
  lines.push('## 改坏测试', '', `- 抓到：${caught} / ${n}`, '',
    '| 稿子 | 改坏了什么 | 应判不合格的标准 | 原稿两遍 | 改坏后 | 结果 |', '|---|---|---|---|---|---|', ...rows, '');
  const out = 'E:/小宋/腾讯云生产版同步_20260918/docs/开物使用报告_20261030/评估器_自检.md';
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(lines.join('\n'));
}

const cmd = { make, report }[process.argv[2]];
if (cmd) cmd(); else console.log('用法：node evals/judge-selftest.mjs make|report');
