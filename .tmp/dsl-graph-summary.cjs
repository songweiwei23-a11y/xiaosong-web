// 只读：列出 DSL 的节点和连线，找到主 LLM 节点的上下游，以及它的 id 在哪些地方被引用。
// 不输出任何提示词正文、不输出环境变量的值。
const fs = require('fs');
const yaml = require('js-yaml');
const file = process.argv[2];
const raw = fs.readFileSync(file, 'utf8');
const doc = yaml.load(raw);
const g = doc.workflow.graph;

console.log('节点数', g.nodes.length, '连线数', g.edges.length);
for (const n of g.nodes) {
  const d = n.data || {};
  console.log(`- ${n.id}  type=${d.type}  title=${d.title}`);
}

const llm = g.nodes.find((n) => n.data.type === 'llm');
console.log('\n主 LLM 节点：', llm.id, llm.data.title);
console.log('入边：');
for (const e of g.edges.filter((e) => e.target === llm.id)) console.log(`  ${e.source} (${e.sourceHandle}) -> 本节点`);
console.log('出边：');
for (const e of g.edges.filter((e) => e.source === llm.id)) console.log(`  本节点 -> ${e.target} (${e.targetHandle})`);

const refs = raw.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => l.includes(llm.id));
console.log('\n主 LLM 节点 id 在 YAML 中的出现次数：', refs.length);
for (const [ln, l] of refs.slice(0, 20)) console.log(`  第 ${ln} 行：${l.trim().slice(0, 100)}`);

const starts = g.nodes.filter((n) => n.data.type === 'start');
for (const s of starts) {
  console.log('\n开始节点变量：');
  for (const v of s.data.variables || []) console.log(`  ${v.variable} (${v.type}) 必填=${v.required}`);
}
