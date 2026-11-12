import fs from 'node:fs';
import { aliSearch } from '../lib/ali-search';
import { getSearchConfig } from '../lib/search-config';
import { fetchPage } from '../lib/page-fetch';
import { extractMainText } from '../lib/html-text';
import { freeChatWebQuery, pickFreeChatSources, readOfficialDocumentation } from '../lib/web-source-quality';
import { buildNotePrompt, buildSummaryPrompt, assembleReport, siteOf, type SourceRow, type ResearchStep } from '../lib/research';
import { askDify } from '../lib/dify-task';
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
 const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
const topic='Dify LLM Memory、Vision 与知识检索的配置区别';
const questions=[
 {q:'LLM Memory 和会话变量有哪些作用域差别，跨会话历史保存有什么边界？',queries:['Dify官方文档 LLM Memory 会话变量 跨会话持久化']},
 {q:'Vision high detail 有何取舍，文档与图片附件怎样送入LLM？',queries:['Dify官方文档 LLM Vision high detail document extractor']},
 {q:'知识检索节点怎样把来源送入LLM，能否当作长期会话记忆？',queries:['Dify官方文档 知识检索节点 LLM Context']},
];
(async()=>{
 const config=await getSearchConfig();if(!config)throw new Error('Search not configured');
 const began=Date.now(), sources:SourceRow[]=[],steps:ResearchStep[]=[],evidence:any[]=[];
 for(const [i,q] of questions.entries()){
  const w=freeChatWebQuery(q.queries[0]);
  const searched=await aliSearch(w.query,config,{topK:8,way:'pro-fetch',rewrite:!/site:/i.test(w.query),today:w.today});
  if(!searched.ok)throw new Error('Search '+searched.reason);
  const sq=topic+' '+q.q,official=await readOfficialDocumentation(sq,fetchPage),urls=new Set(official.map(s=>s.url));
  const candidates=pickFreeChatSources([...official,...searched.hits],sq,0,Date.now(),5),rows:SourceRow[]=[];
  for(const h of candidates){
   const prior=sources.find(s=>s.url===h.url);if(prior){rows.push(prior);if(rows.length===2)break;continue;}
   let text=h.content,published=h.published,fetched:'full'|'snippet'=urls.has(h.url)?'full':'snippet';
   if(!urls.has(h.url)){
    const p=await fetchPage(h.url),t=p.ok?(/text\/(plain|markdown)/.test(p.contentType)?{text:p.html.trim(),published:''}:extractMainText(p.html)):null;
    if(t&&t.text.length>=300&&t.text.length>=h.content.length*.6){text=t.text;published=published||t.published;fetched='full';}
   }
   if(text.length<150)continue;
   const row:SourceRow={n:sources.length+1,step:i,url:h.url,title:h.title,site:siteOf(h.url),published,fetched,content:text.slice(0,15000),collected_at:new Date().toISOString()};sources.push(row);rows.push(row);if(rows.length===2)break;
  }
  const prompt=buildNotePrompt({topic,title:'深度研究联网验收',question:q.q,index:i,total:questions.length,depth:'quick',rows,context:''});
  const st=Date.now(),answer=await askDify(prompt,'kaiwu-research-source-qa-20261007','',{signal:AbortSignal.timeout(180000)});
  steps.push(answer.ok?{status:'done',note:answer.text,sources:rows.map(s=>s.n),searched:searched.hits.length,read:rows.length}:{status:'failed',error:answer.message});
  evidence.push({question:q.q,query:w.query,searchHits:searched.hits.map(h=>({url:h.url,title:h.title,chars:h.content.length})),selected:rows.map(r=>({url:r.url,title:r.title,fetched:r.fetched,chars:r.content.length})),elapsedMs:Date.now()-st});
  console.log(JSON.stringify({step:i,ok:answer.ok,sources:rows.length,chars:answer.ok?answer.text.length:0}));
 }
 const summary=await askDify(buildSummaryPrompt({topic,title:'深度研究联网验收',questions:questions.map(q=>q.q),notes:steps.map(s=>s.note||''),context:'',hasContext:false}),'kaiwu-research-source-qa-20261007','',{signal:AbortSignal.timeout(180000)});
 const report=assembleReport({title:'深度研究联网验收',topic,depth:'quick',questions:questions.map(q=>q.q),steps,summary:summary.ok?summary.text:'结论未完成',sources});
 fs.writeFileSync('/tmp/research-source-qa_20261007.json',JSON.stringify({time:new Date().toISOString(),scope:'真实三轮检索、公开正文、三分节和汇总报告；不写用户数据、不验证真实任务租约与计费',elapsedMs:Date.now()-began,evidence,sources,steps,summaryOK:summary.ok,...report},null,2));
 console.log(JSON.stringify({done:true,summaryOK:summary.ok,...report.check}));
})().catch(e=>{console.error(e.name+': '+e.message);process.exitCode=1;});
