/**
 * 质量整改第一阶段的回归用例（2026-10-05，docs/开物质量深度研究_20261005/问题成因与优化实施方案.md）。
 * 文档点名的五类编造 + 已复现的误报 + 短要求优先级 + 分镜念不完。发布门槛：这些都要过。
 */
import { describe, expect, it } from 'vitest';
import { runQualityChecks, unsupportedFacts, yearConflicts } from '@/lib/quality-checks';
import { scanTaboos } from '@/lib/taboos';
import { auditStoryboard, spokenChars } from '@/lib/storyboard-standards';
import { outputRulesBlock, PRIORITY_ORDER } from '@/lib/output-rules';
import { buildContextBlock, type CreatorContext } from '@/lib/creator-context';
import { formatQualityReport, evaluateScriptQualityStrict } from '@/lib/quality-checker';
import { displayQualityReport, parseQualitySummary, splitQualityReport } from '@/lib/script-result-utils';
import { buildFactFixPrompt, fixTooBig } from '@/lib/fact-fix';
import { readCode } from './helpers/source';

const facts = (out: string, known: string, light = false) => unsupportedFacts(out, known, { light }).join('|');

describe('五类编造（文档验收用例）', () => {
  it('「老板从业 38 年」不能顶掉编出来的「38 元」', () => {
    const known = JSON.stringify({ persona_facts: { yearsInTrade: '从业38年' } });
    expect(facts('招牌锅底只要 38 元一份。', known)).toMatch(/价格「.*38 元/);
    // 资料里真有 38 元就不报
    expect(facts('招牌锅底只要 38 元一份。', `${known}\n锅底 38 元`)).toBe('');
    // 价格字眼附近的数字也算有出处
    expect(facts('人均 30 元吃饱。', '{"price_range":"人均30左右"}')).toBe('');
  });

  it('「从业 5 年 / 在杭州 2 年」：写成在杭州 5 年要报', () => {
    const persona = { yearsInTrade: '从业5年', yearsLocal: '来杭州2年' };
    expect(yearConflicts('我在杭州扎根 5 年了', persona).length).toBeGreaterThan(0);
    expect(yearConflicts('我干这行 5 年了，来杭州 2 年', persona)).toEqual([]);
  });

  it('没给价格却出了报价、福利', () => {
    const f = facts('到店消费满100减20，还免费送一份甜品，包教包会。', '{"profile_name":"测试店"}');
    expect(f).toMatch(/经营承诺「.*满100减20/);
    expect(f).toMatch(/经营承诺「.*免费送/);
    expect(f).toMatch(/包教包会/);
  });

  it('没给顾客故事却出了见证', () => {
    const f = facts('上周有位顾客跟我说，吃完第二天又带全家来了。很多客人都说味道正。', '{}');
    expect(f).toMatch(/顾客见证/);
    // 素材里本来就有这段（审稿原稿），照用不报
    expect(facts('有位顾客说：这锅底太香了', '原稿：有位顾客说：这锅底太香了')).toBe('');
    // 标了【示例】的不算冒充
    expect(facts('【示例】有位顾客说吃完还想来', '{}')).toBe('');
  });

  it('没给统计却出了百分比（不再只认「据统计」）', () => {
    expect(facts('90% 的业主装修都踩过这个坑。', '{}')).toMatch(/百分比「.*90%/);
    expect(facts('九成的家长都不知道。', '{}')).toMatch(/百分比/);
    expect(facts('90% 的业主装修都踩过这个坑。', '{}\n素材：调查显示 90% 的业主……')).toBe('');
  });

  it('模型自称「自检通过、无编造」：列在最前面，提醒以核对为准', () => {
    const f = unsupportedFacts('人均 68 元。\n\n✅ 自检通过，无编造数据。', '{}');
    expect(f[0]).toMatch(/模型自称「自检通过」/);
  });
});

describe('已复现的误报不再报', () => {
  it('「挂衣区」「收银区」「儿童区」不是地名', () => {
    expect(facts('进门左手边是挂衣区，右边是收银区和儿童区。', '{}')).toBe('');
    // 真地名照报
    expect(facts('郑州市的朋友也来了', '{}')).toMatch(/地名「郑州市」/);
  });

  it('「打开到最大角度」「开到最大火」不是绝对化用语；「最大的优惠」照报', () => {
    expect(scanTaboos('柜门可以打开到最大角度，炒菜开到最大火。', null)).toEqual([]);
    expect(scanTaboos('全城最便宜！', null).length).toBeGreaterThan(0);
  });

  it('自由对话只查冒充事实的几类：给建议价格、做促销方案不报', () => {
    const out = '建议定价 39 元，搞个满100减20的活动。';
    expect(runQualityChecks({ output: out, profile: null, taskType: '自由对话' }).issues).toEqual([]);
    expect(runQualityChecks({ output: '90% 的老板都不知道', profile: null, taskType: '自由对话' }).issues.map((i) => i.kind)).toContain('facts');
  });
});

