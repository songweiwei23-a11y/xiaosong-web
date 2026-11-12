/**
 * 账号档案的可选项集合。
 *
 * 【为什么要有这个】生产库里 17 份档案的填写率摆在这儿：
 *
 *   选择题字段（平台/阶段/粉丝量级/设备/团队/场地/时长/变现方式/价格）  一律 47%
 *   填空题字段  成交钩子 6%、成交障碍 12%、爆款基因 18%、粉丝常问 24%、
 *               核心卖点 24%、内容价值 24%、禁忌 29%、用户痛点 41%
 *
 * 选择题的填写率是填空题的两到八倍。成交钩子那一栏 17 个人里只有 1 个填过
 * （写了 724 字），其余 16 个一个字没写——这张表单目前只对极有动力的人有效。
 *
 * 而账号定位最依赖的恰恰是这些填空题。拿不到真实痛点、卖点、禁忌，
 * 模型只能靠"平台+赛道"去编，产出自然片面。**提示词解决"怎么判断"，
 * 解决不了"没东西可判断"。**
 *
 * 【两条设计原则】
 *
 * 1. **只问用户知道的事实，不问需要分析的结论。**
 *    原表单里有「市场上还有哪些空白机会点？」「历史什么类型的内容容易爆？」
 *    这类问题——那是 AI 该干的活，反过来问用户，等于把最难的部分丢回去。
 *    改成问事实：你数据最好的一条是什么类型、顾客最常夸你什么。
 *
 * 2. **能选就不填。** 勾选的认知成本远低于面对空白文本框。
 *    每组都留「其他」，想写的人照样能写。
 *
 * 【存储不变】这些多选最终 join('、') 存回原来的 text 列。
 * 不动表结构，现有 17 份档案照常可用，下游 text() 两种格式都吃。
 */

export interface Option {
  value: string;
  /** 一句话解释，鼠标悬停或副标题展示，帮用户判断选不选 */
  hint?: string;
}

export interface OptionGroup {
  /** 对应 user_profiles 的列名 */
  field: string;
  label: string;
  /** 为什么问这个——让用户知道填了有什么用，是提升填写率的关键 */
  why: string;
  options: Option[];
  /** 允许追加自定义内容 */
  allowOther?: boolean;
  /** 建议最多勾几个，勾太多等于没重点 */
  maxHint?: number;
}

/**
 * 成交理由 / 核心卖点。
 * 取自知识库的「十五个进店理由」（产品/店铺/人 三个维度），
 * 和选题页 ALL_DEAL_REASONS 保持同一套口径。
 * 这一栏原来是「你和同类账号相比有什么不同？」的空白框，填写率 24%。
 */
export const SELLING_POINTS: Option[] = [
  { value: '质量好', hint: '用料足、货真价实' },
  { value: '效果好', hint: '做完改变明显' },
  { value: '性价比高', hint: '同等价格给得更多' },
  { value: '好评多', hint: '回头客多、口碑好' },
  { value: '专业强', hint: '有资质、有年头、技术过硬' },
  { value: '老板好', hint: '本人热情、靠谱、有故事' },
  { value: '服务好', hint: '贴心、售后省心' },
  { value: '实在不坑', hint: '明码标价、不宰客' },
  { value: '有特色', hint: '别家没有的做法或品类' },
  { value: '选择多', hint: '品类全、款式多' },
  { value: '生意好', hint: '排队、火爆、常满座' },
  { value: '规模大', hint: '连锁、分店多、场地大' },
  { value: '案例多', hint: '做过的单子多、有据可查' },
  { value: '便利性', hint: '位置好、离得近、来去方便' },
  { value: '颜值高', hint: '环境或出品好看、适合拍照' },
  { value: '稀缺唯一', hint: '限量、独家、别处买不到' },
  { value: '有面子', hint: '档次、品味、请客不丢份' },
];

