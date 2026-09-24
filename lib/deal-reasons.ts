/**
 * 成交理由：17 个理由的清单、分析提示词、结果解析。
 *
 * 【改之前的样子】
 * - 提示词要求 17 个理由**全部**逐条分析、用表格展示。不适用的也写一大段，
 *   结果又长又乱；模型在表格单元格里用 <br> 分行，页面上的"格式化"函数
 *   把 <br> 换成空行——表格从第二行起全散成了一堆带竖线的碎字。
 * - 分析完**自动勾上全部 17 个**，保存门槛是"至少选 15 个"。
 *   等于逼用户把不相干的理由也一起存下去，再喂给选题、脚本、标题。
 * - 存的是英文代号（looks、honest…），各板块提示词里拿到的就是英文代号。
 * - 保存用 upsert(onConflict: user_id)，而线上表的 user_id 没有唯一约束——
 *   **保存从来没成功过**，线上一条记录都没有。
 *
 * 【现在】只详细写适用的（7 分及以上），不适用的每个一行带过；
 * 不用表格；页面按"适用"那一节自动勾选；存中文名。
 */

export interface DealReason {
  id: string;
  label: string;
  icon: string;
  desc: string;
}

/** 17 个核心成交理由。选题页和成交理由页共用这一份 */
export const DEAL_REASONS: DealReason[] = [
  { id: "looks", label: "颜值高", icon: "🌟", desc: "好看出片上镜" },
  { id: "effect", label: "效果好", icon: "✨", desc: "改变明显" },
  { id: "choice", label: "选择多", icon: "📋", desc: "品类全款式多" },
  { id: "unique", label: "有特色", icon: "🎨", desc: "独家唯一" },
  { id: "convenient", label: "便利性", icon: "📍", desc: "近快方便" },
  { id: "boss", label: "老板好", icon: "👨‍🍳", desc: "热情专业" },
  { id: "service", label: "服务好", icon: "💎", desc: "贴心细致" },
  { id: "cases", label: "案例多", icon: "📊", desc: "经验丰富" },
  { id: "prestige", label: "有面子", icon: "🎩", desc: "档次品味" },
  { id: "value", label: "性价比", icon: "💰", desc: "实惠划算" },
  { id: "quality", label: "质量好", icon: "✅", desc: "用料足" },
  { id: "popular", label: "生意好", icon: "🔥", desc: "火爆排队" },
  { id: "reputation", label: "好评多", icon: "⭐", desc: "复购率高" },
  { id: "professional", label: "专业强", icon: "🎓", desc: "有资质" },
  { id: "scale", label: "规模大", icon: "🏢", desc: "连锁分店多" },
  { id: "rare", label: "稀缺唯一", icon: "🦄", desc: "限量独家" },
  { id: "honest", label: "实在不坑", icon: "🤝", desc: "透明不宰客" },
];

/** 几分算"适用"。提示词和解析共用，不各写一个数 */
export const APPLICABLE_MIN_SCORE = 7;

const LABELS = DEAL_REASONS.map((r) => r.label);

/**
 * 把存储里的值统一成中文名。
 * 老代码存的是英文代号（looks、honest），这里顺带兼容：
 * 认得出的代号换成中文，本来就是中文的原样保留，认不出的丢掉。
 */
export function toReasonLabels(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    const s = String(v ?? '').trim();
    const hit = DEAL_REASONS.find((r) => r.id === s || r.label === s);
    if (hit && !out.includes(hit.label)) out.push(hit.label);
  }
  return out;
}

export interface DealReasonInput {
  accountContext?: string;
  storeName: string;
  storeType: string;
  storeFeatures: string;
  targetCustomer?: string;
}

