const yaml=require('js-yaml'),fs=require('fs');
const d=yaml.load(fs.readFileSync('docs/dify/开物.yml','utf8'));const n=d.workflow.graph.nodes.find(n=>n.data.type==='llm');
console.log(JSON.stringify(n.data.prompt_config,null,1).slice(0,3000));
for(const p of n.data.prompt_template){const s=p.jinja2_text||p.text||'';console.log(p.role,p.edition_type,s.length,[...new Set(s.match(/\{\{\s*[\w.#]+\s*\}\}/g)||[])].join(' '));}
const kr=d.workflow.graph.nodes.filter(n=>n.data.type==='knowledge-retrieval').map(n=>n.id+':'+n.data.title);console.log(kr.join('\n'));