/**
 * 目标用户的痛点。
 * 原来是「受众遇到的主要问题」的空白框，填写率 41%。
 * 这些是本地生意通用的购买顾虑，跨行业成立。
 */
export const PAIN_POINTS: Option[] = [
  { value: '怕被宰 / 价格不透明', hint: '不知道该花多少钱才合理' },
  { value: '怕质量有问题', hint: '担心以次充好、货不对板' },
  { value: '怕效果达不到预期', hint: '花了钱没用' },
  { value: '不知道怎么挑 / 分辨不出好坏', hint: '缺判断标准' },
  { value: '被同行坑过 / 有阴影', hint: '踩过坑所以谨慎' },
  { value: '选择太多 / 挑花眼', hint: '同类太多不知道选谁' },
  { value: '怕服务态度差', hint: '担心被敷衍、被冷落' },
  { value: '怕麻烦 / 流程复杂', hint: '不想折腾' },
  { value: '怕售后没人管', hint: '出了问题找不到人' },
  { value: '预算有限但要求不低', hint: '想花小钱办好事' },
  { value: '时间紧 / 等不起', hint: '需要快' },
  { value: '不好意思问 / 怕显得外行', hint: '有顾虑但不敢开口' },
];

/**
 * 目标用户的需求。原来是「受众想要获得什么」的空白框。
 */
export const USER_NEEDS: Option[] = [
  { value: '要真材实料', hint: '看得见的实在' },
  { value: '要明确的效果', hint: '做完能看到变化' },
  { value: '要有人帮着挑', hint: '希望有懂行的给建议' },
  { value: '要省心省事', hint: '一站解决不折腾' },
  { value: '要价格透明', hint: '事先知道花多少' },
  { value: '要快', hint: '时间就是成本' },
  { value: '要有面子', hint: '拿得出手、能晒' },
  { value: '要长期有人管', hint: '售后和回访' },
];

/**
 * 内容要让观众发生什么变化。取自知识库的五种观众变化。
 * 原来是「你能为观众提供什么独特价值？」——太抽象，填写率 24%。
 */
export const CONTENT_VALUE: Option[] = [
  { value: '让人长见识（认知变化）', hint: '原来如此、涨知识 → 收藏关注' },
  { value: '让人有情绪（情绪变化）', hint: '爽、笑、感动、气愤 → 评论转发' },
  { value: '让人能照做（行动变化）', hint: '我现在就能试 → 保存尝试' },
  { value: '让人对号入座（身份确认）', hint: '这说的不就是我 → 互动关注' },
  { value: '让人产生信任（信任变化）', hint: '这人懂行且做得到 → 咨询购买' },
];

/**
 * 粉丝常问。原来是空白框，填写率 24%。
 * 这些问题直接就是选题来源，所以值得问。
 */
export const FAN_QUESTIONS: Option[] = [
  { value: '多少钱 / 怎么收费', hint: '价格类' },
  { value: '真的假的 / 是不是真材实料', hint: '真伪质疑类' },
  { value: '效果能保持多久', hint: '效果类' },
  { value: '适不适合我这种情况', hint: '适配类' },
  { value: '在哪里 / 怎么去 / 营业时间', hint: '到店类' },
  { value: '要等多久 / 要不要预约', hint: '流程类' },
  { value: '和某某家比怎么样', hint: '比价类' },
  { value: '自己在家能不能做', hint: '替代方案类' },
  { value: '出问题了怎么办', hint: '售后类' },
];

/**
 * 成交障碍。原来是「用户为什么不买？」空白框，填写率 12%。
 */
export const CONVERSION_BARRIERS: Option[] = [
  { value: '觉得贵 / 超预算', hint: '价格门槛' },
  { value: '不相信是真的', hint: '信任门槛' },
  { value: '不着急 / 再看看', hint: '需求不迫切' },
  { value: '怕踩坑 / 想先观望', hint: '风险顾虑' },
  { value: '距离远 / 来一趟麻烦', hint: '便利性门槛' },
  { value: '不知道效果好不好', hint: '缺证据' },
  { value: '要和家人商量', hint: '决策链长' },
  { value: '同行在打价格战', hint: '外部竞争' },
];