export function buildDealReasonPrompt(input: DealReasonInput): string {
  return `请作为短视频编导，判断下面这家店的 17 个成交理由各自成不成立，并给出怎么在视频里拍出来。
${input.accountContext ? `\n${input.accountContext}\n` : ''}
店铺名称：${input.storeName}
店铺类型：${input.storeType}
店铺特色：${input.storeFeatures}
${input.targetCustomer ? `目标客户：${input.targetCustomer}\n` : ''}
17 个成交理由：${LABELS.join('、')}

逐一打 0-10 分。${APPLICABLE_MIN_SCORE} 分及以上算"适用"。
打分只看这家店的真实情况：店铺特色里没有依据的，不要硬凑成适用。

严格按下面的格式输出。不要用表格，不要用任何 HTML 标签（包括 <br>）：

## 适用的成交理由

（只列 ${APPLICABLE_MIN_SCORE} 分及以上的，按分数从高到低。一个都没有就写"暂无"）

### 1. 理由名称 · 9分

**为什么成立**：一两句话，必须落到这家店的具体事实上

**怎么拍**：
- 一个具体的镜头或场景
- 一个具体的镜头或场景

### 2. 理由名称 · 8分

（同上）

## 不太适用

- 理由名称（几分）：一句话说明为什么不成立
- 理由名称（几分）：一句话说明为什么不成立

## 建议主打

从适用的里挑 2-3 个组合起来主打，一两句话说为什么这样组合。

注意：
- 段与段之间空一行。页面按 Markdown 显示，相邻两行不空行会被挤成一段
- "理由名称"必须是上面 17 个里的原词，一字不改
- 17 个理由都要出现，要么在"适用"，要么在"不太适用"`;
}

export interface ScoredReason {
  label: string;
  score: number;
}

export interface ParsedDealReasons {
  applicable: ScoredReason[];
  notApplicable: ScoredReason[];
}

/** 在一行文字里认出是 17 个理由中的哪一个。按名字从长到短匹配，避免"稀缺唯一"被别的短词截胡 */
function findLabel(text: string): string | null {
  const sorted = [...LABELS].sort((a, b) => b.length - a.length);
  return sorted.find((l) => text.includes(l)) ?? null;
}

/**
 * 从分析结果里解析出适用 / 不适用的理由。
 *
 * 页面按"适用"那一节自动勾选——显示给用户看的和自动勾上的必须是同一份，
 * 所以这里只认结构，不认措辞。流式输出时会被反复调用，半截的内容也要能解析。
 */
export function parseDealReasons(markdown: string): ParsedDealReasons {
  const applicable: ScoredReason[] = [];
  const notApplicable: ScoredReason[] = [];
  if (!markdown) return { applicable, notApplicable };

  let section: 'none' | 'applicable' | 'not' | 'other' = 'none';
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (/^#{1,3}\s*[^#]/.test(line) && !/^#{3,}\s*\d/.test(line)) {
      // 二级标题切换小节；"### 1. xx" 这种是条目，不是小节
      if (/不太适用|不适用/.test(line)) section = 'not';
      else if (/适用/.test(line)) section = 'applicable';
      else section = 'other';
      continue;
    }

    if (section === 'applicable') {
      // ### 1. 实在不坑 · 9分    （分隔符可能是 · - — | ： 括号 或空格）
      const m = line.match(/^#{2,4}\s*\d+\s*[.、)）]?\s*(.+?)\s*[·・\-—|｜:：\s（(]\s*(\d+(?:\.\d+)?)\s*分/);
      if (m) {
        const label = findLabel(m[1]);
        const score = Number(m[2]);
        if (label && !applicable.some((r) => r.label === label)) applicable.push({ label, score });
      }
    } else if (section === 'not') {
      // 颜值高（3分）：原因     或  - 颜值高(3分): 原因
      const m = line.match(/^[-*•]?\s*(.+?)\s*[（(]\s*(\d+(?:\.\d+)?)\s*分\s*[）)]/);
      if (m) {
        const label = findLabel(m[1]);
        if (label && !notApplicable.some((r) => r.label === label)) {
          notApplicable.push({ label, score: Number(m[2]) });
        }
      }
    }
  }

  // 模型偶尔会把低分的也放进"适用"。以分数为准，不以它放在哪一节为准
  const demoted = applicable.filter((r) => r.score < APPLICABLE_MIN_SCORE);
  return {
    applicable: applicable.filter((r) => r.score >= APPLICABLE_MIN_SCORE),
    notApplicable: [...notApplicable, ...demoted.filter((d) => !notApplicable.some((n) => n.label === d.label))],
  };
}

/**
 * 老结果的最小修补。
 *
 * 原来的"格式化"会把 <br> 换成空行、把 || 换成加粗——这正是表格被撑碎的原因。
 * 新结果不再有表格，也不需要格式化。只对历史里存着的老结果做一件事：
 * 单元格里的 <br> 换成分号，表格行就不会断开。
 */
export function normalizeLegacyResult(text: string): string {
  return (text || '').replace(/<br\s*\/?>/gi, '；');
}
