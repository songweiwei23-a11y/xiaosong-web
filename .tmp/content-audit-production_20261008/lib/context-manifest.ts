/**
 * 创作上下文的分发清单。
 *
 * 【为什么要有这张表】实测发现：分镜/审稿/标题拿到了简报（各 389-444 字），
 * 而选题和脚本**注入字数最多（2251/2299 字）、有用的却最少**——
 * 它们的页面自己手拼 ctx，没带简报字段，塞进去的是截断的定位原文；
 * 脚本最需要的「人设与口吻」「凭什么信你」「记忆点」一个都没到。
 * 成交理由、自由对话、知识库三个板块则完全没接。
 *
 * 根因是"每个板块该拿什么"这件事散落在各个页面里，没有单一出处。
 * 所以把它收成一张表：**加板块就在这里加一行，改分发就改这一行**，
 * 再配一条测试逐板块核对，漏接就会红。
 *
 * 【四个信息来源，各管一段】
 *   档案     用户填的事实（设备、场地、禁忌…），任何时候都有
 *   账号定位 地基。太长（12466 字），不直接注入
 *   深挖     商业定位 / 内容定位，给人看的，结论经由简报下传
 *   简报     地基的转译，按板块切好片 —— **这是主通道**
 */

/** 会消费创作上下文的板块 */
export type Board =
  | 'topic'
  | 'script'
  | 'storyboard'
  | 'review'
  | 'title'
  | 'dealReason'
  | 'freeChat'
  | 'growth'
  | 'breakdown'
  | 'remix'
  | 'knowledge'
  | 'direction';

/** 档案里可以切出来的几块 */
export type ProfileSlice =
  | 'account'      // 平台、赛道、阶段、粉丝量级
  | 'audience'     // 人群、痛点、需求、粉丝常问
  | 'tone'         // 语气、内容风格
  | 'selling'      // 核心卖点、内容价值、已验证的钩子
  | 'shooting'     // 设备、团队、场地、剪辑能力、预算
  | 'monetize'     // 变现方式、价格区间、成交路径、成交障碍
  | 'viral'        // 爆款基因、差异化优势、已有内容方向
  | 'restrictions'; // 绝对不能说（硬约束）

export interface BoardManifest {
  board: Board;
  label: string;
  /** 这个板块在干什么——写在这里，是为了让"要什么信息"有据可依 */
  job: string;
  profile: ProfileSlice[];
  /** 简报里要哪几个字段（对应 BRIEF_FIELDS 的 key） */
  brief: string[];
  /** 要不要成交理由清单 */
  dealReasons: boolean;
}