/** 成交路径。原来让用户自己写「从观看到成交的每一步」，填写率 24%。 */
export const CONVERSION_PATHS: Option[] = [
  { value: '看视频 → 评论区问 → 私信 → 到店', hint: '本地生意最常见' },
  { value: '看视频 → 点主页 → 加微信 → 成交', hint: '需要沟通的服务' },
  { value: '看视频 → 团购链接下单 → 到店核销', hint: '标准化套餐' },
  { value: '看视频 → 进直播间 → 下单', hint: '有直播能力' },
  { value: '看视频 → 小程序/商城下单 → 发货', hint: '实物电商' },
  { value: '看视频 → 电话咨询 → 上门/到店', hint: '高客单服务' },
];

/**
 * 禁忌。原来是空白框，填写率 29%。
 * 这是硬约束，漏掉会直接产出违规文案，所以必须降低填写门槛。
 */
export const RESTRICTIONS: Option[] = [
  { value: '绝对化用语（最好 / 第一 / 全网最便宜）', hint: '广告法红线，建议都勾上' },
  { value: '不能承诺疗效或效果', hint: '医美、健康、教育类尤其要注意' },
  { value: '不能提竞争对手名字', hint: '避免纠纷' },
  { value: '不能出现具体价格数字', hint: '价格常变或平台限流时' },
  { value: '不能透露供应商 / 进货渠道', hint: '商业机密' },
  { value: '不能拍到顾客正脸', hint: '隐私顾虑' },
  { value: '不能用"揭秘"二字', hint: '容易招同行举报' },
  { value: '不碰时政 / 宗教 / 地域争议', hint: '通用红线' },
];

/** 现有资源。原来是「你有哪些独特资源？」空白框，填写率 12%。 */
export const RESOURCES: Option[] = [
  { value: '自有门店 / 场地', hint: '能当拍摄现场' },
  { value: '稳定的供应链或货源', hint: '能拍进货、溯源' },
  { value: '老客户愿意出镜', hint: '真实案例素材' },
  { value: '同行人脉 / 行业资源', hint: '能做联动和内幕' },
  { value: '有资质证书 / 获奖', hint: '专业背书' },
  { value: '做了很多年 / 有积累', hint: '故事和案例多' },
  { value: '有会拍会剪的人', hint: '生产能力' },
  { value: '有员工/家人能配合出镜', hint: '能做关系类、剧情类' },
];

/** 目前的短板。原来问「竞争劣势」，措辞让人不愿写，填写率 12%。 */
export const WEAKNESSES: Option[] = [
  { value: '不会讲 / 镜头前紧张', hint: '口播类要谨慎' },
  { value: '没时间 / 只能挤空档拍', hint: '产能受限' },
  { value: '位置偏 / 不好找', hint: '要靠内容补便利性' },
  { value: '价格比同行高', hint: '必须讲清凭什么贵' },
  { value: '刚开不久 / 没什么案例', hint: '先攒过程和证据' },
  { value: '店面小 / 环境一般', hint: '避开全景，多用特写' },
  { value: '同行太多 / 竞争激烈', hint: '必须做差异化' },
  { value: '不懂平台规则和玩法', hint: '需要先跑通基础' },
];

/**
 * 数据最好的内容类型。
 * 原来问「历史什么类型的内容容易爆？」——那是让用户做分析。
 * 改成问事实：你已经发过的里面，哪一类数据最好。没发过就选"还没发过"。
 */
