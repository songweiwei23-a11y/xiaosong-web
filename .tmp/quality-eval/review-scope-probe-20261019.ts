// 审稿小改验收探针（真模型，只读，不写库）：同一段稿子 + 个人要求「只口语化」，
// 旧版提示词（HEAD）和新版提示词各跑 2 次，统计改动范围和越界句子。
import fs from 'node:fs';
import path from 'node:path';
import { buildReviewPrompt as buildNew } from '../../lib/review-standards';
import { buildReviewPrompt as buildOld } from './old/review-standards';
import { reviewDrift } from '../../lib/review-drift';
import { readDifyAnswer } from '../../lib/quality-regression';

const OUT = process.argv[2];
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const BASE = (env.DIFY_BASE_URL || env.DIFY_API_URL || 'https://api.dify.ai/v1').replace(/\/$/, '');

const DRAFT = '## 开头\n南乐县城的川味地摊，下班路过就能吃上一口。\n## 正文\n一块钱一串，串串现穿现烫，锅底是我按成都的做法熬的，主厨做川菜9年。\n食材当天进货，价格摆在明面上，吃多少算多少。\n## 结尾\n位置放在评论区，想来的直接问。';
const REQ = '只让他简单优化口语化一些，别的不要动';
const OPEN_HOOK = '下班路过就能吃上一口';

const common = {
  draftContent: DRAFT, platform: '抖音', duration: '30秒', scriptType: '晒过程型',
  reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: true, severityLabels: true,
  personalRequirements: REQ,
};

async function ask(query: string): Promise<string> {
  const res = await fetch(`${BASE}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'review-scope-probe-20261019', response_mode: 'streaming', query,
      inputs: { query, search_query: '审稿 口语化 小改', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为审稿探针，不联网。' },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  return readDifyAnswer(res);
}

function optimizedSection(answer: string): string {
  const m = answer.match(/#{1,4}\s*\d*\.?\s*优化后的完整脚本[\s\S]*?(?=\n#{1,3}\s*\d*\.?\s*(?:纯文字文案|注意|补充|按个人)|$)/);
  return m ? m[0] : '';
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const summary: Array<Record<string, unknown>> = [];
  for (const [arm, build] of [['old', buildOld], ['new', buildNew]] as const) {
    const prompt = build({ ...common } as never);
    for (let rep = 1; rep <= 2; rep++) {
      const answer = await ask(prompt);
      fs.writeFileSync(path.join(OUT, `${arm}-${rep}.md`), answer, 'utf8');
      const drift = reviewDrift(DRAFT, answer);
      const opt = optimizedSection(answer);
      summary.push({
        arm, rep, len: answer.length,
        optimizedFound: opt.length > 0,
        hookKept: opt.includes(OPEN_HOOK),
        newSentences: drift.newSentences.length,
        unexplained: drift.unexplained.length,
        unexplainedSample: drift.unexplained.slice(0, 3),
      });
      console.log(JSON.stringify(summary[summary.length - 1]));
    }
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log('DONE');
}

main().catch((e) => { console.error('ERROR', String(e?.message || e).slice(0, 300)); process.exit(1); });
