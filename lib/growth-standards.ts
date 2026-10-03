/**
 * 起号板块的提示词。
 *
 * 两件事：
 *   ① 起号打法推荐 —— 从 37 计里挑适合这个号的，给出怎么测
 *   ② 开篇钩子生成 —— 用 36 张方法卡给一条内容写开头
 *
 * 【为什么不是把 37 计摆出来让用户自己挑】知识库第18节原话：
 * 「先选适合自己的，而非最炫的」。用户看完 37 计的第一反应是挑最有意思的，
 * 而不是挑自己拍得出来的——单人低预算的号去学多人剧情，
 * 拍两条就撑不住了。所以核心是那张**选择矩阵**：
 * 按真实资源条件（团队、设备、场地、有无门店、擅长什么）匹配。
 *
 * 【为什么不把 37 计全塞进提示词】全文塞进去一万多字，而且会让模型
 * 在 37 个里平均用力。改成：先按矩阵筛出候选，只把候选那几计的完整内容
 * 发过去，让它在有限范围里做深。
 */

import { GROWTH_TACTICS, SELECTION_MATRIX, TEST_RULE, tacticByName } from './growth-tactics';
import { OPENING_CARDS, type OpeningCard } from './opening-cards';
import { THIRTY_DAY_PLAN, DIAGNOSIS_TREE } from './positioning-standards';
import { roleInferRule, roleOfTactic, rolesGuide } from './content-roles';
import { ROUTES_GUIDE, tacticsBlockedBy } from './creative-routes';

/** 一计压缩成一行，用于「候选清单」那一段 */
const brief = (name: string) => {
  const t = tacticByName(name);
  // 标上这一计最适合做哪种视频，模型才知道它在配比里占的是哪一格
  const role = roleOfTactic(name);
  return t ? `- **${t.name}**${role ? `【${role}】` : ''}（${t.formula}）：${t.mechanism}。适合：${t.fit}` : '';
};

/** 一计的完整内容，用于被选中的那几计 */
const full = (name: string) => {
  const t = tacticByName(name);
  if (!t) return '';
  return `### ${t.no}. ${t.name}

- **核心机制**：${t.mechanism}
- **结构公式**：${t.formula}
- **适合**：${t.fit}
- **执行**：${t.howto}
- **案例与变体**：${t.cases}
- **边界**：${t.limit}`;
};

const MATRIX_TABLE = `### 选择矩阵：先选适合自己的，而非最炫的

| 资源条件 | 优先尝试 | 暂缓 |
|---|---|---|
${SELECTION_MATRIX.map((m) => `| ${m.condition} | ${m.prefer.join('、')} | ${m.defer} |`).join('\n')}

⚠️ 这张表是这一步的核心。**用户看完 37 计的第一反应是挑最有意思的，
而不是挑自己拍得出来的**——单人低预算的号去学多人剧情，拍两条就撑不住。
你要按他档案里的真实条件（团队几个人、有什么设备、有没有门店、
擅长讲故事还是讲干货）去匹配，不是按哪一计更酷。`;

/**
 * 起号期的内容配比。小黄第40节原话：三十六计大多是流量型内容，作用是让新号
 * 快速拿到正反馈；零粉做到一千粉、流量稳定，才算起号成功，之后再补观点、故事。
 *
 * 原来的起号方案只讲"挑哪一计"，从没说这些打法在起号期的内容里占多大一块、
 * 什么时候该补别的——用户拿着方案不知道除了这一计之外还发什么。
 */
export const GROWTH_MIX = `### 起号期的内容怎么配（小黄第7、40节）

- 起号打法（36 计）**大多是流量型内容**，作用是让新号快速拿到正反馈——所以起号期它们是**主力**
- 起号期先用**一种**最擅长、反馈最明确的类型集中跑 20-30 条，不要一上来四类齐发
- **起号成功的标准**：零粉做到一千粉，而且发出去的视频流量都比较稳定
- 过了这条线，再逐步补观点、故事和变现内容；变现内容从第一周就可以有，但只占小头
- 配比要和他已经定好的内容定位**对得上**（主力形式、主系列），起号打法是用来把那个方向打开的，不是另起一套

**36 计怎么对应三种视频**（速览里每一计后面都标了【流量型 / 人设型 / 变现型】）：
- 大多数是**流量打法**，起号期的流量型内容主要靠它们
- 有一组拍的是**你自己的服务、产品和真实过程**（情境还原、正误对比、对比改造、替网友做、接受挑战、行业避坑、推荐建议……），
  拍自己的生意时可以直接当**变现型**用——同一条既能拿流量，又能证明你能做成
- 有一组讲的是**人、关系和经历**（一句话设定故事感、加入人物关系、借物喻人、宠妻/宠夫反差、以物换物……），可以直接当**人设型**用
- 所以起号期不是"流量型全靠 36 计、另两种另起炉灶"，而是按配比从三组里各挑能拍的`;

