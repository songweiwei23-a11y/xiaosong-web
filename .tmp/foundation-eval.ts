// 地基对照的离线评估（不调用模型）：三组用同一份素材口径重算质量问题，并统计结构指标。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE } from '../lib/quality-regression';
import { runQualityChecks } from '../lib/quality-checks';
import { topicTagIssues } from '../lib/output-tags';

const ROOT = process.argv[2];
const POSITIONING = '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。';
const CONTENT = '## 内容定位（长期拍什么）\n- 系列A「烧烤做法」：目的人设。拍刷料、穿串、备料，讲清做法的讲究。\n- 系列B「到店实拍」：目的变现。拍客人点餐、结账、小票，金额用占位。\n- 系列C「夜宵日常」：目的流量。拍南乐夜里的烟火气，结尾只留关注或评论。\n排除：公益营销、直播规划、教学型做法教程。';
const BUSINESS = '## 商业定位（成交路径）\n1. 刷到视频，记住「南乐 + 位置或时间」\n2. 评论区问地址，或导航搜店名\n3. 到店点餐，结账时看到小票价格\n4. 复购靠老客户转介绍\n信任依据：主厨 9 年川菜经验，食材当日采购。';
const briefA = fs.readFileSync(`${ROOT}/foundation/briefA.md`, 'utf8');
const material = [JSON.stringify(REGRESSION_PROFILE), POSITIONING, briefA, CONTENT, BUSINESS].join('\n');

const rows = JSON.parse(fs.readFileSync(`${ROOT}/foundation/results.json`, 'utf8')) as { arm: string; task: 'topic' | 'script'; rep: number; output: string }[];

const out = rows.map((r) => {
  const facts = runQualityChecks({ output: r.output, profile: REGRESSION_PROFILE, mix: null, taskType: r.task === 'topic' ? '选题策划' : '脚本生成', source: material })
    .issues.filter((i) => !i.detail.includes('缺少标签')).map((i) => i.detail);
  const entry: Record<string, unknown> = { arm: r.arm, task: r.task, rep: r.rep, len: r.output.length, facts: facts.length, factDetails: facts.map((f) => f.slice(0, 50)) };
  if (r.task === 'topic') {
    entry.topicCount = (r.output.match(/^#{1,4}\s*选题\s*\d+/gm) || []).length;
    entry.tagIssues = topicTagIssues(r.output).length;
    entry.purposeLabels = (r.output.match(/(?:【目的】|\*\*目的\*\*|目的[：:])\**\s*(流量|人设|变现)/g) || []).length;
    entry.seriesHits = (r.output.match(/系列[ABC]/g) || []).length;
  }
  return entry;
});

// 按组汇总
const summary: Record<string, Record<string, number>> = {};
for (const e of out) {
  const key = `${e.arm} ${e.task}`;
  summary[key] ||= { n: 0, facts: 0, tagIssues: 0 };
  summary[key].n += 1;
  summary[key].facts += Number(e.facts);
  if (e.tagIssues !== undefined) summary[key].tagIssues += Number(e.tagIssues);
}
fs.writeFileSync(`${ROOT}/foundation/eval.json`, JSON.stringify({ rows: out, summary }, null, 2));
console.log(JSON.stringify(summary, null, 2));
