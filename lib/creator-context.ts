/**
 * 创作上下文：账号档案 + 账号定位 + 成交理由。
 *
 * 【要解决什么】这三样东西用户已经填过了，而且填得很细——库里最完整的
 * 一个档案有 44 个字段，包括「设备：手机/相机/专业摄像机/灯光/收音设备/
 * 稳定器」「团队：2-3人小团队」「绝对不能说：最好、第一、全网最便宜」
 * 这种具体到能直接指导拍摄的信息。
 *
 * 但它们几乎没被用起来：
 *   · 分镜、审稿、标题三个板块只把 profileId 传给 Dify 做记忆隔离，
 *     档案内容一个字都没进提示词。分镜的提示词里我还写死了
 *     「一个人用手机拍，没有灯」——而这个用户有专业摄像机和灯光。
 *   · 选题和脚本各自维护一套档案选择器，和侧边栏是两套机制，
 *     在选题页选了 A 号，去分镜可能还是 B 号。
 *   · 成交理由页生成的结果没有任何页面读取。
 *
 * 所以这一层的目标：**选一次，全站都知道**。
 *
 * 【为什么按模块切片而不是整个塞进去】档案全文塞进提示词有两个坏处：
 * 一是几千字的无关信息会稀释真正的指令，二是每次生成都要为这些
 * token 付钱。分镜要知道你有什么设备，不需要知道你的变现路径；
 * 标题要知道目标人群，不需要知道剪辑能力。各取所需。
 */

import { briefBlockFor } from './creative-brief';
import { manifestOf, type Board, type ProfileSlice } from './context-manifest';
import { profileCompletion } from './profile-options';

export interface CreatorProfile {
  id: string;
  /** 各页面的档案类型里它是可选的（有未命名档案），这里跟着放宽，
   *  免得靠 `as CreatorProfile` 硬转——那样连真正的字段不符也一起盖住了 */
  profile_name?: string | null;
  // 账号
  account_platform?: string[] | string | null;
  account_track?: string[] | string | null;
  account_stage?: string | null;
  fans_level?: string | null;
  // 目标人群
  target_gender?: string | null;
  target_age?: string[] | string | null;
  target_region?: string[] | string | null;
  target_occupation?: string[] | string | null;
  // 库里是 text，但选题页的类型把它声明成了 string[]。text() 两种都吃，
  // 这里放宽成联合类型，免得为了过编译去 as 一下——那等于把分歧藏起来
  target_pain_points?: string[] | string | null;
  target_needs?: string[] | string | null;
  target_interests?: string[] | string | null;
  fan_common_questions?: string | null;
  // 内容
  content_style?: string[] | string | null;
  content_format?: string[] | string | null;
  content_tone?: string | null;
  content_themes?: string | null;
  content_value?: string | null;
  unique_selling_point?: string | null;
  viral_content_pattern?: string | null;
  content_restrictions?: string | null;
  avoid_content?: string | null;
  // 竞争
  reference_accounts?: string | null;
  competitive_advantage?: string | null;
  competitive_weakness?: string | null;
  market_opportunity?: string | null;
  // 拍摄条件
  unique_resources?: string | null;
  team_structure?: string | null;
  equipment?: string[] | string | null;
  shooting_location?: string[] | string | null;
  editing_capability?: string | null;
  video_duration?: string[] | string | null;
  budget_per_video?: string | null;
  // 变现
  monetization_model?: string[] | string | null;
  product_category?: string[] | string | null;
  price_range?: string[] | string | null;
  conversion_path?: string | null;
  conversion_barriers?: string | null;
  conversion_hooks?: string | null;
}

export interface CreatorPositioning {
  name: string;
  /** 给选题用的摘要（已滤掉执行层细节） */
  summary: string;
  /** 完整定位方案 */
  full: string;
}

export interface CreatorContext {
  profile: CreatorProfile | null;
  positioning: CreatorPositioning | null;
  dealReasons: string[];
  /** 创作简报的 markdown 原文。有它就优先用它，没有才退回截断定位 */
  brief?: string | null;
}

/**
 * 板块类型统一由 lib/context-manifest 定义。
 * 这里保留别名只是为了不改所有调用方的写法。
 */
export type ContextModule = Board;

