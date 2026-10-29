/**
 * 生成稿里编造的具体细节（2026-10-29）。
 *
 * 线上实测：同一份档案，账号定位第一版干净，第二版写出了原文和档案里都没有的「午休」「饭盒」「空饭盒」「合盖」。
 * 原文只说「下班打包」「装盒」「工作餐黄金时段」，模型把它扩写成了具体的道具和动作，内容定位又沿用了它。
 * 现有的事实核对只管价格、顾客见证、经营承诺，管不住这类道具、动作、时间场景。
 *
 * 这里让模型只找「具体到能拍的细节」里、在已知素材找不到出处的说法；找到了交给「按资料修正」
 * （lib/fact-fix 的 buildFactFixPrompt）只改这几处，改动超标就不采用。
 */

/** 生成后要查具体细节的板块：定位类、简报、规划、方向（它们写得最具体，也最容易扩写） */
export const DETAIL_CHECK_TASKS = new Set(['账号定位', '内容定位', '商业定位', '创作简报', '内容规划', '创作方向']);

/** 已知素材的上限：超过的部分不给模型看，所以超长时可能多标（会在核对时提醒） */
export const DETAIL_CHECK_KNOWN_MAX_CHARS = 24_000;

const MAX_ITEMS = 8;

export function buildDetailCheckPrompt(text: string, known: string): string {
  return `【任务】下面是一份稿子。请只找出其中**具体到能拍的细节**、并且在【已知素材】里找不到出处的说法。

具体细节指：道具和容器（如饭盒、保温桶）、具体动作（如合盖、翻面）、具体时间段或场景（如午休、打烊前）、摆放位置、具体数量或份量。

判断：
- 稿子写了素材里没有的具体说法（哪怕只是换个词扩写），找出来。例：素材只说「下班打包」「装盒」，稿子写「午休赶时间、拿空饭盒合盖」，那么「午休」「空饭盒」「合盖」都要找出来。
- 素材里有相同意思的说法（换了字但意思一样），不算。
- 通用的拍摄建议（如「拍清腰头」「用近景」「光线要好」），不算，不要标。
- 价格、顾客见证、经营承诺不在这里标，有别的检查。

【输出】只输出一个 JSON 对象，不要解释，不要代码块：
{"unsupported":["稿子里的原句片段，必须是稿子里原样出现的字，不超过 20 字"]}
没有就输出 {"unsupported":[]}。最多 ${MAX_ITEMS} 条。

【已知素材】
${known.slice(0, DETAIL_CHECK_KNOWN_MAX_CHARS)}

【稿子】
${text}`;
}

/** 从核对员的回答里取出标出的几处，写成「按资料修正」认得的格式（取「」里的原句片段）。读不出就返回空 */
export function parseDetailCheck(raw: string): string[] {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return [];
  let obj: unknown;
  try {
    obj = JSON.parse(m[0]);
  } catch {
    return [];
  }
  const list = (obj as { unsupported?: unknown })?.unsupported;
  if (!Array.isArray(list)) return [];
  const items = list
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.replace(/[「」]/g, '').trim())
    .filter((s) => s.length >= 2)
    .slice(0, MAX_ITEMS);
  return [...new Set(items)].map((s) => `「${s}」：素材里找不到这个具体说法，删掉，或改成素材里有的说法`);
}
