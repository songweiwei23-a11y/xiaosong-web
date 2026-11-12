import fs from 'node:fs';
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
import {getSearchConfig} from '../lib/search-config';
import {aliSearch} from '../lib/ali-search';
import {fetchPage} from '../lib/page-fetch';
import {extractMainText} from '../lib/html-text';
import {buildNotePrompt,siteOf, type SourceRow} from '../lib/research';
import {askDify} from '../lib/dify-task';
(async()=>{
 const result:any={time:new Date().toISOString(),scope:'一次真实搜索、前两个来源读取及一个分节；不创建网站研究任务，不测试全报告、会员计费或恢复'};
 const config=await getSearchConfig();result.configured=!!config;
 if(config){const start=Date.now();const search=await aliSearch('site:docs.dify.ai LLM Memory conversation Vision high detail',config,{topK:4});result.searchElapsedMs=Date.now()-start;result.searchOK=search.ok;
 if(search.ok){result.hits=search.hits.map(h=>({url:h.url,title:h.title,chars:h.content.length}));const rows:SourceRow[]=[];
 for(const [index,hit] of search.hits.slice(0,2).entries()){const page=await fetchPage(hit.url);const content=page.ok?extractMainText(page.html):null;rows.push({n:index+1,step:0,url:hit.url,title:hit.title,site:siteOf(hit.url),published:hit.published,fetched:page.ok&&content?.text?'full':'snippet',content:content?.text||hit.content,collected_at:new Date().toISOString()});}
 result.sources=rows;const begin=Date.now();const answer=await askDify(buildNotePrompt({topic:'Dify LLM节点记忆与视觉配置',title:'正式研究分节质量验收',question:'LLM Memory能否跨会话持久化？Vision high detail有什么取舍？',index:0,total:1,depth:'quick',rows,context:''}),'kaiwu-quality-research-qa-20261005','',{signal:AbortSignal.timeout(180000)});result.modelElapsedMs=Date.now()-begin;result.answer=answer.ok?answer.text:null;result.modelOK=answer.ok;result.error=answer.ok?null:answer.message;
 }}fs.writeFileSync('/tmp/kaiwu-quality-research_20261005.json',JSON.stringify(result,null,2));console.log(JSON.stringify({configured:result.configured,searchOK:result.searchOK,sourceCount:result.sources?.length,modelOK:result.modelOK}));
})().catch(e=>{console.log(JSON.stringify({error:e.name}));process.exitCode=1;});
