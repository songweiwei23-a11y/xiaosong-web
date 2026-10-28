/**
 * 出处的确定性兜底（2026-10-12）：模型改写不稳定、修正常常超时，所以对仍然没有出处的句子，不再让模型改，
 * 直接把这一句换成【待确认】占位。占位是验收标准允许的写法（E3：没有依据时标【待确认】即可通过）。
 *
 * 逐行、逐句判断：只替换有问题的句子，其余原样保留。
 * 跳过：否定或警告语境的行（「不要写 90%」是提醒）；已经标了【示例】【待确认】【换成】的行。
 */
import { isNegatedLine } from './output-guard';

export const PENDING_MARK = '【待确认：这句需要用你的真实情况填写】';

const ALREADY_MARKED = /【待确认|【示例|【换成|（示例）|\(示例\)/;

export interface HoldResult {
  text: string;
  held: number;
}

/**
 * issuesOf：判断一段文字有没有没有出处的说法（与路由里的事实检查用同一套）
 */
/**
 * 行首的编号和标签（「1. **先别做硬广**：」「- **核心问题**：」「- 预算：」）：替换句子时留着它，
 * 不然整行换成占位，编号断了、读的人也不知道这一项原来在说什么（2026-10-28 内容规划「先别做」第 1 条）。
 */
const LINE_LABEL = /^\s*(?:(?:[-*]|\d+[.、．)）])\s*)?(?:\*\*[^*\n]{1,24}\*\*\s*[：:]?\s*|[^：:\n。！？]{1,12}[：:]\s*)?/;

export function holdUnsupported(text: string, issuesOf: (t: string) => string[]): HoldResult {
  let held = 0;
  const lines = text.split('\n').map((line) => {
    if (!line.trim() || isNegatedLine(line) || ALREADY_MARKED.test(line)) return line;
    if (issuesOf(line).length === 0) return line;
    // 先只看标签后面的正文；正文里找不到问题句（问题在标签本身），就按整行处理
    let label = line.match(LINE_LABEL)?.[0] ?? '';
    if (label && issuesOf(line.slice(label.length)).length === 0) label = '';
    const body = line.slice(label.length);
    // 按句号、问号、感叹号切开，只替换有问题的句子；连续的占位合并成一个
    const parts = body.split(/(?<=[。！？])/);
    const out: string[] = [];
    for (const part of parts) {
      if (!part.trim()) { out.push(part); continue; }
      if (issuesOf(part).length === 0) { out.push(part); continue; }
      held++;
      if (out[out.length - 1] !== PENDING_MARK) out.push(PENDING_MARK);
    }
    return label + out.join('');
  });
  return { text: lines.join('\n'), held };
}