export const BOARD_MANIFESTS: BoardManifest[] = [
  {
    board: 'topic',
    label: '选题策划',
    job: '找"往哪个方向拍"。要知道赛道、说给谁听、有什么可挖的、什么不能碰',
    profile: ['account', 'audience', 'viral', 'restrictions'],
    brief: ['oneline', 'audience', 'direction', 'forbidden'],
    dealReasons: true,
  },
  {
    board: 'script',
    label: '脚本生成',
    job: '决定"怎么说"。口吻、说服点、记忆点，缺一样都会写成通稿',
    profile: ['account', 'audience', 'tone', 'selling', 'restrictions'],
    brief: ['oneline', 'persona', 'audience', 'direction', 'trust', 'memory', 'forbidden'],
    dealReasons: true,
  },
  {
    board: 'storyboard',
    label: '分镜脚本',
    job: '决定"怎么拍"。只关心真实拍摄条件和画面，不需要知道变现路径',
    // 分镜表里有台词一列，禁忌同样适用——这条是测试逮出来的，原来漏了
    profile: ['account', 'shooting', 'restrictions'],
    brief: ['oneline', 'shooting', 'memory', 'forbidden'],
    dealReasons: false,
  },
  {
    board: 'review',
    label: '审稿优化',
    job: '当判据用。语气对不对、说的是不是这群人关心的、有没有踩禁忌',
    profile: ['account', 'audience', 'tone', 'restrictions'],
    brief: ['oneline', 'persona', 'audience', 'forbidden'],
    dealReasons: false,
  },
  {
    board: 'title',
    label: '标题封面',
    job: '给谁看、凭什么点。要人群痛点和说服点，不需要拍摄条件',
    profile: ['account', 'audience', 'selling', 'restrictions'],
    brief: ['oneline', 'audience', 'trust', 'forbidden'],
    dealReasons: true,
  },
  {
    board: 'dealReason',
    label: '成交理由',
    job: '找"凭什么让人买"。要卖点、变现路径、客户顾虑——之前这个板块完全没接上下文',
    profile: ['account', 'audience', 'selling', 'monetize', 'restrictions'],
    brief: ['oneline', 'audience', 'trust', 'forbidden'],
    dealReasons: false, // 它本身就是产出成交理由的，不该拿旧的当输入
  },
  {
    board: 'growth',
    label: '起号方案',
    /*
     * 原来借用的是脚本那一套，没有拍摄条件、没有爆款基因——
     * 而起号的核心就是「按真实资源挑他拍得出来的打法」，
     * 提示词让模型对照团队、设备、场地去选，模型却一样都看不到。
     */
    job: '挑"他拍得出来的"打法。要真实拍摄条件、擅长什么、数据最好的内容类型、变现方式',
    profile: ['account', 'audience', 'tone', 'shooting', 'monetize', 'viral', 'restrictions'],
    brief: ['oneline', 'persona', 'audience', 'direction', 'shooting', 'forbidden'],
    dealReasons: false,
  },
  {
    board: 'freeChat',
    label: '高阶自由',
    job: '随口问什么都可能。给一份账号全貌，让它至少知道你是谁、做什么、不能说什么',
    profile: ['account', 'audience', 'tone', 'selling', 'shooting', 'restrictions'],
    brief: ['oneline', 'persona', 'audience', 'direction', 'trust', 'shooting', 'forbidden'],
    dealReasons: false,
  },
  /*
   * 下面三个是 2026-09-30 补接的（产品方："每个板块都要有记忆，互相关联互通"）。
   * 拆解和二创另外还传了整份档案摘要（lib/profile-summary，含经营品类、团队设备），
   * 所以档案这边只切禁忌，不重复塞。
   */
  {
    board: 'breakdown',
    label: '拆解爆款',
    job: '拆完之后"套到这个账号上"给 3 个选题。要知道账号方向和说给谁听，套出来的选题才不跑偏',
    profile: ['restrictions'],
    brief: ['oneline', 'audience', 'direction', 'forbidden'],
    dealReasons: false,
  },
  {
    board: 'remix',
    label: '跨行业二创',
    job: '把别的行业的爆款换成这个账号的血肉。要人设口吻、说给谁听、凭什么信你、记忆点，外加成交理由当结尾的说服点',
    profile: ['restrictions'],
    brief: ['oneline', 'persona', 'audience', 'trust', 'memory', 'forbidden'],
    dealReasons: true,
  },
  {
    board: 'direction',
    label: '创作方向',
    /*
     * 2026-10-02 新板块。档案摘要另传（含经营品类、团队设备），这里切的是方向判断要用的：
     * 已有的内容方向和爆款基因（别重复、接着长）、变现方式（目的要落到钱上）、拍摄条件（方向要拍得出来）
     */
    job: '带着目的找方向：要知道这个号定好的方向、说给谁听、凭什么信你、能拍什么、靠什么赚钱，方向才能既达到目的又拍得出来',
    profile: ['monetize', 'viral', 'restrictions'],
    brief: ['oneline', 'persona', 'audience', 'direction', 'trust', 'shooting', 'forbidden'],
    dealReasons: true,
  },
  {
    board: 'knowledge',
    label: '知识库',
    job: '答方法论问题。知道这个号是做什么的、说给谁听，举例时就能用他自己的行业，而不是泛泛而谈',
    profile: ['account', 'restrictions'],
    brief: ['oneline', 'audience', 'forbidden'],
    dealReasons: false,
  },
];

const BY_BOARD = new Map(BOARD_MANIFESTS.map((m) => [m.board, m]));

export function manifestOf(board: Board): BoardManifest | undefined {
  return BY_BOARD.get(board);
}

/** 哪些板块会用到某个简报字段——界面上标"谁会读这段"用 */
export function boardsUsingBriefField(key: string): Board[] {
  return BOARD_MANIFESTS.filter((m) => m.brief.includes(key)).map((m) => m.board);
}

export const BOARD_LABEL: Record<Board, string> = Object.fromEntries(
  BOARD_MANIFESTS.map((m) => [m.board, m.label])
) as Record<Board, string>;
