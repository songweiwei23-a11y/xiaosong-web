/**
 * 落地页上展示的方法样例。
 *
 * 【为什么是抄出来的常量，不是直接 import 真实数据】
 * lib/growth-tactics.ts 和 lib/opening-cards.ts 加起来 900 多行，
 * 直接 import 会把整套方法库打进落地页的 JS 包——访客还没注册就先下载
 * 一份完整的知识资产，既拖慢首屏，也没必要把全部内容摊给未登录的人。
 *
 * 【那怎么保证不失真】tests/showcase.test.ts 会拿这里的每一条去和真实数据
 * 逐字段比对，对不上就红。抄的内容改不了、真实数据改了这里不跟也会红——
 * 手抄的东西迟早和源头脱节，这是唯一能防住的办法。
 *
 * 【为什么展示方法而不是"成功案例"】
 * 首页原来有一个「成功案例」的导航项，指向 #cases，而页面上根本没有这个
 * 版块——点了不会有任何反应。而且真要做成功案例，我们手上没有可公开的
 * 真实客户案例，编一个就是另一种形式的假数据。
 *
 * 真正能说服人的恰恰是方法本身：别家给的是"AI 帮你写脚本"，
 * 我们能摊开说"这是第 22 计行业避坑，结构是 点名坑 → 后果 → 识别信号 →
 * 替代方案，适合所有有决策成本的行业"。这是抄不走也编不出来的东西。
 */

export interface ShowcaseTactic {
  no: number;
  name: string;
  mechanism: string;
  formula: string;
  fit: string;
}

export interface ShowcaseCard {
  no: number;
  name: string;
  category: string;
  formula: string;
  psychology: string;
}

export interface ShowcaseStructure {
  id: string;
  name: string;
  formula: string;
  coreLogic: string;
  /** 情绪曲线。这一项是别家给不出来的——它说的是观众从第几秒该有什么感觉 */
  emotionCurve: string;
}

/** 起号 36+1 计里挑三条：一条靠反差、一条靠现场、一条靠避险，覆盖面广 */
export const SHOWCASE_TACTICS: ShowcaseTactic[] = [
  {
    no: 1,
    name: '反向操作',
    mechanism: '把行业常规动作、角色或结论倒过来',
    formula: '常规A → 反向B → 真实反应/结果',
    fit: '服务、教学、美食、摄影',
  },
  {
    no: 10,
    name: '情境还原',
    mechanism: '把知识放进其自然发生的现场',
    formula: '真实任务 → 对话/纠错 → 旁观学习 → 结果',
    fit: '专业服务、教学、亲子、带货',
  },
  {
    no: 22,
    name: '行业避坑',
    mechanism: '利用趋利避害，帮助用户避免明确损失',
    formula: '点名坑 → 后果 → 识别信号 → 替代方案',
    fit: '所有有决策成本的行业',
  },
];

/** 开篇 36 计里挑三张，分属三个不同类别，显出这套卡是有体系的 */
export const SHOWCASE_CARDS: ShowcaseCard[] = [
  {
    no: 1,
    name: '圈定人群',
    category: '相关性',
    formula: '人群标签 + 痛点/欲望 + 继续观看理由',
    psychology: '直接点名目标观众，让其产生“在说我”的自我关联',
  },
  {
    no: 4,
    name: '反认知',
    category: '认知缺口',
    formula: '大众认为A → 我的结论非A/B → 证据预告',
    psychology: '提出与大众常识相反、但能用证据解释的结论',
  },
  {
    no: 7,
    name: '损失厌恶',
    category: '价值与损失',
    formula: '别人都告诉你A，却没人告诉你B；问题发生是因为缺少C',
    psychology: '制造已知与未知之间的信息缺口，让人感觉不看会继续吃亏',
  },
];

