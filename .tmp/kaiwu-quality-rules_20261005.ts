import fs from 'node:fs';
import {unsupportedFacts,runQualityChecks,reviewedQualityOutput} from '../lib/quality-checks';
import {regressionCases,REGRESSION_PROFILE} from '../lib/quality-regression';
import {resolveMix} from '../lib/content-mix';
const native=JSON.parse(fs.readFileSync('.tmp/kaiwu-quality-native_20261005.json','utf8'));
const cases=regressionCases();
native.results.forEach((r:any,i:number)=>{const c=cases[i];r.quality=runQualityChecks({output:r.answer,profile:c.profile||REGRESSION_PROFILE,taskType:r.task,source:c.query,...(c.mixCount?{mix:{resolved:resolveMix(c.profile||REGRESSION_PROFILE),count:c.mixCount}}:{})});});
fs.writeFileSync('.tmp/kaiwu-quality-native_20261005.json',JSON.stringify(native,null,2));
const result={
 borrowedNumber:unsupportedFacts('这款产品38元。','老板从业38年；没有任何价格资料。'),
 unsupportedPercent:unsupportedFacts('90%的业主第一步就错了。','没有提供任何统计资料。'),
 placeFalsePositive:unsupportedFacts('指着挂衣区讲解。','定制衣柜'),
 angleFalsePositive:runQualityChecks({output:'把柜门打开到最大角度。',profile:null,taskType:'分镜脚本'}),
 reviewBodyChars:reviewedQualityOutput(native.results.find((r:any)=>r.id==='R2').answer).length,
 nativeQuality:native.results.map((r:any)=>({id:r.id,quality:r.quality}))
};
console.log(JSON.stringify(result));
fs.writeFileSync('.tmp/kaiwu-quality-rules_20261005.json',JSON.stringify(result,null,2));
