import fs from 'node:fs';
import path from 'node:path';
import { buildActualTopicPrompt, fixture } from './topic-quality-prompt_20261007';
import { askDify } from '../lib/dify-task';
import { buildSearchQuery } from '../lib/search-query';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
}
const outDir = path.resolve('docs/选题质量修复_20261007');
fs.mkdirSync(outDir, { recursive: true });
const ctx = fixture();
const prior = ['国庆前后门店客流对比', '老板说忙与闲的真实感受', '我在街上问老板国庆后什么感受'];
const rows = [
  { id: 'before', page: '.tmp/topic-quality-baseline/topic-page.tsx', library: '.tmp/topic-quality-baseline/topic-library.ts', context: ctx },
  { id: 'after', page: 'app/dashboard/topic/page.tsx', library: 'lib/topic-library.ts', context: ctx },
  { id: 'ordinary_furniture', page: 'app/dashboard/topic/page.tsx', library: 'lib/topic-library.ts', context: {
    ...ctx, topicCount: 2, sourceReference: '', incomingSetup: null, sourceFrom: '',
    selectedProfile: { profile_name: '合成验收·衣柜店', account_track: ['定制衣柜'], equipment: ['手机', '店内样柜'], team_size: '一人' },
    topicContext: '定制衣柜店老板，用真实样柜演示。没有顾客故事、没有价格或检测数据，不能编经历或承诺免费服务。',
    personalRequirement: '教装修业主提前记录衣柜门与抽屉开合所需空间，用店内样柜演示，不街采，不编技术标准',
    keyword1: '衣柜开合空间准备', selectedTracks: ['定制衣柜'],
    currentSettings: { purpose: '流量型', audience: '准备装修的家庭', userIntent: '教装修家庭测量与记录，店内样柜演示；不要采访，不编技术标准、顾客经历和免费服务', topic: '衣柜开合空间准备' },
  } },
];
const selectedIds = process.env.QUALITY_CASE_IDS?.split(',');
const report: any = { time: new Date().toISOString(), scope: '正式Dify同题，真实页面提示词函数，合成材料，不写用户历史或会员账本', results: [] };
if (process.env.QUALITY_AFTER_ONLY === '1') {
  const old = JSON.parse(fs.readFileSync(path.join(outDir, '正式模型前后对比.json'), 'utf8'));
  report.results = old.results.filter((r: any) => r.id === 'before' || (selectedIds && !selectedIds.includes(r.id)));
  report.baselineReused = true;
}
async function run(c: any) {
  const query = buildActualTopicPrompt(c.page, c.library, c.context, prior);
  fs.writeFileSync(path.join(outDir, c.id + '-prompt.txt'), query);
  const search = buildSearchQuery('选题策划', { inputs: { topicRole: '流量型', platforms: '抖音', keywords: c.context.keyword1, tracks: c.context.selectedTracks.join('、') } }, query);
  const start = Date.now();
  console.log(JSON.stringify({ id: c.id, started: true, promptChars: query.length, search }));
  try {
    const result = await askDify(query, 'kaiwu-topic-quality-synthetic-20261007-' + c.id, search, { signal: AbortSignal.timeout(300000) });
    const row = { id: c.id, ok: result.ok, answer: result.ok ? result.text : '', error: result.ok ? null : result.message,
      elapsedMs: Date.now() - start, usage: result.ok ? result.completion.usage : {}, queryChars: query.length };
    report.results.push(row);
    fs.writeFileSync(path.join(outDir, '正式模型前后对比.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ id: row.id, ok: row.ok, elapsedMs: row.elapsedMs, answerChars: row.answer.length, error: row.error }));
  } catch (error) {
    report.results.push({ id: c.id, ok: false, elapsedMs: Date.now() - start, error: (error as Error).name });
    fs.writeFileSync(path.join(outDir, '正式模型前后对比.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ id: c.id, ok: false, error: (error as Error).name }));
  }
}
Promise.all(rows.filter(c => (!selectedIds || selectedIds.includes(c.id)) && (process.env.QUALITY_AFTER_ONLY !== '1' || c.id !== 'before')).map(run)).catch(() => { console.error('Probe failed, no credentials logged'); process.exitCode = 1; });

