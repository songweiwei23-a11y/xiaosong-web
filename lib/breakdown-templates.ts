/**
 * 拆解报告里的「变现方向」（2026-10-12）：拆解的核心目的是二创裂变。
 * 拆完按模版对应的不同变现目的（吸引客户、卖服务……）给 5 个方向，每个方向带着一份可以 1:1 复刻的二创结构，
 * 选中某个方向，它的目的和结构整份带去其他板块，在那里再按自己的行业裂变。
 *
 * 闭环的三件事：
 * 1. 模型把每个方向输出成结构化的 JSON（目的、分段、开篇、情绪曲线、镜头、开头台词都是字段），而不是散文。
 * 2. 页面用卡片渲染这份 JSON（排版固定），报告里不再重复显示原始结构文字。
 * 3. 每个方向生成一份固定格式的「二创结构」纯文本（renderCanonical），带「1:1 复刻」的要求；
 *    directionSettings 把目的和方向写进创作设置；复制、收藏和跳转交给其他板块的，都是这份文本和设置。
 */

export const TEMPLATE_SPEC = `### 八、变现方向（二创结构，5 个）

拆解的目的是二创裂变。这里给 5 个方向，每个方向对应一个不同的变现目的，并带着一份可以原样复刻的二创结构：分段的数量、顺序、每段的功能、用的拆解知识、镜头，和上面的拆解一一对应。方向只定「目的」和「拍什么」，不写具体行业；行业由用户到了目标板块再指定，所以结构里只替换题材、人物、场景和具体说法。

请把 5 个方向放进一个 \`\`\`json 代码块里，内容是一个数组，每个元素是一个方向。字段名一个都不能改、不能少。这一节只输出这个代码块：

\`\`\`json
[
  {
    "no": 1,
    "goal": "这个方向要达到的变现目的（4–8 个字，如「吸引更多客户」「卖服务」「招代理」）",
    "name": "这条二创的名字（4–10 个字）",
    "purpose": "流量型 / 人设型 / 变现型，只写一个",
    "direction": "一句话：拍什么、拍给谁看。不写具体行业，行业用【行业】占位",
    "profile_fit": "为什么适合这个账号，只用档案里有的事实；没有档案就写空字符串",
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
- 有账号档案时：5 个方向的目的都要是这个账号能变现的（如吸引客户、卖服务、卖产品、招代理、引到私域成交），purpose 都写「变现型」；profile_fit 只用档案里的经营事实，不编数字。没有档案时：5 个方向各写一个不同的目的，流量、人设、变现都要有，profile_fit 写空字符串。
- 5 个方向的 goal 各不相同，方向之间不能只换词。
- segments 的段数和顺序与上面的分段表一致，每段的 function 和 knowledge 照原片写，不能合并、不能漏掉。
- shots 与上面的逐镜头一一对应（文字拆解没有镜头，shots 写空数组 []）。
- 新题材里没有的人、事、数字，一律写成【待确认：…】占位，不编事实。不写具体行业（餐饮店、服装店这类）。
- JSON 字符串里不要用英文双引号，需要引号时用「」。`;

export interface BreakdownSegment { time: string; function: string; knowledge: string; do: string; lines: string }
export interface BreakdownShot { no: number; time: string; size: string; camera: string; visual: string; line: string; role: string; knowledge: string }
export interface BreakdownTemplate {
  no: number;
  name: string;
  /** 变现目的（方向的标题），如「吸引更多客户」 */
  goal: string;
  purpose: string;
  direction: string;
  /** 为什么适合这个账号（有档案时才有） */
  profile_fit: string;
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
  // 目的类别只认三种；模型写成「变现型（吸引客户）」这类也认得出来
  const purpose = str(o.purpose).match(/流量型|人设型|变现型/)?.[0] ?? '';
  return {
    no: Number(o.no) || i + 1,
    name: str(o.name).replace(/[*「」]/g, '') || `方向${i + 1}`,
    goal: str(o.goal).replace(/[*「」]/g, ''),
    purpose,
    direction: str(o.direction),
    profile_fit: str(o.profile_fit),
    segments: arr(o.segments, (s) => ({ time: str(s.time), function: str(s.function), knowledge: str(s.knowledge), do: str(s.do), lines: str(s.lines) })),
    opening: { hook: str(op.hook), first_2s: str(op.first_2s), first_5s: str(op.first_5s), payoff_at: str(op.payoff_at) },
    emotion: { curve: str(em.curve), peaks: str(em.peaks) },
    shots: arr(o.shots, (s) => ({ no: Number(s.no) || 0, time: str(s.time), size: str(s.size), camera: str(s.camera), visual: str(s.visual), line: str(s.line), role: str(s.role), knowledge: str(s.knowledge) })),
    first_line: str(o.first_line),
    boards: arr(o.boards, (b) => str(b)).filter(Boolean),
  };
}

/** 把报告拆成「正文（给人看）」和「变现方向（结构化，给其他板块）」。方向段落之后的内容保留在正文末尾（若有）。 */
export function splitBreakdownResult(result: string): { report: string; templates: BreakdownTemplate[]; hasStructure: boolean } {
  const head = result.search(/^#{2,4}\s*八[、.．]/m);
  // 没写「八、」标题时，就在整份结果里找 JSON 代码块
  const from = head >= 0 ? head : 0;
  const m = result.slice(from).match(/```json\s*([\s\S]*?)```/);
  if (!m) return { report: head >= 0 ? result.slice(0, head).trimEnd() : result, templates: [], hasStructure: false };
  const jsonAt = from + (m.index ?? 0);
  // 正文 = JSON 之前的内容 + JSON 之后的内容，只去掉 JSON 代码块本身
  const before = head >= 0 ? result.slice(0, head) : result.slice(0, jsonAt);
  const after = result.slice(jsonAt + m[0].length);
  const body = (before + after).trimEnd();
  try {
    const parsed = JSON.parse(m[1]);
    const list = Array.isArray(parsed) ? parsed : [];
    const templates = list.map(normalize).filter((t) => t.segments.length > 0 || t.goal || t.name);
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
 * 行业不写在这里：到了目标板块，由用户自己指定行业再裂变。
 */
export function renderCanonical(t: BreakdownTemplate): string {
  const label = t.goal || t.name;
  const lines: string[] = [];
  lines.push(`【二创结构 · 方向${t.no}：${label}】`);
  lines.push(`变现目的：${t.goal || '未写'}`);
  lines.push(`目的类别：${t.purpose || '未写'}`);
  lines.push(`方向：${t.direction || '未写'}`);
  if (t.profile_fit) lines.push(`为什么适合这个账号：${t.profile_fit}`);
  lines.push('行业：未指定，到用的板块再由用户指定（如餐饮店、服装店），只替换题材，不换结构');
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

/** 整份报告带去其他板块时一起带上的全部方向和二创结构（不显示在正文里，随「继续创作」带过去） */
export function renderAllCanonical(templates: BreakdownTemplate[]): string {
  if (!templates.length) return '';
  return ['【二创结构（全部变现方向，每个都可 1:1 复刻）】', ...templates.map(renderCanonical)].join('\n\n');
}

/**
 * 选中一个方向带去其他板块时的创作设置：目的（类别 + 完整目的）和主线跟着方向走。
 * 不写行业和人群：那是用户到了目标板块自己指定的。
 */
export function directionSettings(t: BreakdownTemplate): { purpose?: string; purposeText?: string; focusContent?: string } {
  const focus = [t.goal, t.direction].filter(Boolean).join('：');
  return {
    purpose: t.purpose || undefined,
    purposeText: t.goal || undefined,
    focusContent: focus || undefined,
  };
}
