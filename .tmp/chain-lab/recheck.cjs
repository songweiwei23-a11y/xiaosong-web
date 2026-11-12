/* 用修好的检查程序重新核对已经生成的链路输出（不调用模型）。 */
const fs = require('node:fs');
const path = require('node:path');
const b = require('./bundle.cjs');
const OUT = path.join(__dirname, 'out');
const chain = JSON.parse(fs.readFileSync(path.join(OUT, 'chain.json'), 'utf8'));
const profile = { profile_name: '测试_青禾家具店_链路验收', account_platform: ['抖音'], account_track: ['家居装修'], product_category: ['沙发', '床', '衣柜'], persona_facts: { yearsInTrade: '家具从业12年', yearsLocal: '来苏州3年', others: '门店开了2年；只卖家具，不承接装修' }, taboo_settings: { excluded: [] } };
const INTENT = '国庆过完这一周店里冷清了，进店的人少了一半。想拍几条视频把客人拉回来，但不想拍成甩卖降价';
const CONSTRAINTS = '只有店主一个人，用手机拍，不请演员；视频 30 秒；不降价、不甩卖、不做促销打折；只用档案里已有的事实，没有的数字、客户经历、经营承诺不要编。';
const rows = [
  ['direction', '创作方向', chain.stages.direction.answer, INTENT],
  ['script', '脚本生成', chain.stages.script.answer, `${INTENT}\n${CONSTRAINTS}`],
  ['review', '审稿优化', chain.stages.review.answer, `${INTENT}\n${CONSTRAINTS}`],
  ['storyboard', '分镜脚本', chain.stages.storyboard.answer, `${INTENT}\n${CONSTRAINTS}`],
];
for (const [key, task, output, source] of rows) {
  const r = b.runQualityChecks({ output, taskType: task, profile, source });
  const before = chain.checks[key];
  console.log(`== ${task}: 修前 ${before.passed ? '过' : '不过'}(${before.issues.length}条) → 修后 ${r.passed ? '过' : '不过'}(${r.issues.length}条)`);
  for (const i of r.issues) console.log(`   [${i.kind}] ${String(i.detail).slice(0, 110)}`);
}
