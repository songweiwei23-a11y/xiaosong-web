/**
 * 脚本的生成后修复（2026-10-11 第二轮复测）：
 * - 结构：没有「第2步：纯文字文案」这一步。模型有时交的是「候选方向」或别的结构，口播根本没有交出来。
 * - 太长：第 2 步口播超过上限的 1.1 倍。复测里 30 秒的稿子有 307、508、1506 字。
 * - 太短（2026-11-08 产品方：字数要真的够）：第 2 步口播不到目标下限（时长 90% 的字数），就按原稿补足。
 * 目标字数见 lib/ai-recommend 的 scriptSpokenTarget：编导设了时长按设定；没设或 AI 推荐按默认 1分30秒～1分40秒。
 *
 * 修复只改一次，改完必须通过检查才采用，否则保留原稿。额度单独计，不占事实修正的 20 次。
 */
import { scriptSpokenTarget } from './ai-recommend';
import { createRateLimiter } from './rate-limit';

/** 每人每天最多修复 20 次（与事实修正分开计） */
export const scriptRepairLimited = createRateLimiter(24 * 3600_000, 20);

/** 口播字数上限（含默认时长）；取不到秒数返回 null */
export function explicitBudget(duration: string | null | undefined): number | null {
  return scriptSpokenTarget(duration)?.hi ?? null;
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

export type ScriptRepairReason = 'structure' | 'length' | 'short';

/** 需要修复的原因；不需要返回 null */
export function scriptRepairReason(text: string, duration?: string | null): ScriptRepairReason | null {
  const spoken = spokenStep(text);
  if (spoken === null) return 'structure';
  const target = scriptSpokenTarget(duration);
  if (target && spoken > target.hi * 1.1) return 'length';
  if (target && spoken < target.lo) return 'short';
  return null;
}

/**
 * 修复稿要过检查：有第 2 步、口播不超过上限的 1.15 倍（触发线是 1.1 倍，只要不比上限差太多就采用）。
 * 补字数的修复稿还要比原稿长，不能越补越短。取不到目标字数时只看结构。
 */
export function acceptScriptRepair(text: string, duration?: string | null, before?: number | null): boolean {
  const spoken = spokenStep(text);
  if (spoken === null || spoken < 40) return false;
  const target = scriptSpokenTarget(duration);
  if (target && spoken > target.hi * 1.15) return false;
  if (typeof before === 'number' && target && before < target.lo && spoken <= before) return false;
  return true;
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

export function buildScriptRepairPrompt(p: { text: string; reason: ScriptRepairReason; spoken?: number | null; duration?: string | null }): string {
  const target = scriptSpokenTarget(p.duration);
  const budget = target?.hi ?? null;
  const shown = !p.duration?.trim() || /AI/.test(p.duration) ? '默认时长 1分30秒～1分40秒' : p.duration;
  const need = p.reason === 'structure'
    ? '原稿没有「第2步：纯文字文案」这一步，口播没有交出来。请按四步结构重写完整脚本：第1步脚本策略卡、第2步纯文字文案（可以直接念的口播）、第3步完整分镜脚本、第4步执行与优化建议。'
    : p.reason === 'short'
      ? `原稿第 2 步的口播只有 ${p.spoken} 字，时长是${shown}，口播要 ${target?.lo}～${target?.hi} 字，现在明显不够。把第 2 步补到 ${target?.lo}～${target?.hi} 字（写完数过字再交）：按原稿的结构和选题设计，把已经有的情节、画面、动作、对话、情绪转折写细写足，每个节点都讲到；开头的钩子和结尾的行动指令保留。不注水、不重复同一个意思、不加空泛的感悟。第 3 步分镜的台词跟着同步补上，和第 2 步逐字一致；其他步骤不动。输出完整脚本（四步都要）。`
      : `原稿第 2 步的口播有 ${p.spoken} 字，时长是${shown}。第 2 步必须重写到 ${budget} 字以内（硬性上限，写完数过字再交），大约 ${Math.round((budget ?? 150) / 20)} 句，每句 20 字以内：只留开头的钩子、一个具体的画面或经过、一句行动指令。原稿里的铺垫、重复、解释全部删掉，不要只删几句。其他步骤不动。输出完整脚本（四步都要）。`;
  return `【脚本修复】${need}

修改时必须守住：
- 不新增任何素材、数字、价格、顾客原话、个人经历；原稿里没有的事实不要补，只把原稿已有的内容讲细。
- 说话人、人设、口吻、钩子方向和原稿保持一致。
- 只输出修复后的完整脚本，不解释修改了什么，不加自检或说明。

【原稿】
${p.text}`;
}
