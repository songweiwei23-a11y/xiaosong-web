import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { askDify } from '../lib/dify-task';
import { buildAdaptiveScriptPrompt, regenerationPrompt } from '../lib/script-design';
import { buildReviewPrompt } from '../lib/review-standards';
import { buildTitlePrompt } from '../lib/title-standards';
import { buildStoryboardPrompt, FOLLOW_SCRIPT } from '../lib/storyboard-standards';
import { buildOpeningPrompt } from '../lib/growth-standards';
import { buildDirectionPrompt } from '../lib/direction';
import { creationSettingsBlock } from '../lib/creation-settings';
import { extractPlainCopy } from '../lib/script-copy';
import { unsupportedFacts } from '../lib/quality-checks';

for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
const dir='docs/创作质量同类修复_20261007'; fs.mkdirSync(dir,{recursive:true});
const goal='我想拍国庆前后门店生意对比，去问每家店老板的真实感受。围绕同一核心问题做成熟、具体、有采访深度的内容，让全国实体店老板愿意看和讨论。不做卖课或代运营获客广告，不编造采访答案。尚未采访，没有账本、收入数字或已知答案。';
const settings={topic:'国庆前后门店生意对比',direction:'同一条街不同门店老板的实际变化与真实感受',userIntent:goal,focusContent:goal,purpose:'流量型' as const,audience:'全国实体店老板及关注县城消费的人',device:'手机和领夹麦',personnel:'一人',openingLine:'国庆前后，这条街上的生意到底有什么变化？'};
const context='合成验收账号：县城编导；一人，手机和领夹麦。账号经营背景不等于本条要推销。'+creationSettingsBlock(settings);
function actualScriptQuery(s:typeof settings, requirements:string) {
  const page=fs.readFileSync('app/dashboard/script/page.tsx','utf8');
  const start=page.indexOf('const query = (autoScriptType || !isAd) ?');
  const end=page.indexOf('const response = await fetchGeneration',start);
  if(start<0||end<0)throw Error('Actual script branch missing');
  const code=ts.transpileModule(`function build(){${page.slice(start,end)}return query;}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const scope={autoScriptType:true,buildAdaptiveScriptPrompt,topic:s.topic,platform:'抖音',isAiDuration:true,finalDuration:'',
    profileInfo:'合成验收账号，一人手机拍摄。'+creationSettingsBlock(s),positioningInfo:'',originContent:s.userIntent,autoSetup:{settings:s},additionalInfo:requirements,currentSettings:s,
    scriptStructure:'auto',openingLine:s.openingLine,hookType:'auto',tactic:'AI推荐',AUTO_TACTIC:'AI推荐'};
  return new Function(...Object.keys(scope),code+'\nreturn build();')(...Object.values(scope));
}
const report:{time:string;scope:string;results:any[]}={time:new Date().toISOString(),scope:'正式Dify，合成材料，关闭联网，不写客户历史与会员账本；脚本使用实际页面组装分支',results:[]};
async function run(id:string,task:string,q:string,known=goal) {
  fs.writeFileSync(path.join(dir,id+'-prompt.txt'),q); const start=Date.now();
  console.log(JSON.stringify({id,started:true,promptChars:q.length}));
  try{
    const result=await askDify(q,'kaiwu-craft-synthetic-20261007-'+id,`${task} ${id === 'script_teaching' ? '衣柜开合空间准备' : settings.topic}`,{signal:AbortSignal.timeout(300000)});
    const row={id,task,ok:result.ok,elapsedMs:Date.now()-start,answer:result.ok?result.text:'',error:result.ok?null:result.message,
      factFlags:result.ok?unsupportedFacts(result.text,known):[],usage:result.ok?result.completion.usage:{}};
    report.results.push(row); fs.writeFileSync(path.join(dir,'正式模型验收.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({id,ok:row.ok,elapsedMs:row.elapsedMs,answerChars:row.answer.length,factFlags:row.factFlags,error:row.error}));
    return row.answer;
  }catch(e){report.results.push({id,ok:false,error:(e as Error).name});fs.writeFileSync(path.join(dir,'正式模型验收.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({id,ok:false,error:(e as Error).name}));return '';}
}
async function main(){
  const [script]=await Promise.all([
    run('script_interview','脚本生成',actualScriptQuery(settings,goal)),
    run('direction_single','创作方向',buildDirectionPrompt({purposes:[],customGoal:goal,formats:['visit'],count:3,depth:'full',profileSummary:'一人，手机和领夹麦',contextBlock:context})),
    run('script_teaching','脚本生成',actualScriptQuery({...settings,topic:'衣柜开合空间准备',userIntent:'用店内真实样柜向装修家庭演示，提前记录衣柜门与抽屉开合所需空间。不要街访，不编技术标准、顾客经历或免费服务。',focusContent:'用真实样柜演示衣柜开合空间准备',openingLine:'',audience:'准备装修的家庭'},'用店内样柜演示，教装修家庭怎么观察、记录与核对空间，不能编尺寸标准。')),
  ]);
  if(!script)return;
  const plain=extractPlainCopy(script)||script;
  await Promise.all([
    run('review_interview','审稿优化',buildReviewPrompt({draftContent:script,contextBlock:context,personalRequirements:'保留同一采访目的和已定开头。问题问得具体，加入有用追问，不编老板答案，不强加金句或营销动作。',platform:'抖音',duration:'AI推荐',scriptType:'',reviewDimensions:'采访深度、事实边界、共同对比口径',optimizationGoals:'更清楚、更有细节、更可执行',benchmarkScript:'',compareMode:true,severityLabels:true}),goal+'\n'+script),
    run('title_interview','标题封面',buildTitlePrompt({topic:settings.topic,contextBlock:context,sourceContent:script,titleTypeLabel:'AI推荐',titleFormulaValue:'auto',titleFormulaLabel:'AI推荐',keywordStrategyLabel:'AI推荐',keywordStrategyDesc:'按原稿与平台',platform:'抖音',targetAudience:settings.audience,count:3}),goal+'\n'+script),
    run('opening_interview','开篇钩子',buildOpeningPrompt({topic:settings.topic,contextBlock:context,currentOpening:settings.openingLine,count:3})+'\n已有参考：\n'+script+'\n所有候选保持同一门店前后对比与采访问题，不预设已经采到的结果。',goal+'\n'+script),
  ]);
  await Promise.all([
    run('storyboard_interview','分镜脚本',buildStoryboardPrompt({scriptContent:plain,contextBlock:context,platform:'抖音',duration:FOLLOW_SCRIPT,contentType:'auto',visualStyle:'bright',visualStyleLabel:'按现场自然记录',additionalInfo:'采访尚未进行，保留主持人主问与至少两条可用追问，受访者台词写按现场真实回答。需要先交代街道与门店环境，可用全景长镜头，不把未知受访者回答当作确定台词。'}),goal+'\n'+script),
    run('regenerate_same','自由对话',regenerationPrompt(goal)+'\n直接给这一条内容的主问、具体追问、记录与剪辑方案，保持同一主切口。'+creationSettingsBlock(settings)),
  ]);
}
main().catch(()=>{console.error('Probe failed; no credentials logged');process.exitCode=1;});
