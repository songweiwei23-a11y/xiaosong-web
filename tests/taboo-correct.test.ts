import { describe, expect, it } from 'vitest';
import { autoCorrectTaboos, describeCorrections } from '@/lib/taboo-correct';

/**
 * 违禁词平台修正（整改 C 期）：命中的绝对化词由平台换成确定的说法，分析用法不动，换不了的保持原样。
 */
describe('违禁词平台修正', () => {
  it('明显的吹：只改命中的那一处，并列出改了什么', () => {
    const r = autoCorrectTaboos('我们家的串串最好，口味最好吃。', null);
    expect(r.text).toBe('我们家的串串很好，口味很好吃。');
    // 「最好吃」里的「最好」也按「最好」这一条替换，计数按替换的字数算（2 处）
    expect(r.changes).toEqual([{ from: '最好', to: '很好', count: 2 }]);
  });

  it('同一句里的分析用法不动：「数据最好的类型」是在比较，不是吹', () => {
    const r = autoCorrectTaboos('数据最好的类型是烧烤。', null);
    expect(r.text).toBe('数据最好的类型是烧烤。');
    expect(r.changes).toEqual([]);
  });

  it('同一行里既有吹又有分析：只改吹的那一处', () => {
    const r = autoCorrectTaboos('全城唯一的串串，最大的优势是价格。', null);
    expect(r.text).toBe('全城独特的串串，最大的优势是价格。');
    expect(r.changes).toEqual([{ from: '唯一', to: '独特', count: 1 }]);
  });

  it('表里没有替换词的命中，保持原样（由结果页的违禁词提示处理）', () => {
    const text = '我们是第一家这样做的店。';
    const r = autoCorrectTaboos(text, null);
    expect(r.text).toBe(text);
    expect(r.changes).toEqual([]);
  });

  it('没有命中：原样返回', () => {
    const text = '今天拍一条家常口播。';
    expect(autoCorrectTaboos(text, null)).toEqual({ text, changes: [] });
  });

  it('多行正文：每一行各自修正，换行不丢', () => {
    const r = autoCorrectTaboos('第一行：串串最好\n第二行：家常口播', null);
    expect(r.text).toBe('第一行：串串很好\n第二行：家常口播');
  });

  it('界面说明：处数与改法', () => {
    expect(describeCorrections([{ from: '最大', to: '较大', count: 2 }, { from: '唯一', to: '独特', count: 1 }]))
      .toBe('已自动修正 3 处：最大→较大 ×2，唯一→独特');
  });
});
