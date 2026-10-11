/**
 * 脚本的生成后修复（2026-10-11 第二轮复测）：
 * - 结构：没有「第2步：纯文字文案」这一步。模型有时交的是「候选方向」或别的结构，口播根本没有交出来。
 * - 时长：编导明确设了时长（30 秒）时，第 2 步口播超过上限的 1.1 倍。复测里有 307、508、1506 字，远超 30 秒。
 * 只有编导明确设了时长才查长度；「AI推荐」时长按内容优先，不查（见 lib/ai-recommend 的 durationRule）。
 *
 * 修复只改一次，改完必须通过同样的检查才采用，否则保留原稿。额度单独计，不占事实修正的 20 次。
 */
import { durationCeilingSeconds, SPEECH_CHARS_PER_SECOND } from './ai-recommend';
import { createRateLimiter } from './rate-limit';

/** 每人每天最多修复 20 次（与事实修正分开计） */
export const scriptRepairLimited = createRateLimiter(24 * 3600_000, 20);

/** 编导明确设的时长对应的口播字数上限；没设（空、AI推荐）返回 null */
export function explicitBudget(duration: string | null | undefined): number | null {
  const d = (duration ?? '').trim();
  if (!d || /AI/.test(d)) return null;
  const sec = durationCeilingSeconds(d);
  return sec ? Math.round(sec * SPEECH_CHARS_PER_SECOND) : null;
}

/** 第 2 步「纯文字文案」的汉字数；没有这一步返回 null */
export function spokenStep(text: string): number | null {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^\s*#+\s*第\s*2\s*步.*纯文字文案/.test(l));
  if (start < 0) return null;
  let cjk = 0;
  for (const line of lines.slice(start + 1)) {
    if (/^\s*#+\s*第\s*\d\s*步/.test(line)) break;
    cjk += (line.match(/[一-鿿]/g) ?? []).length;
  }
  return cjk;
}

/** 需要修复的原因；不需要返回 null */
export function scriptRepairReason(text: string, duration?: string | null): 'structure' | 'length' | null {
  const spoken = spokenStep(text);
  if (spoken === null) return 'structure';
  const budget = explicitBudget(duration);
  if (budget && spoken > budget * 1.1) return 'length';
  return null;
}

/**
 * 修复稿要过同样的检查：有第 2 步、口播不超过上限的 1.15 倍（约 172 字，与质检的 170 字口径一致；
 * 触发线是 1.1 倍，修复稿只要不比原来的上限差太多就采用）。不设上限的时长只看结构。
 */
export function acceptScriptRepair(text: string, duration?: string | null): boolean {
  const spoken = spokenStep(text);
  if (spoken === null || spoken < 40) return false;
  const budget = explicitBudget(duration);
  return !budget || spoken <= budget * 1.15;
}

/**
 * 本地兜底（2026-10-12）：修复后第 2 步口播仍超上限，就按句裁到预算以内。
 * 保留第一句（钩子）和最后一句（收尾），中间按原顺序保留能放得下的句子。只动第 2 步，其他步骤原样。
 * 不改写一个字，只删句子，所以不会新增任何事实。
 */
export function trimSpokenStep(text: string, budget: number): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^\s*#+\s*第\s*2\s*步.*纯文字文案/.test(l));
  if (start < 0) return text;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*#+\s*第\s*\d\s*步/.test(lines[i])) { end = i; break; }
  }
  const cjk = (s: string) => (s.match(/[一-鿿]/g) ?? []).length;
  const sentences: string[] = [];
  for (const line of lines.slice(start + 1, end)) {
    if (!line.trim()) continue;
    for (const s of line.split(/(?<=[。！？])/)) if (s.trim()) sentences.push(s.trim());
  }
  const total = sentences.reduce((n, s) => n + cjk(s), 0);
  if (total <= budget || sentences.length < 2) return text;

  const first = sentences[0];
  const last = sentences[sentences.length - 1];
  let kept: string[];
  if (cjk(first) + cjk(last) <= budget) {
    let used = cjk(first) + cjk(last);
    const middle: string[] = [];
    for (const s of sentences.slice(1, -1)) {
      if (used + cjk(s) > budget) continue;
      middle.push(s);
      used += cjk(s);
    }
    kept = [first, ...middle, last];
  } else if (cjk(first) <= budget) {
    kept = [first];
  } else {
    return text;
  }
  return [...lines.slice(0, start + 1), '', kept.join('\n'), '', ...lines.slice(end)].join('\n');
}

export function buildScriptRepairPrompt(p: { text: string; reason: 'structure' | 'length'; spoken?: number | null; duration?: string | null }): string {
  const budget = explicitBudget(p.duration);
  const need = p.reason === 'structure'
    ? '原稿没有「第2步：纯文字文案」这一步，口播没有交出来。请按四步结构重写完整脚本：第1步脚本策略卡、第2步纯文字文案（可以直接念的口播）、第3步完整分镜脚本、第4步执行与优化建议。'
    : `原稿第 2 步的口播有 ${p.spoken} 字，编导设的是 ${p.duration}。第 2 步必须重写到 ${budget} 字以内（硬性上限，写完数过字再交），大约 ${Math.round((budget ?? 150) / 20)} 句，每句 20 字以内：只留开头的钩子、一个具体的画面或经过、一句行动指令。原稿里的铺垫、重复、解释全部删掉，不要只删几句。其他步骤不动。输出完整脚本（四步都要）。`;
  return `【脚本修复】${need}

修改时必须守住：
- 不新增任何素材、数字、价格、顾客原话、个人经历；原稿里没有的不要补。
- 说话人、人设、口吻、钩子方向和原稿保持一致。
- 只输出修复后的完整脚本，不解释修改了什么，不加自检或说明。

【原稿】
${p.text}`;
}
