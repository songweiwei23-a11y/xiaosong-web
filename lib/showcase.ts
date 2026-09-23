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

/**
 * 全站统一的口径。
 *
 * 这些数字散在落地页、登录页、FAQ 里，之前各写各的，
 * 于是出现过「8 核心功能」（实际 15 个）这种对不上的情况。
 * 收到一处，改一次全站跟着变。
 */
export const FACTS = {
  /** 起号 36+1 计 */
  tactics: 37,
  /** 开篇 36 计 */
  cards: 36,
  /** 两者合计 */
  methods: 73,
  /** 创作板块数 */
  boards: 15,
  /** 编导知识篇数（编导知识大全/_导入Dify 下五个分库合计 153 篇，对外说 150+） */
  docs: '150+',
  /** 知识分库数 */
  libraries: 5,
  /** 主流程环节：选题 → 开篇 → 脚本 → 分镜 → 标题 */
  pipeline: ['选题策划', '开篇设计', '脚本生成', '分镜脚本', '标题封面'] as const,
} as const;
