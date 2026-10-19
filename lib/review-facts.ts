/**
 * 审稿的事实依据预检（2026-10-19）。
 *
 * 【为什么要有这个】线上实测：原稿里写的「老王每天早上六点去批发市场拿货」「人均两三块」，
 * 档案和材料里都没有，审稿却把它们当成「值得保留」，还保留进改写稿。原稿本身不是依据，
 * 它是待审的稿子，里面的时间、价格、经历只有能在账号档案、相关方案参考、创作设置或个人要求里找到依据，才能保留。
 * 相关方案参考也算依据：生成的内容只要不偏离真实、按档案来就可以（产品方 2026-10-19 决定）。
 *
 * 这里只做字面比对（代码数得清的部分），把结果交给模型判断；模型可以因为材料里有同一意思的说法而放行。
 */

/** 具体的时间点：「早上六点」「凌晨5点」「下午三点半」 */
const TIME_CLAIM = /(?:凌晨|清晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里|夜间)?[一二两三四五六七八九十\d]{1,3}点(?:半|钟)?/g;
/** 金额：「一块钱」「两三块」「19.9元」「一元」「人均两三块」 */
const MONEY_CLAIM = /人均[^，。,.！？!?\s]{1,6}|[\d.]+\s*(?:块钱?|元|万|千|百)|[一二两三四五六七八九十]+(?:到|至|-|~)?[一二两三四五六七八九十]*\s*(?:块钱?|元)/g;
/** 时长类的具体数：「9年」「三个月」「半年」「3天」 */
const SPAN_CLAIM = /\d+\s*(?:年|个月|周|天)|[一二两三四五六七八九十]+\s*(?:年|个月)|半年/g;
/** 百分比和销量、人数类 */
const COUNT_CLAIM = /\d+(?:\.\d+)?\s*%|\d+\s*(?:单|次|家|套|份|碗|斤)/g;

/** 去掉空白和标点，只留文字和数字，方便字面比对 */
export function normalizeClaim(text: string): string {
  return text.replace(/[\s，。,.！？!?、；;：:“”"'‘’（）()【】\[\]「」]/g, '');
}

/** 原稿里出现的具体时间、金额、年限、比例（去重，保持出现顺序） */
export function draftFactClaims(draft: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const re of [TIME_CLAIM, MONEY_CLAIM, SPAN_CLAIM, COUNT_CLAIM]) {
    for (const m of draft.matchAll(re)) {
      const claim = m[0].trim();
      const key = normalizeClaim(claim);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(claim);
    }
  }
  return out;
}

/** 在材料（账号档案、相关方案参考、创作设置、个人要求）里找不到字面依据的说法 */
export function unsupportedDraftFacts(draft: string, material: string): string[] {
  const haystack = normalizeClaim(material);
  return draftFactClaims(draft).filter((claim) => !haystack.includes(normalizeClaim(claim)));
}

/**
 * 写进审稿提示词的预检块。没有材料也照样给出：材料为空时，原稿里的具体数字全部算无依据。
 */
export function factEvidenceBlock(draft: string, material: string): string {
  const claims = draftFactClaims(draft);
  const lines = ['## 🔎 事实依据预检（字面比对，仅作线索）', ''];
  if (!claims.length) {
    lines.push('原稿里没有需要比对的具体时间、金额或年限。');
    return lines.join('\n');
  }
  const missing = unsupportedDraftFacts(draft, material);
  lines.push(`原稿里的具体说法：${claims.map((c) => `「${c}」`).join('、')}`);
  if (!missing.length) {
    lines.push('这些说法在档案或材料里都能找到字面依据。');
    return lines.join('\n');
  }
  lines.push(`在账号档案、相关方案参考、创作设置和个人要求里**找不到字面依据**的：${missing.map((c) => `「${c}」`).join('、')}`);
  lines.push('');
  lines.push('规则：原稿本身不是依据。这些说法除非材料里有同一意思的表述（如材料写「一元」、原稿写「一块钱」），否则：');
  lines.push('- 不列进「值得保留」，整句的核心依赖这个说法的，整句都不列；');
  lines.push('- 在问题清单里标【无依据】；');
  lines.push('- 小改稿里把这处说法连同它所依赖的动作换成【待确认：…】（例如「每天早上六点去批发市场拿货」换成【待确认：拿货的时间和地点】），不能只删掉时间、留下动作；句子的其它部分不动。');
  lines.push('作者的日常经历（如「每天去哪里拿货」）也是事实，同样要有依据。');
  lines.push('这一条不受「本轮改动范围」限制：编了就是事实问题，必须标出来。');
  return lines.join('\n');
}
