import fs from 'node:fs';
(async()=>{
  for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
    const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
  }
  const {askDify}=await import('../lib/dify-task');
  const {buildPlanPrompt,parsePlan}=await import('../lib/research');
  const start=Date.now();
  const answer=await askDify(buildPlanPrompt('2026年本地家具门店的短视频营销策略','quick','这是上线验收，只拟定研究计划，不执行搜索。'),'research-model-qa-20261004','',{signal:AbortSignal.timeout(180000)});
  const plan=answer.ok?parsePlan(answer.text,'quick'):null;
  const result={time:new Date().toISOString(),ok:answer.ok,planParsed:!!plan,questions:plan?.questions.length??0,title:plan?.title??null,elapsedMs:Date.now()-start,terminal:answer.ok?answer.completion.terminal:null,error:answer.ok&&!plan?'模型未给出可解析计划':answer.ok?null:answer.message};
  console.log(JSON.stringify(result));
  if(!result.planParsed)process.exitCode=1;
})().catch(()=>{console.log(JSON.stringify({ok:false,error:'模型计划验收连接失败'}));process.exitCode=1;});
