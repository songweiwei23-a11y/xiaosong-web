/**
 * 月度复盘 → 下月策略卡 → 各板块调整（2026-11-08 产品方：全链路打通；诊断、复盘的结果要一直存着）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildReviewPrompt, defaultReviewMonth, installReview, keepReviewSlot, mergeMemory, parseReviewJson, readMix, reviewFreshness,
  reviewPromptBlock, reviewToMarkdown, rollbackReview, worksInMonth, type MonthlyReview, type ReviewSlot,
} from '@/lib/monthly-review';
import { buildContextBlock, type CreatorContext } from '@/lib/creator-context';
import { claimSelfCollection, wantSelfCollection } from '@/lib/self-collect-target';
import { readCode } from './helpers/source';

const NOW = Date.parse('2026-11-08T04:00:00Z');
const MODEL = JSON.stringify({
  summary: '十月发了 6 条，人设型的评论明显多',
  worked: ['老板讲熬底料那条评论最多（「凌晨四点的后厨」）'],
  notWorked: ['纯菜品展示的两条完播低（作品记录）'],
  experimentResults: [{ name: '开头先说价格', result: '成了', evidence: '3 条咨询都比前几条多' }, { name: '剧情反转', result: '没成', evidence: '完播 9%' }],
  strategy: {
    focus: '多拍老板本人讲后厨的事',
    mix: { 流量型: 41, 人设型: 40, 变现型: 20 },
    mixReason: '人设型在出评论',
    doMore: ['老板讲手艺'], doLess: ['纯菜品摆拍'],
    experiments: [{ name: 'a', how: 'x', success: 'y' }, { name: 'b', how: 'x', success: 'y' }, { name: 'c', how: 'x', success: 'y' }, { name: 'd', how: 'x', success: 'y' }],
    boards: { 选题: '多出老板讲手艺的题', 创作方向: '后厨系列继续', 起号: '先立老板人设', 脚本: '开头先说价格' },
  },
  dataGaps: ['没有完播数据'],
});

function review(month: string, over: Partial<MonthlyReview> = {}): MonthlyReview {
  const p = parseReviewJson(MODEL)!;
  return { ...p, month, generatedAt: '2026-11-01T01:00:00.000Z', through: '2026-10-31', source: 'auto', materials: ['十月作品 6 条'], ...over };
}

describe('读模型的复盘', () => {
  it('按格式读出来；配比合计修正成 100；试验最多 3 个；没有「最该抓」的不收', () => {
    const p = parseReviewJson('好的：\n' + MODEL)!;
    expect(p.strategy.focus).toBe('多拍老板本人讲后厨的事');
    expect(Object.values(p.strategy.mix!).reduce((a, b) => a + b, 0)).toBe(100);
    expect(p.strategy.experiments).toHaveLength(3);
    expect(p.experimentResults.map((e) => e.result)).toEqual(['成了', '没成']);
    expect(parseReviewJson('{"strategy":{"focus":""}}')).toBeNull();
    expect(parseReviewJson('没有 JSON')).toBeNull();
    expect(readMix({ 流量型: 10, 人设型: 10, 变现型: 10 })).toBeNull();
  });
});

describe('长期经验、历史版本、退回', () => {
  it('试成了的进「验证过」，没成的进「别再推荐」；同名以新的为准', () => {
    const m = mergeMemory(null, review('2026-10'));
    expect(m.verified.map((v) => v.name)).toEqual(['开头先说价格']);
    expect(m.dropped.map((v) => v.name)).toEqual(['剧情反转']);
    const m2 = mergeMemory(m, { month: '2026-11', experimentResults: [{ name: '剧情反转', result: '成了', evidence: '换了开头后完播 30%' }] });
    expect(m2.verified.map((v) => v.name)).toEqual(['剧情反转', '开头先说价格']);
    expect(m2.dropped).toEqual([]);
  });
  it('新卡上岗旧卡进历史（最多 6 份）；退回把旧的换回来，当前的进历史', () => {
    let row: Parameters<typeof installReview>[0] = {};
    for (let i = 1; i <= 8; i++) row = installReview(row, review(`2026-0${Math.min(i, 9)}`.slice(0, 7), { generatedAt: `2026-0${i}-01T00:00:00Z` }));
    expect(row.reviewHistory).toHaveLength(6);
    const back = rollbackReview(row, 0)!;
    expect(back.review!.generatedAt).toBe(row.reviewHistory![0].generatedAt);
    expect(back.reviewHistory![0].generatedAt).toBe(row.review!.generatedAt);
    expect(rollbackReview(row, 99)).toBeNull();
  });
  it('别的接口重建那一行时复盘那几项原样带上', () => {
    const row = installReview<ReviewSlot>({}, review('2026-10'));
    expect(keepReviewSlot({ ...row, reviewJob: { month: '2026-10', startedAt: 'x' } })).toMatchObject({ review: row.review, reviewMemory: row.reviewMemory, reviewJob: { month: '2026-10' } });
    expect(readCode('app/api/work-insights/route.ts')).toMatch(/\.\.\.\(previous \? keepReviewSlot\(previous\) : \{\}\)/);
  });
});

describe('策略卡进提示词', () => {
  const slot = installReview<ReviewSlot>({}, review('2026-10'));
  it('规划类整张卡、只给本板块那一句；写单条的只两行；关掉、太旧的不给', () => {
    const plan = reviewPromptBlock(slot, 'planning', '选题', NOW);
    expect(plan).toContain('最该抓：多拍老板本人讲后厨的事');
    expect(plan).toContain('给选题：多出老板讲手艺的题');
    expect(plan).not.toContain('给脚本');
    expect(plan).toContain('试过没成、不要再推荐：剧情反转');
    expect(plan).toContain('本次用户选的目的、方向和要求优先');
    const single = reviewPromptBlock(slot, 'single', '脚本', NOW);
    expect(single.split('\n').filter((l) => l.startsWith('- '))).toEqual(['- 这个月最该抓：多拍老板本人讲后厨的事', '- 给脚本：开头先说价格']);
    expect(reviewPromptBlock({ ...slot, review: { ...slot.review!, off: true } }, 'planning', '选题', NOW)).toBe('');
    expect(reviewPromptBlock(slot, 'planning', '选题', Date.parse('2027-02-01'))).toBe('');
    expect(reviewPromptBlock(slot, 'planning', '选题', Date.parse('2026-12-20'))).toContain('超过 45 天');
    expect(reviewPromptBlock(slot, null, null, NOW)).toBe('');
  });
  it('真实拼提示词：选题、方向、起号、自由对话带整张，二创两行；分镜、审稿、标题不带；写脚本页不读（只给档案和写作底线）', () => {
    expect(readCode('lib/boards/script-query.ts')).toMatch(/buildContextBlock\(\s*\{ profile: profile, positioning: null, dealReasons: \[\] \},\s*'script'/);
    expect(readCode('lib/boards/topic-query.ts')).toMatch(/workInsight: creatorContext\.workInsight,\s*doneList: creatorContext\.doneList,/);
    const realNow = Date.now;
    Date.now = () => NOW;
    try {
      const ctx = { profile: { id: 'p', profile_name: '老张火锅' }, positioning: null, dealReasons: [], workInsight: slot as never } as CreatorContext;
      for (const b of ['topic', 'direction', 'growth', 'freeChat'] as const) expect(buildContextBlock(ctx, b)).toContain('本月策略卡');
      expect(buildContextBlock(ctx, 'freeChat')).toContain('给起号：先立老板人设');
      const script = buildContextBlock(ctx, 'remix');
      expect(script).toContain('给脚本：开头先说价格');
      expect(script).not.toContain('多做：');
      for (const b of ['storyboard', 'review', 'title'] as const) expect(buildContextBlock(ctx, b)).not.toContain('本月策略卡');
    } finally { Date.now = realNow; }
  });
  it('新鲜度：没有 / 关着 / 新 / 旧 / 过期', () => {
    expect(reviewFreshness(null)).toBe('none');
    expect(reviewFreshness(review('2026-10'), NOW)).toBe('fresh');
    expect(reviewFreshness(review('2026-10'), Date.parse('2026-12-20'))).toBe('stale');
    expect(reviewFreshness(review('2026-10'), Date.parse('2027-02-01'))).toBe('expired');
  });
});

describe('复盘读什么', () => {
  it('这个月建的、拍的、发的作品才算这个月（按北京时间）', () => {
    const ws = [
      { t: 'a', created_at: '2026-09-30T17:00:00Z' }, // 北京时间 10-01
      { t: 'b', created_at: '2026-09-10T00:00:00Z', published_at: '2026-10-05T00:00:00Z' },
      { t: 'c', created_at: '2026-09-10T00:00:00Z' },
    ];
    expect(worksInMonth(ws, '2026-10').map((w) => w.t)).toEqual(['a', 'b']);
  });
  it('提示词带今天日期、上月试验逐条判、长期经验、采集的主页', () => {
    const prev = review('2026-09');
    const p = buildReviewPrompt({
      month: '2026-10', today: '2026-11-01', through: '2026-10-31', profileSummary: '- 档案名称：老张火锅',
      works: [{ title: '凌晨四点的后厨', status: '已发布', purpose: '人设型', tactic: null, metrics: '播放 1.2万' }],
      performanceBlock: '', insightBlock: '', diagnosisKey: '', previous: prev, memory: mergeMemory(null, prev),
      collectedText: '【主页】老张火锅 粉丝 1.2万', fileTexts: [],
    });
    expect(p.system).toContain('今天是 2026-11-01');
    expect(p.system).toContain('形式（口播、剧情、Vlog）不决定流量');
    expect(p.user).toContain('a｜怎么做：x｜怎么算成了：y');
    expect(p.user).toContain('试过没成（不要再推荐）');
    expect(p.user).toContain('老张火锅 粉丝 1.2万');
    expect(p.user).toContain('「凌晨四点的后厨」｜已发布｜目的：人设型');
  });
  it('手动默认：月初 7 天复盘上个月，之后复盘本月', () => {
    expect(defaultReviewMonth(Date.parse('2026-11-03T04:00:00Z'))).toBe('2026-10');
    expect(defaultReviewMonth(NOW + 86400_000)).toBe('2026-11');
  });
});

describe('结果一直存着', () => {
  it('每份复盘、改过的版本、每份诊断都另存一条永久存档', () => {
    const run = readCode('lib/monthly-review-run.ts');
    expect(run).toMatch(/archiveReport\(userId, profileId, REVIEW_TASK_TYPE, reviewToMarkdown\(review\)/);
    expect(run).toMatch(/from\('script_history'\)\.insert\(\{\s*id: randomUUID\(\)/);
    expect(readCode('app/api/monthly-review/route.ts')).toMatch(/body\.action === 'edit' && next\.review\) await archiveReport/);
    expect(readCode('app/api/account-diagnosis/route.ts')).toMatch(/await archiveReport\(userId, profileId, DIAGNOSIS_ARCHIVE_TASK, diagnosis\.report/);
    expect(readCode('components/works/AccountDiagnosis.tsx')).toMatch(/<ReportArchive profileId=\{profileId\} kind="diagnosis"/);
    expect(readCode('components/works/MonthlyReview.tsx')).toMatch(/<ReportArchive profileId=\{profileId\} kind="review"/);
  });
  it('存档全文可读：配比、试验、给各板块都在', () => {
    const md = reviewToMarkdown(review('2026-10'));
    expect(md).toContain('2026年10月复盘');
    expect(md).toContain('开头先说价格：**成了**');
    expect(md).toContain('选题：多出老板讲手艺的题');
  });
});

describe('自动复盘和插件', () => {
  it('每月定时任务：跳过已复盘的、一个一个跑、连续失败 3 次停', () => {
    const tick = readCode('app/api/admin/monthly-review/tick/route.ts');
    expect(tick).toMatch(/cronRequestAuthorized\(request, 'REVIEW_CRON_SECRET'\)/);
    expect(tick).toMatch(/row\?\.review\?\.month === month/);
    expect(tick).toMatch(/await runMonthlyReview\(\{ userId, profileId, month, source: 'auto' \}\)/);
    expect(tick).toMatch(/streak >= 3/);
  });
  afterEach(() => { (globalThis as { localStorage?: unknown }).localStorage = undefined; });
  it('插件采回来的自己主页：谁发起的归谁，诊断和复盘不会都跑一遍', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
    expect([claimSelfCollection('diagnosis', NOW), claimSelfCollection('review', NOW)]).toEqual([true, false]);
    wantSelfCollection('review', NOW);
    // 两边收到同一条消息，先后顺序都不会让两边都接
    expect([claimSelfCollection('review', NOW), claimSelfCollection('diagnosis', NOW)]).toEqual([true, false]);
    expect([claimSelfCollection('diagnosis', NOW), claimSelfCollection('review', NOW)]).toEqual([false, true]);
    expect(claimSelfCollection('diagnosis', NOW + 31 * 60_000)).toBe(true);
    expect(readCode('components/works/AccountDiagnosis.tsx')).toMatch(/if \(!claimSelfCollection\("diagnosis"\)\) return;/);
  });
});
