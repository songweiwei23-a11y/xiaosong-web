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
import { runQualityChecks, reviewedQualityOutput, type QualityResult } from './quality-checks';

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
  profile?: CreatorProfile;
  requiredSections?: string[];
  /** 按哪个板块做事实核对（lib/quality-checks 的 FACT_CHECK_TASKS）；不传就不查事实（2026-10-05 前一直没传，夜间回归从没查过编造） */
  checkAs?: string;
  /** 这些原文必须一字不差地留在结果里（「只换开头」这类局部改写） */
  mustKeep?: string[];
  /** 这次给的素材（原稿）：结果里照用素材里的价格、说法不算编（和页面上传 originContent 一样） */
  source?: string;
}

export function regressionCases(profile: CreatorProfile = REGRESSION_PROFILE): RegressionCase[] {
  const ctx = { profile, positioning: null, dealReasons: [] };
  const mix = resolveMix(profile);
  return [
    {
      task: '回归:创作方向',
      query: buildDirectionPrompt({
        purposes: ['fans', 'store'], formats: ['any'], count: 20, depth: 'quick',
        profileSummary: buildProfileSummary(profile as unknown as Record<string, unknown>), contextBlock: buildContextBlock(ctx, 'direction'),
        mixBlock: mixPromptBlock(mix, { count: 20, unit: '个' }),
      }),
      mixCount: 20,
    },
    {
      task: '回归:审稿优化',
      query: buildReviewPrompt({
        draftContent: '【开场】0-3秒 老板：我们是全城最正宗的川味串串！\n【中段】3-15秒 台词：我在南乐干了 18 年，零添加，吃了养胃。\n【结尾】15-20秒 台词：加微信领优惠。',
        platform: '抖音', duration: '30秒', scriptType: '晒过程型',
        contextBlock: buildContextBlock(ctx, 'review'),
        personalRequirements: '原稿年限写错了，按事实卡改',
      } as Parameters<typeof buildReviewPrompt>[0]),
      pick: reviewedQualityOutput,
      checkAs: '审稿优化',
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
    ...([
      { name: '美甲', platform: '小红书', task: '选题', facts: { yearsInTrade: '美甲从业5年', yearsLocal: '在杭州定居2年', others: '店开了1年；基础单色价格88元' } },
      { name: '家具', platform: '视频号', task: '开篇', facts: { yearsInTrade: '家具从业12年', yearsLocal: '来苏州3年', others: '门店开了2年；只卖家具，不承接装修' } },
    ]).map(({ name, platform, task, facts }): RegressionCase => {
      const fixture = { ...profile, profile_name: `回归测试·${name}`, account_platform: [platform], account_track: [name], persona_facts: facts, taboo_settings: {} } as CreatorProfile;
      return {
        task: `回归:${name}${task}`, profile: fixture,
        requiredSections: task === '选题' ? ['选题1', '选题2', '选题3'] : ['开篇', '衔接正文'],
        checkAs: task === '选题' ? '选题策划' : '开篇钩子',
        query: `${buildContextBlock({ profile: fixture, positioning: null, dealReasons: [] }, 'freeChat')}\n请为${platform}创作${task === '选题' ? '3个带拍摄角度的选题，严格分为 ## 选题1、## 选题2、## 选题3，每节包含标题和拍摄角度' : '一个20秒开篇和衔接正文，严格分为 ## 开篇 和 ## 衔接正文，每节包含可直接拍的台词'}。严守事实卡：从业年限、本地居住年限、店龄是不同事实，不能互换；只写可直接用的内容，不联网。`,
      };
    }),
    /*
     * 2026-10-05 质量整改加的两个（docs/开物质量深度研究_20261005）：
     *   没给价格、没给顾客故事，却要写「突出性价比和口碑」的引流脚本——最容易编出人均多少钱、有位顾客说；
     *   「只换开头」——短要求不能被模板压过，正文必须一字不动。
     */
    {
      task: '回归:无价格引流脚本',
      query: `${buildContextBlock(ctx, 'script')}\n请写一条 30 秒抖音到店引流口播脚本，突出性价比和顾客口碑。档案里没有价格，也没有具体顾客的故事。分为 ## 开头、## 正文、## 结尾 三节，只写可直接念的台词。`,
      requiredSections: ['开头', '正文', '结尾'],
      checkAs: '脚本生成',
    },
    {
      task: '回归:只换开头',
      query: `${buildContextBlock(ctx, 'script')}\n下面是一条已经定稿的口播，**别改正文，只换开头**，换成更抓人的一句。输出完整稿子。\n\n开头：大家好，今天给大家介绍一下我们店。\n正文：锅底每天早上现炒，一元一串，自己拿签子。\n结尾：想吃的评论区说说你在哪个区。`,
      checkAs: '脚本生成',
      mustKeep: ['锅底每天早上现炒，一元一串，自己拿签子', '想吃的评论区说说你在哪个区'],
      source: '开头：大家好，今天给大家介绍一下我们店。正文：锅底每天早上现炒，一元一串，自己拿签子。结尾：想吃的评论区说说你在哪个区。',
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
  return readDifyAnswer(res);
}

/** 必须收到正常结束事件；错误事件即使不是 Dify 开头，也不能被 JSON 容错吞掉。 */
export async function readDifyAnswer(res: Response): Promise<string> {
  if (!res.ok || !res.body) throw new Error(`Dify ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let answer = '';
  let completed = false;
  const consume = (line: string) => {
    if (!line.startsWith('data:')) return;
    let e: Record<string, unknown>;
    try { e = JSON.parse(line.slice(5).trim()); } catch { throw new Error('Dify 返回了无法解析的事件'); }
    if (e.event === 'error') throw new Error(String(e.message || 'Dify 出错'));
    if (e.event === 'message' || e.event === 'agent_message') answer += typeof e.answer === 'string' ? e.answer : '';
    if (e.event === 'message_replace') answer = typeof e.answer === 'string' ? e.answer : '';
    if (e.event === 'message_end') completed = true;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); if (buf.trim()) consume(buf); break; }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) consume(line);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!completed) throw new Error('Dify 连接中断，未收到完成事件');
  if (!answer.trim()) throw new Error('Dify 未返回正文');
  return answer;
}

export interface RegressionOutcome { task: string; result: QualityResult; sample: string; error?: string }

/** 依次跑完所有用例（串行：别同时压 Dify），每个都体检 */
export async function runRegression(ask: (q: string) => Promise<string> = askDify): Promise<RegressionOutcome[]> {
  const out: RegressionOutcome[] = [];
  for (const c of regressionCases()) {
    try {
      const answer = await ask(c.query);
      const checked = c.pick ? c.pick(answer) : answer;
      const profile = c.profile ?? REGRESSION_PROFILE;
      const mix = c.mixCount ? { resolved: resolveMix(profile), count: c.mixCount } : null;
      // 审稿的事实核对自己会取「优化后的完整脚本」那一节（lib/quality-checks），交给它整段回答，别取两次
      const result = runQualityChecks({ output: c.checkAs === '审稿优化' ? answer : checked, profile, mix, taskType: c.checkAs, source: c.source });
      for (const keep of c.mustKeep ?? []) {
        if (!checked.replace(/\s+/g, '').includes(keep.replace(/\s+/g, ''))) result.issues.push({ kind: 'generation', detail: `没守住用户的明确要求：「${keep.slice(0, 20)}」被改了`.slice(0, 200) });
      }
      for (const section of c.requiredSections ?? []) {
        const lines = checked.split('\n');
        const start = lines.findIndex(line => new RegExp(`^\\s*#{1,4}\\s+${section}(?:[：:、\\s]|$)`).test(line));
        const next = start < 0 ? -1 : lines.findIndex((line, i) => i > start && /^\s*#{1,4}\s+/.test(line));
        const body = start < 0 ? '' : lines.slice(start + 1, next < 0 ? lines.length : next).join('\n');
        if (!/[\p{L}\p{N}]/u.test(body)) result.issues.push({ kind: 'generation', detail: `必要交付部分「${section}」缺失或为空` });
      }
      result.passed = result.issues.length === 0;
      out.push({ task: c.task, result, sample: checked.slice(0, 300) });
    } catch (e) {
      const error = (e as Error).message;
      out.push({ task: c.task, result: { passed: false, issues: [{ kind: 'generation', detail: error.slice(0, 200) }] }, sample: '', error });
    }
  }
  return out;
}
