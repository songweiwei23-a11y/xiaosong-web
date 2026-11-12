// 事实依据验收探针（真模型，只读，不写库）：完整两步流程（审稿 → 校对），原稿带编造的时间和金额，
// 材料（档案）里没有这些说法。检查：值得保留里还有没有、问题清单有没有标无依据、小改稿有没有换成【待确认】。
import fs from 'node:fs';
import path from 'node:path';
import { buildReviewPrompt } from '../../lib/review-standards';
import { reviewVerificationPrompt } from '../../lib/review-verification';
import { readDifyAnswer } from '../../lib/quality-regression';

const OUT = process.argv[2];
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const BASE = (env.DIFY_BASE_URL || env.DIFY_API_URL || 'https://api.dify.ai/v1').replace(/\/$/, '');

// 原稿：档案里没有「早上六点」「人均两三块」这两条依据
const DRAFT = '南乐最好吃的一元串串，老王每天早上六点去批发市场拿货。\n我们是公益店，每周给环卫工人送一顿饭，人均两三块。\n在成都做了9年川菜。\n关注我，直播间见。';
// 材料：账号档案（和线上档案的事实一致的部分）
const MATERIAL = '## 账号档案\n- 人设事实卡：主厨老王，成都人，做川菜 9 年，来南乐半年\n- 主卖：川味串串火锅、川味烧烤\n- 刻意去掉的信息：公益营销（给贫困户送米面油）\n- 禁忌：不说「最好吃」之类绝对化用语';

async function ask(query: string, user: string): Promise<string> {
  const res = await fetch(`${BASE}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user, response_mode: 'streaming', query,
      inputs: { query, search_query: '审稿 事实依据 验收', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为审稿探针，不联网。' },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  return readDifyAnswer(res);
}

function section(text: string, from: string, len: number): string {
  const i = text.indexOf(from);
  return i < 0 ? '' : text.slice(i, i + len);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const prompt = buildReviewPrompt({
    draftContent: DRAFT, platform: '抖音', duration: 'AI推荐', scriptType: '晒过程型', reviewDimensions: '', optimizationGoals: '',
    benchmarkScript: '', compareMode: true, severityLabels: true, contextBlock: MATERIAL, personalRequirements: '',
  } as never);
  const rows: Array<Record<string, unknown>> = [];
  for (let rep = 1; rep <= 2; rep++) {
    const draft = await ask(prompt, `review-facts-probe-${rep}`);
    fs.writeFileSync(path.join(OUT, `draft-${rep}.md`), draft, 'utf8');
    const final = await ask(reviewVerificationPrompt(DRAFT, '', draft, MATERIAL), `review-facts-verify-${rep}`);
    fs.writeFileSync(path.join(OUT, `final-${rep}.md`), final, 'utf8');
    const keep = section(final, '值得保留', 400);
    const row = {
      rep,
      keepCitesMorning: keep.includes('早上六点'),
      keepCitesHalfPrice: keep.includes('人均两三块'),
      noEvidenceMarks: (final.match(/无依据/g) || []).length,
      mornMarkedNoEvidence: /早上六点[\s\S]{0,80}无依据|无依据[\s\S]{0,120}早上六点/.test(final),
      placeholderUsed: /【待确认[：:]?[^】]*】/.test(final),
      smallEditStillHasMorning: section(final, '优化后的完整脚本', 2000).includes('早上六点'),
      finalLen: final.length,
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(rows, null, 2), 'utf8');
  console.log('DONE');
}

main().catch((e) => { console.error('ERROR', String(e?.message || e).slice(0, 300)); process.exit(1); });
