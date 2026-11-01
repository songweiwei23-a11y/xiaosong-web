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

describe('基线抽查里的误报（2026-11-01）：这些都不算', () => {
  it('计数用的量词：两件事、五件套、一块木料、两套衣服', () => {
    expect(extractConcrete('目标要拆成两件事；账号五件套；拿一块木料；同一人两套衣服对比')).toEqual([]);
  });

  it('「原因有三点」不是三点钟；「四点出摊」是', () => {
    expect(extractConcrete('原因有三点：')).toEqual([]);
    expect(extractConcrete('每天四点出摊').map((s) => s.text)).toEqual(['四点']);
  });

  it('16 点对得上档案里的下午 4 点', () => {
    expect(novelTexts('我每天16点到摊位', ['每天下午4点出摊'])).toEqual([]);
  });

  it('约数、常见时段、规划用语、提问都不算', () => {
    expect(extractConcrete('服务本地几十年')).toEqual([]);
    expect(extractConcrete('头发长了，早上怎么整理都不顺')).toEqual([]);
    expect(extractConcrete('上个月发得少，暂时没有数据')).toEqual([]);
    expect(extractConcrete('顾客说过哪句话，能说明他为什么选这里？')).toEqual([]);
  });

  it('「3件事」是计数；「镜头9单独拍」不是 9 单', () => {
    expect(extractConcrete('圆脸男生剪发前先说3件事')).toEqual([]);
    expect(extractConcrete('镜头9单独拍手指逐项指向字幕')).toEqual([]);
    expect(extractConcrete('一天接了30单').map((s) => s.text)).toEqual(['30单']);
  });

  it('模型在引用禁令：句子里有「不能、不要、别」，里面的细节不算', () => {
    expect(extractConcrete('不能写成“前两天有一家人来装修”。')).toEqual([]);
    expect(extractConcrete('不写「完播率低于40%就换」这类合格线')).toEqual([]);
    // 2026-11-01 创作方向复测里的三种说法
    expect(extractConcrete('不把设想写成“前两天来了一个孩子”。')).toEqual([]);
    expect(extractConcrete('不拍“前两天来了一对夫妻”这类内容')).toEqual([]);
    expect(extractConcrete('档案里也没说过「前两天来了一位主人」这类事')).toEqual([]);
  });

  it('自查清单里点名的词不算：未使用、未编造、不应补写', () => {
    expect(extractConcrete('- **无风险词**：✅ 未使用"揭秘""震惊""100%"等违规词')).toEqual([]);
    expect(extractConcrete('- 当前处理：未编造「有位顾客说……」的案例')).toEqual([]);
    expect(extractConcrete('不应补写“前几天有个顾客”等未核实故事。')).toEqual([]);
    // 不是自查的照样算
    expect(extractConcrete('新手妈妈买洗护，90%都会忽略这一行小字').map((s) => s.text)).toEqual(['90%']);
  });

  it('拍摄、发布建议里的时间和距离不算；讲店里的事照样算', () => {
    expect(extractConcrete('- **场景设置**：市区一条街，白天（上午 10 点-下午 3 点），手机固定机位拍摄。')).toEqual([]);
    expect(extractConcrete('- 收声：靠近受访者1米内，避开商场广播')).toEqual([]);
    expect(extractConcrete('- **发布时间**：建议早上7-9点或晚上19-21点')).toEqual([]);
    expect(extractConcrete('凌晨四点我来到市场，镜头跟着我挑菜').map((s) => s.text)).toEqual(['凌晨四点']);
    expect(extractConcrete('有人花3万做收纳还是挤').map((s) => s.text)).toEqual(['3万']);
  });

  it('规划里的配比不算：题材比例、形式占比表；讲事实的百分数照样算', () => {
    expect(extractConcrete('- **题材比例**：建议先按主赛道约70% / 目标人群兴趣约30%执行')).toEqual([]);
    const table = '| 形式 | 占比 | 负责哪种作用 |\n|---|---:|---|\n| 知识 | 35% | 流量型 |\n| 故事 | 20% | 人设型 |';
    expect(extractConcrete(table)).toEqual([]);
    expect(extractConcrete('##### 题材比例\n\n- **主赛道：约 70%**')).toEqual([]);
    expect(extractConcrete('所以知识型40%不是既有结论；可逐步调整为流量型40%、人设型25%')).toEqual([]);
    expect(extractConcrete('| 问题 | 说明 |\n|---|---|\n| 尺码 | 90%的妈妈都买错了 |').map((s) => s.text)).toEqual(['90%']);
  });

  it('时长分配后面的占比不算；「若有真实案例，可加一句『前两天有个客人』」是条件句', () => {
    expect(extractConcrete('- 第一道题演示：5-12 秒（12%）✅')).toEqual([]);
    expect(extractConcrete('若老赵有真实的客户案例，可在开场加一句"前两天有个客人……"')).toEqual([]);
  });

  it('禁令写成列表：引导行是「不能擅自添加：」，下面列的例子都不算', () => {
    const text = '没有真实客户案例\n不能擅自添加：\n- “前两天有个客人……”\n- “上周一个上班族……”\n- “十个有九个……”';
    expect(extractConcrete(text)).toEqual([]);
    // 引导行不是禁令时，列表里的照样算
    expect(extractConcrete('可以这样开头：\n- 前两天有个客人来问').map((s) => s.text)).toEqual(['前两天', '有个客人']);
  });

  it('「上周一个上班族」不是周一；「周一出摊」是', () => {
    expect(extractConcrete('上周一个上班族来剪发')).toEqual([]);
    expect(extractConcrete('每周一出摊').map((s) => s.text)).toEqual(['周一']);
  });

  it('经历句式在问句、条件句里不算：这是在提问或假设', () => {
    expect(extractConcrete('如果有一次把过程讲清的经历，就能形成人设证据。')).toEqual([]);
    expect(extractConcrete('当时顾客说了什么，店里做了什么？')).toEqual([]);
    expect(extractConcrete('下次直接这样说：我平时能不能打理。')).toEqual([]);
    // 不是问句的经历照样算
    expect(extractConcrete('有一次一位客人吃完说太辣了。').map((s) => s.text)).toEqual(['有一次']);
  });

  it('件、套、款是计数；中文数字的「码」不算', () => {
    expect(extractConcrete('先说3件日常小事')).toEqual([]);
    expect(extractConcrete('前八码直接出大字')).toEqual([]);
  });

  it('分镜自己的统计不算', () => {
    expect(extractConcrete('- 特写占比：**0%**。本片需要看清人与沙发的关系')).toEqual([]);
  });

  it('少见的时段单独出现也算：凌晨', () => {
    expect(extractConcrete('凌晨的菜市场').map((s) => s.text)).toEqual(['凌晨']);
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
