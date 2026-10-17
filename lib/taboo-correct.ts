/**
 * 违禁词平台修正（整改 C 期 · 违禁词，2026-10-17）。
 *
 * 原来的做法：模型写完，结果页标出违禁词，让编导自己改或点「让 AI 改掉」。模型还是会反复写，
 * 所以现在由平台直接把「确定能换」的绝对化词改成平实的说法，不依赖模型再写一遍。
 *
 * 规则：
 *   - 只替换 scanTaboos 命中的词，并且只替换命中的那一处（同一句里的分析用法不动）；
 *   - 只用下面这张表里写明的替换词，表里没有的命中项保持原样，继续由结果页的违禁词提示处理；
 *   - 替换是「显示层」的：历史记录里存的还是模型原稿，打开时按同样的规则再修正一次，结果一致；
 *   - 会列出改了哪些词、各几处，界面上可以切回原文，不静默改。
 */
import { scanTaboos } from './taboos';

/** 命中词 → 替换词。替换后语意不变、语法通顺；拿不准的不放进来 */
export const TABOO_CORRECTIONS: Record<string, string> = {
  '全城最正宗': '很地道',
  '最正宗': '很地道',
  '最地道': '很地道',
  '最好吃': '很好吃',
  '最好': '很好',
  '最便宜': '很便宜',
  '最划算': '很划算',
  '最实惠': '很实惠',
  '最专业': '很专业',
  '最强': '很强',
  '最大': '较大',
  '最火': '很火',
  '最全': '很全',
  '最高端': '偏高端',
  '最安全': '比较安全',
  '最靠谱': '比较靠谱',
  '最佳': '理想的',
  '全网最低': '价格很亲民',
  '顶级': '高档',
  '独家': '特色',
  '唯一': '独特',
  '史上最': '很',
};

/** 检测只看命中词前后这么多字：够覆盖 scanTaboos 的上下文判断（分析、排除用法） */
const WINDOW = 12;

export interface TabooCorrection {
  from: string;
  to: string;
  count: number;
}

export interface TabooCorrected {
  text: string;
  changes: TabooCorrection[];
}

/**
 * 修正一段正文。profile 用来判断行业禁忌（和结果页的违禁词提示用同一份档案）。
 * 没有可替换的命中时，原样返回，changes 为空。
 */
export function autoCorrectTaboos(text: string, profile: object | null | undefined): TabooCorrected {
  const hits = scanTaboos(text, profile).map((h) => h.word).filter((w) => w in TABOO_CORRECTIONS);
  if (!hits.length) return { text, changes: [] };

  const counts = new Map<string, number>();
  const words = [...new Set(hits)].sort((a, b) => b.length - a.length);
  const lines = text.split('\n').map((line) => {
    let out = line;
    for (const word of words) {
      // 从后往前替换，前面的下标不会因为替换而错位
      const at: number[] = [];
      for (let i = out.indexOf(word); i !== -1; i = out.indexOf(word, i + word.length)) at.push(i);
      for (const idx of at.reverse()) {
        const from = Math.max(0, idx - WINDOW);
        const to = Math.min(out.length, idx + word.length + WINDOW);
        const window = out.slice(from, to);
        // 这一处单独看还是违禁词，才改；分析用法（「最大的优势」）在窗口里就不命中
        const still = scanTaboos(window, profile).some((h) => h.word === word);
        if (!still) continue;
        out = out.slice(0, idx) + TABOO_CORRECTIONS[word] + out.slice(idx + word.length);
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
    return out;
  });

  const changes = [...counts.entries()].map(([from, count]) => ({ from, to: TABOO_CORRECTIONS[from], count }));
  return { text: lines.join('\n'), changes };
}

/** 给界面看的一句话：「已自动修正 3 处：最大→较大 ×2，唯一→独特 ×1」 */
export function describeCorrections(changes: TabooCorrection[]): string {
  const total = changes.reduce((n, c) => n + c.count, 0);
  return `已自动修正 ${total} 处：${changes.map((c) => `${c.from}→${c.to}${c.count > 1 ? ` ×${c.count}` : ''}`).join('，')}`;
}
