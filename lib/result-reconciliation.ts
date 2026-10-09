/** 只校正能够确定计算的统计，不改变编辑判断、标题正文或作者原话。 */
export function reconcileReviewScores(markdown: string): string {
  const rows = [...markdown.matchAll(/^\s*\|([^\n|]+)\|\s*\*{0,2}(\d+(?:\.\d+)?)\s*\/\s*(\d+)\*{0,2}\s*\|/gm)]
    .filter(m => /核心目的|信息递进|事实与证据|表达与人设|拍摄执行|收束与目的/.test(m[1]));
  const expected = [20, 20, 20, 15, 15, 10];
  if (rows.length !== 6 || rows.some((m, i) => Number(m[3]) !== expected[i] || Number(m[2]) > expected[i])) return markdown;
  const sum = Math.round(rows.reduce((n, m) => n + Number(m[2]), 0) * 10) / 10;
  const score = Number((sum / 10).toFixed(2));
  return markdown.split('\n').map(line => {
    // 只认交付报告的总分行；不替换原稿引用、正文或评分依据里的数字。
    const plain = line.replace(/\*/g, '').trim();
    if (/^(?:[-+]\s*)?(?:综合得分|综合评分|总评分|最终得分)\s*[：:]/.test(plain)) return `综合得分：${score} / 10（按六项得分合计）`;
    if (/^(?:[-+]\s*)?百分制合计\s*[：:]/.test(plain)) return `百分制合计：${sum} / 100 → 最终得分 ${score} / 10`;
    if (/^(?:[-+]\s*)?合计\s*[：:]\s*\d+(?:\.\d+)?\s*\/\s*100\s*→/.test(plain)) return `合计：${sum} / 100 → ${score} / 10（按六项得分合计）`;
    // 模型会在补充说明里另写“按实际表现调整为8.5分”，与六项加总自相矛盾。
    // 只处理报告的该总评分说明，不替换原稿或其他评价数字。
    if (/^(?:[-+]\s*)?总评补充说明\s*[：:]/.test(plain) && /六维评分|六项评分/.test(plain)) {
      return line.replace(/按实际表现调整为\s*\d+(?:\.\d+)?\s*分/g, `最终合计为${score}分`);
    }
    return line;
  }).join('\n');
}

/** 标题字数的统一口径：Unicode 字母与数字，不含标点、空格和表情。 */
export function titleCharacterCount(title: string): number {
  return (title.match(/[\p{L}\p{N}]/gu) ?? []).length;
}

export function reconcileTitleCounts(markdown: string): string {
  let title = '';
  let fenced = false;
  return markdown.split('\n').map(line => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; title = ''; return line; }
    if (fenced) return line;
    const heading = line.replace(/\*\*/g, '').match(/^\s*(?:#{1,4}\s*)?(?:标题\s*)?\d{1,2}[.、．:：)）]\s*(.+?)\s*$/);
    if (heading) title = heading[1];
    else if (/^\s*#{1,4}\s/.test(line)) title = '';
    if (title && /^\s*(?:[-*+]\s*)?\*{0,2}字数\*{0,2}\s*[：:]\s*\*{0,2}\d+/.test(line)) {
      return `- **字数**：${titleCharacterCount(title)} 字（不含标点和空格）`;
    }
    return line;
  }).join('\n');
}

/** 极窄的截断特征：末尾落在未写完的结构标签，而非以字数猜测质量。 */
export function hasObviousCutoff(text: string): boolean {
  return /【(?:画面|口播|台词|镜头|字幕|动作|第\d+步)?[^】\n]{0,10}$/.test(text.trimEnd())
    || /(?:^|\n)\*\*(?:画|画面|台|台词|口|口播|字|字幕|动|动作|镜|镜头)$/.test(text.trimEnd());
}
