/**
 * 拆解报告里的「套用模版」（2026-10-12）：拆解的目的是二创，拆解结果要能 1:1 地交给其他板块。
 *
 * 闭环的三件事：
 * 1. 模型把每个模版输出成结构化的 JSON（分段、开篇、情绪曲线、镜头、开头台词都是字段），而不是散文。
 * 2. 页面用卡片渲染这份 JSON（排版固定），报告里不再重复显示原始模版文字。
 * 3. 每个模版生成一份固定格式的「二创结构」纯文本（renderCanonical），带「1:1 复刻」的要求；
 *    复制按钮和跳转到选题 / 脚本 / 创作方向 / 审稿优化 / 分镜，交给它们的都是这份文本。
 */

export const TEMPLATE_SPEC = `### 八、套用模版（二创结构，至少 5 个）

拆解的目的是二创。每个模版都是一份可以原样复刻的二创结构：分段的数量、顺序、每段的功能、用的拆解知识、镜头，和上面的拆解一一对应；只换题材、人物、场景和具体说法。

请把所有模版放进一个 \`\`\`json 代码块里，内容是一个数组，每个元素是一个模版。字段名一个都不能改、不能少：

\`\`\`json
[
  {
    "no": 1,
    "name": "模版名称（4–10 个字）",
    "purpose": "流量型 / 人设型 / 变现型，只写一个，和拆解结论一致",
    "direction": "一句话：新题材是什么，拍给谁看",
    "segments": [
      {"time": "0–3 秒", "function": "抓人（抓人 / 铺垫 / 冲突 / 证据 / 高潮 / 兑现 / 行动指令，照原片这一段的功能）", "knowledge": "开篇 36 计：盲盒（写出拆解里用的知识名字）", "do": "这一段怎么拍或怎么写，对应原片的哪一段", "lines": "这一段要说的话的要点，写成能直接念的句子"}
    ],
    "opening": {"hook": "用的钩子或开篇 36 计", "first_2s": "前 2 秒怎么抓人", "first_5s": "前 5 秒埋什么期待", "payoff_at": "钩子在第几秒兑现"},
    "emotion": {"curve": "反转型 / 盲盒型 / 共鸣爆发型 / 情感渗透型", "peaks": "起伏点在第几秒、靠什么做起伏"},
    "shots": [
      {"no": 1, "time": "0–3 秒", "size": "景别", "camera": "运镜", "visual": "画面要点", "line": "台词要点", "role": "这一镜在整条里的作用", "knowledge": "用的拆解知识"}
    ],
    "first_line": "开头第一句，能直接念",
    "boards": ["适合的板块：选题 / 脚本 / 创作方向 / 审稿优化 / 分镜，写你认为适合的几个"]
  }
]
\`\`\`

要求：
- segments 的段数和顺序与上面的分段表一致，每段的 function 和 knowledge 照原片写，不能合并、不能漏掉。
- shots 与上面的逐镜头一一对应（文字拆解没有镜头，shots 写空数组 []）。
- 新题材里没有的人、事、数字，一律写成【待确认：…】占位，不编事实。
- JSON 字符串里不要用英文双引号，需要引号时用「」。只输出这个代码块，不要在代码块外面解释。`;

/**
 * 第九节「可套用的模板创作方向」（2026-10-12）：按账号档案给 3 个方向。
 * 每个方向引用第八节的一个模版，写清结构骨架和第一句，能收藏，能交给脚本、选题继续用。
 * 标题统一是「#### 方向 N｜名称」，创作列表靠这个标题认出每一条。
 */
export const DIRECTION_FORMAT = `按下面的账号档案，给 3 个可套用的模板创作方向。每个方向都要能收藏，并能直接交给「脚本」或「选题」继续用，所以每一个都要写全。

每个方向按这个格式写，标题必须是「#### 方向 N｜名称」（N 是 1、2、3，名称 4–10 个字）：

#### 方向 1｜名称
- **目的**：流量型 / 人设型 / 变现型，只写一个，和拆解结论一致
- **套用的模版**：模版 N（对应上面「八、套用模版」里的一个），分段数量和顺序照它来
- **方向**：一句话，拍什么、拍给谁看
- **结构骨架**：按分段写，「1. 0–3 秒 抓人（开篇 36 计：盲盒）→ 2. …」，段数和模版一致，每段用的拆解知识要点名
- **第一句怎么说**：能直接念的开头第一句，口吻用档案里的人设
- **适合给**：脚本 / 选题（写清先给哪一个，为什么）

要求：
- 只用档案里有的事实；档案里没有的人、事、数字写成【待确认：…】，不编造。
- 3 个方向用到的模版要不一样，方向之间不能只换词。
- 这一节之外不要再加别的小节。`;

