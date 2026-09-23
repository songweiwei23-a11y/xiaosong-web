import { describe, it, expect } from 'vitest';
import { buildTitlePrompt } from '@/lib/title-standards';
import { OPENING_CARDS } from '@/lib/opening-cards';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';
import {
  detectTactics,
  detectOpeningCards,
  tacticBrief,
  summarizeTacticTests,
  buildTacticPickPrompt,
  buildOpeningPrompt,
  parseOpenings,
  MIN_SAMPLES,
} from '@/lib/growth-standards';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/**
 * 起号 36+1 计和开篇 36 计接进生产链路。
 *
 * 接之前这两套只有 /dashboard/growth 一个页面在用——
 * 去那儿看一眼、生成个方案、出来，选题和脚本完全不知道它们存在。
 * 这组用例守的是「它们真的参与了生成」，不是「文件还在」。
 */

const baseTitleParams = {
  topic: '南乐县烧烤店怎么在淡季把客流拉回来',
  titleTypeLabel: '痛点式',
  titleFormulaValue: 'pain-solution',
  titleFormulaLabel: '痛点+解决方案',
  keywordStrategyLabel: '搜索词',
  keywordStrategyDesc: '高搜索量',
  platform: '抖音',
  targetAudience: '县城餐饮老板',
  count: 5,
};

describe('标题接开篇 36 卡', () => {
  it('没圈定卡时，36 张的索引全部进提示词', () => {
    const prompt = buildTitlePrompt(baseTitleParams);
    const missing = OPENING_CARDS.filter((c) => !prompt.includes(c.name));
    expect(missing.map((c) => c.name), '这些卡没进提示词').toEqual([]);
    expect(prompt).toContain('钩子机制库');
  });

  it('要求报出用的是哪一张，否则事后没法追溯', () => {
    const prompt = buildTitlePrompt(baseTitleParams);
    expect(prompt).toContain('用的钩子');
    expect(prompt).toMatch(/不要自己造/);
  });

  it('圈定了卡就只给那几张的细节，不再给全量索引', () => {
    const prompt = buildTitlePrompt({ ...baseTitleParams, openingCards: ['圈定人群', '反认知'] });
    expect(prompt).toContain('圈定人群');
    expect(prompt).toContain('反认知');
    // 展开的卡要带机制和风险边界，不是只有名字
    expect(prompt).toContain('心理机制');
    expect(prompt).toContain('风险边界');
    // 没圈的卡不该再出现
    expect(prompt).not.toContain('扮猪吃虎');
    // 全量索引的引导语不该还在
    expect(prompt).not.toContain('下面 36 张卡是钩子的底层机制');
  });

  it('模型瞎编的卡名会被丢掉，不会当成已圈定', () => {
    const prompt = buildTitlePrompt({ ...baseTitleParams, openingCards: ['宇宙无敌钩子'] });
    // 一个有效的都没有 → 退回全量索引
    expect(prompt).toContain('每个标题挑 1 张主卡');
    expect(prompt).not.toContain('宇宙无敌钩子');
  });

  it('卡名和风险词的冲突被点明了', () => {
    const prompt = buildTitlePrompt(baseTitleParams);
    // 库里有张卡就叫「内幕揭秘」，而风险词里禁用「揭秘」。
    // 两条同时出现在一个提示词里，不调和的话模型会以为卡名给了豁免。
    expect(prompt).toContain('内幕揭秘');
    expect(prompt).toContain('禁用「揭秘」');
    expect(prompt).toContain('卡名不是豁免');
  });

  it('钩子库没把提示词撑爆', () => {
    const withCards = buildTitlePrompt(baseTitleParams).length;
    // 36 张索引约 1.6k 字，总长控制在 6k 以内，不至于冲淡主任务
    expect(withCards).toBeLessThan(6000);
  });
});

