/**
 * 创作简报：把账号定位转译成各板块能直接用的创作指令。
 *
 * 【为什么需要它】账号定位是给人看的——有论证、有推导，一份 12466 字。
 * 而各板块注入提示词时按 2000 字截断，实测只有前 16% 进得去，而且进去的是：
 *   ✓ 核心结论、行业分析（其他板块用不上）、半截前采问题（更用不上）
 *   ✗ 一句话定位、六维地基全部、记忆点、差异化 —— 全被截掉
 * 断点还落在句子中间。**人设标签、用户画像、语气、禁忌一个都没到达**，
 * 各板块其实一直在靠档案字段硬撑，定位基本白生成。
 *
 * 根子上这是两种东西：定位给人看，简报给机器用。不该是同一份文档截断。
 *
 * 【所以它不是摘要，是转译】把"分析结论"翻译成"创作指令"：
 *   定位里：同行人设分布：大师型/数据型/案例型 → 你是熟人型，县域信任壁垒最高
 *   简报里：人设与口吻——南乐本地、接单先看人的熟人型编导。
 *           写文案用唠嗑的口气，不用专业术语，不摆专家架子
 * 前者在论证，后者能直接指导生成。
 *
 * 【结构按消费方切片】每个板块只取自己那几段，单板块注入 400-800 字——
 * 比现在截断 2000 字更短，但全是有用的。
 */

import { manifestOf, boardsUsingBriefField, BOARD_LABEL, type Board } from './context-manifest';

/** 简报的字段定义。顺序即生成和展示的顺序 */
export interface BriefField {
  key: string;
  /** 小节标题，生成和解析都靠它，改了会解析不出来 */
  label: string;
  /** 写给模型看的产出要求 */
  spec: string;
  /** 界面上的编辑提示 */
  hint: string;
}

/**
 * 哪个板块读哪几段，统一由 lib/context-manifest 那张表决定，
 * 不在这里各记一份——两处记就会对不上。
 */
export function modulesOf(key: string): Board[] {
  return boardsUsingBriefField(key);
}

export const BRIEF_FIELDS: BriefField[] = [
  {
    key: 'oneline',
    label: '一句话定位',
    spec: '不超过30字。[身份]+[特点]+[价值]，要能让陌生人立刻知道这个号是干什么的。',
    hint: '所有板块都会读到这句，写得越准，产出越不跑偏',
  },
  {
    key: 'persona',
    label: '人设与口吻',
    spec: `分四行写，每行都要能直接指导写文案：
- **我是谁**：一句能被观众复述的人设标签
- **说话什么调**：具体到语气词和句式习惯，不要写"亲切专业"这种
- **会说的一句话**：举一个真实例子
- **不会说的一句话**：举一个真实例子（这条比上一条更有用）`,
    hint: '脚本和审稿靠这段定口吻。"会说/不会说"各举一例，比形容词管用得多',
  },
  {
    key: 'audience',
    label: '说给谁听',
    spec: `分四行：
- **画像**：一句话，要具体到能想起某个真实的人
- **他最怕什么**：3条，每条都能直接拍成内容
- **他最想要什么**：3条
- **他会搜什么词**：写出他真会打出来的那几个词`,
    hint: '选题、脚本、标题、审稿都读这段。痛点写得越具体，选题越好出',
  },
  {
    key: 'direction',
    label: '内容方向',
    spec: `分五行：
- **三种视频的配比**：照定位里定的抄，写成"流量型X%（主打什么）+ 人设型X%（主打什么）+ 变现型X%（主打什么）"——配比说的是目的，不是脚本类型
- **各自的结尾指令**：流量型要什么、人设型要什么、变现型要什么，每种只一个
- **两套打法各用什么**：四大脚本主打哪几种结构；起号36计主打哪几计（写计名，照定位里挑的来）
- **能长期挖的选题来源**：4-5个，每个举一个具体例子
- **明确不做的方向**：3条，说明为什么不做`,
    hint: '"不做什么"和"做什么"一样重要——它能挡住跑偏的选题',
  },
  {
    key: 'trust',
    label: '凭什么信你',
    spec: `分两行：
- **核心卖点**：2-3条，每条一句话
- **可以拍成画面的证据**：4-6条，必须是能真实拍到的东西，不是形容词`,
    hint: '脚本和标题靠这段找说服点。证据要能拍出来，不能是"品质好"这种',
  },
  {
    key: 'shooting',
    label: '怎么拍',
    spec: `分三行：
- **呈现形式**：口播/探店/Vlog/情景剧等，一句话说明为什么是它
- **真实条件**：设备、场地、一个人还是有帮手、一周能出几条
- **视觉调性**：光线、色彩、镜头稳不稳，一句话`,
    hint: '分镜只读这一段。写准了，分镜就不会给出拍不出来的方案',
  },
  {
    key: 'memory',
    label: '记忆点',
    spec: '2-3条。语言/动作/道具/服装/场景声音里挑，每条说明怎么重复。标明哪些还待验证。',
    hint: '固定的口头禅、手势、道具——让观众能复述你',
  },
  {
    key: 'forbidden',
    label: '绝对不能说',
    spec: '逐条列出。包含账号自己的禁忌和通用红线（绝对化用语、承诺疗效等）。',
    hint: '硬约束，所有板块都会带上。漏一条可能直接违规',
  },
];

