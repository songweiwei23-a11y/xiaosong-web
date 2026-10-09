import { describe, expect, it } from 'vitest';
import { factGuardTail, profileFactsBlock, userDonts } from '@/lib/fact-guard';
import { unsupportedFacts } from '@/lib/quality-checks';
import { findExcludedMentions } from '@/lib/interview-exclusions';
import { scanTaboos } from '@/lib/taboos';

/** 2026-10-09 全板块实测的家具店档案（南乐） */
const furniture = {
  product_category: ['家居建材', '沙发', '床'],
  account_track: ['家居装修', '新中式家具', '奶油风家具'],
  competitive_advantage: '六大品类风格齐全，合伙人有15年行业经验',
  unique_selling_point: '一站式配齐全屋家具',
  team_structure: '老板娘出镜，合伙人负责进货',
};

describe('档案关键事实原话', () => {
  it('品类、竞争优势原话和年限归属都写进去', () => {
    const block = profileFactsBlock(furniture);
    expect(block).toContain('【档案关键事实');
    expect(block).toContain('「六大品类风格齐全，合伙人有15年行业经验」');
    expect(block).toContain('「15 年行业经验」≠「15 年老店」');
    expect(block).toContain('合伙人的年限不能安到出镜人身上');
  });
  it('没有档案或档案是空的不加', () => {
    expect(profileFactsBlock(null)).toBe('');
    expect(profileFactsBlock({})).toBe('');
  });
});

describe('用户说过不要的', () => {
  it('从原话里取出「不想拍成甩卖」这类', () => {
    const donts = userDonts(['国庆后客流少，想拍一条，但不想拍成甩卖、降价那种，也别显得很惨。', undefined]);
    expect(donts.some((d) => d.startsWith('不想拍成甩卖'))).toBe(true);
    expect(donts.some((d) => d.startsWith('别显得很惨'))).toBe(true);
  });
  it('「不要编」是给模型的规矩，不算用户的不要', () => {
    expect(userDonts(['不要编数字'])).toEqual([]);
  });
  it('最多 6 条、去重', () => {
    const t = Array.from({ length: 10 }, (_, i) => `不要做第${i}种内容`).join('。');
    expect(userDonts([t, t])).toHaveLength(6);
  });
  it('尾巴里列出用户的不要；没有时不出这行', () => {
    expect(factGuardTail(['不想拍成甩卖'])).toContain('「不想拍成甩卖」');
    expect(factGuardTail()).not.toContain('用户原话里说了不要的');
    expect(factGuardTail()).toContain('【交稿前最后一查');
  });
});

describe('实测补的三类编造', () => {
  const known = '南乐县 家具店 六大品类';
  it('客户故事、经营做法、效果基准、教用户编数字都能查出', () => {
    const out = unsupportedFacts([
      '前两天来了对小夫妻，看了一圈沙发。',
      '我们报价就是底价，砍我也不降。',
      '直接跟厂家拿货，省了三层代理商的钱。',
      '完播率低于 40% 就换开头。',
      '如果没有具体数字就说沙发三千多。',
    ].join('\n'), known);
    expect(out.some((s) => s.startsWith('客户故事「'))).toBe(true);
    expect(out.filter((s) => s.startsWith('经营做法「')).length).toBeGreaterThanOrEqual(2);
    expect(out.some((s) => s.startsWith('效果基准「'))).toBe(true);
    expect(out.some((s) => s.startsWith('教用户编数字「'))).toBe(true);
    // 效果基准那一行的 40% 不再按百分比重复报
    expect(out.some((s) => s.startsWith('百分比「'))).toBe(false);
  });
  it('标了占位、反例、假设和否定的不报', () => {
    const out = unsupportedFacts([
      '前两天来了【换成你接待的真实客户】',
      '❌ 前两天来了对小夫妻，砍我也不降',
      '如果上周来了一位客人问价，可以这样回答',
      '不是厂家直供的也没关系',
      '语速放慢 20%，音量调低 30%',
    ].join('\n'), known);
    expect(out).toEqual([]);
  });
  it('「N 年老店」档案里没有就报；功能区和「区间」不当地名', () => {
    const out = unsupportedFacts('我们是15年老店。\n沙发区和餐桌区分开，最佳完播区间是前 5 秒。', known);
    expect(out.some((s) => s.startsWith('资历/荣誉「') && s.includes('15年老店'))).toBe(true);
    expect(out.some((s) => s.startsWith('地名'))).toBe(false);
  });
});

