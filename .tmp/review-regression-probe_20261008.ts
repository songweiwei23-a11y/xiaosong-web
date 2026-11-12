import fs from 'node:fs';
import { askDify } from '../lib/dify-task';
import { buildReviewPrompt, personalRequirementsReminder } from '../lib/review-standards';
import { buildSearchQuery } from '../lib/search-query';
import { extractPlainCopy } from '../lib/script-copy';
import { resultStats, reviewDraftStats } from '../lib/script-result-utils';
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
const dir='.tmp/quality-regression_20261008';
const latest=JSON.parse(fs.readFileSync(dir+'/owner-review-history.private.json','utf8'))[0];
const input=latest.input_data;
const original=fs.readFileSync(dir+'/latest-review-query-rendered.private.txt','utf8');
const context=original.slice(original.indexOf('📇 账号背景'), original.indexOf('📄 待审稿件'));
const goals='提升开头吸引力、增强情绪共鸣、优化口播节奏、加强画面感、去除营销腔、扩充内容';
const report={time:new Date().toISOString(),scope:'原文来自本人最近一次审稿；独立诊断会话，不修改客户历史与额度账本；原始请求为可见页面文本，Markdown样式已移除',draftStats:reviewDraftStats(input.draftContent),results:[] as any[]};
async function run(id:string,query:string,focus:string) {
  fs.writeFileSync(dir+'/'+id+'-prompt.private.txt',query);
  console.log(JSON.stringify({id,started:true,promptChars:query.length}));
  const start=Date.now();
  const search=buildSearchQuery('审稿优化',{platform:input.platform,scriptType:input.scriptType,reviewFocus:focus},query);
  const result=await askDify(query,'kaiwu-review-regression-20261008-'+id,search,{signal:AbortSignal.timeout(300000)});
  const row={id,ok:result.ok,elapsedMs:Date.now()-start,queryChars:query.length,search,answer:result.ok?result.text:'',usage:result.ok?result.completion.usage:{},error:result.ok?null:result.message};
  report.results.push(row);
  fs.writeFileSync(dir+'/model-regression.private.json',JSON.stringify(report,null,2));
  if(result.ok)fs.writeFileSync(dir+'/'+id+'-copy.private.txt',extractPlainCopy(result.text));
  console.log(JSON.stringify({...row,answer:undefined,usage:row.usage,stats:result.ok?resultStats(result.text):null}));
}
const fixed=buildReviewPrompt({...input,contextBlock:context,reviewDimensions:'',optimizationGoals:goals,benchmarkScript:'',compareMode:true,severityLabels:true})+personalRequirementsReminder(input.personalRequirements);
Promise.all([run('original_fresh',original,''),run('fixed_ambiguous',fixed,input.personalRequirements)]).catch(e=>{console.error('Diagnostic model call failed: '+e.name);process.exitCode=1;});
