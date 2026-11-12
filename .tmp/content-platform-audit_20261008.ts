import fs from 'node:fs';
import ts from 'typescript';
import { askDify } from './content-audit-production_20261008/lib/dify-task';
import { buildPositioningPrompt } from './content-audit-production_20261008/lib/positioning-standards';
import { buildBriefPrompt, briefCompleteness } from './content-audit-production_20261008/lib/creative-brief';
import { buildDirectionPrompt } from './content-audit-production_20261008/lib/direction';
import { buildAdaptiveScriptPrompt } from './content-audit-production_20261008/lib/script-design';
import { buildReviewPrompt } from './content-audit-production_20261008/lib/review-standards';
import { reviewVerificationPrompt, reconcileReviewSpeechStats, combinedReviewUsage } from './content-audit-production_20261008/lib/review-verification';
import { buildTitlePrompt } from './content-audit-production_20261008/lib/title-standards';
import { buildStoryboardPrompt, auditStoryboard } from './content-audit-production_20261008/lib/storyboard-standards';
import * as growth from './content-audit-production_20261008/lib/growth-standards';
import { buildTextBreakdownPrompt } from './content-audit-production_20261008/lib/text-breakdown';
import { buildRemixPrompt, splitRemixPlans } from './content-audit-production_20261008/lib/remix';
import { buildDealReasonPrompt, parseDealReasons } from './content-audit-production_20261008/lib/deal-reasons';
import { buildExtractionPrompt, parseExtraction, buildCheckPrompt, applyCheck } from './content-audit-production_20261008/lib/interview-import';
import { buildContextBlock, describeExecutionConstraints } from './content-audit-production_20261008/lib/creator-context';
import { buildProfileSummary } from './content-audit-production_20261008/lib/profile-summary';
import { extractPlainCopy } from './content-audit-production_20261008/lib/script-copy';
import { estimateSpeechStats } from './content-audit-production_20261008/lib/script-result-utils';
import { creationSettingsBlock } from './content-audit-production_20261008/lib/creation-settings';
import * as topicMethods from './content-audit-production_20261008/lib/topic-design';
import * as routes from './content-audit-production_20261008/lib/creative-routes';
import * as roles from './content-audit-production_20261008/lib/content-roles';
import * as elements from './content-audit-production_20261008/lib/viral-elements';
import * as continuation from './content-audit-production_20261008/lib/creation-continuation';
import { ALL_DEAL_REASONS } from './content-audit-production_20261008/app/dashboard/topic/constants';
import { splitTopicSections, buildNoRepeatBlock } from './content-audit-production_20261008/lib/topic-library';
import { taboosPromptBlock } from './content-audit-production_20261008/lib/taboos';

