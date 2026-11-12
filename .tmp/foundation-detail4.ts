// 按 任务 × 版本 × 问题类型 统计 eval4 的质检问题（只读，不调用模型）。
// 把「广告法用词」（taboo）和「素材里没有的事实」（facts）分开，编造数里混着的广告法词不算编造。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE } from '../lib/quality-regression';
import { runQualityChecks } from '../lib/quality-checks';

const ROOT = process.argv[2];
const POSITIONING = '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。';
const CONTENT = '## 内容定位（长期拍什么）\n- 系列A「烧烤做法」：目的人设。拍刷料、穿串、备料，讲清做法的讲究。\n- 系列B「到店实拍」：目的变现。拍客人点餐、结账、小票，金额用占位。\n- 系列C「夜宵日常」：目的流量。拍南乐夜里的烟火气，结尾只留关注或评论。\n排除：公益营销、直播规划、教学型做法教程。';
const BUSINESS = '## 商业定位（成交路径）\n1. 刷到视频，记住「南乐 + 位置或时间」\n2. 评论区问地址，或导航搜店名\n3. 到店点餐，结账时看到小票价格\n4. 复购靠老客户转介绍\n信任依据：主厨 9 年川菜经验，食材当日采购。';
const SCRIPT = '## 开头\n南乐县城的川味地摊，下班路过就能吃上一口。\n## 正文\n一块钱一串，串串现穿现烫，锅底是我按成都的做法熬的，主厨做川菜9年。\n食材当天进货，价格摆在明面上，吃多少算多少。\n## 结尾\n位置放在评论区，想来的直接问。';
const material = [JSON.stringify(REGRESSION_PROFILE), POSITIONING, CONTENT, BUSINESS, SCRIPT].join('\n');

const CHECK_TASK: Record<string, string> = { storyboard: '分镜脚本', title: '标题封面', review: '审稿优化' };
const rows = JSON.parse(fs.readFileSync(`${ROOT}/foundation/results4.json`, 'utf8')) as { arm: string; task: string; rep: number; output: string }[];
const tally: Record<string, Record<string, number>> = {};
const facts: string[] = [];
for (const r of rows) {
  const issues = runQualityChecks({ output: r.output, profile: REGRESSION_PROFILE, mix: null, taskType: CHECK_TASK[r.task], source: material }).issues
    .filter((i) => !i.detail.includes('缺少标签') && !i.detail.includes('模型自称'));
  for (const i of issues) {
    const key = `${r.task} ${r.arm}`;
    tally[key] ||= {};
    tally[key][i.kind] = (tally[key][i.kind] ?? 0) + 1;
    if (i.kind !== 'taboo') facts.push(`${r.task} ${r.arm} #${r.rep} [${i.kind}] ${i.detail.slice(0, 110)}`);
  }
}
console.log(JSON.stringify(tally, null, 2));
console.log(facts.join('\n'));
