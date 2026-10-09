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

import { briefBlockFor, briefFactsChanged } from './creative-brief';
import { manifestOf, type Board, type ProfileSlice } from './context-manifest';
import { profileCompletion } from './profile-options';
import { resolveMix, mixContextLine } from './content-mix';
import { taboosPromptBlock, readTabooSettings } from './taboos';
import { scrubProfile } from './interview-exclusions';
import { personaFactsBlock } from './persona-facts';
import { performancePromptBlock, type PerformanceSummary } from './performance';
import { PRESET_BOARDS, presetPromptBlock, type CreatorPreset } from './creator-presets';
import { PREFERENCE_BOARDS, preferencePromptBlock, type PreferenceItem } from './preferences';
import { OUTPUT_RULE_BOARDS, outputRulesBlock } from './output-rules';
import { adviceContextBlock, threeHavesBlock } from './industry-advice';

/** 三有自检只给产出选题、脚本、方向的板块（见 lib/industry-advice 的 threeHavesBlock） */
const THREE_HAVE_BOARDS = new Set<ContextModule>(['topic', 'script', 'direction']);

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
  // 前采建档提取的真实细节：老板/出镜人经历、年限、客户原话
  interview_highlights?: string | null;
  /** 内容配比设置（jsonb，见 lib/content-mix） */
  content_mix?: unknown;
  /** 禁忌设置：关掉的行业禁忌、自己补充的（jsonb，见 lib/taboos） */
  taboo_settings?: unknown;
  /** 人设事实卡（jsonb，见 lib/persona-facts）：最硬的事实，所有板块以它为准 */
  persona_facts?: unknown;
  /** 档案最后一次保存的时间。比简报新，说明简报里的事实可能过时 */
  updated_at?: string | null;
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
  /** 这份简报的生成/保存时间 */
  briefAt?: string | null;
  /** 生成 / 保存简报时档案事实的指纹（lib/creative-brief 的 profileFactsFingerprint） */
  briefFacts?: string | null;
  /** 数据回流：这个号发出去的作品录的数据汇总（lib/performance） */
  performance?: PerformanceSummary | null;
  /** 这个档案在用的风格预设（lib/creator-presets）：写稿类板块照这个写法 */
  preset?: CreatorPreset | null;
  /** 我的创作偏好（lib/preferences）：从修改、收藏、发布里学到的，只有生效的那几条 */
  preferences?: PreferenceItem[] | null;
  /** 行业建议（药方）的 markdown 原文，见 lib/industry-advice。所有创作板块都带 */
  advice?: string | null;
}

/** 规划类板块才带真实数据：选题、方向、起号、自由对话（写脚本、分镜这些单条内容用不上） */
const PERFORMANCE_BOARDS = new Set<ContextModule>(['topic', 'direction', 'growth', 'freeChat']);

/**
 * 简报是按旧档案写的：人设、经历、品类、人群这些事实在简报之后改过。
 * 原来比的是档案更新时间——成交理由同步一下卖点就误报（2026-10-02），改成比内容（见 briefFactsChanged）
 */
export function briefOlderThanProfile(ctx: Pick<CreatorContext, 'profile' | 'brief' | 'briefFacts'>): boolean {
  return !!ctx.brief && briefFactsChanged(ctx.briefFacts, ctx.profile);
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
  // 平台红线 + 按行业自动带出的禁忌（lib/taboos）：所有带 restrictions 切片的板块都会拿到，选题、方向在源头就避开
  return `### ⛔ 硬性禁忌（违反即不可用）\n\n${rows ? `${rows}\n\n` : ''}${taboosPromptBlock(p)}`;
}

/**
 * 按模块拼出要注入提示词的上下文。
 * 没有档案时返回空串——调用方直接拼接即可，不用各自判空。
 */
