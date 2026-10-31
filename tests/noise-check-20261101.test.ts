/**
 * 无关信息检测（lib/noise-check，整改方案阶段 0.2）：输出里新出现、输入里没有的具体细节。
 */
import { describe, expect, it } from 'vitest';
import { cnToInt, extractConcrete, noiseReport, normalizeDigits } from '@/lib/noise-check';

const novelTexts = (out: string, inputs: string[]) => noiseReport(out, inputs).novel.map((s) => s.text);

describe('数字统一', () => {
  it('中文数字转整数', () => {
    expect(cnToInt('四')).toBe(4);
    expect(cnToInt('十二')).toBe(12);
    expect(cnToInt('二十')).toBe(20);
    expect(cnToInt('一百二十')).toBe(120);
    expect(cnToInt('两')).toBe(2);
    expect(cnToInt('好')).toBeNull();
  });

  it('单位前的中文数字换成阿拉伯数字', () => {
    expect(normalizeDigits('下午 四 点')).toBe('下午4点');
    expect(normalizeDigits('做川菜九年')).toBe('做川菜9年');
    expect(normalizeDigits('一元火锅')).toBe('1元火锅');
  });
});

describe('时段', () => {
  it('输入里是下午 4 点，输出写凌晨四点：新出现', () => {
    expect(novelTexts('凌晨四点我来到市场', ['每天下午4点出摊'])).toEqual(['凌晨四点']);
  });

  it('输出写下午四点，输入里有下午4点：不算', () => {
    expect(novelTexts('下午四点开始备菜', ['每天下午4点出摊'])).toEqual([]);
  });

  it('「有一点咸」里的「一点」不是时间', () => {
    expect(extractConcrete('这锅汤有一点咸')).toEqual([]);
  });
});

describe('数字与经历', () => {
  it('年限对得上不算，对不上算', () => {
    expect(novelTexts('我做川菜9年了', ['做川菜9年'])).toEqual([]);
    expect(novelTexts('我做川菜十年了', ['做川菜9年'])).toEqual(['十年']);
  });

  it('金额：档案里的一元对得上；编出来的价格算', () => {
    expect(novelTexts('1元一串，随便点', ['一元火锅'])).toEqual([]);
    expect(novelTexts('一份只要15块钱', ['一元火锅'])).toEqual(['15块钱']);
  });

  it('百分数和年份', () => {
    expect(novelTexts('九成顾客都说好，回头率30%', [''])).toEqual(['30%']);
    expect(novelTexts('2023年开的店', ['来南乐半年'])).toEqual(['2023年']);
  });

  it('经历句式：访谈里有的不算，编出来的算', () => {
    const inputs = ['有个老顾客每周都来，说就喜欢我们的汤底不咸'];
    expect(novelTexts('有个老顾客每周都来', inputs)).toEqual([]);
    expect(novelTexts('有一次一位客人吃完说……', inputs)).toEqual(['有一次']);
  });
});

describe('不算具体细节的', () => {
  it('【】占位、镜头时长、序号都不算', () => {
    const text = '【待确认：做了3年】\n【镜头1】0-8秒\n第3周：复盘\n第36计 冷知识';
    expect(extractConcrete(text)).toEqual([]);
  });

  it('同一个细节只报一次', () => {
    expect(novelTexts('凌晨四点出门，凌晨四点到市场', [''])).toEqual(['凌晨四点']);
  });
});