export interface GrowthPlanParams {
  /** 账号上下文（创作简报切片 + 档案），由调用方用 buildContextBlock 拼好 */
  contextBlock?: string;
  /**
   * 已经做好的内容定位（方向、配比、系列那几段）。
   * 起号是把内容定位定下的方向打开，不看它就会各说各话：
   * 内容定位说主力是晒过程，起号却推了一堆情景剧打法。
   */
  contentPlan?: string;
  /** 用户补充说明 */
  notes?: string;
  /** 用户手动圈定的打法。不传就让 AI 按矩阵推荐 */
  picked?: string[];
  /** 档案里的禁忌原文。和它冲突的打法直接从清单里拿掉，见 tacticsBlockedBy */
  restrictions?: string;
  /** 内容配比（lib/content-mix 的 mixPromptBlock，百分比版）。有它就照它写，不再让 AI 自己定 */
  mixBlock?: string;
}

/**
 * 从内容定位全文里摘出起号要用的几段：内容方向、配比、每个系列的名字和一句话。
 *
 * 不整篇塞：一份内容定位七八千字，十集清单、选题来源、30 条节奏起号都用不上，
 * 塞进去只会稀释打法那部分的指令。
 * 新旧两种格式都认（旧版标题是「内容类型配比」「内容系列（4个）」）。
 */