export const BEST_PERFORMING: Option[] = [
  { value: '还没发过 / 还看不出来', hint: '新号选这个就行' },
  { value: '讲知识 / 教方法的', hint: '' },
  { value: '拍工作过程的', hint: '' },
  { value: '讲观点 / 吐槽的', hint: '' },
  { value: '讲故事 / 讲经历的', hint: '' },
  { value: '探店 / 带看环境的', hint: '' },
  { value: '对比测评类', hint: '' },
  { value: '搞笑 / 段子类', hint: '' },
  { value: '顾客真实反馈类', hint: '' },
];

/** 表单里按组渲染，顺序就是这里的顺序 */
export const OPTION_GROUPS: OptionGroup[] = [
  {
    field: 'target_pain_points',
    label: '你的客人最担心什么',
    why: '这是内容最好用的切入点——写脚本、起标题、想选题都从这里来',
    options: PAIN_POINTS,
    allowOther: true,
    maxHint: 4,
  },
  {
    field: 'target_needs',
    label: '他们真正想要什么',
    why: '痛点是"怕什么"，需求是"要什么"，两个都有内容才有正反两面',
    options: USER_NEEDS,
    allowOther: true,
    maxHint: 3,
  },
  {
    field: 'unique_selling_point',
    label: '你凭什么让人选你',
    why: '这决定了视频里要反复证明什么。勾太多等于没重点，挑最硬的 2-3 个',
    options: SELLING_POINTS,
    allowOther: true,
    maxHint: 3,
  },
  {
    field: 'content_value',
    label: '你想让观众看完有什么变化',
    why: '只有"产生信任"这一项直接带来成交，其余是涨粉和传播',
    options: CONTENT_VALUE,
    allowOther: false,
    maxHint: 2,
  },
  {
    field: 'fan_common_questions',
    label: '客人最常问你什么',
    why: '每一个高频问题都是一条现成的选题，这一栏填了选题就不愁',
    options: FAN_QUESTIONS,
    allowOther: true,
  },
  {
    field: 'conversion_barriers',
    label: '他们为什么犹豫、没下单',
    why: '内容要一条条把这些顾虑拆掉，不然流量再大也不成交',
    options: CONVERSION_BARRIERS,
    allowOther: true,
    maxHint: 3,
  },
  {
    field: 'conversion_path',
    label: '客人一般怎么找到你、怎么成交',
    why: '决定视频结尾把人往哪儿引',
    options: CONVERSION_PATHS,
    allowOther: true,
    maxHint: 2,
  },
  {
    field: 'content_restrictions',
    label: '绝对不能说的话',
    why: '硬约束。勾上之后所有产出都会避开，漏掉可能直接违规',
    options: RESTRICTIONS,
    allowOther: true,
  },
  {
    field: 'unique_resources',
    label: '你手上有什么别人没有的',
    why: '这些是能拍、能当证据的东西，决定了内容能做多深',
    options: RESOURCES,
    allowOther: true,
  },
  {
    field: 'competitive_weakness',
    label: '现在最大的短板',
    why: '说实话反而有用——AI 会绕开你做不到的，不给你拍不出来的方案',
    options: WEAKNESSES,
    allowOther: true,
    maxHint: 3,
  },
  {
    field: 'viral_content_pattern',
    label: '已经发过的内容里，哪类数据最好',
    why: '有验证过的方向就顺着做，别推倒重来',
    options: BEST_PERFORMING,
    allowOther: true,
    maxHint: 2,
  },
];

/** 多选存回 text 列：顿号分隔，和库里已有的手写内容格式一致 */
export function joinSelections(selected: string[], other?: string): string {
  const all = [...selected];
  const o = other?.trim();
  if (o) all.push(o);
  return all.filter(Boolean).join('、');
}

/**
 * 把已存的值还原成勾选状态。
 * 库里现有 17 份档案是手写的长文本，还原不出勾选项——
 * 那就原样放进「其他」，一个字都不丢。
 */
