// 分镜、审稿、标题的离线评估：编造数（素材口径：档案 + 定位 + 内容 + 商业 + 输入的脚本；审稿的草稿不算素材）、审稿埋题命中数。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE } from '../lib/quality-regression';
import { runQualityChecks } from '../lib/quality-checks';

const ROOT = process.argv[2];
const POSITIONING = '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。';
const CONTENT = '## 内容定位（长期拍什么）\n- 系列A「烧烤做法」：目的人设。拍刷料、穿串、备料，讲清做法的讲究。\n- 系列B「到店实拍」：目的变现。拍客人点餐、结账、小票，金额用占位。\n- 系列C「夜宵日常」：目的流量。拍南乐夜里的烟火气，结尾只留关注或评论。\n排除：公益营销、直播规划、教学型做法教程。';
const BUSINESS = '## 商业定位（成交路径）\n1. 刷到视频，记住「南乐 + 位置或时间」\n2. 评论区问地址，或导航搜店名\n3. 到店点餐，结账时看到小票价格\n4. 复购靠老客户转介绍\n信任依据：主厨 9 年川菜经验，食材当日采购。';
const SCRIPT = '## 开头\n南乐县城的川味地摊，下班路过就能吃上一口。\n## 正文\n一块钱一串，串串现穿现烫，锅底是我按成都的做法熬的，主厨做川菜9年。\n食材当天进货，价格摆在明面上，吃多少算多少。\n## 结尾\n位置放在评论区，想来的直接问。';
const material = [JSON.stringify(REGRESSION_PROFILE), POSITIONING, CONTENT, BUSINESS, SCRIPT].join('\n');

const TIME_RE = /(?:(?:凌晨|早上|早晨|上午|中午|下午|晚上|傍晚|夜里|早|晚)\s*(?:[一二三四五六七八九十]|\d{1,2})\s*点(?:半|钟)?)|(?:(?:[一二三四五六七八九十]|\d{1,2})\s*点(?:半|钟)?(?=\s*(?:开|出|收|关|到|起|去|回|进|拿|备|就|左右|以后|之前)))/g;
const QUOTE_RE = /(?:客人|顾客|老客户|有个学生|一个大哥|有位)[^“"\n]{0,10}?(?:说|问|讲|回|夸)[：:]?\s*[“"]/g;
const PLANTED: Array<[string, RegExp]> = [
  ['最好（广告法）', /最好/],
  ['公益（档案排除）', /公益/],
  ['直播（档案排除）', /直播/],
  ['早上六点（素材没有）', /六点|6点/],
  ['人均两三块（素材没有）', /两三块|人均/],
];
const CHECK_TASK: Record<string, string> = { storyboard: '分镜脚本', title: '标题封面', review: '审稿优化' };

const rows = JSON.parse(fs.readFileSync(`${ROOT}/foundation/results4.json`, 'utf8')) as { arm: string; task: string; rep: number; output: string }[];
const out = rows.map((r) => {
  const checks = runQualityChecks({ output: r.output, profile: REGRESSION_PROFILE, mix: null, taskType: CHECK_TASK[r.task], source: material })
    .issues.filter((i) => !i.detail.includes('缺少标签') && !i.detail.includes('模型自称'));
  const times = (r.output.match(TIME_RE) ?? []).filter((h) => !material.includes(h.replace(/\s/g, '')) && !material.includes(h));
  const quotes = r.output.match(QUOTE_RE) ?? [];
  const caught = PLANTED.filter(([, re]) => re.test(r.output)).map(([name]) => name);
  return {
    arm: r.arm, task: r.task, rep: r.rep, len: r.output.length,
    fabrications: checks.length + times.length + quotes.length,
    checkFacts: checks.length, timeClaims: times.length, customerQuotes: quotes.length,
    plantedCaught: caught.length, plantedNames: caught,
  };
});
const summary: Record<string, { n: number; fabrications: number; plantedCaught: number }> = {};
for (const e of out) {
  const key = `${e.arm} ${e.task}`;
  summary[key] ||= { n: 0, fabrications: 0, plantedCaught: 0 };
  summary[key].n += 1;
  summary[key].fabrications += e.fabrications;
  summary[key].plantedCaught += e.plantedCaught;
}
fs.writeFileSync(`${ROOT}/foundation/eval4.json`, JSON.stringify({ rows: out, summary }, null, 2));
console.log(JSON.stringify(summary, null, 2));
