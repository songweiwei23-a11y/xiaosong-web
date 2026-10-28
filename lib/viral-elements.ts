/**
 * 八大爆款元素 与 四大脚本。
 *
 * 【为什么要把它们从知识库里提出来】
 * 这两套东西原本只以 .md 的形式躺在「编导知识大全」里，靠 Dify 在生成时
 * 检索。检索得到，不代表说得出来——落地页上一直没法引用它们，因为代码里
 * 数不出「八大」「四大」到底是哪八个哪四个。
 *
 * 结构化之后有三个好处：
 *   1. 落地页可以直接摊开讲，而且数字有源头
 *   2. tests/viral-elements.test.ts 会拿每一条去原始 .md 里比对，抄错就红
 *   3. 选题页直接用这一份做可选的选题角度，并由 viralElementPrompt()
 *      把原文句式带进提示词（已接）
 *
 * 【口径】句式是从原文里提炼的概要，不是逐字照搬——原文每一条都是一整段
 * 带例子的讲解，全抄进来既臃肿也没必要。但**名字必须和原文一字不差**，
 * 测试正是按名字去原文里找的。
 */

export interface ViralElement {
  /** 选题页多选用的稳定标识。不入库，只在前端 state 和提示词拼装之间传 */
  id: string;
  /**
   * 元素名，统一用薛老师的八大爆款元素：成本、人群、头牌、奇葩、最差、反差、怀旧、荷尔蒙（2026-10-25 定）。
   * 句式仍来自知识库「八大爆款元素选题.md」：反差 = 对立选题，奇葩 = 猎奇选题，人群 = 圈人群选题。
   */
  name: string;
  /** 一句话说清这个元素在利用什么 */
  hook: string;
  /** 原文给的固定句式／词根，挑最有代表性的几个 */
  patterns: string[];
  /**
   * 只适用于这些行业（赛道或产品品类，用档案里的标准选项写）。不写 = 全行业都可以。
   * 2026-10-27 加：八个元素不是都适合所有行业，比如「荷尔蒙」讲异性评价，放到母婴、数码上说不通。
   */
  only?: string[];
  /** 不适用的行业（同上，用标准选项写）。 */
  avoid?: string[];
}

/**
 * 八大爆款元素。来源：编导知识大全/_导入Dify/库1_定位与选题/八大爆款元素选题.md
 *
 * 这套东西的价值在于它是**可套用的句式**，不是"要有冲突感"这种正确的废话。
 * 给一个行业，八个元素能直接套出八个方向的选题。
 */
export const VIRAL_ELEMENTS: ViralElement[] = [
  {
    id: 'celebrity',
    name: '头牌',
    hook: '人天然想看"最"——最贵、最牛、最顶的那个到底什么样',
    patterns: ['世界上最贵的X到底有多贵', '最牛的人到底有多牛', '最贵的东西到底好在哪'],
  },
  {
    id: 'nostalgia',
    name: '怀旧',
    hook: '调动共同记忆，让同龄人一眼认出"这说的是我那会儿"',
    patterns: ['20年前经典的X', '古代人是如何办到的', '当年最火的X'],
  },
  {
    id: 'contrast',
    name: '反差',
    hook: '把两类人摆在一起，双方都想看自己那一边',
    patterns: ['穷人 vs 富人', '南方人 vs 北方人', '曾经 vs 现在'],
  },
  {
    id: 'worst',
    name: '最差',
    hook: '负面比正面更抓人——人更怕踩坑，而不是更想变好',
    patterns: ['贬值最快的X', '差评最多的X', '最没面子的X', '反人类设计的X'],
  },
  {
    id: 'hormone',
    name: '荷尔蒙',
    hook: '异性评价是最强的即时动机，看完就想改',
    patterns: ['异性会多看你两眼的X', '一秒下头的X', '自以为很好、实际对方眼里很差的X'],
    only: ['时尚穿搭', '美妆护肤', '健身运动', '情感生活', '服装配饰'],
  },
  {
    id: 'curious',
    name: '奇葩',
    hook: '外行看不到的那一层，本身就是信息差',
    patterns: ['外行人绝对不知道的X', '内行人的神奇操作', '黑心内幕操作'],
    avoid: ['母婴育儿'],
  },
  {
    id: 'people',
    name: '人群',
    hook: '先点名再说话，被点到的人会觉得"在说我"',
    patterns: ['某星座 / 某 MBTI 的X', '内向（或外向）的人的X', '第一次体验X的人'],
  },
  {
    id: 'cost',
    name: '成本',
    hook: '金钱、时间、面子、力气——四种成本都是人爱看的',
    patterns: ['花小钱办大事', '十分之一时间就能完成的X', '便宜又有面子的X'],
  },
];

