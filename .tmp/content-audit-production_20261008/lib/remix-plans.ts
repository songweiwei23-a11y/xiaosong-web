export interface RemixPlan { id: string; title: string; body: string; }
/** 只按方案标题切分，忽略口播、分镜里的数字和代码示例。 */
export function splitRemixPlans(markdown: string): { intro: string; footer: string; plans: RemixPlan[] } {
  const lines = markdown.split('\n');
  const starts: Array<{ index: number; title: string; level: number }> = [];
  let fenced = false;
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    const heading = line.match(/^\s*(#{1,4})\s+(.+?)\s*#*\s*$/);
    const bold = heading ? null : line.match(/^\s*\*\*(.+?)\*\*\s*$/);
    const title = (heading?.[2] || bold?.[1] || '').replace(/\*\*/g, '').trim();
    if (/^(?:[^\p{L}\p{N}]*)(?:二创)?方案\s*(?:\d+|[一二三四五六七八九十]+)(?=\s|[：:、｜|.（(【：—-]|$)/u.test(title)) {
      starts.push({ index, title, level: heading ? heading[1].length : 3 });
    }
  });
  if (!starts.length) return { intro: '', footer: '', plans: markdown.trim() ? [{ id: 'plan-1', title: '二创方案', body: markdown.trim() }] : [] };
  const level = Math.min(...starts.map(item => item.level));
  const boundaries = starts.filter(item => item.level === level);
  // 整批推荐会提到其他方案，应留在方案之外，不能夹进最后一个方案。
  let end = lines.length;
  fenced = false;
  for (let index = boundaries[boundaries.length - 1].index + 1; index < lines.length; index++) {
    if (/^\s*(```|~~~)/.test(lines[index])) { fenced = !fenced; continue; }
    const heading = !fenced && lines[index].match(/^\s*(#{1,4})\s+/);
    if (heading && heading[1].length <= level) { end = index; break; }
  }
  return {
    intro: lines.slice(0, boundaries[0].index).join('\n').trim(),
    footer: lines.slice(end).join('\n').trim(),
    plans: boundaries.map((item, i) => ({
      id: `plan-${i + 1}`, title: item.title,
      body: lines.slice(item.index, boundaries[i + 1]?.index ?? end).join('\n').replace(/\n\s*---\s*$/, '').trim(),
    })),
  };
}
