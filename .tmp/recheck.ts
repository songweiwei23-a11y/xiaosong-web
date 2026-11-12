// 离线重算：用和线上一致的素材（档案 + 激活的账号定位）重新做质量检查，不调用模型。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE } from '../lib/quality-regression';
import { runQualityChecks } from '../lib/quality-checks';

const SCRATCH = process.argv[2];
const POSITIONING_FULL = '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。';
// 线上 fact-guard 的素材：档案 JSON + 激活的账号定位（见 app/api/dify/stream/route.ts 第 198–207 行）
const material = JSON.stringify(REGRESSION_PROFILE) + '\n' + POSITIONING_FULL;
const TASK = { topic: '选题策划', script: '脚本生成' } as const;

function checks(output: string, task: keyof typeof TASK) {
  return runQualityChecks({ output, profile: REGRESSION_PROFILE, mix: null, taskType: TASK[task], source: material }).issues.map((i) => i.detail);
}

// 第一轮（盲评那一批）
const blind = fs.readFileSync(`${SCRATCH}/advice-ab/blind.md`, 'utf8');
const key = JSON.parse(fs.readFileSync(`${SCRATCH}/advice-ab/key.json`, 'utf8')) as Record<string, { task: string; arm: string; rep: number }>;
const parts = blind.split(/=================== (S\d+)（[^）]*） ===================/).slice(1);
const round1: Record<string, { arm: string; task: string; n: number; details: string[] }> = {};
for (let i = 0; i < parts.length; i += 2) {
  const id = parts[i];
  const output = parts[i + 1].trim();
  const k = key[id];
  const details = checks(output, k.task as keyof typeof TASK);
  round1[id] = { arm: k.arm, task: k.task, n: details.length, details };
}

// 复测那一批
const verify = JSON.parse(fs.readFileSync(`${SCRATCH}/verify/results.json`, 'utf8')) as { task: string; rep: number; output: string }[];
const round2 = verify.map((r) => {
  const details = checks(r.output, r.task as keyof typeof TASK);
  return { task: r.task, rep: r.rep, n: details.length, details };
});

const summary = (rows: { task: string; n: number; arm?: string }[]) => {
  const by: Record<string, number[]> = {};
  for (const r of rows) {
    const key = `${r.task}${r.arm ? ` ${r.arm}` : ''}`;
    (by[key] ||= []).push(r.n);
  }
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v]));
};

console.log(JSON.stringify({
  round1_perSample: Object.fromEntries(Object.entries(round1).map(([id, v]) => [id, { task: v.task, arm: v.arm, n: v.n }])),
  round1_byArm: summary(Object.values(round1).map((v) => ({ task: v.task, arm: v.arm, n: v.n }))),
  round1_details: Object.fromEntries(Object.entries(round1).map(([id, v]) => [id, v.details])),
  round2_bySample: round2.map((r) => ({ task: r.task, rep: r.rep, n: r.n })),
  round2_details: round2.map((r) => ({ task: r.task, rep: r.rep, details: r.details })),
}, null, 2));
