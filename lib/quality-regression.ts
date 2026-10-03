/**
 * 每晚回归（2026-10-03）：拿一份固定的测试档案，真跑几个关键板块，再用 lib/quality-checks 体检。
 * 提示词一改坏（禁忌没带上、配比不按条数、排除的信息又被用、年限又写错），第二天后台看板就能看到，
 * 不用等编导在使用中撞上。只在服务端跑（定时任务调 /api/admin/quality/regression）。
 *
 * 测试档案把这周线上出过的坑都埋进去了：事实卡写「来南乐半年」、排除清单里有「公益」「直播」、
 * 审稿的原稿故意写「全城最正宗」「在南乐干了 18 年」。
 */
import { buildDirectionPrompt } from './direction';
import { buildProfileSummary } from './profile-summary';
import { buildContextBlock, type CreatorProfile } from './creator-context';
import { resolveMix, mixPromptBlock } from './content-mix';
import { buildReviewPrompt } from './review-standards';
import { buildRewritePrompt, cleanRewriteOutput } from './canvas';
import { creationScript } from './creation-flow';
import { runQualityChecks, type QualityResult } from './quality-checks';

export const REGRESSION_PROFILE: CreatorProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  profile_name: '回归测试·川味地摊',
  account_platform: ['抖音'],
  account_track: ['美食烹饪', '本地服务'],
  account_stage: '刚起号，定位未确定',
  target_age: ['18-24岁', '25-30岁'],
  target_occupation: ['学生', '白领'],
  content_tone: '亲切朋友式',
  unique_selling_point: '实在不坑、性价比高',
  competitive_advantage: '主厨做川菜 9 年；愿意真做公益；本地村书记人脉可对接贫困户',
  conversion_path: '看视频 → 评论区问 → 到店；中长期：进直播间 → 挂小房子小风车',
  product_category: ['川味串串火锅', '川味烧烤'],
  persona_facts: { host: '主厨老王', origin: '成都人', yearsInTrade: '做川菜 9 年', yearsLocal: '来南乐半年', mainProducts: '川味串串火锅、川味烧烤' },
  taboo_settings: { excluded: ['公益营销：给贫困户送米面油，联系村书记对接', '直播规划：蓝 V 后挂小房子小风车'] },
} as CreatorProfile;

export interface RegressionCase {
  task: string;
  /** 交给模型的提示词 */
  query: string;
  /** 从模型回答里取出要体检的那部分（审稿只查优化后的稿子，问题清单里引用原稿的话不算） */
  pick?: (answer: string) => string;
  mixCount?: number;
}

export function regressionCases(profile: CreatorProfile = REGRESSION_PROFILE): RegressionCase[] {
  const ctx = { profile, positioning: null, dealReasons: [] };
  const mix = resolveMix(profile);
  return [
    {
      task: '回归:创作方向',
      query: buildDirectionPrompt({
        purposes: ['fans', 'store'], formats: ['any'], count: 5, depth: 'quick',
        profileSummary: buildProfileSummary(profile as unknown as Record<string, unknown>), contextBlock: buildContextBlock(ctx, 'direction'),
        mixBlock: mixPromptBlock(mix, { count: 5, unit: '个' }),
      }),
      mixCount: 5,
    },
    {
      task: '回归:审稿优化',
      query: buildReviewPrompt({
        draftContent: '【开场】0-3秒 老板：我们是全城最正宗的川味串串！\n【中段】3-15秒 台词：我在南乐干了 18 年，零添加，吃了养胃。\n【结尾】15-20秒 台词：加微信领优惠。',
        platform: '抖音', duration: '30秒', scriptType: '晒过程型',
        contextBlock: buildContextBlock(ctx, 'review'),
        personalRequirements: '原稿年限写错了，按事实卡改',
      } as Parameters<typeof buildReviewPrompt>[0]),
      pick: (a) => creationScript('review', a),
    },
    {
      task: '回归:画布改写',
      query: buildRewritePrompt({
        doc: '# 一元火锅\n**开头**：你知道一元火锅能吃到什么吗？\n**中段**：本店食材均为当日采购，锅底由主厨精心熬制。\n**结尾**：想吃的评论区说说。',
        selection: '**中段**：本店食材均为当日采购，锅底由主厨精心熬制。',
        instruction: '口语一点，像老板跟熟客聊天',
        context: buildContextBlock(ctx, 'freeChat'),
      }),
      pick: cleanRewriteOutput,
    },
  ];
}

const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

/** 调一次「开物」，收齐回答（不进任何人的会话，用户标成 quality-nightly） */
async function askDify(query: string): Promise<string> {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'quality-nightly', response_mode: 'streaming', query,
      inputs: { query, search_query: '短视频 创作 质检', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为夜间质检回归，不联网。' },
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok || !res.body) throw new Error(`Dify ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let answer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const l of lines) {
      if (!l.startsWith('data: ')) continue;
      try {
        const e = JSON.parse(l.slice(6));
        if (e.event === 'message') answer += e.answer || '';
        if (e.event === 'message_replace') answer = e.answer || '';
        if (e.event === 'error') throw new Error(e.message || 'Dify 出错');
      } catch (err) { if ((err as Error).message?.startsWith('Dify')) throw err; }
    }
  }
  return answer;
}

export interface RegressionOutcome { task: string; result: QualityResult; sample: string; error?: string }

/** 依次跑完所有用例（串行：别同时压 Dify），每个都体检 */
export async function runRegression(ask: (q: string) => Promise<string> = askDify): Promise<RegressionOutcome[]> {
  const out: RegressionOutcome[] = [];
  for (const c of regressionCases()) {
    try {
      const answer = await ask(c.query);
      const checked = (c.pick ? c.pick(answer) : answer) || answer;
      const mix = c.mixCount ? { resolved: resolveMix(REGRESSION_PROFILE), count: c.mixCount } : null;
      out.push({ task: c.task, result: runQualityChecks({ output: checked, profile: REGRESSION_PROFILE, mix }), sample: checked.slice(0, 300) });
    } catch (e) {
      out.push({ task: c.task, result: { passed: false, issues: [] }, sample: '', error: (e as Error).message });
    }
  }
  return out;
}