describe('用户的明确要求优先于模板（不按字数）', () => {
  it('脚本页：短要求不再写「MCN标准 > 用户补充要求」', () => {
    const page = readCode('app/dashboard/script/page.tsx');
    expect(page).not.toMatch(/MCN标准 > 用户补充要求/);
    expect(page).not.toMatch(/用户补充要求作为额外参考/);
    expect(page).toMatch(/\*\*优先级\*\*：\$\{PRIORITY_ORDER\}/);
  });

  it('统一顺序：事实与安全 > 用户明确要求 > 创作目的 > 模板；写稿板块都带', () => {
    expect(PRIORITY_ORDER.indexOf('事实')).toBeLessThan(PRIORITY_ORDER.indexOf('明确要求'));
    expect(PRIORITY_ORDER.indexOf('明确要求')).toBeLessThan(PRIORITY_ORDER.indexOf('模板'));
    const ctx = { profile: { id: 'p', profile_name: '店' }, positioning: null, dealReasons: [] } as unknown as CreatorContext;
    expect(buildContextBlock(ctx, 'script')).toContain('写作底线');
    expect(buildContextBlock(ctx, 'breakdown')).not.toContain('写作底线');
    expect(outputRulesBlock()).toMatch(/【示例】/);
    expect(outputRulesBlock()).toMatch(/自检通过/);
  });

  it('自由对话每一轮都带不编造的一句', () => {
    expect(readCode('app/api/dify/chat/route.ts')).toMatch(/\$\{FREE_CHAT_FACT_LINE\}/);
  });
});

describe('分数不再包装成「MCN级」', () => {
  it('新报告只说结构要素齐不齐，没有分数和等级', () => {
    const report = formatQualityReport(evaluateScriptQualityStrict('随便一段话'));
    expect(report).not.toMatch(/得分|等级|MCN级|达标/);
    expect(report).toMatch(/\*\*结构检查\*\*：/);
    // 正文和报告照样拆得开
    expect(splitQualityReport(`正文\n\n---\n\n${report}`).body).toBe('正文');
  });

  it('旧记录里的分数、等级、状态不再显示', () => {
    const old = '## 🟢 脚本质量评分\n\n**得分**：9.5 / 10.0 分\n**等级**：MCN级\n**状态**：✅ 达标\n\n### 发现的问题\n- 缺少金句';
    expect(displayQualityReport(old)).not.toMatch(/MCN级|9\.5|达标/);
    expect(parseQualitySummary(old).passed).toBe(true);
    const page = readCode('components/workspace/ResultPanel.tsx');
    expect(page).not.toMatch(/\{quality\.level\}/);
    expect(readCode('components/workspace/HistoryPanel.tsx')).not.toMatch(/toFixed\(1\)\} 分/);
  });
});

describe('分镜：标的时长念不念得完', () => {
  it('5 秒里 46 个字：报出来', () => {
    const line = '这个衣柜我们用的是十八毫米的颗粒板，每一块都是我亲手挑的，你们放心买放心用不会出问题的';
    const md = `| 镜号 | 景别 | 运镜 | 画面 | 台词 | 时长 | 要点 |\n|---|---|---|---|---|---|---|\n| 1 | 中景 | 固定 | 老板指柜子 | ${line} | 5s | 自然 |\n| 2 | 特写 | 固定 | 板材 | 无 | 3s | 清楚 |`;
    const a = auditStoryboard(md, '15秒')!;
    expect(spokenChars(line)).toBeGreaterThan(40);
    expect(a.issues.join('|')).toMatch(/镜头 1：台词 \d+ 字.*念不完/);
    expect(a.issues.join('|')).not.toMatch(/镜头 2：/);
  });
  it('念得完的不报；「无」「（动作）」不算台词', () => {
    expect(spokenChars('无')).toBe(0);
    expect(spokenChars('（转身拿锅）真好吃！')).toBe(3);
  });
});