describe('从生成结果里认出用了哪一计 / 哪张卡', () => {
  it('认得出正文里提到的计名，按出现先后排', () => {
    const text = '综合你的条件，我建议先试**行业避坑**，第二轮再上「反向操作」。';
    expect(detectTactics(text)).toEqual(['行业避坑', '反向操作']);
  });

  it('认得出卡名', () => {
    const text = '第1条 · 用了圈定人群\n第2条 · 用了反认知';
    expect(detectOpeningCards(text)).toEqual(['圈定人群', '反认知']);
  });

  it('模型造的词不认', () => {
    expect(detectTactics('我建议用「量子起号法」')).toEqual([]);
    expect(detectOpeningCards('用了「究极钩子」')).toEqual([]);
  });

  it('空值不炸', () => {
    for (const x of ['', null as unknown as string, undefined as unknown as string]) {
      expect(detectTactics(x)).toEqual([]);
      expect(detectOpeningCards(x)).toEqual([]);
    }
  });

  it('知识库里的名字都是能被认出来的（没有空名或重名）', () => {
    const tNames = GROWTH_TACTICS.map((t) => t.name);
    const cNames = OPENING_CARDS.map((c) => c.name);
    expect(new Set(tNames).size).toBe(tNames.length);
    expect(new Set(cNames).size).toBe(cNames.length);
    expect(tNames.every((n) => n.trim().length > 1)).toBe(true);
    expect(cNames.every((n) => n.trim().length > 1)).toBe(true);
  });
});

describe('打法说明带上结构公式和边界', () => {
  it('每一计都拼得出说明，且四样关键信息齐全', () => {
    for (const t of GROWTH_TACTICS) {
      const b = tacticBrief(t.name);
      expect(b, `${t.name} 拼不出说明`).toContain(t.name);
      expect(b).toContain(t.formula);
      // 边界是红线。以前只在起号页显示给人看，模型从来没见过
      expect(b).toContain(t.limit);
      expect(b).toContain(t.mechanism);
    }
  });

  it('不存在的计名返回空串，不会拼出半截东西', () => {
    expect(tacticBrief('量子起号法')).toBe('');
    expect(tacticBrief('')).toBe('');
  });
});

describe('选题和脚本真的用上了打法', () => {
  it('选题页把打法拼进提示词，并要求每条都能用这一计拍', () => {
    const src = read('app/dashboard/topic/page.tsx');
    expect(src).toContain('tacticBrief');
    expect(src).toContain('【本批选题的拍法】');
    // 光提一句不算，要落到结构公式上
    expect(src).toContain('结构公式');
    // 打法要跟着交接到脚本，否则链路断在选题
    expect(src).toMatch(/tactic:\s*tactic \|\| undefined/);
  });

  it('脚本页把打法拼进提示词，并说清和脚本结构的分工', () => {
    const src = read('app/dashboard/script/page.tsx');
    expect(src).toContain('tacticBrief');
    expect(src).toContain('tacticSection');
    // 两套结构不说清分工，模型会拿一个覆盖另一个
    expect(src).toContain('时间怎么分');
    expect(src).toContain('事件怎么走');
  });

  it('脚本页把打法写进历史记录——复盘统计全靠它', () => {
    const src = read('app/dashboard/script/page.tsx');
    const inputDataBlock = src.slice(src.indexOf('const inputData'), src.indexOf('const inputData') + 700);
    expect(inputDataBlock).toContain('tactic');
  });

  it('两个分支（广告/内容）都注入了拍法，不是只改了一个', () => {
    const src = read('app/dashboard/script/page.tsx');
    const hits = src.match(/\$\{tacticSection\}/g) ?? [];
    expect(hits.length, '广告脚本和内容脚本是两套提示词，都要注入').toBe(2);
  });
});