export interface BreakdownSegment { time: string; function: string; knowledge: string; do: string; lines: string }
export interface BreakdownShot { no: number; time: string; size: string; camera: string; visual: string; line: string; role: string; knowledge: string }
export interface BreakdownTemplate {
  no: number;
  name: string;
  purpose: string;
  direction: string;
  segments: BreakdownSegment[];
  opening: { hook: string; first_2s: string; first_5s: string; payoff_at: string };
  emotion: { curve: string; peaks: string };
  shots: BreakdownShot[];
  first_line: string;
  boards: string[];
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const arr = <T>(v: unknown, f: (x: any) => T): T[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').map(f) : []);

function normalize(raw: any, i: number): BreakdownTemplate {
  const o = raw && typeof raw === 'object' ? raw : {};
  const op = o.opening && typeof o.opening === 'object' ? o.opening : {};
  const em = o.emotion && typeof o.emotion === 'object' ? o.emotion : {};
  return {
    no: Number(o.no) || i + 1,
    name: str(o.name) || `模版${i + 1}`,
    purpose: str(o.purpose).replace(/[*「」]/g, ''),
    direction: str(o.direction),
    segments: arr(o.segments, (s) => ({ time: str(s.time), function: str(s.function), knowledge: str(s.knowledge), do: str(s.do), lines: str(s.lines) })),
    opening: { hook: str(op.hook), first_2s: str(op.first_2s), first_5s: str(op.first_5s), payoff_at: str(op.payoff_at) },
    emotion: { curve: str(em.curve), peaks: str(em.peaks) },
    shots: arr(o.shots, (s) => ({ no: Number(s.no) || 0, time: str(s.time), size: str(s.size), camera: str(s.camera), visual: str(s.visual), line: str(s.line), role: str(s.role), knowledge: str(s.knowledge) })),
    first_line: str(o.first_line),
    boards: arr(o.boards, (b) => str(b)).filter(Boolean),
  };
}

/** 把报告拆成「正文（给人看）」和「模版（结构化，给其他板块）」。模版段落之后的内容保留在正文末尾（若有）。 */
export function splitBreakdownResult(result: string): { report: string; templates: BreakdownTemplate[]; hasStructure: boolean } {
  const head = result.search(/^#{2,4}\s*八、套用模版/m);
  // 没写「八、套用模版」标题时，就在整份结果里找 JSON 代码块
  const from = head >= 0 ? head : 0;
  const m = result.slice(from).match(/```json\s*([\s\S]*?)```/);
  if (!m) return { report: head >= 0 ? result.slice(0, head).trimEnd() : result, templates: [], hasStructure: false };
  const jsonAt = from + (m.index ?? 0);
  // 正文 = JSON 之前的内容 + JSON 之后的内容（第九节「可套用的模板创作方向」在这里），只去掉 JSON 代码块本身
  const before = head >= 0 ? result.slice(0, head) : result.slice(0, jsonAt);
  const after = result.slice(jsonAt + m[0].length);
  const body = (before + after).trimEnd();
  try {
    const parsed = JSON.parse(m[1]);
    const list = Array.isArray(parsed) ? parsed : [];
    const templates = list.map(normalize).filter((t) => t.segments.length > 0 || t.name);
    return { report: body, templates, hasStructure: true };
  } catch {
    return { report: body, templates: [], hasStructure: true };
  }
}

export function parseBreakdownTemplates(result: string): BreakdownTemplate[] {
  return splitBreakdownResult(result).templates;
}

/**
 * 「二创结构」纯文本：固定格式，原样复制、原样交给其他板块。带「1:1 复刻」的要求。
 */
export function renderCanonical(t: BreakdownTemplate): string {
  const lines: string[] = [];
  lines.push(`【二创结构 · 模版${t.no}：${t.name}】`);
  lines.push(`目的：${t.purpose || '未写'}`);
  lines.push(`方向：${t.direction || '未写'}`);
  lines.push('');
  lines.push(`分段（${t.segments.length} 段，按顺序 1:1 复刻，段数和每段功能不增不减）：`);
  t.segments.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.time}｜${s.function}｜知识：${s.knowledge || '未写'}`);
    if (s.do) lines.push(`   做法：${s.do}`);
    if (s.lines) lines.push(`   台词要点：${s.lines}`);
  });
  lines.push('');
  lines.push(`开篇：钩子 ${t.opening.hook || '未写'}；前 2 秒 ${t.opening.first_2s || '未写'}；前 5 秒 ${t.opening.first_5s || '未写'}；兑现在 ${t.opening.payoff_at || '未写'}`);
  lines.push(`情绪曲线：${t.emotion.curve || '未写'}；起伏点 ${t.emotion.peaks || '未写'}`);
  if (t.shots.length) {
    lines.push('');
    lines.push(`镜头（${t.shots.length} 个，与原片逐镜头对应）：`);
    t.shots.forEach((s, i) => lines.push(`${i + 1}. ${s.time}｜${s.size}｜${s.camera}｜画面：${s.visual}｜台词：${s.line}｜作用：${s.role}｜知识：${s.knowledge}`));
  }
  lines.push('');
  lines.push(`开头第一句：${t.first_line || '未写'}`);
  lines.push('');
  lines.push('要求：二创必须 1:1 复刻以上的分段数量、顺序、每段功能、用的拆解知识和镜头；只替换题材、人物、场景和具体说法。不新增原结构没有的段落。新题材里没有的事实用【待确认】占位，不编造。');
  return lines.join('\n');
}
