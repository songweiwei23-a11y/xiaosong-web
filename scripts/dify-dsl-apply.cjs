#!/usr/bin/env node
/**
 * 把工作流 DSL 改成当前该有的样子，再自检一遍，输出一份"改了什么"的清单。
 *
 * 为什么用脚本改、不在网页上点：每一处改动都有据可查、能重复执行、能回退；
 * 改完还要机器核对——删掉一个节点而提示词里还引用着它，Dify 不报错，只是那一段变成空的。
 *
 * 用法：node scripts/dify-dsl-apply.cjs docs/dify/小宋编导文案工作台.yml [输出路径]
 * 不给输出路径就原地覆盖。系统提示词原文在 docs/dify/system-prompt.md。
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const [src, outArg] = process.argv.slice(2);
if (!src) {
  console.error('用法：node scripts/dify-dsl-apply.cjs <dsl.yml> [输出路径]');
  process.exit(1);
}
const out = outArg || src;
const doc = yaml.load(fs.readFileSync(src, 'utf8'));
const g = doc.workflow.graph;
const changes = [];
const note = (s) => changes.push(s);

// ① 应用名：跟网站一起改名「开物」
if (doc.app.name !== '开物') {
  note(`应用名：${doc.app.name} → 开物`);
  doc.app.name = '开物';
}
doc.app.description = '开物：短视频编导和代运营的 AI 工作台——定位、选题、脚本、分镜、审稿、标题封面。';
const os = doc.workflow.features.opening_statement || '';
if (/小宋/.test(os)) {
  doc.workflow.features.opening_statement = os.replace(/我是小宋的编导文案工作台/g, '我是「开物」AI 编导').replace(/小宋/g, '开物');
  note('开场白里的"小宋"改成"开物"');
}

// ② 删掉坏掉的 Tavily Extract：它把检索词同时当网址和问题，检索词不是网址，每次白跑
const extract = g.nodes.find((n) => n.data.title === 'Tavily Extract');
if (extract) {
  g.nodes = g.nodes.filter((n) => n !== extract);
  const before = g.edges.length;
  g.edges = g.edges.filter((e) => e.source !== extract.id && e.target !== extract.id);
  note(`删除节点 Tavily Extract（${extract.id}）及其 ${before - g.edges.length} 条连线`);
}

/*
 * ③ Tavily Search：线上实测它每次都报错，联网从来没通过——
 *    "All domains in include_domains are invalid: ['/']"。
 *    修好域名之后还有第二个坑：chunks_per_source 填的是 100，Tavily 只允许 1-5，照样报错；
 *    max_results 100 + 抓网页全文，一旦搜到东西会把几十个网页全文塞给模型，直接撑爆上下文。
 */
const search = g.nodes.find((n) => n.data.title === 'Tavily Search');
if (search) {
  const setIn = (bucket, label, k, v, why) => {
    const p = search.data[bucket];
    if (JSON.stringify(p[k]?.value) !== JSON.stringify(v)) {
      note(`Tavily Search.${label}：${JSON.stringify(p[k]?.value)} → ${JSON.stringify(v)}（${why}）`);
      p[k] = { ...(p[k] || { type: 'constant' }), value: v };
    }
  };
  const param = (k, v, why) => setIn('tool_parameters', k, k, v, why);
  const conf = (k, v, why) => setIn('tool_configurations', k, k, v, why);
  param('include_domains', null, '原来是"/"，Tavily 判为无效域名，每次都报错');
  param('topic', 'general', '只搜新闻搜不到案例、玩法、平台规则');
  param('search_depth', 'advanced', '深度搜索，结果质量优先');
  conf('chunks_per_source', 3, '原来 100，Tavily 只允许 1-5，会报错');
  conf('max_results', 6, '原来 100；6 个来源足够，多了只会稀释');
  conf('include_raw_content', 'false', '整页全文太长，改用下面的相关段落 + 总结');
  conf('include_answer', 'advanced', '让 Tavily 先把搜到的内容总结成一段');
}

