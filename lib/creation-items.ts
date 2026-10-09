/**
 * 把一份创作结果拆成"可以单独带走的一条一条"（2026-10-02）。
 *
 * 产品方要求：自由对话里结合热点出了 6 个选题，用户想只拿其中两条去写脚本——
 * 勾选、点「脚本生成」，那两条自动填进去，点生成就出结果。任何板块的产出都一样。
 * 原来「继续创作」只能把整条回答一股脑带走，脚本页拿到 6 个选题还得自己删。
 *
 * 认的写法（线上见过的）：
 *   ### 选题1：……   ## 📌 选题1：【类别】（题目在下面「**标题**：《…》」里）
 *   ### 1. 【流量型·地域差异】成本选题+地域对立（题目在「**选题：** …」里）
 *   ## 方向一 / 方案 2 / 脚本 3 / 版本A
 *   整段没有标题时：1. **…** 这样的编号列表
 * 不认的：脚本内部的「1. 开场 0-3秒」「2. 正文」这类段落——它们是一条内容的组成部分，不是并列的几条。
 */

export type CreationItemKind = 'topic' | 'script' | 'direction' | 'plan' | 'title' | 'item';

export interface CreationItem {
  id: string;
  /** 列表里给人看的名字 */
  label: string;
  /** 真正的题目（选题、标题类才有），交给脚本页当候选 */
  topic?: string;
  kind: CreationItemKind;
  /** 含标题行的整段，带走时原样带走 */
  body: string;
}

export interface CreationItems {
  intro: string;
  items: CreationItem[];
  footer: string;
}

/*
 * 创作生产相关的都算（产品方 2026-10-02："方向、思路、执行建议、选题、脚本……哪怕是一个想法，
 * 都是创作不可或缺的，都要能勾选、收藏、继续创作"）。账号运营板块里的方向、思路也算——那是灵感。
 * 长的放前面：正则按顺序试，「执行建议」要先于「建议」匹配上。
 */
const KIND_WORDS: Record<Exclude<CreationItemKind, 'item'>, string[]> = {
  topic: ['选题', '主题', '题目'],
  // 「Vlog 1」「视频2」：一次策划几条视频（线上真实写法）
  script: ['脚本', '文案', '口播稿', '视频', 'Vlog', 'vlog', 'VLOG'],
  direction: ['账号方向', '内容方向', '创作方向', '切入角度', '切入点', '方向', '角度', '思路', '灵感', '想法', '点子', '创意', '系列', '栏目', '人设'],
  plan: ['执行建议', '操作建议', '落地建议', '行动建议', '方案', '策划', '计划', '选择', '建议', '玩法', '打法', '做法', '拍法', '形式', '策略', '方法', '技巧'],
  title: ['标题', '开头', '开篇', '钩子'],
};
const KEYWORD = [...Object.values(KIND_WORDS).flat(), '版本'].sort((a, b) => b.length - a.length).join('|');
const CN_NUM = '[一二三四五六七八九十]{1,3}';
/**
 * 带关键词的：选题1 / 方向一 / 方案A / 脚本 3 / 选择1 / 建议2；
 * 以及「第1条」「第二版」——线上一次出 5 条文案就是「## 第1条：【变现型·晒过程】……」
 */
/*
 * 关键词前面允许多一两个字：「备选方向2」「新思路1」，以及模型手误——
 * 线上实测一次出 5 个方向，第 3 个写成了「方方向3」，原来就漏认了。
 * 「我推荐先做：方向1」前面字多，不会被当成一条。
 */
const KEYWORD_ITEM = new RegExp(`^(?:\\p{Script=Han}{0,2}?(?:${KEYWORD})\\s*(?:\\d{1,2}|${CN_NUM}|[A-Ha-h])|第\\s*(?:\\d{1,2}|${CN_NUM})\\s*(?:条|个|版|篇|种|套|期))(?=\\s|[：:、.．|｜（(【\\-—]|$)`, 'u');
/** 纯数字编号：1. / 2、 / 3） */
const NUMBER_ITEM = /^\d{1,2}\s*[.、．)）]\s*\S/;
/**
 * 脚本内部的段落、报告的收尾小节——编号了也不是"并列的几条"。
 * 「1. 先确定拍摄场地 2. 准备道具」这种执行建议要能勾，所以拍摄、准备、道具、发布不在这里
 */
