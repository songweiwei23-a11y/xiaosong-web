import fs from 'node:fs';
import { buildReviewPrompt, personalRequirementsReminder } from '../lib/review-standards';
import { buildSearchQuery } from '../lib/search-query';
import { reviewVerificationPrompt } from '../lib/review-verification';
const dir='.tmp/quality-regression_20261008';
const input=JSON.parse(fs.readFileSync(dir+'/owner-review-history.private.json','utf8'))[0].input_data;
const original=fs.readFileSync(dir+'/latest-review-query-rendered.private.txt','utf8');
const context=original.slice(original.indexOf('📇 账号背景'),original.indexOf('📄 待审稿件'))
 .replace('审稿时按这个账号的标准判：语气对不对得上、说的是不是这群人关心的、有没有踩到上面的禁忌。','审稿先按当前稿件与本轮要求判断：保留作者声音，核对事实与禁忌；账号长期人群、业务与风格仅作背景，不能把本条观察记录强改成面向老板的获客内容。')
 .replace('⚠️ 以上是这个账号确定下来的创作方向，产出必须与它一致，不要另起炉灶。','以上是账号的长期创作背景，用于辅助理解人设、语气、事实与禁忌。本条的主题、人群、目的和表达以当前原稿及用户明确要求为准；不能用长期商业定位替换本次观察、讨论或其他内容目的。围绕用户当前选择深化，不要另起炉灶。');
for(const [id,duration] of [['explicit90','1分30秒'],['explicit30','30秒以内']]) {
 const personalRequirements=input.personalRequirements.replace('1-30秒',duration);
 const query=buildReviewPrompt({...input,duration,personalRequirements,contextBlock:context,reviewDimensions:'',optimizationGoals:'提升开头吸引力、增强情绪共鸣、优化口播节奏、加强画面感、去除营销腔、扩充内容',benchmarkScript:'',compareMode:true,severityLabels:true})+personalRequirementsReminder(personalRequirements);
 const search=buildSearchQuery('审稿优化',{platform:input.platform,scriptType:input.scriptType,reviewFocus:personalRequirements},query);
 fs.writeFileSync(dir+'/'+id+'-prompt.private.txt',query);
 fs.writeFileSync(dir+'/'+id+'-search.private.txt',search);
 console.log(JSON.stringify({id,queryChars:query.length,scope:'两种明确时长的对照夹具；不代表用户已确认时长'}));
}
const candidatePath=dir+'/failed-explicit90-candidate.private.md';
if(fs.existsSync(candidatePath)) fs.writeFileSync(dir+'/verification-prompt.private.txt',reviewVerificationPrompt(input.draftContent,input.personalRequirements.replace('1-30秒','1分30秒'),fs.readFileSync(candidatePath,'utf8')));