describe('复盘回写：按打法统计样本数', () => {
  const row = (tactic?: string, taskType = '脚本生成') => ({
    task_type: taskType,
    input_data: tactic ? { topic: 'x', tactic } : { topic: 'x' },
  });

  it('数得出每一计写了几条', () => {
    const stats = summarizeTacticTests([
      row('行业避坑'),
      row('行业避坑'),
      row('反向操作'),
      row('行业避坑'),
    ]);
    expect(stats).toEqual([
      { name: '行业避坑', count: 3, enough: true },
      { name: '反向操作', count: 1, enough: false },
    ]);
  });

  it('input_data 是 JSON 字符串时也认', () => {
    const stats = summarizeTacticTests([
      { task_type: '脚本生成', input_data: JSON.stringify({ tactic: '反向操作' }) },
    ]);
    expect(stats).toEqual([{ name: '反向操作', count: 1, enough: false }]);
  });

  it('只数脚本——选题是一批 10 条，不是 10 次测试', () => {
    const stats = summarizeTacticTests([
      row('行业避坑', '选题策划'),
      row('行业避坑', '标题封面'),
      row('行业避坑'),
    ]);
    expect(stats).toEqual([{ name: '行业避坑', count: 1, enough: false }]);
  });

  it('没记打法的老记录直接跳过，不会算成一个叫 undefined 的计', () => {
    expect(summarizeTacticTests([row(), row(), row('反向操作')])).toEqual([
      { name: '反向操作', count: 1, enough: false },
    ]);
  });

  it('编出来的计名不算数', () => {
    expect(summarizeTacticTests([row('量子起号法')])).toEqual([]);
  });

  it('脏数据不炸', () => {
    expect(summarizeTacticTests(null)).toEqual([]);
    expect(summarizeTacticTests('nope')).toEqual([]);
    expect(
      summarizeTacticTests([
        null,
        { task_type: '脚本生成', input_data: '{坏JSON' },
        { task_type: '脚本生成', input_data: 42 },
        { task_type: '脚本生成' },
      ])
    ).toEqual([]);
  });

  it(`${MIN_SAMPLES} 条是够与不够的分界`, () => {
    const make = (n: number) => summarizeTacticTests(Array.from({ length: n }, () => row('反向操作')));
    expect(make(MIN_SAMPLES - 1)[0].enough).toBe(false);
    expect(make(MIN_SAMPLES)[0].enough).toBe(true);
  });
});

describe('AI 推荐知道他测到哪儿了', () => {
  it('带上已测记录时，提示词里有条数和测试规则', () => {
    const prompt = buildTacticPickPrompt({
      tested: [
        { name: '行业避坑', count: 4, enough: true },
        { name: '反向操作', count: 1, enough: false },
      ],
    });
    expect(prompt).toContain('已拍 4 条');
    expect(prompt).toContain('还差 2 条');
    expect(prompt).toContain('一次只改一个核心变量');
    expect(prompt).toContain('不要急着换新的');
  });

  it('没有已测记录时不凭空多出一段', () => {
    const prompt = buildTacticPickPrompt({});
    expect(prompt).not.toContain('他已经测过的');
    // 主任务还在
    expect(prompt).toContain('挑出 5 个候选');
  });
});

describe('起号页把链路接上了', () => {
  const src = read('app/dashboard/growth/page.tsx');

  it('算出测试进度并喂给 AI 推荐', () => {
    expect(src).toContain('summarizeTacticTests');
    expect(src).toMatch(/tested,/);
  });

  it('有「按这一计去选题」的出口', () => {
    expect(src).toContain('按这一计去选题');
    expect(src).toMatch(/tactic:\s*picked\[0\]/);
  });

  it('开篇结果能带着钩子去标题页', () => {
    expect(src).toContain('用这些钩子起标题');
    expect(src).toContain('openingCards');
    // 用户没手动圈时，要从正文里认出模型挑了哪几张
    expect(src).toContain('detectOpeningCards(result)');
  });
});

/**
 * 选题 → 开篇 → 脚本 这条链要能一路点下去：
 * 选题整批带过来任选一条，每种开法各出一条，挑中一条直接去写脚本。
 */
describe('每种开法各出一条', () => {
  it('圈定了卡就按卡数出条数，并逐张列出顺序', () => {
    const prompt = buildOpeningPrompt({
      topic: '淡季怎么把老客拉回来',
      picked: ['圈定人群', '反认知', '损失厌恶'],
    });
    expect(prompt).toContain('每一种各写一条');
    expect(prompt).toMatch(/给这 3 张卡各写一条，共 3 条/);
    // 顺序要列出来，否则模型容易漏掉其中一张
    expect(prompt).toContain('1. 圈定人群');
    expect(prompt).toContain('2. 反认知');
    expect(prompt).toContain('3. 损失厌恶');
  });

  it('没圈定时仍按条数走，不会说"各写一条"', () => {
    const prompt = buildOpeningPrompt({ topic: 'x', count: 6 });
    expect(prompt).toContain('给 6 条');
    expect(prompt).not.toContain('每一种各写一条');
  });

  it('要求开头原话单独放在引用行——解析全靠这一条', () => {
    const prompt = buildOpeningPrompt({ topic: 'x', picked: ['反认知'] });
    expect(prompt).toContain('必须单独放在 > 引用行里');
    expect(prompt).toContain('### 1. 卡名');
  });
});

