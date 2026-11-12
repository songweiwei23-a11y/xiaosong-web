// 离线评估（不调用模型）：新旧两版用同一份素材口径重算质量问题，并统计结构指标。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE } from '../lib/quality-regression';
import { runQualityChecks } from '../lib/quality-checks';
import { topicTagIssues } from '../lib/output-tags';

const ROOT = process.argv[2];
const POSITIONING_FULL = '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。';
const CONTENT = '## 内容定位（长期拍什么）\n- 系列A「烧烤做法」：目的人设。拍刷料、穿串、备料，讲清做法的讲究。\n- 系列B「到店实拍」：目的变现。拍客人点餐、结账、小票，价格摆在明面。\n- 系列C「夜宵日常」：目的流量。拍南乐夜里的烟火气，结尾只留关注或评论。\n排除：公益营销、直播规划、教学型做法教程。';
const BUSINESS = '## 商业定位（成交路径）\n1. 刷到视频，记住「南乐 + 位置或时间」\n2. 评论区问地址，或导航搜店名\n3. 到店点餐，结账时看到小票价格\n4. 复购靠老客户转介绍\n信任依据：主厨 9 年川菜经验，食材当日采购。';
// 同一份素材口径：档案 + 账号定位 + 内容定位 + 商业定位（线上 fact-guard 也是拿档案和定位当素材）
const material = [JSON.stringify(REGRESSION_PROFILE), POSITIONING_FULL, CONTENT, BUSINESS].join('\n');
const SERIES_NAMES = ['烧烤做法', '到店实拍', '夜宵日常'];
const PURPOSES = ['流量', '人设', '变现'];

type Row = { label: string; task: 'topic' | 'script'; output: string };

function factIssues(output: string, task: Row['task']) {
  const r = runQualityChecks({ output, profile: REGRESSION_PROFILE, mix: null, taskType: task === 'topic' ? '选题策划' : '脚本生成', source: material });
  return r.issues.filter((i) => !i.detail.includes('缺少标签')).map((i) => i.detail);
}

/** 选题里【系列】【目的】的取值，只统计选题段落 */
function tagValues(output: string, tag: string): string[] {
  const re = new RegExp(`(?:【${tag}】|\\*\\*${tag}\\*\\*|(?:^|\\n)\\s*${tag}\\s*[：:])\\s*\\**\\s*([^\\n*]+)`, 'g');
  return [...output.matchAll(re)].map((m) => m[1].trim());
}

const oldRaw = JSON.parse(fs.readFileSync(`${ROOT}/verify/results.json`, 'utf8')) as { task: string; rep: number; output: string }[];
const newRaw = JSON.parse(fs.readFileSync(`${ROOT}/division/results.json`, 'utf8')) as { task: string; rep: number; output: string }[];

function summarize(label: string, rows: { task: string; output: string }[]) {
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const task = r.task as Row['task'];
    const facts = factIssues(r.output, task);
    const entry: Record<string, unknown> = { task, facts: facts.length, factDetails: facts.map((f) => f.slice(0, 60)) };
    if (task === 'topic') {
      entry.tagIssues = topicTagIssues(r.output).length;
      const series = tagValues(r.output, '系列');
      entry.seriesValues = series;
      entry.seriesOutOfFramework = series.filter((s) => !SERIES_NAMES.some((n) => s.includes(n)) && !s.includes('待内容定位')).length;
      entry.purposes = tagValues(r.output, '目的').map((p) => PURPOSES.find((x) => p.includes(x)) ?? p.slice(0, 6));
      entry.topicCount = (r.output.match(/^#{1,4}\s*选题\s*\d+/gm) || []).length;
    }
    out.push(entry);
  }
  return { label, rows: out };
}

const result = {
  old: summarize('old', oldRaw),
  new: summarize('new', newRaw),
};
fs.writeFileSync(`${ROOT}/eval.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