for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
const dir='docs/全创作板块实测_20261008';fs.mkdirSync(dir+'/模型原始记录',{recursive:true});
const profile:any={id:'00000000-0000-4000-8000-000000000108',profile_name:'测试_青禾家具店',account_platform:['抖音'],account_track:['家居家装'],account_stage:'刚起号，定位未确定',fans_level:'0-1000',target_region:['本地县城'],target_age:['25-35岁','35-45岁'],target_pain_points:'担心家具买回去挡门、尺寸不合适；看图片无法判断摆进自己家的效果',target_needs:'到店试坐，看真实样柜开门和拉抽屉；买之前知道该量哪些地方',content_style:['接地气'],content_tone:'自然平实，不说教，不用夸张方言',team_structure:'老板一个人',equipment:['手机'],shooting_location:['家具展厅'],editing_capability:'手机基础剪辑',video_duration:['30秒','60秒'],product_category:['沙发','床','衣柜'],monetization_model:['到店消费'],unique_selling_point:'展厅有可供演示的真实样柜和沙发，老板愿意现场讲解选购注意点',content_restrictions:'不能说最低价、全县第一、百分百环保；没有提供尺寸标准、折扣、销量、客户案例或售后承诺，不能补造；只有手机，一人拍摄，不安排顾客配合表演',interview_highlights:'老板说：先看家里门能不能开，再看柜子摆得好不好看。'};
const ctx:any={profile,positioning:null,dealReasons:[],brief:null};
const summary=buildProfileSummary(profile);
const interviewSource='【虚构测试前采】我们叫青禾家具店，卖沙发、床和衣柜，主要想让本县正在装修的人来展厅看看。视频由我一个人拍，只有手机，做基础剪辑。展厅有样柜，能开柜门和拉抽屉，也能试坐沙发。我现在刚开始做抖音，粉丝不到一千。顾客常担心尺寸买错，我一般会说先看家里门能不能开，再看柜子摆得好不好看。具体做了多少年这次不说，价格、销量、环保等级、免费服务和售后政策都没核实，别替我填。';
const rawDraft='买衣柜前，先别急着看颜色。今天就在店里这个样柜上看一眼：柜门打开后，要占到哪儿；抽屉拉出来，前面还剩多少位置。把自己家的门、床和过道位置记下来，到店对着样柜试一试。款式喜欢，还得在自己家用得顺手。';
const furnitureIntent='给正在装修的本地家庭演示：挑衣柜时要观察柜门与抽屉打开后的位置。用已有样柜，一个人手机拍，30秒以内，口语自然，不编厘米标准、不说免费上门、不虚构客户经历。';
const streetIntent='模拟一个县城编导，计划采访同一条街的商家，比较国庆前后生意变化和老板真实感受。尚未采访，没有回答、收入数字或账本。给全国实体店老板看，不是代运营获客广告。一个人手机，90秒以内。';
const streetContext='虚构测试账号：县城编导，日常服务本地商家老板，但本条用于公共观察讨论；一人手机，未安排助手；尚未采访，没有实录和已知答案。';
const settings:any={topic:'买衣柜前先看门与抽屉打开的位置',userIntent:furnitureIntent,focusContent:furnitureIntent,purpose:'流量型',audience:'本地正在装修的家庭',device:'手机',personnel:'一人',duration:'30秒'};
let report:any={time:new Date().toISOString(),productionBuild:'VF2jcy8WLgiU0KsNJIvez',scope:'当前生产源码快照的真实提示词构造器 + 正式Dify模型调用；全部为虚构测试材料，关闭联网，不写客户历史或会员账本；页面操作记录另外保存，不冒充浏览器端到端',profile,fixtures:{interviewSource,rawDraft,furnitureIntent,streetIntent},results:[]};
function save(){fs.writeFileSync(dir+'/正式模型实测.json',JSON.stringify(report,null,2));}
const answers:Record<string,string>={};
if(process.argv.includes('--resume')){
 report=JSON.parse(fs.readFileSync(dir+'/正式模型实测.json','utf8'));
 for(const row of report.results)if(row.ok)answers[row.id]=row.answer;
 const quickPath=dir+'/账号定位默认快速版实测.json';
 if(fs.existsSync(quickPath)){const q=JSON.parse(fs.readFileSync(quickPath,'utf8'));if(q.ok)answers['02_positioning']=q.answer;}
}
async function run(id:string,board:string,query:string,search:string,options:{review?:boolean;source?:string;requirements?:string}={}){
 const existing=report.results.find((x:any)=>x.id===id);if(existing)return existing.ok?existing.answer:'';
 fs.writeFileSync(dir+'/模型原始记录/'+id+'_输入.txt',query);const start=Date.now();console.log(JSON.stringify({id,board,started:true,promptChars:query.length}));
 try{
  const draft=await askDify(query,'kaiwu-platform-audit-synthetic-20261008-'+id,search,{signal:AbortSignal.timeout(300000)});
  if(!draft.ok)throw Error(draft.message);
  let text=draft.text,usage=draft.completion.usage;
  if(options.review){fs.writeFileSync(dir+'/模型原始记录/'+id+'_未校对初稿.md',text);const verified=await askDify(reviewVerificationPrompt(options.source||'',options.requirements||'',text),'kaiwu-platform-audit-synthetic-20261008-'+id,'审稿 原稿事实校对',{signal:AbortSignal.timeout(180000)});if(!verified.ok)throw Error(verified.message);text=reconcileReviewSpeechStats(verified.text);usage=combinedReviewUsage(usage||{},verified.completion.usage||{});}
  const copy=extractPlainCopy(text);const row:any={id,board,ok:true,elapsedMs:Date.now()-start,promptChars:query.length,answerChars:text.length,answer:text,copy,stats:copy?estimateSpeechStats(copy):null,usage};
  if(board==='选题策划')row.parsedItems=splitTopicSections(text).length;
  if(board==='开篇设计')row.parsedItems=growth.parseOpenings(text).length;
  if(board==='创作简报')row.completeness=briefCompleteness(text);
  if(board==='成交理由')row.parsedReasons=parseDealReasons(text);
  if(board==='分镜脚本')row.storyboardAudit=auditStoryboard(text,'30秒',options.source||'');
  answers[id]=text;report.results.push(row);fs.writeFileSync(dir+'/模型原始记录/'+id+'_输出.md',text);save();console.log(JSON.stringify({...row,answer:undefined,copy:undefined,usage:undefined,parsedReasons:undefined}));return text;
 }catch(e){const row={id,board,ok:false,elapsedMs:Date.now()-start,error:(e as Error).message};report.results.push(row);save();console.log(JSON.stringify(row));return '';}
}
async function group(tasks:Array<()=>Promise<any>>){for(let i=0;i<tasks.length;i+=3)await Promise.allSettled(tasks.slice(i,i+3).map(fn=>fn()));}
function topicQuery(count:number,prior:string[]=[]){
 const page=fs.readFileSync('.tmp/content-audit-production_20261008/app/dashboard/topic/page.tsx','utf8');const start=page.indexOf('let query = `【工作任务】');const end=page.indexOf('const response = await fetchGeneration',start);
 if(start<0||end<0)throw Error('Production topic builder missing');
 const code=ts.transpileModule('function build(){'+page.slice(start,end)+'return query;}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const scope:any={...topicMethods,...routes,...roles,...elements,...growth,...continuation,ALL_DEAL_REASONS,describeExecutionConstraints,creationSettingsBlock,taboosPromptBlock,
 topicCount:count,topicType:'短视频选题',sourceReference:'',personalRequirement:furnitureIntent,currentSettings:settings,selectedProfile:profile,incomingSetup:null,sourceFrom:'',mode:'quick',topicContext:buildContextBlock(ctx,'topic'),customModeContext:'',accountStage:profile.account_stage,fansLevel:profile.fans_level,avgViewsInput:'',selectedPlatforms:['抖音'],selectedTracks:['家居家装'],selectedContentTypes:[],selectedStyles:['接地气'],positioningExtra:'',selectedViralElements:[],selectedElements:[],topicRole:'流量型',selectedDealReasons:[],setMixUsed:()=>{},keyword1:'衣柜开合空间',keyword2:'',keyword3:'',benchmarkAccounts:'',viralCases:'',difficulty:'简单易懂',withHook:true,tactic:'',route:'两种都出',routeExplicit:false,extractRelevantPositioningInfo:(v:string)=>v};
 const query=new Function(...Object.keys(scope),code+'\nreturn build();')(...Object.values(scope));return query+creationSettingsBlock(settings)+buildNoRepeatBlock(prior);
}
async function main(){
 const topic=topicQuery(3); // 构造错误要在首次模型调用前暴露
 await group([
 ()=>run('01_interview_extract','前采建档',buildExtractionPrompt(interviewSource),'前采建档 家具店'),
 ()=>run('02_positioning','账号定位',buildPositioningPrompt({profileSummary:summary,platform:'抖音',restrictions:profile.content_restrictions,focus:'full',additionalNotes:'只基于已提供资料制定可执行方案。经营年限、价格、销量没有确认。'}),'家具实体店 账号定位 人设 用户'),
 ()=>run('03_direction','创作方向',buildDirectionPrompt({purposes:[],customGoal:furnitureIntent,formats:['demo'],count:3,depth:'full',profileSummary:summary,contextBlock:buildContextBlock(ctx,'direction')}),'衣柜开合空间 创作方向'),
 ()=>run('04_breakdown_text','拆解爆款',buildTextBreakdownPrompt(rawDraft,buildContextBlock(ctx,'breakdown'),settings),'家具选购 文案结构 拆解'),
 ()=>run('05_freechat','高阶自由','【高阶自由对话】'+streetContext+'\n'+streetIntent+'\n请帮我设计采访方案：给出共同主问、根据不同回答继续追问的办法、现场记录口径，以及采访后怎样组织成一条片子。','县城门店 国庆前后 生意对比 采访'),
 ()=>run('06_knowledge','知识库查询','请从编导知识库中查询并回答：教知识型脚本和晒过程型脚本分别适合什么内容？请给出结构方法及可定位的知识库依据，并用家具展厅一个人手机演示柜门开合举例。知识库没有的明确说明。'+buildContextBlock(ctx,'knowledge'),'教知识型 晒过程型 结构方法 火车节'),
 ]);
 if(answers['02_positioning'])ctx.positioning={name:'测试家具号定位',summary:answers['02_positioning'].slice(0,2000),full:answers['02_positioning']};
 await group([
 ()=>run('07_business','商业定位',buildPositioningPrompt({profileSummary:summary,platform:'抖音',restrictions:profile.content_restrictions,focus:'business',baseline:answers['02_positioning']}),'家具店 商业定位 到店转化'),
 ()=>run('08_content','内容定位',buildPositioningPrompt({profileSummary:summary,platform:'抖音',restrictions:profile.content_restrictions,focus:'content',baseline:answers['02_positioning']}),'家具店 内容定位 系列 配比'),
 ()=>run('09_deal','成交理由',buildDealReasonPrompt({accountContext:buildContextBlock(ctx,'dealReason'),storeName:'测试_青禾家具店',storeType:'家具家居',storeFeatures:profile.unique_selling_point+'；'+profile.content_restrictions,targetCustomer:'本地正在装修的家庭'}),'家具店 成交理由 真实证据'),
 ()=>run('10_topic','选题策划',topic,'衣柜开合空间 本地装修家庭 选题'),
 ]);
 await group([
 ()=>run('11_brief','创作简报',buildBriefPrompt({positioningFull:answers['02_positioning'],profileSummary:summary,businessPositioning:answers['07_business'],contentPositioning:answers['08_content'],notes:'缺少证据的经营事实和服务承诺必须保持待确认，不要把方案建议写成店铺已经具备的事实。'}),'家具店 创作简报 口吻 人群'),
 ()=>run('12_growth','起号打法',growth.buildGrowthPlanPrompt({contextBlock:buildContextBlock(ctx,'growth'),contentPlan:answers['08_content'],restrictions:profile.content_restrictions,notes:'一个人手机，每周只能抽两个小时集中拍摄，先做可持续的系列，不承诺涨粉数量。'}),'家具店 起号打法 一人手机'),
 ()=>run('13_script30','脚本生成',buildAdaptiveScriptPrompt({topic:settings.topic,platform:'抖音',duration:'30秒以内',context:buildContextBlock(ctx,'script'),source:rawDraft,requirements:furnitureIntent,settings,scriptTypeGuide:'教知识型：提出问题→用现场样柜演示→给可执行检查方法',craftFocus:'现场演示、口语化、拍起来简单'}),'衣柜开合空间 教知识 演示'),
 ()=>run('14_script_interview','脚本生成',buildAdaptiveScriptPrompt({topic:'国庆前后门店生意对比',platform:'抖音',duration:'90秒以内',context:streetContext,source:streetIntent,requirements:'采访尚未完成，问题具体，有共同对比口径，不预写商家回答。开头逐字保留：国庆前后，这条街上的生意到底有什么变化？',settings:{topic:'国庆前后门店生意对比',userIntent:streetIntent,audience:'全国实体店老板',purpose:'流量型',openingLine:'国庆前后，这条街上的生意到底有什么变化？'}}),'国庆前后 门店生意 采访主问 追问'),
 ]);
 if(answers['11_brief']){ctx.brief=answers['11_brief'];ctx.briefAt=new Date().toISOString();}
 await group([
 ()=>run('15_opening','开篇设计',growth.buildOpeningPrompt({topic:settings.topic,contextBlock:buildContextBlock(ctx,'script')+creationSettingsBlock(settings),currentOpening:rawDraft}),'衣柜开合空间 开篇钩子'),
 ()=>run('16_review','审稿优化',buildReviewPrompt({draftContent:rawDraft,contextBlock:buildContextBlock(ctx,'review'),personalRequirements:furnitureIntent,platform:'抖音',duration:'30秒以内',scriptType:'教知识型',reviewDimensions:'逻辑是否清晰、画面是否具体、是否口语化',optimizationGoals:'更清楚、更容易拍摄',benchmarkScript:'',compareMode:true,severityLabels:true}),'家具样柜 审稿优化 事实边界',{review:true,source:rawDraft,requirements:furnitureIntent}),
 ()=>run('17_title','标题封面',buildTitlePrompt({topic:settings.topic,contextBlock:buildContextBlock(ctx,'title'),sourceContent:answers['13_script30']||rawDraft,titleTypeLabel:'AI推荐',titleFormulaValue:'auto',titleFormulaLabel:'AI推荐',keywordStrategyLabel:'AI推荐',keywordStrategyDesc:'按真实内容，不夸张未知损失',platform:'抖音',targetAudience:'本地装修家庭',count:3}),'衣柜开合空间 标题封面'),
 ()=>run('18_storyboard','分镜脚本',buildStoryboardPrompt({scriptContent:extractPlainCopy(answers['13_script30'])||rawDraft,contextBlock:buildContextBlock(ctx,'storyboard'),platform:'抖音',duration:'30秒',contentType:'auto',visualStyle:'bright',visualStyleLabel:'展厅现有光线自然演示',additionalInfo:'一人手机，没有助手，只拍现有样柜。台词与原稿逐字一致，不增加客户或未知尺寸标准。'}),'家具样柜 分镜 一人手机 30秒',{source:extractPlainCopy(answers['13_script30'])||rawDraft}),
 ()=>run('19_remix','跨行业二创',buildRemixPrompt({kind:'paste',industry:'餐饮',title:'虚构测试：点菜先看人数',text:'点菜前，先别急着看招牌。今天拿店里这套餐具看一眼：两个人吃，桌上能摆多少盘；再多点一道，位置还够不够。把自己来几个人、想吃什么记下来。菜喜欢，也得吃得完。'}, {layers:['opening','structure','presentation'],count:2,differentiate:'form',depth:'full',role:'流量型',duration:'30 秒',outputs:['script','shots','shootPlan','titles'],profileSummary:summary,store:{name:profile.profile_name,lines:['沙发','床','衣柜'],track:'家居家装'},contextBlock:buildContextBlock(ctx,'remix'),restrictions:profile.content_restrictions,notes:'只借表达机制，不把原行业的经历、效果、数字搬来；两方案一个样柜演示，一个沙发选购观察。'}),'跨行业二创 家具 演示 结构'),
 ]);
 await group([
 ()=>run('20_topic_repeat','选题策划',topicQuery(3,splitTopicSections(answers['10_topic']||'').map(x=>x.title)),'衣柜开合空间 第二批不同选题'),
 ()=>run('21_interview_titles','标题封面',buildTitlePrompt({topic:'国庆前后门店生意对比',contextBlock:streetContext,sourceContent:answers['14_script_interview']||streetIntent,titleTypeLabel:'AI推荐',titleFormulaValue:'auto',titleFormulaLabel:'AI推荐',keywordStrategyLabel:'AI推荐',keywordStrategyDesc:'不把采访计划写成完成的采访或已知结论',platform:'抖音',targetAudience:'全国实体店老板',count:3}),'国庆前后 门店生意 采访计划 标题'),
 ]);
 save();console.log(JSON.stringify({finished:true,total:report.results.length,ok:report.results.filter((x:any)=>x.ok).length}));
}
main().catch(e=>{console.error('HARNESS_FAILED '+e.message);process.exitCode=1;});