// ④ 主模型节点
const llm = g.nodes.find((n) => n.data.type === 'llm');
const params = llm.data.model.completion_params;
const setParam = (k, v, why) => {
  if (params[k] !== v) {
    note(`模型参数 ${k}：${params[k]} → ${v}（${why}）`);
    params[k] = v;
  }
};
setParam('temperature', 0.5, '同一份档案结果更稳定');
setParam('frequency_penalty', 0, '长篇结构化方案里标题和表头本来就要重复，惩罚重复只会让措辞变怪');
setParam('presence_penalty', 0, '同上');
if (llm.data.memory?.window?.size !== 20) {
  note(`记忆窗口：${llm.data.memory.window.size} → 20（100 轮会把长方案一起塞进来，撑爆上下文）`);
  llm.data.memory.window.size = 20;
}
// 上下文变量关掉：它指向的库4 检索结果在提示词里本来就有一份，原来开头又重复塞了一遍
if (llm.data.context?.enabled) {
  note('关闭"上下文"：库4 检索结果原来在提示词开头又重复了一遍，而那里正是 PPT 碎片所在的库');
  llm.data.context = { enabled: false, variable_selector: [] };
}
const sys = llm.data.prompt_template.find((p) => p.role === 'system');
const newSys = fs.readFileSync(path.join(__dirname, '..', 'docs', 'dify', 'system-prompt.md'), 'utf8').trim();
if (sys.text.trim() !== newSys) {
  note(`系统提示词：${sys.text.length} 字 → ${newSys.length} 字（原文见 docs/dify/system-prompt.md）`);
  sys.text = newSys;
}

/*
 * ⑥ 看图：拆解爆款要把视频截图（拼成带时间码的拼图）发给模型看。
 *    原来模型节点的视觉是关的，发了图也会被丢掉；应用级每条消息最多 3 个文件。
 *    打开节点视觉（读用户消息带的文件），应用级图片放开、上限提到 6 张。
 *    另外模型本身要在 Dify「模型供应商」里勾上视觉支持，那一步在网页上做。
 */
const vision = { enabled: true, configs: { detail: 'high', variable_selector: ['sys', 'files'] } };
if (JSON.stringify(llm.data.vision) !== JSON.stringify(vision)) {
  note('模型节点打开视觉（读 sys.files，高清）——拆解爆款要看视频截图');
  llm.data.vision = vision;
}
const fu = doc.workflow.features.file_upload;
if (!fu.image.enabled || fu.image.number_limits < 6 || fu.number_limits < 6) {
  note(`应用文件上传：图片 ${fu.image.enabled ? '开' : '关'} → 开；每条消息上限 ${fu.number_limits} → 6`);
  fu.image.enabled = true;
  fu.image.number_limits = Math.max(6, fu.image.number_limits);
  fu.number_limits = Math.max(6, fu.number_limits);
}

// ⑤ 自检：提示词里引用的节点都存在；连线两端都存在；没有孤立节点
const ids = new Set(g.nodes.map((n) => n.id));
const problems = [];
for (const m of sys.text.matchAll(/\{\{#([^.#]+)\.[^#]+#\}\}/g)) {
  if (!ids.has(m[1]) && !['sys', 'start', 'context'].includes(m[1])) problems.push(`提示词引用了不存在的节点 ${m[1]}`);
}
for (const e of g.edges) {
  if (!ids.has(e.source) || !ids.has(e.target)) problems.push(`连线 ${e.id} 指向不存在的节点`);
}
for (const n of g.nodes) {
  if (n.data.type === 'start') continue;
  if (!g.edges.some((e) => e.target === n.id)) problems.push(`节点「${n.data.title}」没有任何入线`);
}
if (/小宋/.test(sys.text)) problems.push('系统提示词里还有"小宋"');
if (/Day1-Day7的具体操作清单|今天我要曝光/.test(sys.text)) problems.push('冲突规则没删干净');

if (problems.length) {
  console.error('自检没过，未写出：\n' + problems.map((p) => '  ✗ ' + p).join('\n'));
  process.exit(1);
}
fs.writeFileSync(out, yaml.dump(doc, { lineWidth: -1, noRefs: true }));
console.log(changes.length ? '改动：\n' + changes.map((c) => '  · ' + c).join('\n') : '没有需要改的');
console.log(`\n自检通过，已写出 ${out}`);
