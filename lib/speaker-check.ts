/**
 * 出镜人本人的台词里用身份称呼指自己（2026-10-30）。
 *
 * 线上实测：锦园的口播写「师傅说这道菜最不能省的」，出镜的就是那位师傅本人。
 * 提示词里已经写了不许这样说，模型还是会写，所以生成后再查一遍：
 * 只查出镜人本人的台词；顾客、受访者怎么称呼不管；画面、拍摄要点里的第三人称也不管。
 * 找到的交给「按资料修正」只改这几句，改动超标就不采用（和事实修正同一套做法，共用每人每天 20 次额度）。
 */

/** 生成后要查说话人的板块：有口播台词的（脚本、开篇、分镜） */
export const SPEAKER_CHECK_TASKS = new Set(['脚本生成', '开篇钩子', '分镜脚本']);

/** 门槛：稿子里一个身份称呼都没有，就不用多问一次模型 */
const TITLE_RE = /师傅|主厨|厨师|厨子|老板娘|老板|店主|掌柜/;

export function needsSpeakerCheck(text: string): boolean {
  return TITLE_RE.test(text);
}

/** 已知素材的上限：和编造细节检查一样，超过的部分不给模型看 */
export const SPEAKER_CHECK_KNOWN_MAX_CHARS = 24_000;

const MAX_ITEMS = 8;

export function buildSpeakerCheckPrompt(text: string, known: string): string {
  return `【任务】下面是一份稿子。请只找出**出镜人本人对着镜头说的台词**里，用身份称呼指自己、或用「他」「她」指自己的句子。

判断：
- 出镜人是谁，看【已知素材】里的人设事实卡（「出镜人是谁」「和店的关系」）。素材里没写出镜人身份的，输出空。
- 出镜人对着镜头说「我」「我们」「你」，是对的，不标。
- 出镜人的台词里用「师傅」「主厨」「老板」这类称呼指他自己（例如「师傅说这道菜……」「今天就跟着他看」），标出来。
- 顾客、受访者、路人怎么称呼，不算，不标。
- 画面、拍摄要点里的第三人称（例如「师傅手部特写」「给师傅的提示」），不算，不标。

【输出】只输出一个 JSON 对象，不要解释，不要代码块：
{"self":["稿子里的原句片段，必须是稿子里原样出现的字，不超过 30 字"]}
没有就输出 {"self":[]}。最多 ${MAX_ITEMS} 条。

【已知素材】
${known.slice(0, SPEAKER_CHECK_KNOWN_MAX_CHARS)}

【稿子】
${text}`;
}

/** 从核对员的回答里取出标出的几句，写成「按资料修正」认得的格式（取「」里的原句片段）。读不出就返回空 */
export function parseSpeakerCheck(raw: string): string[] {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return [];
  let obj: unknown;
  try {
    obj = JSON.parse(m[0]);
  } catch {
    return [];
  }
  const list = (obj as { self?: unknown })?.self;
  if (!Array.isArray(list)) return [];
  const items = list
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.replace(/[「」]/g, '').trim())
    .filter((s) => s.length >= 2)
    .slice(0, MAX_ITEMS);
  return [...new Set(items)].map((s) => `「${s}」：出镜人本人的台词不用这个称呼指自己，改成「我」「我们」或直接说事`);
}

/** 只改标出的几句。其余内容原样保留；拿到的改稿由调用方用 fixTooBig 判断是不是超标 */
export function buildSpeakerFixPrompt(p: { text: string; issues: string[] }): string {
  return `【任务】下面这份稿子里，出镜人本人的台词用身份称呼指自己（例如「师傅说」「他」）。**只改这几处**，其余一个字都不要动。

【要改的几处】
${p.issues.map((i, n) => `${n + 1}. ${i}`).join('\n')}

【怎么改】
- 指自己的称呼改成「我」「我们」，或直接说事。例如「师傅说这道菜最不能省的」改成「我说，这道菜最不能省的」或「这道菜最不能省的」
- 不改画面、拍摄要点里的第三人称，不改顾客、受访者说的话
- 不加新的事实，不删未被标出的句子

【原稿】
${p.text}

【输出】只输出改好后的完整稿子，结构、格式、未被标出的内容保持原样。不要解释你改了什么，不要加开场白，不要用代码块包起来。`;
}
