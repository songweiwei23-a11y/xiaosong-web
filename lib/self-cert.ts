/**
 * 删掉模型给自己发的合格证（2026-10-05 现状研究：正式版约四分之一的回答写了「自检通过 / 无虚构 / 未编造」，
 * 其中有的恰恰编了顾客见证——它写「✅ 安全核查通过 · 无虚构顾客故事」，上面就是三处编的见证）。
 * 这类话不可信，留着只会误导用户，所以展示、复制、带去下一步之前一律删掉；真假以程序核对为准（lib/quality-checks）。
 *
 * 删三种：
 *   1. 单独一行的自我认证（「✅ 安全核查通过」「自检：无编造」）
 *   2. 这一行下面紧跟的清单（「- 无具体价格」「- 无虚构顾客故事」……）
 *   3. 标题是「自检 / 自查 / 安全核查 / 合规检查」的整节
 * 正文句子里顺带一句的（「……，自检通过，无编造。」）只删这几个词。
 */
const CLAIM = /(?:自检|自查|安全核查|合规核查|事实核查|核查|检查|核对)(?:已)?通过|无编造|没有编造|未编造|无虚构|没有虚构|未虚构|全部(?:属实|真实)|数据(?:均|都)?真实可靠|事实(?:均|都)?已核实/;
const SECTION_TITLE = /自检|自查|安全核查|合规(?:检查|核查)|事实(?:核查|核对)|质量自评/;

export function stripSelfCert(text: string): string {
  if (!text || !CLAIM.test(text) && !/^\s*#{1,4}\s+.*(?:自检|自查|安全核查)/m.test(text)) return text;
  const lines = text.split('\n');
  const out: string[] = [];
  let skipList = false;
  let skipSection = 0;
  for (const line of lines) {
    const heading = line.match(/^\s*(#{1,4})\s+(.*)$/);
    if (heading) {
      if (skipSection && heading[1].length <= skipSection) skipSection = 0;
      if (!skipSection && SECTION_TITLE.test(heading[2])) { skipSection = heading[1].length; continue; }
    }
    if (skipSection) continue;
    const bare = line.replace(/[*_`>#✅☑️✔️\s]/gu, '');
    const isList = /^\s*(?:[-*•]|\d+[.、)])\s+/.test(line);
    if (skipList) {
      if (isList || !bare) { if (isList) continue; } else skipList = false;
    }
    // 整行就是一句认证（或「认证：清单开头」）：删掉，下面的清单也删
    if (bare && CLAIM.test(bare) && bare.replace(CLAIM, '').replace(/[：:，,。！!、（）()【】]/g, '').length <= 6) { skipList = true; continue; }
    if (bare && SECTION_TITLE.test(bare) && /[：:]$/.test(bare) && bare.length <= 14) { skipList = true; continue; }
    // 正文里顺带的一句：只删这几个词
    out.push(CLAIM.test(line) ? line.replace(new RegExp(`[，,、；;]?\\s*(?:${CLAIM.source})[^，,。！!；;\\n]{0,8}[。.！!]?`, 'g'), '').replace(/\s+$/, '') : line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+---\s*$/, '').trim();
}
