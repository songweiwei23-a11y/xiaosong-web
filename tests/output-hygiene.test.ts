import { describe, it, expect } from 'vitest';
import { stripSelfCheck, unsupportedFacts } from '@/lib/quality-checks';
import { softenPlatformBannedWords } from '@/lib/result-reconciliation';
import { FACT_AUTO_FIX_TASKS } from '@/lib/fact-fix';
import { buildReviewPrompt } from '@/lib/review-standards';

describe('交付前整理：去掉模型写的自检清单', () => {
  it('自检标题整块去掉，正文保留', () => {
    const out = stripSelfCheck('一句话钩子\n\n## ✅ 发布前自检\n- 无编造数字\n- 符合禁忌\n\n## 拍摄建议\n师傅站在炭火前');
    expect(out).toContain('一句话钩子');
    expect(out).toContain('拍摄建议');
    expect(out).not.toContain('发布前自检');
    expect(out).not.toContain('无编造数字');
  });

  it('「数字来源核查」标签和它下面缩进的子条目一起去掉（评测里的真实格式）', () => {
    const text = [
      '台词：一块钱一串，该给的料一样不少。',
      '',
      '- **数字来源核查**：',
      '  - "9年川菜"来自档案原话 ✅',
      '  - "30块钱"需老板确认 ✅',
      '',
      '- **禁忌核查**：',
      '  - 未出现绝对化用语 ✅',
      '结尾：评论区告诉我你在哪。',
    ].join('\n');
    const out = stripSelfCheck(text);
    expect(out).toContain('台词：一块钱一串');
    expect(out).toContain('结尾：评论区告诉我你在哪');
    expect(out).not.toContain('数字来源核查');
    expect(out).not.toContain('9年川菜');
    expect(out).not.toContain('绝对化用语');
  });

  it('「这条为什么这样写」「数据说明」这类给老板看的说明块也去掉', () => {
    const out = stripSelfCheck('一句话钩子\n\n## 💡 这条为什么这样写\n因为观众怕被坑。\n\n## ⚠️ 本脚本的数据与事实说明\n- 来自档案的事实：9年川菜\n\n## 拍摄建议\n师傅站在炭火前');
    expect(out).toContain('一句话钩子');
    expect(out).toContain('拍摄建议');
    expect(out).not.toContain('为什么这样写');
    expect(out).not.toContain('数据与事实说明');
  });

  it('正文里普通的「核对」字眼不误删', () => {
    expect(stripSelfCheck('老板每天核对一次库存。')).toBe('老板每天核对一次库存。');
  });
});

describe('平台禁用词：「揭秘」换成中性说法', () => {
  it('写进标题、口播、选题的「揭秘」直接替换', () => {
    expect(softenPlatformBannedWords('揭秘一元火锅的成本\n教知识·揭秘型')).toBe('拆解一元火锅的成本\n教知识·拆解型');
  });

  it('提醒「不说揭秘」的行保持原样', () => {
    expect(softenPlatformBannedWords('- 不说"揭秘"，不用绝对化用语')).toBe('- 不说"揭秘"，不用绝对化用语');
  });
});

describe('审稿优化：提示词不许以「缺少档案材料」为由停下', () => {
  it('交付规则写进了审稿提示词', () => {
    const prompt = buildReviewPrompt({
      draftContent: '我在这条街干了18年。', platform: '抖音', duration: '30秒', scriptType: '晒过程型',
      reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: true, severityLabels: true,
      contextBlock: '账号背景：做川菜9年',
    } as Parameters<typeof buildReviewPrompt>[0]);
    expect(prompt).toContain('交付不得以「缺少档案材料」为由停下');
    expect(prompt).toContain('【待确认：…】');
  });
});

describe('生成后自动查出处的板块', () => {
  it('包含脚本、标题、选题、二创，不包含审稿优化', () => {
    for (const t of ['脚本生成', '标题封面', '选题策划', '跨行业二创', '创作方向']) expect(FACT_AUTO_FIX_TASKS.has(t)).toBe(true);
    expect(FACT_AUTO_FIX_TASKS.has('审稿优化')).toBe(false);
  });
});

describe('出处检查：编出来的价格和顾客证言会被认出', () => {
  it('档案里没有的具体价格要标出来', () => {
    const issues = unsupportedFacts('这一顿 30 块钱吃到撑。', '一元一串，人均 50-200 元');
    expect(issues.some((i) => i.includes('价格'))).toBe(true);
  });

  it('编造的顾客证言要标出来', () => {
    const issues = unsupportedFacts('来过的人都说，这个价位能吃成这样，值了。', '一元一串');
    expect(issues.some((i) => i.includes('顾客见证'))).toBe(true);
  });
});