export function extractContentPlan(md: string, max = 2500): string {
  if (!md?.trim()) return '';
  const sections = md.split(/\n(?=## )/);
  const find = (re: RegExp) => sections.find((s) => re.test(s.split('\n')[0]));
  const parts: string[] = [];

  const dir = find(/^## .*内容方向/);
  if (dir) parts.push(dir.trim());

  const mix = find(/^## .*配比/);
  if (mix) parts.push(mix.split(/\n### 配比核验/)[0].trim());

  const series = find(/^## .*内容系列/);
  if (series) {
    const blocks = series.split(/\n(?=### )/);
    const kept = [blocks[0].split('\n')[0]];
    for (const b of blocks.slice(1)) {
      // 每个系列只留标题和开头几行（一句话、定量变量），十集清单不要
      kept.push(b.split('\n').filter((l) => l.trim()).slice(0, 4).join('\n'));
    }
    parts.push(kept.join('\n\n'));
  }

  const out = parts.join('\n\n');
  return out.length > max ? `${out.slice(0, max)}\n…（后略）` : out;
}

// 和禁忌冲突的计：实现挪到 lib/creative-routes（定位也要用，放这里会和定位互相 import）
export { tacticsBlockedBy };

function blockedNote(blocked: string[]): string {
  return blocked.length
    ? `⛔ 这几计和他档案里的禁忌冲突，已经从清单里拿掉，**不要推荐、也不要当备选**：${blocked.join('、')}`
    : '';
}

/** 已定内容定位那一段。两个提示词共用 */
function contentPlanBlock(plan?: string): string {
  if (!plan?.trim()) return '';
  return [
    '## 🧭 已经定好的内容定位（起号要和它一致）',
    '',
    plan.trim(),
    '',
    '⚠️ 起号打法是用来把上面这个方向**打开**的：优先挑能拍它的主力形式、能喂它的主系列的打法。',
    '真要偏离它，先用一句话说明为什么。',
    '',
  ].join('\n');
}

/** ① 起号打法推荐 */
export function buildGrowthPlanPrompt(p: GrowthPlanParams): string {
  const parts: string[] = [];

  parts.push(`你是一位做实体店短视频代运营的资深编导，正在给一个新号定起号打法。

**你不是在介绍方法，是在替他做选择。** 方案写完他就照着拍，
所以每一计都要说清楚：他为什么能拍、第一条具体拍什么、什么情况下换掉。`);
  parts.push('');

  if (p.contextBlock?.trim()) {
    parts.push(p.contextBlock.trim());
    parts.push('');
  }
  const plan = contentPlanBlock(p.contentPlan);
  if (plan) parts.push(plan);
  if (p.notes?.trim()) {
    parts.push('## 💡 这次的额外要求', '', p.notes.trim(), '');
  }
  if (p.mixBlock?.trim()) parts.push(p.mixBlock.trim(), '');

  parts.push('## 📚 判断依据', '');
  parts.push(GROWTH_MIX, '');
  // 三种视频各怎么拍（方向、结构、结尾指令）——起号方案要按它给出每一种的拍法
  parts.push(rolesGuide(), '');
  // 计管事件怎么走，四大脚本管话怎么讲——起号方案里每一计都要配上讲法，补它讲不清成交理由的短板
  parts.push(ROUTES_GUIDE, '');
  parts.push(MATRIX_TABLE, '');

  const blocked = tacticsBlockedBy(p.restrictions);
  const allowed = (name: string) => !blocked.includes(name);
  const picked = (p.picked ?? []).filter(allowed);

  // 用户圈定了就只发那几计的完整内容；没圈定就发全部的一行摘要
  if (picked.length) {
    parts.push('### 用户已经圈定了这几计，就在这里面做深', '');
    parts.push(picked.map(full).filter(Boolean).join('\n\n'), '');
    parts.push('⚠️ 不要推荐清单之外的打法——用户已经选好了。', '');
  } else {
    parts.push('### 37 计速览（挑 3-4 计，然后去下面要完整内容）', '');
    parts.push(GROWTH_TACTICS.filter((t) => allowed(t.name)).map((t) => brief(t.name)).filter(Boolean).join('\n'), '');
  }
  const note = blockedNote(blocked);
  if (note) parts.push(note, '');

  parts.push('### 测试规则', '', TEST_RULE, '');
  parts.push(THIRTY_DAY_PLAN, '');
  parts.push(DIAGNOSIS_TREE, '');

  parts.push(`## 📤 输出格式

# 🚀 起号方案

## 📌 先说结论

- **建议主攻**：哪 1 计，为什么是它
- **备选**：2-3 计，什么情况下切过去
- **明确不做**：2 条，说明为什么（多半是资源撑不住）
- **多久能看出跑没跑通**：用"零粉到一千粉、流量稳定"这条线来说

## 🧮 起号期内容配比

按「起号期的内容怎么配」：
- 起号期（到一千粉、流量稳定之前）：流量型 / 人设型 / 变现型各占多少，为什么${p.mixBlock?.trim() ? '——**照上面「内容配比」的数写，不要另定**' : ''}
- **每一种用哪一计来拍**：从标了对应类型的计里挑，写清"流量型用 X 计、人设型用 Y 计、变现型用 Z 计"，
  以及每种的脚本结构和结尾行动指令（只写一个）
- 过线之后：补什么、比例怎么变
- 和已定的内容定位怎么对上（主力形式、主系列）；没有内容定位的，按档案里数据最好的内容类型来

## 🎯 主攻打法：[计名]

- **为什么是你能拍的**：对照他的真实资源逐条说（团队几个人、设备、能在哪拍、擅长什么），不要泛泛而谈
- **结构公式**：套到他这个号上，写成具体的
- **配什么脚本讲**：这一计管事件怎么走，话怎么讲从四大脚本里配一个结构（如 正确做法VS错误做法 + 教知识·解题型），
  说明配了它补上的是什么（成交理由？人设？）
- **前 3 条具体拍什么**：每条一句能直接当标题用的话 + 拍摄要点；
  标题叠一个爆款元素（成本、人群、头牌、奇葩、最差、反差、怀旧、荷尔蒙），在后面用括号标出是哪个
- **边界**：什么不能碰（从这一计的边界里挑对他适用的）

## 🔄 备选打法（2-3 计）

每计写：什么情况下切过去、一句话说明怎么套到他这个号上、配哪个四大脚本结构讲。

## 🧪 怎么测

- 一次只改哪个变量
- 每计测几条、看什么指标
- 什么信号算"这计行"，什么信号算"换掉"

## 📅 30 天节奏

按他的真实产能排，不要排成每天一条如果他一周只能拍两次。
每段写清任务和交付物。

## 📊 跑不通先查哪里

挑最可能出现的 3 种情况：什么现象 → 先怀疑什么 → 下一步做什么实验。

## ✍️ 写作要求

- **所有建议必须在他的真实资源之内**：团队几个人、有什么设备、能在哪拍
- **每一计都要说"为什么是你能拍的"**，说不出来就别推荐
- 具体到能开机，不要写"可以尝试…"这类话
- 不要把 37 计罗列一遍——只讲你选中的那几计
- 档案里的禁忌同样管你举的例子和示范标题；例子里的老板、客户、同行也不能写成反面角色（赖账、坑人、难缠）
- **不要替他编数字和经历**：档案里没有的人数、金额、年限、播放量一律写成 X（如《帮X个老板拍了第一条》）；
  档案里没写过的具体经历，标"（示例，换成你自己的真实经历）"

**交稿前自查**（不过关就改完再交，自查过程不用写出来）：
1. 标题和话术里，档案没写过的数字都换成了 X
2. 全文没有出现"揭秘"两个字
3. 例子里没有把哪个老板、客户、同行写成反面角色`);

  return parts.join('\n');
}

/**
 * ①.5 先推荐候选，让用户自己选。
 *
 * 【为什么要多这一步】直接出整份方案有两个问题：一是跑三分钟才知道
 * 它选的方向对不对，不对就得重来；二是用户没有参与感——方案是"给"他的，
 * 不是他"选"的，执行意愿差一截。
 *
 * 所以先花 30 秒出 5 个候选，每个说清"为什么是你能拍的"和"第一条拍什么"，
 * 用户勾中意的，再生成完整方案。选错了成本也只有 30 秒。
 */
export function buildTacticPickPrompt(p: {
  contextBlock?: string;
  /** 已定的内容定位，见 GrowthPlanParams.contentPlan */
  contentPlan?: string;
  /** 档案禁忌原文，见 GrowthPlanParams.restrictions */
  restrictions?: string;
  notes?: string;
  /** 已经测过的打法及条数，来自 summarizeTacticTests */
  tested?: TacticTestStat[];
}): string {
  const parts: string[] = [];

  parts.push(`你是一位做实体店短视频代运营的资深编导。
从下面 37 计里，按这个账号的**真实资源条件**挑出 5 个候选，交给他自己选。

**不要挑最炫的，挑他拍得出来的。** 单人低预算的号推多人剧情，
他拍两条就撑不住，这样的推荐等于没推荐。`);
  parts.push('');

  if (p.contextBlock?.trim()) parts.push(p.contextBlock.trim(), '');
  const plan = contentPlanBlock(p.contentPlan);
  if (plan) parts.push(plan);
  if (p.notes?.trim()) parts.push('## 💡 额外要求', '', p.notes.trim(), '');

  /*
   * 已测记录。没有这一段，推荐就是每次从 37 计里重新抽签——
   * 用户拍了 4 条「行业避坑」还会被再推一次，
   * 而只拍了 1 条就放弃的那一计，也没人告诉他样本根本不够。
   */
  if (p.tested?.length) {
    parts.push('## 🧪 他已经测过的', '');
    for (const t of p.tested) {
      parts.push(
        `- **${t.name}**：已拍 ${t.count} 条${t.enough ? '（样本够了，可以下判断）' : `（还差 ${MIN_SAMPLES - t.count} 条才够判断）`}`
      );
    }
    parts.push('');
    parts.push(TEST_RULE);
    parts.push('');
    parts.push(
      `**据此调整推荐**：还没测够 ${MIN_SAMPLES} 条的，优先建议他接着测完，` +
        '不要急着换新的；已经测够且效果不好的，才换方向。' +
        '如果你推荐的是他已经在测的那一计，要在「为什么是你能拍的」里说明这是接着测，不是重新开始。'
    );
    parts.push('');
  }

  const blocked = tacticsBlockedBy(p.restrictions);
  parts.push('## 📚 判断依据', '', MATRIX_TABLE, '');
  parts.push('### 37 计速览', '');
  parts.push(
    GROWTH_TACTICS.filter((t) => !blocked.includes(t.name)).map((t) => brief(t.name)).filter(Boolean).join('\n'),
    ''
  );
  const note = blockedNote(blocked);
  if (note) parts.push(note, '');

  parts.push(`## 📤 输出格式

**严格按下面的格式输出 5 条，一条都不要多。** 每条之间空一行：

计名｜适合度｜为什么是你能拍的｜第一条拍什么

- **计名**：必须和上面 37 计里的名字**一字不差**
- **适合度**：高 / 中 / 可以试试
- **为什么是你能拍的**：一句话，必须点到他的真实条件（团队几个人、
  有什么设备、能在哪拍、擅长什么），不要写"适合你的账号"这种空话
- **第一条拍什么**：一句能直接当标题用的话

示例（格式参考，内容要换成这个账号的）：
情境还原｜高｜你每周都在客户店里干活，素材自动产生，一个人拿手机就能拍｜今天帮张老板拍第5条，他说昨天来了8个人

不要写前言、不要写总结、不要用表格、不要加编号。只输出这 5 行。`);

  return parts.join('\n');
}

/** 解析候选推荐。格式约定得很死，但模型仍可能变形，所以要容错 */
export interface TacticCandidate {
  name: string;
  fitLevel: string;
  why: string;
  firstShot: string;
}

export function parseTacticCandidates(text: string): TacticCandidate[] {
  const out: TacticCandidate[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^[-*\d.、\s]+/, '');
    if (!line.includes('｜') && !line.includes('|')) continue;
    const cols = line.split(/[｜|]/).map((s) => s.trim());
    if (cols.length < 4) continue;
    // 计名必须对得上 37 计，否则是模型编的或表头行
    const hit = GROWTH_TACTICS.find((t) => cols[0].includes(t.name));
    if (!hit) continue;
    if (out.some((x) => x.name === hit.name)) continue;
    out.push({ name: hit.name, fitLevel: cols[1], why: cols[2], firstShot: cols[3] });
  }
  return out;
}

/**
 * 从生成结果里认出实际用到的计名 / 卡名。
 *
 * 用户没有手动圈定时，是模型自己挑的，挑了哪几个只写在正文里。
 * 想把这个信息传给下一个板块（选题带打法、标题跟钩子），
 * 或者事后统计某一计测了几条，就得先把它从文字里认出来。
 *
 * 只认知识库里真实存在的名字——模型偶尔会造词，造出来的不算。
 * 按出现先后排序：结果里通常第一个就是主推的那个。
 */
function detectNames(text: string, names: string[]): string[] {
  if (!text) return [];
  const hits: Array<{ name: string; at: number }> = [];
  for (const name of names) {
    const at = text.indexOf(name);
    if (at >= 0) hits.push({ name, at });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.name);
}

export function detectTactics(text: string): string[] {
  return detectNames(text, GROWTH_TACTICS.map((t) => t.name));
}

export function detectOpeningCards(text: string): string[] {
  return detectNames(text, OPENING_CARDS.map((c) => c.name));
}

/**
 * 某一计的可注入说明，给选题页和脚本页共用。
 *
 * 打法不是选题——「南乐烧烤店怎么引流」是选题，「反向操作」是拍法。
 * 同一个选题套不同的计，拍出来是两条完全不同的片子。
 * 所以这一段要同时带三样东西：
 *   - 结构公式：脚本按它排，这是这一计之所以成立的骨架
 *   - 适合场景：防止模型把这一计用在它根本不适用的题材上
 *   - 边界：知识库原文写的红线（比如「不要伪造专业资质」），
 *     以前只在起号页显示给人看，模型从来没见过
 */
export function tacticBrief(name: string): string {
  const t = tacticByName(name);
  if (!t) return '';
  const role = roleOfTactic(t.name);
  return [
    `**第 ${t.no} 计 · ${t.name}**`,
    ``,
    ...(role ? [`- **最适合做**：${role}视频（按${role}的结尾行动指令收尾）`] : []),
    `- **为什么成立**：${t.mechanism}`,
    `- **结构公式**：${t.formula}`,
    `- **适合**：${t.fit}`,
    `- **执行要点**：${t.howto}`,
    `- **⚠️ 边界（必须守住）**：${t.limit}`,
  ].join('\n');
}

export interface TacticTestStat {
  name: string;
  /** 用这一计写过几条脚本 */
  count: number;
  /** 按知识库的测试规则，样本够不够下判断 */
  enough: boolean;
}

/** 知识库的测试规则要求每种打法至少测 3—5 条，少于这个数不能否定方法本身 */
export const MIN_SAMPLES = 3;

/**
 * 统计每一计写过几条脚本。
 *
 * 这是 TEST_RULE 能落地的前提。规则原话是「每种打法至少测 3—5 条；
 * 样本太少只能判断单条执行好坏，不能否定方法本身」——
 * 但系统此前不记录哪条脚本用了哪一计，所以这条规则一直是纸上的：
 * 用户拍一条没火就换打法，永远在换、永远起不来，而系统一句话都提示不了。
 *
 * 只数脚本，不数选题：选题是一批 10 条，不是 10 次测试；
 * 一条脚本才对应一条真要拍出来的片子。
 */
export function summarizeTacticTests(rows: unknown): TacticTestStat[] {
  if (!Array.isArray(rows)) return [];
  const counts = new Map<string, number>();

  for (const row of rows) {
    const r = row as { task_type?: string; input_data?: unknown };
    if (r?.task_type !== '脚本生成') continue;

    // input_data 可能是 jsonb 解出来的对象，也可能是一段 JSON 字符串
    let data: { tactic?: unknown } | null = null;
    if (typeof r.input_data === 'string') {
      try {
        data = JSON.parse(r.input_data);
      } catch {
        continue;
      }
    } else if (r.input_data && typeof r.input_data === 'object') {
      data = r.input_data as { tactic?: unknown };
    }

    const name = typeof data?.tactic === 'string' ? data.tactic.trim() : '';
    // 只认知识库里真实存在的计名
    if (!name || !tacticByName(name)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, enough: count >= MIN_SAMPLES }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export interface OpeningParams {
  contextBlock?: string;
  /** 这条内容讲什么 */
  topic: string;
  /** 已有的脚本或开头，想优化时传 */
  currentOpening?: string;
  /** 用户圈定的方法卡。不传就让 AI 按内容目的挑 */
  picked?: string[];
  /** 要几条。圈定了卡时这个数被忽略——每张卡各一条 */
  count?: number;
}

/** 一条开头。从生成结果里逐条解析出来，供用户挑一条去写脚本 */
export interface ParsedOpening {
  no: number;
  /** 用的哪张卡 */
  card: string;
  /** 开头原话——要直接念出来的那句 */
  line: string;
  /** 为什么抓得住这群人 */
  why: string;
  /** 正文怎么兑现 */
  deliver: string;
  risk: string;
}

/**
 * 从开篇结果里逐条解析。
 *
 * 用户要的是「选一个开篇就能去写脚本」，所以必须能把每一条单独拿出来，
 * 而不是把整篇结果当一坨文本丢给脚本页。
 *
 * 输出格式在 buildOpeningPrompt 里约定成 `### N. 卡名` + 一行引用，
 * 但模型仍会变形，所以这里放宽：标题层级 2-4 级都认，序号后的分隔符
 * 点、顿号、空格都认；引用行缺失时退而取第一行正文。
 */
export function parseOpenings(text: string): ParsedOpening[] {
  if (!text) return [];
  const lines = text.split('\n');

  // 先找出所有条目标题的行号
  const heads: Array<{ at: number; no: number; card: string }> = [];
  lines.forEach((raw, i) => {
    const m = raw.match(/^#{2,4}\s*\**\s*(?:第\s*)?(\d+)\s*(?:条)?\s*[.、·:：\-\s]\s*\**\s*(.+?)\s*\**\s*$/);
    if (!m) return;
    const label = m[2].replace(/[（(].*?[）)]/g, '').trim();
    // 卡名必须对得上 36 张，否则是"我推荐哪一条"这类小标题或模型编的
    const hit = OPENING_CARDS.find((c) => label.includes(c.name));
    if (!hit) return;
    heads.push({ at: i, no: Number(m[1]), card: hit.name });
  });

  const field = (block: string[], key: string) => {
    for (const l of block) {
      const m = l.match(new RegExp(`^[-*]\\s*\\**${key}\\**\\s*[：:]\\s*(.+)$`));
      if (m) return m[1].replace(/\*\*/g, '').trim();
    }
    return '';
  };

  return heads.map((h, idx) => {
    const end = idx + 1 < heads.length ? heads[idx + 1].at : lines.length;
    const block = lines.slice(h.at + 1, end);

    // 开头原话优先取引用行；模型没用引用时退而取第一行不是列表的正文
    const quoted = block
      .filter((l) => /^\s*>/.test(l))
      .map((l) => l.replace(/^\s*>\s?/, '').trim())
      .filter(Boolean)
      .join(' ');
    const fallback =
      block.find((l) => l.trim() && !/^[-*#>]/.test(l.trim()))?.trim() ?? '';

    return {
      no: h.no,
      card: h.card,
      line: (quoted || fallback).replace(/^\**|\**$/g, '').trim(),
      why: field(block, '为什么抓得住这群人'),
      deliver: field(block, '正文怎么兑现'),
      risk: field(block, '风险'),
    };
  });
}

const cardFull = (c: OpeningCard) => `### ${c.no}. ${c.name}（${c.category}）

- **心理机制**：${c.psychology}
- **开篇公式**：${c.formula}
- **执行要点**：${c.howto}
- **案例**：${c.cases}
- **推荐组合**：${c.combo}
- **风险边界**：${c.risk}`;

/** ② 开篇钩子生成 */
export function buildOpeningPrompt(p: OpeningParams): string {
  const count = p.count ?? 6;
  const picked = p.picked?.length
    ? OPENING_CARDS.filter((c) => p.picked!.includes(c.name))
    : [];

  const parts: string[] = [];

  parts.push(`你是一位短视频编导，正在给一条内容写开头。

**前 3 秒决定这条片子的生死。** 但钩子不是诱饵——
开头许下的承诺，正文必须兑现，否则完播率会更难看。`);
  parts.push('');

  if (p.contextBlock?.trim()) {
    parts.push(p.contextBlock.trim(), '');
  }

  parts.push('## 🎬 这条内容', '', `**主题**：${p.topic.trim()}`, '');
  // 钩子要为目的服务：流量型开头赌大众，变现型开头赌精准人群
  parts.push(roleInferRule('hook'), '');
  if (p.currentOpening?.trim()) {
    parts.push('**现在的开头**（觉得不够抓人，要换）：', '', p.currentOpening.trim(), '');
  }

  parts.push('## 📚 开篇方法卡', '');
  if (picked.length) {
    // 圈定了就每张各写一条。用户的原话是「每一种开篇都设计一个」——
    // 他要的是横向对比同一条内容的不同开法，不是同一个套路换几个词。
    parts.push(
      `用户圈定了 ${picked.length} 种。**每一种各写一条，一条都不能少、也不要多写**，`,
      '顺序和下面一致。同一条内容用不同的钩子开，差别应该是看得出来的——',
      '如果两条开头换掉几个词就一样，说明其中一条没真的用上那张卡。',
      ''
    );
    parts.push(picked.map(cardFull).join('\n\n'), '');
  } else {
    parts.push(
      `下面是 36 种开篇方法。**先看目标用户和内容目的，再选 1 个主钩子、最多 1-2 个辅助钩子**——堆钩子等于没钩子。`,
      ''
    );
    parts.push(
      OPENING_CARDS.map((c) => `- **${c.name}**（${c.category}）：${c.formula}`).join('\n'),
      ''
    );
  }

  /*
   * 格式约定得很死，是因为用户要在页面上逐条挑一条去写脚本——
   * 挑不出来就等于还得自己复制粘贴。标题行必须是「### 序号. 卡名」，
   * 开头原话必须单独一行引用，解析靠的就是这两条。
   */
  parts.push(`## 📤 输出格式

${
  picked.length
    ? `按下面的顺序，给这 ${picked.length} 张卡各写一条，共 ${picked.length} 条：\n\n${picked
        .map((c, i) => `${i + 1}. ${c.name}`)
        .join('\n')}`
    : `给 ${count} 条，每条用一张不同的卡。`
}

**每条严格按这个结构写，标题行的卡名要和上面一字不差：**

### 1. 卡名
> 开头原话（这是要直接念出来的，写成口语，不要写"（停顿）"这类提示）

- **为什么抓得住这群人**：一句话，对应他们的处境
- **正文怎么兑现**：开头许了什么，正文必须给什么
- **风险**：这么写可能踩什么坑（没有就写"无"）

⚠️ 开头原话必须单独放在 > 引用行里，只放要念的那句话，
不要把解释、括号备注写进引用行——这一行会被直接拿去当脚本的开头。

最后加一段：

## 🎯 我推荐哪一条
挑 1 条，说明为什么它最适合这个号——要结合账号的人设和口吻，
不是挑最刺激的那条。

## ✍️ 写作要求

- **开头写成能直接念的口语**，不是文案腔
- 必须和这个号的口吻一致（看上面的人设与口吻那一段）
- 不要用账号禁忌里写明不能说的话
- **每条用不同的计**，不要六条都是同一个套路
- 承诺要兑现：写不出正文怎么接的，这条就不要给`);

  return parts.join('\n');
}