/** 按 id 取元素，取不到返回 undefined */
export function viralElementById(id: string): ViralElement | undefined {
  return VIRAL_ELEMENTS.find((e) => e.id === id);
}

/**
 * 档案的行业关键词：赛道和产品品类两处都算（档案里两个字段都可能是数组，也可能是「、」分隔的字符串）。
 * 自定义的赛道照样进来，只是不会命中 only / avoid 里的标准名。
 */
export function industryKeysOf(profile: { account_track?: unknown; product_category?: unknown } | null | undefined): string[] {
  const keys: string[] = [];
  for (const v of [profile?.account_track, profile?.product_category]) {
    const raw = Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(/[、，,；;]+/) : [];
    for (const x of raw) {
      const t = x.trim();
      if (t && !keys.includes(t)) keys.push(t);
    }
  }
  return keys;
}

const fitsIndustry = (e: ViralElement, keys: string[]): boolean =>
  (!e.only || e.only.some((k) => keys.includes(k))) && !(e.avoid ?? []).some((k) => keys.includes(k));

export interface ElementFit {
  /** 这批真正用的元素（id），顺序和传入的一致 */
  ids: string[];
  /** 传入的里面被行业挑掉的（id） */
  dropped: string[];
  /** 传入的全都不适用，退回了全行业通用的元素 */
  fellBack: boolean;
}

/**
 * 按行业筛爆款元素。没有行业信息（没选档案）时不筛，原样用。
 * 所选的全都不适用时，退回全行业通用的元素，不让这批选题没有元素可用。
 */
export function elementsFitting(ids: string[], keys: string[]): ElementFit {
  if (!keys.length) return { ids, dropped: [], fellBack: false };
  const picked = ids.filter((id) => {
    const e = viralElementById(id);
    return !!e && fitsIndustry(e, keys);
  });
  const dropped = ids.filter((id) => !picked.includes(id));
  if (picked.length) return { ids: picked, dropped, fellBack: false };
  const general = VIRAL_ELEMENTS.filter((e) => fitsIndustry(e, keys)).map((e) => e.id);
  return { ids: general, dropped, fellBack: true };
}

/**
 * 创意难度 → 每条选题用几个爆款元素（2026-10-27）：容易执行 1 个、中等创意 2 个、高创意 3 个。
 * 页面按钮是「容易执行 / 中等创意 / 高创意」，助理的说法（简单易上手、高难度）也认。认不出的按中等（2 个）。
 */
const PER_TOPIC: Record<string, number> = { 容易执行: 1, 简单易上手: 1, 中等创意: 2, 高创意: 3, 高难度: 3 };
export function elementsPerTopic(difficulty: string): number {
  return PER_TOPIC[difficulty.trim()] ?? 2;
}

/**
 * 页面提示：所选的元素里，有哪些不适用于这个档案的行业。没有就返回空串。
 * 静默丢掉元素会变成「选了却用不上」，所以要明说。
 */
export function elementFitNote(ids: string[], keys: string[]): string {
  if (!keys.length || !ids.length) return '';
  const { dropped, fellBack } = elementsFitting(ids, keys);
  if (!dropped.length) return '';
  const names = dropped.map((id) => viralElementById(id)?.name ?? id).join('、');
  const where = `「${keys.join('、')}」`;
  return fellBack
    ? `所选的爆款元素（${names}）不适用于${where}，这批改用适合这个行业的元素`
    : `${names}不适用于${where}，这批不会用它`;
}

