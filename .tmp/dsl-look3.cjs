const yaml=require('js-yaml'),fs=require('fs');
const d=yaml.load(fs.readFileSync('docs/dify/开物.yml','utf8'));const n=d.workflow.graph.nodes.find(n=>n.data.type==='llm');
const s=n.data.prompt_template[0].jinja2_text||n.data.prompt_template[0].text;s.split('\n').forEach((l,i)=>{if(/\{%|\{\{/.test(l))console.log(i+1,l.slice(0,160))});

