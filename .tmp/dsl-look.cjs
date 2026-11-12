const yaml=require('js-yaml'),fs=require('fs');
const d=yaml.load(fs.readFileSync('docs/dify/开物.yml','utf8'));const g=d.workflow.graph;
const t=id=>{const n=g.nodes.find(n=>n.id===id);return n?`${n.data.title}[${n.data.type}]`:id};
for(const e of g.edges) console.log(t(e.source),'--',e.sourceHandle||'','->',t(e.target));
for(const n of g.nodes){ if(n.data.type==='if-else') console.log('IF',n.data.title,JSON.stringify(n.data.cases).slice(0,600));
 if(n.data.type==='llm'){console.log('LLM',n.data.title,'context:',JSON.stringify(n.data.context));
   const txt=JSON.stringify(n.data.prompt_template);console.log(' refs:',[...new Set(txt.match(/\{\{#[^}]+#\}\}/g))].join(' '));}
 if(n.data.type==='knowledge-retrieval') console.log('KR',n.data.title,'query:',JSON.stringify(n.data.query_variable_selector), 'topk', n.data.multiple_retrieval_config?.top_k);}