const BY_KEY = new Map(BRIEF_FIELDS.map((f) => [f.key, f]));

/** 生成简报的提示词。输入是已确定的账号定位全文 */
export function buildBriefPrompt(params: {
  positioningFull: string;
  profileSummary?: string;
  /** 用户对这次生成的额外要求 */
  notes?: string;
  /**
   * 商业定位 / 内容定位的产出。
   *
   * 这两个板块生成完原本就躺在库里——没有任何地方读取，
   * 它们的结论进不了任何创作环节。简报是唯一下传的通道，
   * 所以有就吸收进来，让那两次生成真的落地。
   */
  businessPositioning?: string;
  contentPositioning?: string;
  /** 内容配比（lib/content-mix 的 mixPromptBlock，百分比版）。有它，「三种视频的配比」照它写，不再照定位抄 */
  mixBlock?: string;
  /** 平台红线 + 行业禁忌（lib/taboos）：简报「禁忌」那一节要把不能拍的方向写进去 */
  taboos?: string;
}): string {
  const fields = BRIEF_FIELDS.map(
    (f, i) => `### ${i + 1}. ${f.label}\n${f.spec}`
  ).join('\n\n');

  return `你是一位短视频代运营的主编。下面有一份已经定好的账号定位方案，
现在要把它**转译**成一份「创作简报」——供选题、脚本、分镜、审稿、标题各个环节直接使用。

## ⚠️ 这不是摘要，是转译

定位方案是给人看的：有论证、有推导、有取舍过程。
简报是给创作环节用的：**每一句都要能直接指导生成，不要论证过程**。

举个例子：
- 定位里写的是：「同行人设分布：大师型/数据型/案例型 → 你是熟人型，在县域信任壁垒最高」
- 简报里应该是：「**人设**：南乐本地、接单先看人的熟人型编导。写文案用唠嗑的口气，
  不用专业术语，不摆专家架子」

前者在分析，后者能照着写。**你要产出的是后者。**

## 📄 已确定的账号定位

${params.positioningFull.trim()}
${
    params.businessPositioning?.trim()
      ? `\n## 💰 已做过的商业定位（深挖，结论要吸收进「凭什么信你」）\n\n${params.businessPositioning.trim()}\n`
      : ''
  }${
    params.contentPositioning?.trim()
      ? `\n## 💎 已做过的内容定位（深挖，结论要吸收进「内容方向」）\n\n${params.contentPositioning.trim()}\n`
      : ''
  }${params.profileSummary?.trim() ? `\n## 📇 账号档案（事实以它为准）\n\n${params.profileSummary.trim()}\n\n方向、取舍听定位的；**事实**（出镜人是谁、干了几年、从哪来、在本地多久、价格、品类）以这份档案为准——档案可能比定位新，两边对不上时按档案写，档案没写的年限、经历不要自己补。\n` : ''}${
    params.notes?.trim() ? `\n## 💡 这次的额外要求\n\n${params.notes.trim()}\n` : ''
  }${
    params.mixBlock?.trim()
      ? `\n${params.mixBlock.trim()}\n- 简报「内容方向」里的**三种视频的配比**照这个数写，不照上面定位里的抄（定位可能是按旧配比写的）\n`
      : ''
  }${
    params.taboos?.trim()
      ? `\n## ⛔ 这个行业的禁忌\n\n${params.taboos.trim()}\n- 简报的「禁忌」那一节要把**不能拍的方向**和这个号最容易踩的几句话写进去；「内容方向」「能长期挖的选题来源」里不能出现这些方向\n`
      : ''
  }
## 📤 输出格式

严格按下面的小节标题和顺序输出，**标题一个字都不要改**——
各板块靠标题把简报切开，改了就读不到了。

${fields}

## ✍️ 写作要求

- **每句都是指令**：能直接拿去指导写文案、起标题、排镜头。不要写"要注重…"这类空话
- **具体到能执行**：不要形容词，要具体的词、句、动作、画面
- **忠于定位**：结论必须来自上面那份定位，不要自己另起一套（事实性的年限、经历以账号档案为准）
- **全篇控制在 1500 字以内**：这是要塞进每一次生成的，长了就是给所有板块加负担
- 不要写前言、不要复述定位、不要解释你在做什么，直接从"### 1. 一句话定位"开始`;
}

/**
 * 把简报 markdown 解析成字段。
 * 按 `### N. 标题` 切，标题必须和 BRIEF_FIELDS 里的 label 对得上。
 */
