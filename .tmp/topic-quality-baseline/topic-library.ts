/**
 * 选题库：把每一批选题拆成一条一条，全部保留下来；并据此防止重复。
 *
 * 【为什么要拆】选题是一批一批生成的，存档也是一批一整段。用户能看到的是
 * "某天那一批"，想找两周前出过的某一条，得一批批点开翻。要求是：
 * 每一条选题都能单独保留、单独找到、单独拿去接着做。
 *
 * 【为什么要防重复】同样的输入连生成两次，10 条里有 7 条是同一个选题——
 * 只是换了顺序、把全角标点换成了半角。原因是 Dify 会话记忆：
 * AI 看到"上次同样的问题我答了这 10 条"，就照着再写一遍。
 * 靠记忆防不了重复，得把"已经出过的"明明白白告诉它、并且禁止重出。
 */

export interface TopicSection {
  title: string;
  /** 这条选题下面的全部内容：内容方向、开篇钩子、拍摄思路…… */
  body: string;
}

/**
 * 选题标题行。两种写法都认：
 *   ## 选题1：我在濮阳街头……
 *   ## 📌 选题1：【对抗反常识型】     ← 标题在下面的 **标题**：《……》 里
 * 序号、分隔符、层级、前面的 emoji 都不统一，所以放宽匹配。
 */
const HEADING = /^(#{1,4})\s*(?:[^\s#\w一-龥]{1,3}\s*)?\**\s*选题\s*\d+\s*[：:\-—、.]?\s*(.*)$/;
/**
 * 更早的一种写法：按类别分组，题目是编号标题，不带"选题"二字：
 *   ## 【教知识型选题】6条
 *   ### 1. 《濮阳一家火锅店，老板不会拍视频……》
 * 只在上面那种一条都认不出时才用它兜底——"### 1. xxx"太常见，
 * 平时就用它的话，会把选题内部的编号小节误认成选题。
 */
const NUMBERED = /^(#{2,4})\s*()\d+\s*[.、)）]\s*(.+)$/;
const TITLE_LINE = /^\**\s*标题\s*\**\s*[：:]\s*\**\s*(.+?)\s*\**\s*$/;

function cleanTitle(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/^[《「"“]+|[》」"”]+$/g, '')
    .replace(/\s*[（(][^）)]*[）)]\s*$/, '') // 结尾的括号备注
    .trim();
}

/** 只有类别没有题目的标题行，比如「【对抗反常识型】」 */
function isCategoryOnly(s: string): boolean {
  const t = s.replace(/\*\*/g, '').trim();
  return !t || /^【[^】]*】$/.test(t);
}

/**
 * 把一批选题拆成一条一条。
 * 一条的范围：从它的标题行，到下一条选题、或者同级及以上的别的标题（比如"## 发布建议"）为止。
 */
export function splitTopicSections(markdown: string): TopicSection[] {
  return locateSections(markdown).map(({ title, body }) => ({ title, body }));
}

/** 带行号的拆分结果：删除某一条时要知道它占哪几行 */
interface LocatedSection extends TopicSection {
  /** 标题行所在行号 */
  start: number;
  /** 这一条结束的下一行（不含） */
  end: number;
}

function locateSections(markdown: string): LocatedSection[] {
  if (!markdown) return [];
  const primary = splitWith(markdown, HEADING, 2);
  return primary.length > 0 ? primary : splitWith(markdown, NUMBERED, 3);
}