/** 数组字段和文本字段混用，统一成一行可读的文字 */
function text(v: unknown, maxLen = 300): string {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.filter(Boolean).join('、') : String(v);
  const t = s.trim();
  if (!t) return '';
  return t.length > maxLen ? t.slice(0, maxLen) + '…' : t;
}

/** 只在有值时产出一行，避免提示词里出现一堆「未设置」 */
function line(label: string, value: unknown, maxLen = 300): string | null {
  const t = text(value, maxLen);
  return t ? `- **${label}**：${t}` : null;
}

const join = (lines: (string | null)[]) => lines.filter(Boolean).join('\n');

/**
 * 拍摄条件。分镜板块最缺的就是这一块——
 * 之前提示词里写死「一个人用手机拍，没有灯」，是个凭空假设。
 * 档案里填了就用真的，没填才退回那个保守假设。
 */
export function describeShootingSetup(p: CreatorProfile | null): string {
  if (!p) return '';
  const rows = join([
    line('可用设备', p.equipment),
    line('团队规模', p.team_structure),
    line('常用场地', p.shooting_location),
    line('剪辑能力', p.editing_capability),
    line('单条预算', p.budget_per_video),
    line('惯用时长', p.video_duration),
  ]);
  if (!rows) return '';

  return `## 🎥 这个账号的真实拍摄条件

${rows}

**按这些条件设计分镜**：有稳定器才安排运动镜头，有灯光才设计光位，
团队只有一个人就不要出现需要第二机位同时拍的镜头。
条件没写到的按最保守的情况处理（手机、单人、自然光）。`;
}

/** 目标人群。脚本、审稿、标题都要，但详略不同 */
function describeAudience(p: CreatorProfile, detail: 'brief' | 'full'): string {
  const base = join([
    line('人群', [text(p.target_age), text(p.target_gender), text(p.target_occupation)].filter(Boolean).join(' · ')),
    line('地域', p.target_region),
  ]);
  if (detail === 'brief') return base;

  return join([
    base,
    line('真实痛点', p.target_pain_points, 500),
    line('真正需求', p.target_needs, 500),
    line('粉丝常问', p.fan_common_questions, 400),
  ]);
}

/**
 * 「这条选题拍不拍得出来」的约束。
 *
 * 选题页原本无条件写着「拍摄方式：手机即可，不需要专业设备」「一个人就能拍，
 * 不需要团队」——和分镜里那个凭空假设是同一个病。对一个有专业摄像机、灯光和
 * 2-3 人团队的账号，这等于把选题范围砍到单人手机能拍的那一小块，
 * 买了设备等于白买。
 *
 * 填了条件就按真的来，没填才退回保守假设。
 */
export function describeExecutionConstraints(p: CreatorProfile | null): string {
  const gear = text(p?.equipment, 200);
  const team = text(p?.team_structure, 100);
  const place = text(p?.shooting_location, 150);
  if (!gear && !team) {
    return `- 拍摄成本要低：手机即可，不需要专业设备
- 简单易上手：一个人就能拍，不需要团队或演员
- 场景要求：日常场景（店内/家里），避免凌晨拍摄、多场景切换
- 道具要求：日常道具，避免复杂道具`;
  }
  return join([
    '- 选题必须落在这个账号的真实拍摄能力之内：',
    line('  可用设备', gear),
    line('  团队规模', team),
    line('  可用场地', place),
    '- 器材清单里没有的东西不要假设它存在；场地没写到的不要设计成外拍',
    team && !/1人|单人|一个人|个人/.test(team)
      ? '- 有团队就可以出镜+掌机分工，需要两个人配合的选题是可以做的'
      : '- 只有一个人，需要他人配合出镜的选题不要出',
    '- 仍然要可执行：避免凌晨拍摄、需要请演员、跨多个场地的选题',
  ]);
}

/** 禁忌。所有产出内容的板块都该带上，这是硬约束 */
export function describeRestrictions(p: CreatorProfile): string {
  const rows = join([
    line('绝对不能说', p.content_restrictions, 500),
    line('避免的内容', p.avoid_content, 300),
  ]);
  return rows ? `### ⛔ 硬性禁忌（违反即不可用）\n\n${rows}` : '';
}