export function parseBrief(markdown: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!markdown?.trim()) return out;

  // 允许标题前有序号、允许 ## 或 ###，标题后允许有多余空白
  const lines = markdown.split('\n');
  let current: string | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (current) out[current] = buf.join('\n').trim();
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^#{2,4}\s*(?:\d+[.、]\s*)?(.+?)\s*$/);
    if (m) {
      const hit = BRIEF_FIELDS.find((f) => m[1].includes(f.label));
      if (hit) {
        flush();
        current = hit.key;
        continue;
      }
    }
    if (current) buf.push(line);
  }
  flush();
  return out;
}

/** 字段拼回 markdown，编辑后保存用 */
export function serializeBrief(values: Record<string, string>): string {
  return BRIEF_FIELDS.filter((f) => values[f.key]?.trim())
    .map((f, i) => `### ${i + 1}. ${f.label}\n\n${values[f.key].trim()}`)
    .join('\n\n');
}

/**
 * 取某个板块要读的那几段。
 * 这是简报存在的全部意义——各板块只拿自己需要的，而不是截断 2000 字。
 */
export function briefBlockFor(
  markdown: string | null | undefined,
  board: Board
): string {
  const want = manifestOf(board)?.brief ?? [];
  const values = parseBrief(markdown);
  const picked = BRIEF_FIELDS.filter((f) => want.includes(f.key) && values[f.key]?.trim());
  if (picked.length === 0) return '';

  const body = picked.map((f) => `### ${f.label}\n\n${values[f.key].trim()}`).join('\n\n');
  return `## 🧭 创作简报（这个号已经定好的方向）

${body}

⚠️ 以上是这个账号确定下来的创作方向，产出必须与它一致，不要另起炉灶。`;
}

/** 界面上标"这段谁会读"，读的是同一张清单 */
export function readerLabels(key: string): string {
  const boards = boardsUsingBriefField(key);
  if (boards.length === BRIEF_FIELDS.length) return '所有板块';
  return boards.map((b) => BOARD_LABEL[b]).join('、');
}

/** 简报填了几个字段，用于界面上提示完整度 */
export function briefCompleteness(markdown: string | null | undefined): number {
  const values = parseBrief(markdown);
  const filled = BRIEF_FIELDS.filter((f) => values[f.key]?.trim()).length;
  return Math.round((filled / BRIEF_FIELDS.length) * 100);
}

export function fieldOf(key: string): BriefField | undefined {
  return BY_KEY.get(key);
}

/** 存进 account_positioning 时用的类型值 */
export const BRIEF_TYPE = '创作简报';

/**
 * 简报依赖的那部分档案事实：人设、经历、品类、人群、语气、方向。
 *
 * 【为什么不比更新时间】2026-10-02 线上：成交理由保存时会把理由同步进档案的「核心卖点」，
 * 档案更新时间跟着变，各板块就提示"档案在简报之后改过，简报可能是旧的"——简报里的人设、年限一个字没变。
 * 保存配比、开关禁忌也一样会误报。所以只看这些字段的内容变没变：
 * - 不含核心卖点：成交理由会往里同步，而成交理由本身另有通道进各板块
 * - 不含配比、禁忌设置、前采原文、时间戳：要么不影响简报，要么各板块另外读
 */
const BRIEF_FACT_FIELDS = [
  'profile_name', 'account_platform', 'account_track', 'account_stage', 'product_category', 'price_range', 'monetization_model',
  'target_gender', 'target_age', 'target_region', 'target_occupation', 'target_pain_points', 'target_needs', 'target_interests',
  'content_style', 'content_format', 'content_tone', 'content_themes', 'competitive_advantage', 'unique_resources', 'interview_highlights',
];

/** 存在简报那一行 positioning_description 里的前缀（这一列简报原来不用） */
export const BRIEF_FACTS_PREFIX = 'profile-facts:';

export function profileFactsFingerprint(profile: object | null | undefined): string {
  const p = (profile ?? {}) as Record<string, unknown>;
  const norm = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).map(String).map((x) => x.trim()).join('、') : v == null ? '' : String(v).trim());
  const text = BRIEF_FACT_FIELDS.map((k) => `${k}=${norm(p[k])}`).join('\n');
  // FNV-1a，够分辨"变没变"就行
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return BRIEF_FACTS_PREFIX + h.toString(16).padStart(8, '0');
}

/**
 * 简报是不是按旧档案写的：生成 / 保存简报时记下的事实指纹，和档案现在的对不上。
 * 老简报没记指纹的，判断不了，不提醒（不能拿更新时间猜——那正是误报的来源）
 */
export function briefFactsChanged(briefFacts: string | null | undefined, profile: object | null | undefined): boolean {
  if (!profile || !briefFacts || !briefFacts.startsWith(BRIEF_FACTS_PREFIX)) return false;
  return briefFacts !== profileFactsFingerprint(profile);
}
