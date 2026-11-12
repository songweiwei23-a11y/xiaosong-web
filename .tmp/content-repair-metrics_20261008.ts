import fs from 'node:fs';
import {businessLines} from '../lib/profile-summary';
import {businessLines as oldLines} from './content-audit-production_20261008/lib/profile-summary';
import {splitCreationItems} from '../lib/creation-items';
import {splitCreationItems as oldItems} from './content-audit-production_20261008/lib/creation-items';
import {reconcileTitleCounts,reconcileReviewScores,hasObviousCutoff} from '../lib/result-reconciliation';
const root='docs/全板块质量修复_20261008';
const prior='docs/全创作板块实测_20261008';
const read=(name:string)=>fs.readFileSync(`${prior}/${name}`,'utf8');
const review=read('网页实测/审稿_可见正文.md').split('\n').map(line=>line.includes('\t')?`|${line.replace(/\t/g,'|')}|`:line).join('\n');
const title=read('网页实测/标题_可见正文.md');
fs.writeFileSync(root+'/原失败样本_审稿统计修正.md',reconcileReviewScores(review));
fs.writeFileSync(root+'/原失败样本_标题统计修正.md',reconcileTitleCounts(title));
const profile={product_category:['沙发','床','衣柜','沙发、床、衣柜'],account_track:['家居家装']};
let breakdown=read('网页实测/拆文案_可见正文.md');
for(const h of read('网页实测/拆文案_完成.txt').matchAll(/- heading "(.+)" \[level=(\d)\]/g)) breakdown=breakdown.split('\n').map(line=>line.trim()===h[1]?`${'#'.repeat(Number(h[2]))} ${line}`:line).join('\n');
fs.writeFileSync(root+'/网页拆解_按实际DOM标题恢复.md',breakdown);
const regression=JSON.parse(fs.readFileSync('.tmp/content-repair-tests-release_20261008.json','utf8'));
const metrics={scope:'针对已定位缺陷的回放与正式模型校对，不能代表全平台文案质量、创意、流量或长期稳定性提升百分比',
  review:{sampleCount:1,before:{dimensionsSum:92,reportedTotal:82},after:{dimensionsSum:92,reportedTotal:92},note:'只修正算术，分项评价不变，不把8.2变9.2解释成原稿质量提升'},
  titleCounts:{sampleCount:3,before:[22,23,23],after:[19,19,20],correctBefore:0,correctAfter:3,unit:'不含标点和空格的Unicode字母与数字'},
  businessLines:{fixture:profile,before:oldLines(profile),after:businessLines(profile)},
  analysisSelection:{sampleCount:1,before:oldItems(breakdown).items.map(x=>({label:x.label,kind:x.kind})),after:splitCreationItems(breakdown).items},
  cutoff:{sampleCount:1,observedHasEndEvent:true,beforeAccepted:true,afterRejected:hasObviousCutoff(read('模型原始记录/14_script_interview_输出.md')),scope:'极窄的未写完结构标签识别，不是通用完整性验证'},
  pendingInterviewTitles:{batches:2,titleCount:6,beforeStateCompatible:2,afterStateCompatible:6,deltaPercentagePoints:66.7,scope:'两份已生成失败产物进行独立校对回放；只评价尚未采访状态兼容，不代表标题综合质量或点击率'},
  remixCount:{sampleCount:1,requested:1,before:2,after:1,scope:'仅数量通过；未以此认定其内容事实和镜头资源全部合格'},
  unitTests:{files:regression.testResults.length,passed:regression.numPassedTests,total:regression.numTotalTests,failed:regression.numFailedTests},
  release:{candidateBuild:'i-_ar1_VNXMmSW7YiCveb',observedCurrentBuild:'VF2jcy8WLgiU0KsNJIvez',candidateSourceFiles:10,status:'awaiting_explicit_production_cutover_approval',reason:'自动审批拒绝生产切换；已通过候选构建与运行健康检查；未运行切换脚本，Dify未变更'},
};
fs.writeFileSync(root+'/量化验收.json',JSON.stringify(metrics,null,2));
console.log(JSON.stringify(metrics,null,2));