const STRUCTURAL = /分析|拆解|核查|核验|评估|开场|开篇钩子(?!\d)|正文|中段|结尾|收尾|铺垫|高潮|转折|镜头\s*\d|分镜|总评|逐维度打分|问题清单|优化后的完整脚本|纯文字文案|节奏自检|拍摄顺序|拍摄清单|注意事项|总结|\d+\s*[-–~～]\s*\d+\s*秒|^\d{1,2}\s*[.、．)）]\s*(?:为什么|原因)/;
const TOPIC_LINE = /^\s*[-*>]?\s*\**\s*(?:选题|标题|题目|主题)\s*\**\s*[：:]\s*\**\s*(.+?)\s*\**\s*$/;

/** 标题行的文字：去掉 #、加粗、开头的 emoji 和符号 */
function headingText(line: string): { level: number; text: string } | null {
  const h = line.match(/^\s*(#{1,4})\s+(.+?)\s*#*\s*$/);
  const bold = h ? null : line.match(/^\s*\*\*(.+?)\*\*\s*[：:]?\s*$/);
  if (!h && !bold) return null;
  const text = keycap((h?.[2] ?? bold![1]).replace(/\*\*/g, ''))
    .replace(/^[^\p{L}\p{N}【《]+/u, '')
    // 「三、第1条：成都串串火锅」：大纲序号后面才是真正的条目编号（线上真实写法）
    .replace(new RegExp(`^${CN_NUM}[、.．]\\s*(?=第\\s*\\d|(?:${KEYWORD})\\s*(?:\\d|${CN_NUM}))`), '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { level: h ? h[1].length : 5, text };
}

/** 表情数字编号当普通编号：「1️⃣ 先问自己」「② 拍后厨」→「1. 先问自己」「2. 拍后厨」 */
function keycap(s: string): string {
  return s
    .replace(/^(\s*[^\p{L}\p{N}]*?)(\d{1,2})️?⃣\s*/u, '$1$2. ')
    .replace(/^(\s*)([①-⑳])\s*/u, (_m, sp: string, c: string) => `${sp}${c.charCodeAt(0) - 0x2460 + 1}. `)
    // 关键词后面的：「方向1️⃣ 弱势群体+头牌组合」（线上真实写法）→「方向1 弱势群体+头牌组合」
    .replace(/(\d{1,2})️?⃣/gu, '$1 ');
}

const cleanTopic = (s: string) => s.replace(/\*\*/g, '').replace(/^[《「"“]+|[》」"”]+$/g, '').replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim();

/** 列表里显示的名字：去掉「选题1：」「1.」前缀和类别标签外的多余符号 */
function labelOf(text: string): string {
  return text.replace(/^\d{1,2}\s*[.、．)）]\s*/, '').replace(/\*\*/g, '').trim().slice(0, 80) || text.slice(0, 80);
}

const kindOfWord = (w: string): CreationItemKind | undefined =>
  (Object.entries(KIND_WORDS) as [Exclude<CreationItemKind, 'item'>, string[]][]).find(([, ws]) => ws.includes(w))?.[0];

/**
 * 这一条是什么。先看开头的关键词（「思路2」），再看正文（有口播 → 脚本），
 * 最后看标题里说的事（「先从老板人设切入」→ 方向思路，「每周固定拍三条」这类做法 → 方案建议）。
 * 都认不出算普通条目，界面上折叠起来。
 */
function kindOf(text: string, body: string): CreationItemKind {
  // 和 KEYWORD_ITEM 一样允许前面多一两个字（「方方向3」「备选方向2」）
  const k = text.match(new RegExp(`^(${KEYWORD})`))?.[1]
    ?? text.match(new RegExp(`^\\p{Script=Han}{1,2}?(${KEYWORD})\\s*(?:\\d|${CN_NUM}|[A-Ha-h])`, 'u'))?.[1];
  const byWord = k ? kindOfWord(k) : undefined;
  if (byWord) return byWord;
  if (/(?:^|\n)\s*[-*>]?\s*\**\s*(?:选题|标题|题目)\s*\**\s*[：:]/.test(body) || /《[^》]{4,}》/.test(text)) return 'topic';
  if (/口播|台词|分镜|镜头\s*\d|【镜头/.test(body)) return 'script';
  const head = text.replace(/^\d{1,2}\s*[.、．)）]\s*/, '');
  if (/方向|思路|角度|切入|人设|内容线|系列|栏目|灵感|想法|创意|定位/.test(head)) return 'direction';
  if (/建议|做法|怎么做|怎么拍|执行|落地|策略|打法|玩法|拍法|技巧|方法|计划|先|再|每天|每周|固定/.test(head)) return 'plan';
  return 'item';
}

/** 一条里的真正题目：「**选题：** …」「**标题**：《…》」；都没有时，选题/标题类用标题行本身 */
function topicOf(text: string, body: string, kind: CreationItemKind): string | undefined {
  for (const line of body.split('\n').slice(1, 12)) {
    const m = line.match(TOPIC_LINE);
    if (m && cleanTopic(m[1]).length >= 4) return cleanTopic(m[1]).slice(0, 120);
  }
  if (kind !== 'topic' && kind !== 'title') return undefined;
  const t = cleanTopic(text.replace(new RegExp(`^(?:${KEYWORD})?\\s*(?:\\d{1,2}|${CN_NUM}|[A-Ha-h])?\\s*[：:、.．|｜\\-—]?\\s*`), '').replace(/^【[^】]*】\s*/, ''));
  return t.length >= 4 ? t.slice(0, 120) : undefined;
}

export function splitCreationItems(markdown: string): CreationItems {
  const text = String(markdown ?? '');
  const lines = text.split('\n');
  const empty = { intro: text.trim(), items: [], footer: '' };

  // 找候选标题（代码块里的不算）
  type Cand = { index: number; level: number; text: string; keyword: boolean };
  const cands: Cand[] = [];
  const parents: { level: number; text: string }[] = [];
  let fenced = false;
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    const h = headingText(line);
    if (!h) return;
    while (parents.length && parents[parents.length - 1].level >= h.level) parents.pop();
    const keyword = KEYWORD_ITEM.test(h.text);
    const analysisSection = parents.some(parent => parent.level >= 2 && /(?:结构|逐项|逐句).*(?:拆解|分析)|(?:拆解|分析).*(?:结构|逐项|逐句)/.test(parent.text));
    // 拆解中的“1.开篇钩子、2.脚本结构…”是分析维度；后面真正的选题/方向仍可带走。
    if (keyword || (NUMBER_ITEM.test(h.text) && !analysisSection)) cands.push({ index, level: h.level, text: h.text, keyword });
    parents.push(h);
  });

  // 取最浅的、至少有两条的那一层
  const levels = [...new Set(cands.map((c) => c.level))].sort((a, b) => a - b);
  let starts: Cand[] = [];
  for (const lv of levels) {
    const at = cands.filter((c) => c.level === lv);
    if (at.length >= 2) { starts = at; break; }
  }

  let ranges: { start: number; end: number; text: string; keyword: boolean }[] = [];
  if (starts.length >= 2) {
    const level = starts[0].level;
    ranges = starts.map((s, i) => {
      let end = starts[i + 1]?.index ?? lines.length;
      // 最后一条：遇到同级或更高级的其他标题（比如「## 发布建议」）就结束，后面算结尾
      if (i === starts.length - 1) {
        fenced = false;
        for (let j = s.index + 1; j < lines.length; j++) {
          if (/^\s*(```|~~~)/.test(lines[j])) { fenced = !fenced; continue; }
          const h = !fenced && headingText(lines[j]);
          if (h && h.level <= level) { end = j; break; }
        }
      }
      return { start: s.index, end, text: s.text, keyword: s.keyword };
    });
  } else if (!lines.some((l) => /^\s*#{1,4}\s+/.test(l))) {
    // 整段没有标题：顶格的编号列表当一条一条
    const listStarts = lines.map((l, i) => ({ i, m: keycap(l).match(/^(\d{1,2})[.、．)）]\s+(.+)$/) })).filter((x) => x.m);
    if (listStarts.length >= 2) {
      ranges = listStarts.map((x, k) => {
        let end = listStarts[k + 1]?.i ?? lines.length;
        if (k === listStarts.length - 1) {
          // 最后一条之后隔一个空行、又不是缩进续行的，算结尾
          for (let j = x.i + 1; j < lines.length; j++) {
            if (lines[j].trim() === '' && j + 1 < lines.length && lines[j + 1].trim() && !/^\s{2,}|^\s*[-*]/.test(lines[j + 1])) { end = j; break; }
          }
        }
        return { start: x.i, end, text: x.m![0].replace(/\*\*/g, '').trim(), keyword: false };
      });
    }
  }
  if (ranges.length < 2) return empty;

  // 纯编号的、多数是脚本段落/报告小节：不是并列的几条
  const plain = ranges.filter((r) => !r.keyword);
  if (plain.length && plain.filter((r) => STRUCTURAL.test(r.text)).length * 2 >= plain.length) return empty;

  /*
   * 条目自己没说是什么时，看上面的大标题：「## 拍摄时的 6 个建议」下面的「多拍备用素材」「现场随机应变」
   * 就是执行建议（线上真实回答，原来被当成普通条目折叠了）
   */
  const above = lines.slice(Math.max(0, ranges[0].start - 6), ranges[0].start).join('\n').slice(-300);
  const parentKind: CreationItemKind | undefined =
    /脚本|文案|口播/.test(above) ? 'script'
      : /选题/.test(above) ? 'topic'
      : /方向|思路|灵感|角度|创意|点子/.test(above) ? 'direction'
      : /建议|技巧|方法|要点|做法|怎么拍|怎么做|策略|打法|玩法|拍法|执行|经验/.test(above) ? 'plan'
      : undefined;

  const items = ranges.map((r, i) => {
    const body = lines.slice(r.start, r.end).join('\n').replace(/\n\s*-{3,}\s*$/, '').trim();
    const own = kindOf(r.text, body);
    const kind = own === 'item' && parentKind ? parentKind : own;
    return { id: `item-${i + 1}`, label: labelOf(r.text), topic: topicOf(r.text, body, kind), kind, body };
  });
  return {
    intro: lines.slice(0, ranges[0].start).join('\n').trim(),
    items,
    footer: lines.slice(ranges[ranges.length - 1].end).join('\n').trim(),
  };
}

const KIND_NAME: Record<CreationItemKind, string> = { topic: '选题', script: '脚本', direction: '方向思路', plan: '方案建议', title: '标题', item: '内容' };

/** 创作方向默认只勾前五个和推荐的那一个，其余留给用户自己勾；别的板块照旧全勾 */
export function defaultPickIds(parts: CreationItems): string[] {
  if (itemsNoun(parts.items) !== '方向思路') return parts.items.map((it) => it.id);
  return parts.items.filter((it, i) => i < 5 || /我推荐/.test(`${it.label}${it.body}`)).map((it) => it.id);
}

/**
 * 这一批主要是什么：「勾选要带走的选题」。
 * 几类创作内容混在一起（两条方向、两条做法、一条选题）叫「创作内容」，照样展开给勾；
 * 只有大半认不出来时才叫「内容」，界面上折叠
 */
export function itemsNoun(items: CreationItem[]): string {
  const count: Partial<Record<CreationItemKind, number>> = {};
  for (const it of items) count[it.kind] = (count[it.kind] ?? 0) + 1;
  const top = (Object.entries(count) as [CreationItemKind, number][]).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] * 2 > items.length) return KIND_NAME[top[0]];
  const creative = items.filter((it) => it.kind !== 'item').length;
  return creative * 2 > items.length ? '创作内容' : '内容';
}

/**
 * 勾选的那几条拼成要带走的正文。
 * 开头那段说明（比如「根据濮阳最近一周的热点……」）短的话一起带上——它是这批内容的前提；
 * 结尾的「我推荐先拍哪个」这类整批点评不带：它说的可能正是没勾的那几条。
 */
export function selectionBody(parts: CreationItems, ids: Iterable<string>): { body: string; title: string; topicOptions: string[] } {
  const want = new Set(ids);
  const picked = parts.items.filter((it) => want.has(it.id));
  const intro = parts.intro && parts.intro.length <= 400 ? parts.intro + '\n\n' : '';
  const body = intro + picked.map((it) => it.body).join('\n\n---\n\n');
  const topicOptions = picked.map((it) => it.topic).filter((t): t is string => Boolean(t));
  const title = picked.length === 1 ? (picked[0].topic || picked[0].label) : `${picked.length} 条：${picked.map((it) => it.topic || it.label).join('、')}`.slice(0, 180);
  return { body, title, topicOptions };
}
