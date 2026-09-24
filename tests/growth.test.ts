import { describe, it, expect } from 'vitest';
import {
  GROWTH_TACTICS,
  SELECTION_MATRIX,
  TEST_RULE,
  tacticByName,
  tacticByNo,
} from '@/lib/growth-tactics';
import { OPENING_CARDS, OPENING_CATEGORIES, cardByName } from '@/lib/opening-cards';
import { buildGrowthPlanPrompt, buildOpeningPrompt } from '@/lib/growth-standards';

/**
 * 起号板块。数据是从知识库那两个精编版文件用脚本提取的，不是手抄——
 * 73 条、每条 7-9 个字段，手抄错了没人会发现。
 *
 * 【为什么必须结构化】实测问过知识库「起号三十六计第1-10计叫什么」，
 * 它答「知识库中没有」——那两个大文件没被导入 Dify，
 * 能检索到的只有零散单节。而且推荐引擎要按资源条件精确匹配，
 * 检索给不了这种确定性。
 */

describe('起号 36+1 计的数据完整性', () => {
  it('正好 37 条（36 计 + 赠送第 37 计）', () => {
    expect(GROWTH_TACTICS).toHaveLength(37);
  });

  it('序号连续不重复', () => {
    const nos = GROWTH_TACTICS.map((t) => t.no).sort((a, b) => a - b);
    expect(nos).toEqual(Array.from({ length: 37 }, (_, i) => i + 1));
  });

  it('每一计的字段都齐', () => {
    const bad: string[] = [];
    for (const t of GROWTH_TACTICS) {
      for (const k of ['name', 'mechanism', 'formula', 'fit', 'howto', 'limit'] as const) {
        if (!t[k]?.trim()) bad.push(`${t.no}.${t.name} 缺 ${k}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('每一计都有边界——什么情况下不能用', () => {
    // 没有边界的方法会被滥用。比如「扮猪吃虎」不写边界，
    // 就会有人真去伪造求职身份骗路人
    for (const t of GROWTH_TACTICS) {
      expect(t.limit.length, `${t.name} 的边界太短`).toBeGreaterThan(8);
    }
  });

  it('抽样核对内容，确认提取没串行', () => {
    const t1 = tacticByNo(1)!;
    expect(t1.name).toBe('反向操作');
    expect(t1.formula).toContain('常规A');
    expect(t1.limit).toContain('羞辱');

    const t37 = tacticByNo(37)!;
    expect(t37.name).toContain('身份反差');
  });

  it('按名字能查到', () => {
    expect(tacticByName('扮猪吃虎')?.no).toBe(2);
    expect(tacticByName('不存在的计')).toBeUndefined();
  });
});

describe('开篇 36 计方法卡', () => {
  it('正好 36 张', () => {
    expect(OPENING_CARDS).toHaveLength(36);
  });

  it('每张卡字段都齐', () => {
    const bad: string[] = [];
    for (const c of OPENING_CARDS) {
      for (const k of ['name', 'category', 'psychology', 'formula', 'howto', 'risk'] as const) {
        if (!c[k]?.trim()) bad.push(`${c.no}.${c.name} 缺 ${k}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('有分类，能按组展示', () => {
    expect(OPENING_CATEGORIES.length).toBeGreaterThan(2);
  });

  it('抽样核对', () => {
    const c = cardByName('圈定人群')!;
    expect(c.no).toBe(1);
    expect(c.formula).toContain('人群标签');
    expect(c.risk).toContain('歧视');
  });
});

describe('选择矩阵——这是起号板块的核心', () => {
  it('五种资源条件都有', () => {
    expect(SELECTION_MATRIX).toHaveLength(5);
    for (const m of SELECTION_MATRIX) {
      expect(m.condition).toBeTruthy();
      expect(m.detect, `${m.condition} 没说怎么判断用户符合`).toBeTruthy();
      expect(m.prefer.length).toBeGreaterThan(2);
      expect(m.defer, `${m.condition} 没写暂缓什么`).toBeTruthy();
    }
  });

  /**
   * 矩阵里推荐的打法必须真实存在。
   * 写错一个名字，推荐引擎就会推一个查不到内容的计，
   * 而且不报错——只是那一计没有完整说明。
   */
  it('矩阵里提到的打法名都能在 37 计里查到', () => {
    const missing: string[] = [];
    for (const m of SELECTION_MATRIX) {
      for (const name of m.prefer) {
        if (!tacticByName(name)) missing.push(`${m.condition} → ${name}`);
      }
    }
    expect(missing, `这些打法名对不上：\n${missing.join('\n')}`).toEqual([]);
  });

  it('测试规则明确"一次只改一个变量"', () => {
    // 没有这条，用户会拍一条没火就换打法，永远在换、永远起不来
    expect(TEST_RULE).toContain('一次只改一个核心变量');
    expect(TEST_RULE).toContain('至少测 3');
  });
});

describe('起号方案提示词', () => {
  const ctx = '## 🧭 创作简报\n\n### 怎么拍\n\n一个人、手机+灯、多在家或车里';

  it('立场是替用户做选择，不是介绍方法', () => {
    const p = buildGrowthPlanPrompt({ contextBlock: ctx });
    expect(p).toContain('不是在介绍方法，是在替他做选择');
  });

  it('带上选择矩阵，并说明为什么它最重要', () => {
    const p = buildGrowthPlanPrompt({});
    expect(p).toContain('先选适合自己的，而非最炫的');
    expect(p).toContain('用户看完 37 计的第一反应是挑最有意思的');
  });

  it('没圈定时给 37 计速览，不发全文', () => {
    const p = buildGrowthPlanPrompt({});
    expect(p).toContain('37 计速览');
    expect(p).toContain('反向操作');
    // 全文一万多字，会让模型在 37 个里平均用力
    expect(p).not.toContain('**案例与变体**');
  });

  it('圈定之后只发那几计的完整内容', () => {
    const p = buildGrowthPlanPrompt({ picked: ['行业避坑', '内幕揭秘'] });
    expect(p).toContain('用户已经圈定了这几计');
    expect(p).toContain('**案例与变体**'); // 完整内容出现了
    expect(p).toContain('不要推荐清单之外的打法');
    // 没圈定的计不该出现完整块
    expect(p).not.toContain('### 9. 一人分饰多角');
  });

  it('带上账号上下文、30天节奏和诊断树', () => {
    const p = buildGrowthPlanPrompt({ contextBlock: ctx });
    expect(p).toContain('一个人、手机+灯');
    expect(p).toContain('第1-3天');
    expect(p).toContain('有曝光但前段流失');
  });

  it('要求每一计都说清"为什么是你能拍的"', () => {
    const p = buildGrowthPlanPrompt({});
    expect(p).toContain('为什么是你能拍的');
    expect(p).toContain('说不出来就别推荐');
    // 产能撑不住就不能排成每天一条
    expect(p).toContain('不要排成每天一条');
  });
});

describe('开篇钩子提示词', () => {
  it('讲清楚钩子是承诺不是诱饵', () => {
    const p = buildOpeningPrompt({ topic: '为什么我们家牛肉贵' });
    expect(p).toContain('钩子不是诱饵');
    expect(p).toContain('正文必须兑现');
  });

  it('没圈定时给 36 种速览，并提醒别堆钩子', () => {
    const p = buildOpeningPrompt({ topic: 'x' });
    expect(p).toContain('圈定人群');
    expect(p).toContain('堆钩子等于没钩子');
  });

  it('圈定之后只发那几张卡的完整内容，并且每张各写一条', () => {
    const p = buildOpeningPrompt({ topic: 'x', picked: ['圈定人群', '直接提问'] });
    expect(p).toContain('用户圈定了 2 种');
    expect(p).toContain('**心理机制**');
    expect(p).not.toContain('复古怀旧');
    // 改过一次：原来是"在这几种里面写"，可以两条都用同一张卡。
    // 用户要的是横向比较——每种开法各一条，才比得出差别
    expect(p).toContain('每一种各写一条');
  });

  it('要求每条用不同的计，并给出推荐', () => {
    const p = buildOpeningPrompt({ topic: 'x' });
    expect(p).toContain('每条用不同的计');
    expect(p).toContain('我推荐哪一条');
    // 挑最适合这个号的，不是最刺激的
    expect(p).toContain('不是挑最刺激的那条');
  });

  it('要求口语、合口吻、不踩禁忌', () => {
    const p = buildOpeningPrompt({ topic: 'x', contextBlock: '## 🧭 创作简报' });
    expect(p).toContain('能直接念的口语');
    expect(p).toContain('和这个号的口吻一致');
    expect(p).toContain('账号禁忌');
  });

  it('可以传入现有开头做优化', () => {
    const p = buildOpeningPrompt({ topic: 'x', currentOpening: '大家好我是小宋' });
    expect(p).toContain('现在的开头');
    expect(p).toContain('大家好我是小宋');
  });

  it('条数可配', () => {
    expect(buildOpeningPrompt({ topic: 'x', count: 3 })).toContain('给 3 条');
  });
});

/**
 * 第五轮反馈：起号的内容配比没按小黄来。
 * 原来起号方案只讲"挑哪一计"，没说起号期这些打法占多大一块、什么时候补别的；
 * 也看不到已定的内容定位，更看不到拍摄条件（借用的是脚本板块的上下文）。
 */
describe('起号期配比与内容定位对齐', () => {
  it('带上小黄第40节：三十六计是流量型、到一千粉流量稳定才算起号成功', async () => {
    const { GROWTH_MIX } = await import('@/lib/growth-standards');
    const p = buildGrowthPlanPrompt({});
    expect(p).toContain(GROWTH_MIX);
    expect(GROWTH_MIX).toContain('**大多是流量型内容**');
    expect(GROWTH_MIX).toContain('零粉做到一千粉，而且发出去的视频流量都比较稳定');
    expect(p).toContain('## 🧮 起号期内容配比');
  });

  it('前 3 条标题叠爆款元素（薛老师八大元素）', () => {
    expect(buildGrowthPlanPrompt({})).toContain('标题叠一个爆款元素（成本、人群、头牌、奇葩、最差、反差、怀旧、荷尔蒙）');
  });

  it('已定的内容定位传进来就用上，没有就不留空段', async () => {
    const { buildTacticPickPrompt } = await import('@/lib/growth-standards');
    const plan = '## 内容方向：多元四类还是单一主题\n选 B：帮100个老板拍第一条';
    for (const p of [buildGrowthPlanPrompt({ contentPlan: plan }), buildTacticPickPrompt({ contentPlan: plan })]) {
      expect(p).toContain('## 🧭 已经定好的内容定位（起号要和它一致）');
      expect(p).toContain('帮100个老板拍第一条');
    }
    expect(buildGrowthPlanPrompt({})).not.toContain('## 🧭 已经定好的内容定位');
  });

  it('从内容定位里只摘方向、配比、系列名，不要十集清单', async () => {
    const { extractContentPlan } = await import('@/lib/growth-standards');
    const md = [
      '# 💎 内容定位方案',
      '## 长期价值主张', '让老板看见',
      '## 内容方向：多元四类还是单一主题', '选 A+B',
      '## 内容配比', '### 作用配比', '流量 60%', '### 配比核验', '1. 是',
      '## 内容系列（2 个）',
      '### 系列一：帮100个老板拍第一条', '一句话：…', '定量：第一条视频', '变量：行业', '前10集：', '1. 火锅店', '2. 烧烤店',
      '## 选题来源', '客户提问',
    ].join('\n');
    const out = extractContentPlan(md);
    expect(out).toContain('选 A+B');
    expect(out).toContain('流量 60%');
    expect(out).not.toContain('配比核验');
    expect(out).toContain('### 系列一：帮100个老板拍第一条');
    expect(out).toContain('变量：行业');
    expect(out).not.toContain('火锅店');
    expect(out).not.toContain('客户提问');
    expect(extractContentPlan('')).toBe('');
  });

  it('旧格式的内容定位也认（「内容类型配比」「内容系列（4个）」）', async () => {
    const { extractContentPlan } = await import('@/lib/growth-standards');
    const out = extractContentPlan('## 内容类型配比\n晒过程 50%\n## 内容系列（4个）\n### 系列一：「这个老板我觉得行」\n**形式**：晒过程型');
    expect(out).toContain('晒过程 50%');
    expect(out).toContain('这个老板我觉得行');
  });
});

describe('和禁忌冲突的打法，交给 AI 之前就剔掉', () => {
  // 实测：禁忌写着"不揭秘行业内幕"，起号方案照样把「内幕揭秘」列成备选
  const R = '不揭秘行业内幕、不诋毁同行';

  it('认得出冲突', async () => {
    const { tacticsBlockedBy } = await import('@/lib/growth-standards');
    expect(tacticsBlockedBy(R)).toEqual(['内幕揭秘']);
    expect(tacticsBlockedBy('')).toEqual([]);
  });

  it('推荐候选和完整方案的清单里都没有它，并说明为什么', async () => {
    const { buildTacticPickPrompt } = await import('@/lib/growth-standards');
    for (const p of [buildGrowthPlanPrompt({ restrictions: R }), buildTacticPickPrompt({ restrictions: R })]) {
      expect(p).not.toMatch(/- \*\*内幕揭秘\*\*/);
      expect(p).toContain('⛔ 这几计和他档案里的禁忌冲突');
    }
    expect(buildGrowthPlanPrompt({})).toMatch(/- \*\*内幕揭秘\*\*/);
  });

  it('用户手动圈了也剔掉', () => {
    const p = buildGrowthPlanPrompt({ restrictions: R, picked: ['内幕揭秘', '行业避坑'] });
    expect(p).not.toMatch(/### \d+\. 内幕揭秘/);
    expect(p).toMatch(/### \d+\. 行业避坑/);
  });
});
