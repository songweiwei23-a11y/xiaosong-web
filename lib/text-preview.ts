/**
 * 很长的正文先显示前面一段（结果区的「摘要优先」）。
 * 尽量在段落处截断，不把一段话切成两半；前面找不到合适的段落分隔，就按字数硬截。
 */
export function previewCut(text: string, max: number): string {
  if (text.length <= max) return text;
  const at = text.lastIndexOf('\n\n', max);
  const cut = at > max * 0.5 ? at : max;
  return text.slice(0, cut).trimEnd();
}
