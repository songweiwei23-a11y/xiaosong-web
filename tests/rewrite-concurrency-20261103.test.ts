/**
 * 逐句、逐条改写同时问（2026-11-03 产品方：质量不变，让慢本身变快）。
 * 验的是「和原来排队问完全一样」：发给模型的提问一字不差、次数一样，替换结果一样；只是同时发出、不再一句等一句。
 */
import { describe, expect, it } from 'vitest';
import { mapLimit, REWRITE_CONCURRENCY } from '@/lib/map-limit';
import { replaceEachSentence } from '@/lib/reality-check';
import { polishTitles, findTemplateTitles } from '@/lib/title-polish';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 原来的排队写法，留作对照 */
async function serialReplace(text: string, sentences: string[], rewrite: (b: string) => Promise<string | null>) {
  let out = text;
  for (const s of sentences) {
    const next = await rewrite(s);
    if (next) out = out.split(s).join(next);
  }
  return out;
}

describe('mapLimit', () => {
  it('按原顺序返回；同时最多 limit 个；单个失败记 null 不拖垮整批', async () => {
    let running = 0, peak = 0;
    const r = await mapLimit([30, 5, 20, 1, 10], 3, async (ms, i) => {
      running++; peak = Math.max(peak, running);
      await sleep(ms);
      running--;
      if (i === 3) throw new Error('上游限流');
      return ms * 2;
    });
    expect(r).toEqual([60, 10, 40, null, 20]);
    expect(peak).toBe(3);
    expect(REWRITE_CONCURRENCY).toBe(3);
  });

  it('真的不再一句等一句：6 句各 40ms，同时 3 句约 80ms，远小于排队的 240ms', async () => {
    const t0 = Date.now();
    await mapLimit([1, 2, 3, 4, 5, 6], 3, () => sleep(40));
    expect(Date.now() - t0).toBeLessThan(200);
  });
});

describe('逐句修复：提问和结果与排队问一样', () => {
  const text = '第一句收腰就能换风格。第二句三天见效。第三句一个技巧翻倍。第四句照常。';
  const sentences = ['第一句收腰就能换风格。', '第二句三天见效。', '第三句一个技巧翻倍。'];
  // 回答快慢打乱，验证按原顺序替换
  const delays: Record<string, number> = { '第一句收腰就能换风格。': 30, '第二句三天见效。': 1, '第三句一个技巧翻倍。': 15 };
  const rewrite = (asked: string[]) => async (body: string) => {
    asked.push(body);
    await sleep(delays[body] ?? 0);
    return body === '第二句三天见效。' ? null : `【改】${body}`;
  };

  it('同样的提问、同样的次数、同样的结果', async () => {
    const askedNew: string[] = [], askedOld: string[] = [];
    const now = await replaceEachSentence(text, sentences, rewrite(askedNew));
    const old = await serialReplace(text, sentences, rewrite(askedOld));
    expect(now.text).toBe(old);
    expect([...askedNew].sort()).toEqual([...askedOld].sort());
    expect(now).toMatchObject({ tried: 3, accepted: 2 });
  });
});

describe('模板标题重写：提问和结果与排队问一样', () => {
  it('每条模板标题各问一次，按原顺序替换', async () => {
    const text = '★标题：别只盯着价格，看看这家店\n★标题：你知道县城老板最怕什么吗\n★标题：凌晨四点的后厨';
    const templated = findTemplateTitles(text);
    expect(templated.length).toBeGreaterThanOrEqual(2);
    const asked: string[] = [];
    const r = await polishTitles(text, async (prompt) => {
      asked.push(prompt);
      await sleep(asked.length === 1 ? 20 : 1);
      return null;
    });
    expect(asked).toHaveLength(templated.length);
    expect(r.tried).toBe(templated.length);
    expect(r.text).toBe(text);
  });
});