/**
 * 把选中的爆款元素渲染成提示词里的一段。
 *
 * 【这个函数是整件事的重点】
 * 选题页原先只把元素名发给模型——「爆款元素：成本、人群」。
 * 模型只能靠猜"成本"是什么意思，出来的选题和这套方法没什么关系，
 * 等于这八个按钮点了基本没用，而且不报错，看不出来。
 *
 * 现在把原文的固定句式一起发过去，并明确要求每条选题落在某个句式上、
 * 还要标注用的是哪个。这样"用户选最差选题，AI 就按那几个句式出选题"
 * 才真的成立。
 *
 * 认不出的 id 直接跳过——宁可少给一条，也不要把 'xxx' 这种字符串
 * 当成元素名塞进提示词里。
 */
export function viralElementPrompt(ids: string[]): string {
  const picked = ids.map(viralElementById).filter((e): e is ViralElement => !!e);
  if (picked.length === 0) return '';

  const lines = [
    '【八大爆款元素】选中以下角度，按给定句式出选题：',
    '',
    ...picked.flatMap((e) => [
      // 用括号而不是破折号：hook 本身就含破折号，两个撞在一起读不清
      `▸ ${e.name}（${e.hook}）`,
      `  可套句式：${e.patterns.join(' / ')}`,
    ]),
    '',
    '要求：',
    '- 每条选题必须落在上面某一个句式上，把 X 换成本行业的具体东西',
    '- 句式是知识库给定的，不要自己另造一套',
    '- 同一批里，同一个句式关键词（如「当年最火」「最没面子」「一秒下头」）只用在一条标题上，别的条换说法，不然整批标题读起来像一个模板',
    '- 句式里的「最怕」「最没面子」「最牛」这类是元素本身的说法，照用，不用改；绝对化只禁止用来夸商品或价格（「最便宜」「全网最低」这种），碰到这类才换成具体的比较；正文里不写「原句式含…」「本条按禁忌调整」这类说明',
    '- 句式是看点的说法，不是要拿数据证明的事实：「当年最火」「贬值最快」「差评最多」「十分之一时间」写成提问或个人观察（「贬值最快的是哪种外套？」「当年最火的校服外套，现在还值得留吗？」）就成立，不需要出处。不要因为没有数据就把句式删掉、换成普通提问；不确定的只是不把它写成定论',
    '- 负面的句式（贬值最快、差评最多、最没面子、反人类设计、一秒下头）说的是市面上常见的、旧式的东西或大家踩过的坑，不能是这家店自己在卖的货：写「反人类设计的老式裤腰」，不写「反人类设计的大码裤子」（等于骂自己的货）',
    '- 句式照用，「当年最火」「最贵」「最没面子」这些就是看点，标题里要直接写出来；只是 X 要写成一件具体的东西或一个人（一条裤子、一件外套、一张沙发、一家店），不写成一个做法或技巧：写「当年最火的校服外套」，不写「当年最火的穿法」',
    '- 每条选题后标注用的是哪个元素、套的哪个句式',
  ];
  return lines.join('\n');
}

export interface ScriptFamily {
  /** 脚本类型名，必须与课程原文一字不差 */
  name: string;
  /** 这一类脚本主要解决哪个生意问题 */
  purpose: string;
  /** 课程里对它的定位，用来说明为什么要分这四类 */
  note: string;
}

/**
 * 四大脚本。来源：库2_脚本与文案 里那八节课（每类两节）。
 * 课程原文：「四大脚本回顾：聊观点、晒过程、教知识、讲故事。」
 *
 * 【为什么这是个卖点，而不只是"四种分类"】
 * 这四类各自对应一个不同的生意目的——不是风格差别，是目标差别。
 * 通用 AI 会问你"想要什么风格"，而这套东西问的是"你这条视频是要涨粉、
 * 要粉丝更铁、要促变现，还是要成交高客单"。目的定了，结构才定得下来。
 */
export const SCRIPT_FAMILIES: ScriptFamily[] = [
  {
    name: '教知识',
    purpose: '涨粉',
    note: '课程里叫"抖音变现的碗"——粉丝最精准，是账号的地基',
  },
  {
    name: '聊观点',
    purpose: '吸"真"粉丝',
    note: '靠观点和情绪价值建人物 IP，粉丝认的是人，不是内容',
  },
  {
    name: '晒过程',
    purpose: '促变现',
    note: '把一件事从头到尾记录下来，用真实过程换信任，离变现最近',
  },
  {
    name: '讲故事',
    purpose: '成交高客单',
    note: '靠困境、转机和情绪递进建立高信任，适合客单价高的生意',
  },
];
