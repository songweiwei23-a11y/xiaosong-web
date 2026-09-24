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

// ③ Tavily Search：限定域名原来填的是 "/"，类型是"新闻"——方法论问题不该去搜新闻
const search = g.nodes.find((n) => n.data.title === 'Tavily Search');
if (search) {
  const p = search.data.tool_parameters;
  const set = (k, v, why) => {
    if (JSON.stringify(p[k]?.value) !== JSON.stringify(v)) {
      note(`Tavily Search.${k}：${JSON.stringify(p[k]?.value)} → ${JSON.stringify(v)}（${why}）`);
      p[k] = { ...(p[k] || { type: 'constant' }), value: v };
    }
  };
  set('include_domains', null, '原来是"/"，不限定域名');
  set('topic', 'general', '方法论和案例不该只搜新闻');
  set('search_depth', 'basic', '每次生成都会跑，basic 更快');
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