describe('按资料修正', () => {
  it('提示词只改列出的几处，其余不动', () => {
    const p = buildFactFixPrompt({ text: '原稿正文', issues: ['价格「人均 68 元」档案和素材里都没有'] });
    expect(p).toMatch(/只改这几处/);
    expect(p).toMatch(/【待确认/);
    expect(p).toContain('人均 68 元');
  });
  it('没被标出的句子大多被改了就不采用（防止借机重写全文）；编得多的短稿正当修正不误拒', () => {
    // 2026-10-05 真实模型实测：这份稿子编了 5 处，修正后只剩一句原话——这是对的，不能拒
    const bad = '## 开头\n人均 68 元吃到撑！90% 的人第一次来都会点二份。\n## 正文\n上周有位顾客跟我说，吃完第二天又带全家来了。我们锅底每天早上现炒。\n## 结尾\n现在到店免费送一份甜品，自检通过，无编造。';
    const issues = ['价格「# 开头 人均 68 元吃到撑！」档案和素材里都没有', '百分比「68 元吃到撑！90% 的人第」没有出处', '顾客见证「## 正文 上周有位顾客跟我说，吃完第二天又带全家」资料里没有这段经历', '经营承诺「结尾 现在到店免费送一份甜品」老板没说过要这样做', '模型自称「自检通过」——以这里的核对为准，别信这句'];
    expect(fixTooBig(bad, '## 开头\n价格实在，不少人第一次来都会点二份。\n## 正文\n我们锅底每天早上现炒。\n## 结尾\n欢迎到店品尝。', issues)).toBe(false);
    // 借机把没标出的句子也改了：拒
    const before = '第一句话很长很长。第二句话也很长。第三句话说别的。人均 68 元。';
    expect(fixTooBig(before, '完全不一样的一整篇新稿子，没有一句和原来相同。', ['价格「人均 68 元」档案和素材里都没有'])).toBe(true);
    expect(fixTooBig(before, '第一句话很长很长。第二句话也很长。第三句话说别的。价格亲民。', ['价格「人均 68 元」档案和素材里都没有'])).toBe(false);
  });
  it('页面：查到才出现、最多 5 条、不扣次数；接口有每天上限', () => {
    expect(readCode('components/workspace/FactCheckNotice.tsx')).toMatch(/if \(!issues\.length\) return auto\?\.state === 'done'/);
    expect(readCode('components/workspace/FactCheckNotice.tsx')).toMatch(/NOTICE_MAX = 5/);
    const route = readCode('app/api/fact-fix/route.ts');
    expect(route).toMatch(/autoDay = createRateLimiter\(24 \* 3600_000, 20\)/);
    expect(route).toMatch(/manualMonth = createRateLimiter\(30 \* 24 \* 3600_000, 10\)/);
    expect(route).not.toMatch(/reserveCreation|incrementUsage/);
  });
});

describe('第二阶段对比实测的误报（2026-10-05）', () => {
  it('「常见误区」「被褥区」「分区」「样柜展示区」「元的区」「潮湿地区」都不是地名', () => {
    expect(facts('衣柜常见误区：被褥区放太低，常用区不够，帮你算分区。样柜展示区可以拍。88 元的区别。南方潮湿地区要注意。', '{}\n88元')).toBe('');
    expect(facts('朝阳区的朋友也来了', '{}')).toMatch(/地名「朝阳区」/);
  });
  it('内容配比的百分比不是统计数据', () => {
    expect(facts('内容配比：流量型 60% / 人设型 25% / 变现型 15%', '{}')).toBe('');
  });
  it('提醒「所谓免费设计套路」不是老板的承诺；真承诺照报', () => {
    expect(facts('警惕所谓"免费设计"的套路', '{}')).toBe('');
    expect(facts('到店报抖音粉丝再送一份蘸料！', '{}')).toMatch(/经营承诺/);
  });
  it('模型自己写的自检清单不算交付内容；自称自检通过照样报', () => {
    const out = '## 开篇\n在苏州做家具的第 12 年。\n\n## 自检\n- 来苏州3年、店开2年、从业12年均按事实卡\n- 未编造';
    const persona = { yearsInTrade: '家具从业12年', yearsLocal: '来苏州3年', others: '门店开了2年' };
    expect(runQualityChecks({ output: out, profile: { persona_facts: persona }, taskType: '开篇钩子' }).issues.map((i) => i.detail).join('|')).not.toMatch(/均按事/);
    expect(unsupportedFacts(out, JSON.stringify(persona))[0]).toMatch(/模型自称「未编造」/);
  });
  it('「在苏州卖了两年家具」按店龄算（门店开了 2 年）不报；「在杭州做了 5 年美甲」（在杭州才 2 年）照报', () => {
    expect(yearConflicts('在苏州卖了两年家具', { yearsInTrade: '家具从业12年', yearsLocal: '来苏州3年', others: '门店开了2年' })).toEqual([]);
    expect(yearConflicts('在杭州做了5年美甲', { yearsInTrade: '美甲从业5年', yearsLocal: '在杭州定居2年', others: '店开了1年' }).length).toBeGreaterThan(0);
  });
});

describe('第二轮对比实测的误报（2026-10-05）', () => {
  it('「这个城市」「其他城市」「夜市」「成都老乡」不是地名；「南乐县」照常认', () => {
    expect(facts('来到这个城市，和其他城市不一样，老王在夜市摆摊，碰到个成都老乡。', '{}')).toBe('');
    expect(facts('濮阳市南乐县的朋友', '{}')).toMatch(/地名/);
  });
  it('「拿起一块」是量词不是价格；「只要三块」照报', () => {
    expect(facts('镜头3：拿起一块，指着切面', '{}')).toBe('');
    expect(facts('一串只要三块', '{}')).toMatch(/价格/);
  });
  it('「没有"全网第一"这类说法」是在说避开了，不是在吹；「全网第一」照报', () => {
    expect(facts('自检：没有"最低价""全网第一"等绝对化用语', '{}').replace(/模型自称[^|]*\|?/, '')).toBe('');
    expect(facts('我们是全网第一的串串', '{}')).toMatch(/全网第一/);
  });
});