function splitWith(markdown: string, heading: RegExp, titleGroup: number): LocatedSection[] {
  const lines = markdown.split('\n');
  const out: LocatedSection[] = [];
  let cur: { level: number; heading: string; body: string[]; start: number } | null = null;

  const flush = (end: number) => {
    if (!cur) return;
    let title = isCategoryOnly(cur.heading) ? '' : cleanTitle(cur.heading);
    if (!title) {
      // 题目写在 **标题**：《……》 那一行
      const line = cur.body.map((l) => l.trim()).find((l) => TITLE_LINE.test(l));
      if (line) title = cleanTitle(line.match(TITLE_LINE)![1]);
    }
    const body = cur.body.join('\n').replace(/\n-{3,}\s*$/, '').trim();
    if (title) out.push({ title, body, start: cur.start, end });
    cur = null;
  };

  lines.forEach((line, i) => {
    const m = line.match(heading);
    if (m) {
      flush(i);
      cur = { level: m[1].length, heading: m[titleGroup], body: [], start: i };
      return;
    }
    const other = line.match(/^(#{1,6})\s/);
    if (cur && other && other[1].length <= cur.level) {
      // 同级或更高级的非选题标题：这一条到此为止
      flush(i);
      return;
    }
    if (cur) cur.body.push(line);
  });
  flush(lines.length);
  return out;
}

/**
 * 从一批里删掉某一条（按指纹匹配，同一条在一批里出现几次都删掉）。
 * 返回删完的正文和删掉的标题；一条都没匹配上时原样返回。
 */
export function removeTopicSection(
  markdown: string,
  title: string
): { markdown: string; removed: string[] } {
  const key = topicKey(title);
  const hits = locateSections(markdown).filter((s) => topicKey(s.title) === key);
  if (!key || hits.length === 0) return { markdown, removed: [] };
  const lines = markdown.split('\n');
  const drop = new Set<number>();
  for (const h of hits) for (let i = h.start; i < h.end; i++) drop.add(i);
  const kept = lines.filter((_, i) => !drop.has(i)).join('\n').replace(/\n{3,}/g, '\n\n');
  return { markdown: kept, removed: hits.map((h) => h.title) };
}

/**
 * 某一批里被用户删掉的选题。记在那一批存档的 input_data.deletedTopics 里——
 * 删掉多半是因为不喜欢，所以它们照样算"已经出过"，不能让 AI 再推回来。
 */
export function deletedTopicsOf(inputData: unknown): string[] {
  const d = inputData && typeof inputData === 'object' ? (inputData as Record<string, unknown>).deletedTopics : null;
  return Array.isArray(d) ? d.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];
}

/**
 * 用来判断"是不是同一条"的标题指纹。
 * 这次撞车的那几条，就是只把全角的"，？"换成了半角的",?"——
 * 按原文比一条都比不出来。所以标点、空格、书名号全部去掉，只比字。
 */
export function topicKey(title: string): string {
  return (title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export interface LibraryTopic {
  title: string;
  body: string;
  /** 来自哪一批（script_history 的 id），逐条删除时要用 */
  batchId: string;
  createdAt: string;
}

/**
 * 从若干批次里汇总出选题库。批次按新到旧传入；
 * 同一条在好几批里都出现过（正是这次的毛病），只留最新的那一次。
 */
export function collectTopics(
  batches: { id: string; result: string | null; created_at: string }[]
): LibraryTopic[] {
  const seen = new Set<string>();
  const out: LibraryTopic[] = [];
  for (const b of batches) {
    for (const s of splitTopicSections(b.result || '')) {
      const k = topicKey(s.title);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({ title: s.title, body: s.body, batchId: b.id, createdAt: b.created_at });
    }
  }
  return out;
}

/**
 * 这一批选题是不是这个档案出的。
 *
 * 防重复清单原来按"用户"取：四个档案的选题混在一起，给家具城出选题时，
 * 代运营号的选题也被当成"这个账号出过的"发给 AI，上限 100 条还被别的号挤占。
 *
 * 新记录存了 profile_id，直接比；旧记录没存 id，但 profileInfo 里有档案名称，按名字认；
 * 两样都没有的（极少）算进来——宁可多防一点重复，也不要漏。
 */
export function batchBelongsToProfile(
  inputData: unknown,
  profileId: string,
  profileName?: string | null
): boolean {
  const d = inputData && typeof inputData === 'object' ? (inputData as Record<string, unknown>) : {};
  const pid = d.profile_id ?? d.profileId;
  if (typeof pid === 'string' && pid) return pid === profileId;
  let info: unknown = d.profileInfo;
  if (typeof info === 'string') {
    try {
      info = JSON.parse(info);
    } catch {
      info = null;
    }
  }
  const name = info && typeof info === 'object' ? (info as Record<string, unknown>)['档案名称'] : undefined;
  if (typeof name === 'string' && name.trim()) return !!profileName && name.trim() === profileName.trim();
  return true;
}

/** 生成前要附上"已经出过的"清单、禁止重复的任务 */
export const NO_REPEAT_TASKS = new Set(['选题策划']);

/**
 * 不接共用会话的任务（生成和追问都不接，也不把自己的会话写回去）。
 *
 * - 选题：共用会话里有上一次同样问题的完整回答，会把出新点子的任务带回老路上。
 * - 三份定位：一次提示词两万字、产出一两万字，塞进共用会话几次就把它撑爆——
 *   9/24 内容定位连续三次"超出模型上下文"就是这么来的，而且连累所有板块。
 *   它们要的背景（档案、已有的账号定位）提示词里都明写了，不靠会话；
 *   别的板块用定位时也是从数据库读，不靠会话。
 * - 起号方案：同理——档案、已定的内容定位都在提示词里，会话只会把上一版方案带进来。
 * - 创作简报（2026-10-02）：定位、档案、配比、禁忌、排除清单都在提示词里。接共用会话的话，
 *   这个档案之前在自由对话、脚本里聊过的东西（比如编导建档时刻意去掉的"公益""直播"）会被带回简报，
 *   而简报会下发到所有板块——一处带偏，处处跑偏。
 */
export const ISOLATED_TASKS = new Set(['选题策划', '账号定位', '商业定位', '内容定位', '创作简报', '起号方案', '拆解爆款', '跨行业二创', '创作方向', '画布改写']);
// 画布改写（2026-10-03）：自由对话结果画布里"把这段改口语点"，每次单独开会话——不读也不写共用记忆

/**
 * 追问对话里，用户这句话是不是在要**新**选题。
 *
 * 只有这时才附上"已经出过的"清单。"第 3 条展开讲讲""这条怎么拍"这类追问
 * 如果也附一句"出过的不许重复"，反而会把 AI 带偏——用户要的恰恰是那一条。
 */
export function wantsNewTopics(text: string): boolean {
  const t = (text || '').replace(/\s/g, '');
  return (
    /(再|重新|另外|多)(来|出|给|生成|想|写|列|策划|推荐)[^，。？！,.?!]{0,8}(选题|条|个|批)/.test(t) ||
    /换一?(批|组|些)/.test(t) ||
    /(新的|别的|其他的?|不一样的)(选题|角度|方向)/.test(t)
  );
}

/** 防重复时最多列出多少条旧选题。太多会稀释指令、拖慢生成，最近的最要紧 */
export const NO_REPEAT_LIMIT = 100;

/**
 * 发给 AI 的"已经出过的选题"清单。
 *
 * 只列题目也够了：题目本身就带着切入点（"街头采访老板""拒单""90后vs70后"），
 * 模型看得出哪些角度用过了。
 */
export function buildNoRepeatBlock(titles: string[]): string {
  const list = titles.slice(0, NO_REPEAT_LIMIT);
  if (list.length === 0) return '';
  return [
    '',
    '【已经出过的选题——这次一条都不能重复】',
    `下面是这个账号之前已经生成过的 ${list.length} 条选题。这次的每一条都必须是新的：`,
    '- 不许原样重复，也不许只改标点、改数字、调换语序、换个说法重出同一条',
    '- 下面用过的切入点和场景（比如同一种采访、同一种对比、同一个人物设定），这次换别的',
    '- 宁可角度冷门一点，也不要回到用过的路子上',
    '',
    ...list.map((t, i) => `${i + 1}. ${t}`),
    '',
  ].join('\n');
}
