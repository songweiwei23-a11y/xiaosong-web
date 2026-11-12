// 创作方向对照的离线评估（不调用模型）：编造数（素材口径与前面一致）、配比问题。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE } from '../lib/quality-regression';
import { runQualityChecks } from '../lib/quality-checks';
import { resolveMix } from '../lib/content-mix';

const ROOT = process.argv[2];
const POSITIONING = '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。';
const CONTENT = '## 内容定位（长期拍什么）\n- 系列A「烧烤做法」：目的人设。拍刷料、穿串、备料，讲清做法的讲究。\n- 系列B「到店实拍」：目的变现。拍客人点餐、结账、小票，金额用占位。\n- 系列C「夜宵日常」：目的流量。拍南乐夜里的烟火气，结尾只留关注或评论。\n排除：公益营销、直播规划、教学型做法教程。';
const BUSINESS = '## 商业定位（成交路径）\n1. 刷到视频，记住「南乐 + 位置或时间」\n2. 评论区问地址，或导航搜店名\n3. 到店点餐，结账时看到小票价格\n4. 复购靠老客户转介绍\n信任依据：主厨 9 年川菜经验，食材当日采购。';
const material = [JSON.stringify(REGRESSION_PROFILE), POSITIONING, CONTENT, BUSINESS].join('\n');
const mix = resolveMix(REGRESSION_PROFILE as unknown as Parameters<typeof resolveMix>[0]);

const TIME_RE = /(?:(?:凌晨|早上|早晨|上午|中午|下午|晚上|傍晚|夜里|早|晚)\s*(?:[一二三四五六七八九十]|\d{1,2})\s*点(?:半|钟)?)|(?:(?:[一二三四五六七八九十]|\d{1,2})\s*点(?:半|钟)?(?=\s*(?:开|出|收|关|到|起|去|回|进|拿|备|就|左右|以后|之前)))/g;
const QUOTE_RE = /(?:客人|顾客|老客户|有个学生|一个大哥|有位)[^“"\n]{0,10}?(?:说|问|讲|回|夸)[：:]?\s*[“"]/g;

const rows = JSON.parse(fs.readFileSync(`${ROOT}/direction/results.json`, 'utf8')) as { arm: string; rep: number; output: string }[];
const out = rows.map((r) => {
  const r2 = runQualityChecks({ output: r.output, profile: REGRESSION_PROFILE, mix: { resolved: mix, count: 5 }, taskType: '创作方向', source: material });
  const issues = r2.issues.filter((i) => !i.detail.includes('缺少标签') && !i.detail.includes('模型自称'));
  const mixIssues = issues.filter((i) => i.kind === 'mix');
  const factIssues = issues.filter((i) => i.kind !== 'mix');
  const times = (r.output.match(TIME_RE) ?? []).filter((h) => !material.includes(h.replace(/\s/g, '')) && !material.includes(h));
  const quotes = r.output.match(QUOTE_RE) ?? [];
  return {
    arm: r.arm, rep: r.rep, len: r.output.length,
    mixIssues: mixIssues.length, mixDetail: mixIssues.map((i) => i.detail.slice(0, 60)),
    checkFacts: factIssues.length, timeClaims: times.length, customerQuotes: quotes.length,
    fabrications: factIssues.length + times.length + quotes.length,
    sample: { facts: factIssues.map((i) => i.detail.slice(0, 40)), times: times.slice(0, 2) },
  };
});
const summary: Record<string, { n: number; fabrications: number; mixIssues: number }> = {};
for (const e of out) {
  summary[e.arm] ||= { n: 0, fabrications: 0, mixIssues: 0 };
  summary[e.arm].n += 1;
  summary[e.arm].fabrications += e.fabrications;
  summary[e.arm].mixIssues += e.mixIssues;
}
fs.writeFileSync(`${ROOT}/direction/eval.json`, JSON.stringify({ rows: out, summary }, null, 2));
console.log(JSON.stringify(summary, null, 2));