describe('开篇结果能逐条拆出来', () => {
  const sample = `## 开篇方案

### 1. 圈定人群
> 南乐开饭店的老板，淡季别急着发优惠券。

- **为什么抓得住这群人**：淡季是他们最焦虑的时候
- **正文怎么兑现**：给出三个不降价的拉客动作
- **风险**：圈得太窄，外地人划走

### 2. 反认知
> 我劝你淡季别打折，打了才是真的没人来。

- **为什么抓得住这群人**：和他们第一反应相反
- **正文怎么兑现**：解释打折为什么反噬复购
- **风险**：无

## 🎯 我推荐哪一条
推荐第 2 条，更符合你直接的口吻。`;

  it('拆得出每一条，卡名和开头原话都对', () => {
    const out = parseOpenings(sample);
    expect(out.length).toBe(2);
    expect(out[0].card).toBe('圈定人群');
    expect(out[0].line).toBe('南乐开饭店的老板，淡季别急着发优惠券。');
    expect(out[0].deliver).toBe('给出三个不降价的拉客动作');
    expect(out[1].card).toBe('反认知');
    expect(out[1].risk).toBe('无');
  });

  it('不会把「我推荐哪一条」当成一条开头', () => {
    expect(parseOpenings(sample).some((o) => o.card.includes('推荐'))).toBe(false);
  });

  it('模型换了标题写法也认（第N条 · 卡名）', () => {
    const out = parseOpenings(`### 第1条 · 直击痛点
> 拍了半年没人看？问题出在开头这三秒。
- **正文怎么兑现**：拆解三秒结构`);
    expect(out.length).toBe(1);
    expect(out[0].card).toBe('直击痛点');
    expect(out[0].line).toContain('拍了半年没人看');
  });

  it('模型忘了用引用行时，退而取第一行正文', () => {
    const out = parseOpenings(`### 1. 极限数字
这家店一年卖出十二万串。

- **风险**：无`);
    expect(out[0].line).toBe('这家店一年卖出十二万串。');
  });

  it('编出来的卡名不算一条', () => {
    expect(parseOpenings('### 1. 宇宙无敌开场\n> 随便一句')).toEqual([]);
  });

  it('空值和纯文本不炸', () => {
    for (const x of ['', '一段没有结构的话', null as unknown as string]) {
      expect(parseOpenings(x)).toEqual([]);
    }
  });
});

describe('选定的开头会锁死脚本第一句', () => {
  const src = read('app/dashboard/script/page.tsx');

  it('脚本页收得到并拼进提示词', () => {
    expect(src).toContain('openingLine');
    expect(src).toContain('开头已经定了，必须用这一句');
    expect(src).toContain('一字不改');
  });

  it('锁死时不再发"开场钩子要求"，避免两条指令打架', () => {
    expect(src).toContain('effectiveHookGuide');
    expect(src).toMatch(/openingLine\.trim\(\)\s*\?\s*''\s*:\s*hookGuide/);
    // 两个分支都要换成 effectiveHookGuide，不能只改一个
    expect((src.match(/\$\{effectiveHookGuide\}/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(/\$\{hookGuide\}/);
  });
});

describe('选题整批带到开篇页', () => {
  it('选题页「设计开篇」带的是整批，不是只有第一条', () => {
    const src = read('app/dashboard/topic/page.tsx');
    const block = src.slice(src.indexOf('label: "设计开篇"'), src.indexOf('label: "设计开篇"') + 600);
    expect(block).toContain('topicOptions: options');
  });

  it('起号页优先用带过来的那批，不被历史覆盖', () => {
    const src = read('app/dashboard/growth/page.tsx');
    expect(src).toContain('handoffTopics');
    expect(src).toMatch(/handoffTopics\.length > 0 \? handoffTopics : recentTopics/);
  });

  it('每条开头都有「用这条写脚本」的出口', () => {
    const src = read('app/dashboard/growth/page.tsx');
    expect(src).toContain('用这条写脚本');
    expect(src).toMatch(/openingLine:\s*o\.line/);
    expect(src).toContain('parseOpenings');
  });
});