describe('修复后复测的误报（2026-10-09）', () => {
  it('建议、配比、否定、通用规则都不报', () => {
    const out = unsupportedFacts([
      '- **第37计 身份反差**（赠送计）：教师 × 家具老板',
      '给出质量验证依据（检测报告、质保年限）',
      '质量相关的具体证据（检测报告）',
      '两周后根据实际数据调整',
      '再用60%的品类内容承接转化',
      '- **目标人群兴趣 35%**：地摊文化',
      '用食材处理、老顾客反馈证明手艺',
      '重点在服务，不是在讲"今天只来了几个人"',
      '批次1占全片79%的镜头',
      '突出川味的外乡人做法',
      '走到柜子区和现代简约区',
    ].join('\n'), '南乐县 尚未采访时写提问型开头');
    expect(out).toEqual([]);
  });
  it('「尚未采访时」的通用规则不触发采访检查，真没采访仍然查', () => {
    expect(unsupportedFacts('我问了一个问题他们愣住了', '尚未采访时写提问型开头')).toEqual([]);
    expect(unsupportedFacts('我问了老板们，他们都说生意差了', '尚未采访：国庆前后生意变化').some((s) => s.startsWith('采访经历'))).toBe(true);
  });
  it('真编的数据仍然报', () => {
    const out = unsupportedFacts('据统计，抖音同城流量95%是本地人。', '南乐县');
    expect(out.some((s) => s.includes('引用了数据'))).toBe(true);
    expect(out.some((s) => s.startsWith('百分比'))).toBe(true);
  });
});

describe('定位里的分析用语不算踩禁忌（2026-10-09 补测）', () => {
  it('分析、比较自己的内容类型不报', () => {
    const text = [
      '所以**流量型占最大**（拿到稳定曝光）',
      '流量型45%是最大的一块，符合新号起号期',
      '**晒过程**(档案"数据最好的内容类型"是"还没发过")',
      '还没验证过哪类内容跑得最好',
      '**人是最大的差异化**——成都师傅本身就是信任状',
      '直接回应最大疑问"一元火锅是真是假"',
      '晒过程 + 真实客人出镜 = 最强信任证据',
      '拍一桌客人（最好3-4个年轻人）',
      '火候（涮多久口感最好）',
      '追求极致便宜、连一元火锅都嫌贵的',
      '主力讲故事（来南乐第一个月）',
      '装修场景高频踩坑,知识需求最强',
      '6000平大店空荡荡的视觉冲击力最强',
      '方向二如果客人配合度高,转化率最好',
      '流量型占45%,是三类里最大的',
      '- **视频目的**：**流量型**（占比最大）',
      '1. **最好拍**：方案1是纯口播',
      '提前准备真实效果图（如有客户案例最佳，无则用通用图）',
      '需要真实案例素材(如果有最好,没有就用假设表达)',
      '为什么节后人少了反而是客人的最佳来店时机？',
      '人少了正好把这个优势发挥到极致',
      '可以直接拍；唯一硬伤是地址缺失',
      '- 稀缺唯一（3分）：没有独家款或唯一性单品',
      '- **不承诺"最正宗""成都第一"**',
      '- **流量45%是最大块**',
      '所以要多拍几波,选最好的一条',
      '同时最大化你的优势',
      '符合争议开篇;唯一可优化点是结尾',
      '2. **一元火锅是你最大的钩子**',
      '老客出镜、互动本身就是最强背书',
    ].join('\n');
    expect(scanTaboos(text, null).map((h) => h.word)).toEqual([]);
  });
  it('真吹的照样报', () => {
    const words = scanTaboos('我们家是南乐第一！\n全城最好吃的串串\n味道最正宗\n极致口感\n拍"南乐最大家具城逛一圈"\n还是你这最全\n我们是价格最实惠的那一家\n我们有独家代理的款式\n全县唯一一家', null).map((h) => h.word);
    expect(words).toEqual(expect.arrayContaining(['南乐第一', '全城最好吃', '最正宗', '极致', '最大', '最全', '最实惠', '独家', '唯一']));
  });
});

describe('排除信息不误伤普通词', () => {
  it('排除「愿意投入」时，「效果」「喜欢」这类普通词不算用到', () => {
    const hits = findExcludedMentions('这种内容效果很好，大家都喜欢看。', ['不太愿意投入拍视频']);
    expect(hits).toEqual([]);
  });
});
