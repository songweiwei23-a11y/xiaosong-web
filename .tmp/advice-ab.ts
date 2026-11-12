// 行业建议对照实验（真实模型调用，写到服务器 /tmp/advice-ab/，不写库、不进任何用户的会话）。
// A 组：创作上下文不带行业建议；B 组：带。两组的档案、账号定位完全相同，只差这一段。
// 输出打乱成盲评编号 S1..S8，分组映射单独写在 key.json，评完再看。
import * as fs from 'node:fs';
import { REGRESSION_PROFILE, readDifyAnswer } from '../lib/quality-regression';
import { buildContextBlock, type CreatorContext } from '../lib/creator-context';
import { buildIndustryAdvicePrompt } from '../lib/industry-advice';
import { buildProfileSummary } from '../lib/profile-summary';
import { runQualityChecks } from '../lib/quality-checks';
import { getServiceSupabase } from '../lib/admin-auth';

const OUT = '/tmp/advice-ab';
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

/** 测试档案的账号定位（只用来让两组都有同一份定位，与真实用户无关） */
const POSITIONING = {
  name: '账号定位',
  summary: '川味地摊，主打一元串串火锅和川味烧烤，目标是本地年轻人到店吃。',
  full: '## 账号定位\n- 这个号是什么：南乐县城一家川味地摊，主打一元串串火锅、川味烧烤。\n- 说给谁听：住在南乐的 18–30 岁年轻人，下班后想吃便宜又有味道的。\n- 凭什么让人信：主厨做川菜 9 年，食材当日采购，价格摆在明面上。\n- 不做什么：不做泛流量搞笑段子，不做公益营销。',
};

const ASK_ADVICE_INPUT = { purpose: 'monetize' as const, stage: 'accumulate' as const, situation: '发了 6 条，最好的一条 3000 播放，咨询基本是老客户转介绍，没有新客。' };

async function ask(query: string): Promise<string> {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'advice-ab-experiment', response_mode: 'streaming', query,
      inputs: { query, search_query: '短视频 创作 药方对照', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为对照实验，不联网。' },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  return readDifyAnswer(res);
}

const profile = REGRESSION_PROFILE;
const TASKS = [
  {
    key: 'topic', taskType: '选题策划', label: '选题',
    request: '请为抖音出 3 个带拍摄角度的选题，严格分为 ## 选题1、## 选题2、## 选题3，每节包含标题和拍摄角度。',
    module: 'topic' as const, checkAs: '选题策划',
  },
  {
    key: 'script', taskType: '脚本生成', label: '脚本',
    request: '请写一条 30 秒抖音到店引流口播脚本，分为 ## 开头、## 正文、## 结尾 三节，只写可直接念的台词。',
    module: 'script' as const, checkAs: '脚本生成',
  },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report: Record<string, unknown> = {};

  // 0. 线上已经存过的行业建议：只看长度和是否有后半段，不输出内容
  const db = getServiceSupabase();
  const { data: stored, error: storedErr } = await db.from('account_positioning').select('full_content').eq('positioning_type', '行业建议');
  const storedLens = (stored ?? []).map((r: { full_content?: string | null }) => (r.full_content ?? '').length);
  report.storedAdvice = { count: storedLens.length, lengths: storedLens, error: storedErr?.message ?? null };

  // 1. 生成一份行业建议（新提示词）
  const advicePrompt = buildIndustryAdvicePrompt({
    profileSummary: buildProfileSummary(profile as unknown as Record<string, unknown>),
    baseline: POSITIONING.full,
    input: ASK_ADVICE_INPUT,
    taboos: undefined,
  });
  const advice = await ask(advicePrompt);
  fs.writeFileSync(`${OUT}/advice.md`, advice);
  const sectionMarks = ['核心判断', '行业真实打法', '应该做什么', '不该做什么', '核心策略', '硬规则', '进入下一阶段'];
  report.adviceLength = advice.length;
  report.adviceSections = sectionMarks.map((m) => ({ m, at: advice.indexOf(m) }));

  // 2. 两组上下文
  const ctxFor = (advice: string | null): CreatorContext => ({ profile, positioning: POSITIONING, dealReasons: [], advice });
  const ctxA = ctxFor(null);
  const ctxB = ctxFor(advice);
  report.blockLengths = {
    A: buildContextBlock(ctxA, 'topic').length,
    B: buildContextBlock(ctxB, 'topic').length,
  };

  // 3. 生成：每个任务 × 两组 × 两次，串行
  type Sample = { id: string; task: string; arm: 'A' | 'B'; rep: number; output: string; issues: string[] };
  const samples: Sample[] = [];
  for (const t of TASKS) {
    for (const rep of [1, 2]) {
      for (const arm of ['A', 'B'] as const) {
        const ctx = arm === 'A' ? ctxA : ctxB;
        const query = `${buildContextBlock(ctx, t.module)}\n\n${t.request}`;
        let output = '';
        try { output = await ask(query); } catch (e) { output = `【调用失败】${(e as Error).message}`; }
        const checks = output.startsWith('【调用失败】') ? { issues: [] as { detail: string }[] } : runQualityChecks({
          output, profile, mix: null, taskType: t.checkAs,
        });
        samples.push({ id: '', task: t.key, arm, rep, output, issues: checks.issues.map((i) => i.detail) });
        console.log(`done ${t.key} ${arm} ${rep} len=${output.length}`);
      }
    }
  }

  // 4. 盲评编号：打乱顺序，编号与分组分开写
  const shuffled = [...samples].sort(() => Math.random() - 0.5);
  const key: Record<string, { task: string; arm: string; rep: number }> = {};
  const blindLines: string[] = [];
  shuffled.forEach((s, i) => {
    const id = `S${i + 1}`;
    s.id = id;
    key[id] = { task: s.task, arm: s.arm, rep: s.rep };
    blindLines.push(`\n\n=================== ${id}（${TASKS.find((t) => t.key === s.task)?.label}） ===================\n\n${s.output}`);
  });
  fs.writeFileSync(`${OUT}/blind.md`, blindLines.join(''));
  fs.writeFileSync(`${OUT}/key.json`, JSON.stringify(key, null, 2));
  fs.writeFileSync(`${OUT}/issues.json`, JSON.stringify(shuffled.map((s) => ({ id: s.id, issues: s.issues })), null, 2));
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log('DONE');
}

main().catch((e) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/error.txt`, String(e?.stack || e));
  console.log('ERROR', String(e?.message || e).slice(0, 300));
});