/**
 * 按模块拼出要注入提示词的上下文。
 * 没有档案时返回空串——调用方直接拼接即可，不用各自判空。
 */
export function buildContextBlock(ctx: CreatorContext, module: ContextModule): string {
  const p = ctx.profile;
  if (!p && !ctx.positioning && ctx.dealReasons.length === 0) return '';

  const parts: string[] = [];
  const title = p?.profile_name ? `## 📇 账号背景：${p.profile_name}` : '## 📇 账号背景';

  // 按清单切片，不再用 switch。加板块只需在 lib/context-manifest 里加一行
  if (p) {
    const want = new Set<ProfileSlice>(manifestOf(module)?.profile ?? []);
    parts.push(title, '');

    if (want.has('account')) {
      parts.push(join([
        line('平台', p.account_platform),
        line('赛道', p.account_track),
        line('账号阶段', [text(p.account_stage), text(p.fans_level)].filter(Boolean).join(' · ')),
        line('内容形式', p.content_format),
      ]), '');
    }
    if (want.has('audience')) parts.push(describeAudience(p, 'full'), '');
    if (want.has('tone')) {
      parts.push(join([
        line('说话语气', p.content_tone),
        line('内容风格', p.content_style),
      ]), '');
    }
    if (want.has('selling')) {
      parts.push(join([
        line('核心卖点', p.unique_selling_point, 500),
        line('内容价值', p.content_value, 300),
        line('已验证的开场钩子', p.conversion_hooks, 500),
      ]), '');
    }
    if (want.has('shooting')) parts.push(describeShootingSetup(p), '');
    if (want.has('monetize')) {
      parts.push(join([
        line('变现方式', p.monetization_model),
        line('价格区间', p.price_range),
        line('成交路径', p.conversion_path, 400),
        line('成交障碍', p.conversion_barriers, 400),
      ]), '');
    }
    if (want.has('viral')) {
      parts.push(join([
        line('已有的内容方向', p.content_themes, 600),
        line('这个号的爆款基因', p.viral_content_pattern, 400),
        line('差异化优势', p.competitive_advantage, 400),
      ]), '');
    }
    if (want.has('restrictions')) parts.push(describeRestrictions(p), '');

    if (module === 'review') {
      parts.push('**审稿时按这个账号的标准判**：语气对不对得上、说的是不是这群人关心的、有没有踩到上面的禁忌。', '');
    }
  }
  /*
   * 账号方向。优先用创作简报，没有才退回截断定位原文。
   *
   * 为什么优先用简报：实测账号定位有 12466 字，这里按 2000 字截断，
   * 只有前 16% 进得去——而且进去的是核心结论、行业分析（其他板块用不上）
   * 和半截前采问题（更用不上）；一句话定位、六维地基、记忆点全被截掉，
   * 断点还落在句子中间。**人设、人群、语气、禁忌一个都没到达。**
   *
   * 简报是按消费方切好片的，各板块只拿自己那几段，400-800 字，全是有用的。
   */
  const brief = briefBlockFor(ctx.brief, module);
  if (brief) {
    parts.push('', brief);
  } else if (ctx.positioning) {
    const body = module === 'topic' ? ctx.positioning.summary : ctx.positioning.full;
    if (body) {
      parts.push('', `## 🎯 已确定的账号定位`, '', text(body, 2000), '',
        '⚠️ 以上是这个号已经定好的方向，产出必须与它一致，不要另起炉灶。',
        '（这一段是从定位原文截断来的。生成一份「创作简报」可以让各板块拿到完整方向。）');
    }
  }

  // 成交理由：只有变现相关的模块需要
  if (ctx.dealReasons.length > 0 && ['topic', 'script', 'title'].includes(module)) {
    parts.push('', '## 💰 这个账号的成交理由', '', ctx.dealReasons.map((r) => `- ${r}`).join('\n'), '',
      '内容要能体现这些理由，但不是硬塞——放在具体场景里讲出来。');
  }

  // 连续空行压成一个，否则拼出来的提示词到处是空档
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 档案填了多少，用于在界面上提示「补全档案能让产出更准」 */
export function profileCompleteness(p: CreatorProfile | null): number {
  // 算法只留一份，在 lib/profile-options；这里原来自己数 18 项，和侧边栏各说各的
  return profileCompletion(p).percent;
}