export function splitSelections(stored: string | null | undefined, options: Option[]): {
  selected: string[];
  other: string;
} {
  if (!stored?.trim()) return { selected: [], other: '' };
  const known = new Set(options.map((o) => o.value));
  const parts = stored.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);

  // 拆出来的每一段都能对上选项，才认为是勾选出来的
  const allKnown = parts.length > 0 && parts.every((p) => known.has(p));
  if (allKnown) return { selected: parts, other: '' };

  const selected = parts.filter((p) => known.has(p));

  // 一项都对不上 = 纯手写。原样返回，不拆不拼——
  // 按顿号重组会把用户写的中文逗号换掉，那是在悄悄改人家的内容
  if (selected.length === 0) return { selected: [], other: stored.trim() };

  // 混合：能对上的勾上，剩下的拼回「其他」
  return { selected, other: parts.filter((p) => !known.has(p)).join('、') };
}

/** 档案完整度：按「对产出有用的字段」算，不是按表里有多少列算 */
export const SCORED_FIELDS = [
  'account_platform', 'account_track', 'account_stage', 'fans_level',
  'target_age', 'target_occupation', 'target_pain_points', 'target_needs',
  'unique_selling_point', 'content_value', 'content_tone', 'content_style',
  'content_format', 'fan_common_questions', 'content_restrictions',
  'conversion_barriers', 'conversion_path', 'unique_resources',
  'competitive_weakness', 'viral_content_pattern',
  'equipment', 'team_structure', 'shooting_location', 'video_duration',
  'monetization_model', 'price_range',
] as const;

export type ScoredField = (typeof SCORED_FIELDS)[number];

/** 提示"还差哪几项"时用的叫法，跟档案表单上的说法对得上 */
export const SCORED_FIELD_LABELS: Record<ScoredField, string> = {
  account_platform: '发布平台',
  account_track: '赛道',
  account_stage: '账号阶段',
  fans_level: '粉丝量级',
  target_age: '年龄段',
  target_occupation: '职业标签',
  target_pain_points: '客人最担心什么',
  target_needs: '客人真正想要什么',
  unique_selling_point: '凭什么选你',
  content_value: '观众看完的变化',
  content_tone: '说话语气',
  content_style: '内容风格',
  content_format: '呈现形式',
  fan_common_questions: '客人常问什么',
  content_restrictions: '不能说的话',
  conversion_barriers: '犹豫没下单的原因',
  // 别用带顿号的说法：列出"还差哪几项"时是用顿号连的，会被看成两项
  conversion_path: '成交路径',
  unique_resources: '独有资源',
  competitive_weakness: '最大短板',
  viral_content_pattern: '数据最好的内容',
  equipment: '设备条件',
  team_structure: '团队配置',
  shooting_location: '拍摄场地',
  video_duration: '视频时长偏好',
  monetization_model: '变现方式',
  price_range: '价格区间',
};

function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.some((x) => (typeof x === 'string' ? x.trim().length > 0 : x != null));
  return true;
}

/**
 * 档案完整度——全站只有这一份算法。
 *
 * 原来有四份各算各的：侧边栏数 5 项，其中 target_audience、content_category
 * 两列表里根本没有，所以永远卡在 60%（真实是 96%）；档案库组件直接 filled += 6，
 * 什么都没填也有 60%；另外两份一份 18 项、一份 26 项。
 * 现在统一按表单上对生成有用的 26 项算，并告诉用户还差哪几项。
 */
export function profileCompletion(p: object | null | undefined): {
  percent: number;
  filled: number;
  total: number;
  /** 还没填的项（表单上的叫法），按表单顺序 */
  missing: string[];
} {
  const total = SCORED_FIELDS.length;
  if (!p) return { percent: 0, filled: 0, total, missing: SCORED_FIELDS.map((f) => SCORED_FIELD_LABELS[f]) };
  const row = p as Record<string, unknown>;
  const missing = SCORED_FIELDS.filter((f) => !isFilled(row[f]));
  const filled = total - missing.length;
  return { percent: Math.round((filled / total) * 100), filled, total, missing: missing.map((f) => SCORED_FIELD_LABELS[f]) };
}