export function buildContextBlock(ctx: CreatorContext, module: ContextModule): string {
  // 建档时刻意没选的（排除清单）：相关的句子先从档案里拿掉，再拼进提示词（见 lib/interview-exclusions）
  const p = ctx.profile ? scrubProfile(ctx.profile, readTabooSettings(ctx.profile.taboo_settings).excluded) ?? null : null;
  if (!p && !ctx.positioning && ctx.dealReasons.length === 0 && !ctx.advice) return '';

  const parts: string[] = [];
  const title = p?.profile_name ? `## 📇 账号背景：${p.profile_name}` : '## 📇 账号背景';

  // 按清单切片，不再用 switch。加板块只需在 lib/context-manifest 里加一行
  if (p) {
    const want = new Set<ProfileSlice>(manifestOf(module)?.profile ?? []);
    parts.push(title, '');
    // 人设事实卡放最前面：最硬的事实，每个板块都要（2026-10-03，见 lib/persona-facts）
    const persona = personaFactsBlock(p.persona_facts);
    if (persona) parts.push(persona, '');

    if (want.has('account')) {
      parts.push(join([
        line('平台', p.account_platform),
        line('赛道', p.account_track),
        line('账号阶段', [text(p.account_stage), text(p.fans_level)].filter(Boolean).join(' · ')),
        line('内容形式', p.content_format),
      ]), '');
      /*
       * 真实事实（出镜人是谁、干了几年、从哪来）。
       * 2026-10-02 线上：档案里改成了「9 年川菜厨师」，但各板块从来没读过前采要点，
       * 人设只能从创作简报里拿——简报还是按旧前采写的「在南乐扎根 18 年」，于是全站都写 18 年
       */
      const facts = line('真实情况（年限、经历、籍贯以此为准，不要改写或夸大）', p.interview_highlights?.trim().replace(/\s*\n+\s*/g, '；'), 600);
      if (facts) parts.push(facts, '');
      // 自由对话里也常让它出选题、排计划：告诉它这个号平时按什么配比（选题、方向等板块有自己的配比条，不走这里）
      if (module === 'freeChat') parts.push(mixContextLine(resolveMix(p)), '');
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
      parts.push('**审稿先按当前稿件与本轮要求判断**：保留作者声音，核对事实与禁忌；账号长期人群、业务与风格仅作背景，不能把本条观察记录强改成面向老板的获客内容。', '');
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
    if (p) {
      parts.push('', briefOlderThanProfile(ctx)
        ? '⚠️ 账号档案在这份简报生成之后改过：简报里的人设事实（年限、经历、籍贯、价格、品类）可能已经过时，**和上面账号背景对不上的一律以账号背景为准**。'
        : '简报里的事实（年限、经历、籍贯、价格、品类）如果和上面账号背景对不上，以账号背景为准。');
    }
  } else if (ctx.positioning) {
    const body = module === 'topic' ? ctx.positioning.summary : ctx.positioning.full;
    if (body) {
      parts.push('', `## 🎯 已确定的账号定位`, '', text(body, 2000), '',
        '⚠️ 以上是这个号已经定好的方向，产出必须与它一致，不要另起炉灶。',
        '（这一段是从定位原文截断来的。生成一份「创作简报」可以让各板块拿到完整方向。）');
    }
  }

  // 行业建议（药方）：这个号当前阶段的打法，所有板块都照它执行
  const advice = adviceContextBlock(ctx.advice);
  if (advice) parts.push('', advice);
  if (THREE_HAVE_BOARDS.has(module)) parts.push('', threeHavesBlock());

  // 数据回流：这个号发出去的真实数据（lib/performance），规划类板块用它调整方向和拍法
  if (PERFORMANCE_BOARDS.has(module)) {
    const perf = performancePromptBlock(ctx.performance);
    if (perf) parts.push('', perf);
  }

  // 风格预设：用户认可的写法，只给写稿类板块；只学表达和结构，事实仍以上面的档案为准
  if (PRESET_BOARDS.has(module)) {
    const style = presetPromptBlock(ctx.preset);
    if (style) parts.push('', style);
  }

  // 我的创作偏好：从使用里学到的写法习惯，写稿类板块带上；优先级在档案、事实卡、禁忌、风格预设之后（块里写明了）
  if (PREFERENCE_BOARDS.has(module)) {
    const pref = preferencePromptBlock(ctx.preferences);
    if (pref) parts.push('', pref);
  }

  // 写作底线（2026-10-05 质量整改，lib/output-rules）：优先级、不编造，所有写稿板块都带
  if (OUTPUT_RULE_BOARDS.has(module)) parts.push('', outputRulesBlock());

  // 成交理由：只有变现相关的模块需要——哪些模块要，看清单里的 dealReasons（原来这里另写了一份名单，两处会对不上）
  if (ctx.dealReasons.length > 0 && manifestOf(module)?.dealReasons) {
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