/** 19 种脚本结构里挑三种：一种解决问题、一种打破认知、一种靠情节，路数完全不同 */
export const SHOWCASE_STRUCTURES: ShowcaseStructure[] = [
  {
    id: 'problem',
    name: '解题型',
    formula: '难题呈现 → 危机升级 → 解决方案 → 执行步骤',
    coreLogic: '用户有具体问题需要解决',
    emotionCurve: '焦虑 → 共鸣 → 希望 → 行动力',
  },
  {
    id: 'expose',
    name: '揭秘型',
    formula: '反常识观点 → 内幕揭露 → 真相示范',
    coreLogic: '打破用户认知，建立权威',
    emotionCurve: '疑惑 → 震惊 → 恍然大悟',
  },
  {
    id: 'story',
    name: '故事型',
    formula: '现状铺垫 → 困境冲突 → 转折高潮 → 成就结局',
    coreLogic: '用故事情节吸引完播',
    emotionCurve: '代入 → 焦虑 → 惊喜 → 满足',
  },
];

/**
 * 全站统一的口径。
 *
 * 这些数字散在落地页、登录页、FAQ 里，之前各写各的，
 * 于是出现过「8 核心功能」（实际 15 个）这种对不上的情况。
 * 收到一处，改一次全站跟着变。
 *
 * 【为什么从 73 改成 92】原来只数了起号计和开篇计，把 19 种脚本结构漏掉了——
 * 而那 19 种同样是一条条写好的方法：每种都有结构公式、核心逻辑、情绪曲线和
 * 避坑清单，用户在脚本页选得到，选完直接进提示词。漏数它等于白白把自己
 * 说小了一圈。数字全部对着代码和文件现数，见 tests/showcase.test.ts。
 */
export const FACTS = {
  /** 起号 36+1 计 —— lib/growth-tactics.ts */
  tactics: 37,
  /** 开篇 36 计 —— lib/opening-cards.ts */
  cards: 36,
  /** 开篇计的类别数：相关性/认知缺口/价值与损失/冲突与选择/事件期待/视觉与感官 */
  cardCategories: 6,
  /**
   * 脚本结构种数 —— 脚本页选得到、且有完整方法数据的，不含「AI推荐」。
   * AI推荐不是一种结构，是"让 AI 替你挑"，算进去就是凑数。
   */
  structures: 19,
  /** 八大爆款元素 —— lib/viral-elements.ts，每条都带可直接套用的句式 */
  elements: 8,
  /** 四大脚本：教知识 / 聊观点 / 晒过程 / 讲故事，各对应一个生意目的 */
  families: 4,
  /**
   * 四者合计，每一条都带可套用的公式或句式。
   *
   * 92 → 100 不是凑整：八大爆款元素本来就一直在知识库里被检索、被用，
   * 只是没被数进来。它们每条都给了固定句式（「贬值最快的X」「外行人绝对
   * 不知道的X」），和起号计、开篇计是同一种东西，没有理由不算。
   *
   * 四大脚本不计入这个数——它是给那 19 种结构分的类，算进去就是重复计数。
   */
  methods: 100,
  /**
   * 创作板块数。原来写 15，是把会员中心也算成了创作板块；
   * 如实是 14，与侧边栏里的板块数一致。2026-09-29 加了前采建档，15；09-30 加了拆解爆款，16；又加了跨行业二创，17；
   * 10-02 加了创作方向，18；10-09 加了当月内容规划，19。
   */
  boards: 20,
  /** 编导知识篇数（编导知识大全/_导入Dify 下五个分库现数） */
  docs: 156,
  /**
   * 知识库全文字符数，单位万字符，含标点、英文与 Markdown 排版字符。
   * 原来数出 43.2 万，其中 13 万多是两份精编版末尾把单节课原文又抄了一遍的附录——
   * 同样的内容算了两次。2026-09-25 清掉重复后现数 29.6 万字符，对外说约 29 万字符。
   */
  wordsWan: 30,
  /** 知识分库数 */
  libraries: 5,
  /** 主流程环节：方向 → 选题 → 开篇 → 脚本 → 分镜 → 标题（2026-10-02 加了创作方向，带着目的找方向在选题之前） */
  pipeline: ['创作方向', '选题策划', '开篇设计', '脚本生成', '分镜脚本', '标题封面'] as const,
} as const;
