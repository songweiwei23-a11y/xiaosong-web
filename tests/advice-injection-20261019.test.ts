import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adviceContextBlock, buildIndustryAdvicePrompt } from '@/lib/industry-advice';

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

describe('行业建议要进到每一个创作板块（2026-10-19 修复）', () => {
  it('选题页和脚本页自己拼的上下文也带上行业建议', () => {
    // 这两页是手动拼 ctx 的，之前漏了 advice，存过的药方在选题和脚本里等于没有
    expect(read('app/dashboard/topic/page.tsx')).toContain('advice: creatorContext.advice');
    expect(read('app/dashboard/script/page.tsx')).toContain('advice: creatorContext.advice');
  });
});

describe('行业建议提示词：应该做、不该做、核心策略', () => {
  const withBaselines = buildIndustryAdvicePrompt({
    profileSummary: '- 账号：锦园串串',
    baseline: '六维地基',
    businessBaseline: '商业定位：到店咨询是主路径',
    contentBaseline: '内容定位：烧烤做法系列',
    input: { purpose: 'monetize', stage: 'accumulate', situation: '' },
  });

  it('输出结构包含核心判断、应该做、不该做、核心策略', () => {
    for (const part of ['核心判断', '行业真实打法', '应该做什么', '不该做什么', '核心策略']) {
      expect(withBaselines, part).toContain(part);
    }
  });

  it('应该做和不该做要能追溯到内容定位或商业定位', () => {
    expect(withBaselines).toContain('必须能追溯到内容定位或商业定位');
    expect(withBaselines).toContain('逐条标出处');
  });

  it('价格和阈值数字的硬约束（对照实验里出现过的编造）', () => {
    expect(withBaselines).toContain('价格、价位、人均、营业时间、地址、作息');
    expect(withBaselines).toContain('阈值类数字');
    expect(withBaselines).toContain('和这个号自己过去的数据比较');
  });

  it('注入上限能容纳典型输出（实测约 4100 字），核心策略不会被截掉', () => {
    const typical = Array.from({ length: 12 }, (_, i) => `## 第${i + 1}节\n${'这是一段有内容的打法说明。'.repeat(20)}\n`).join('\n');
    expect(typical.length).toBeGreaterThan(3000);
    expect(typical.length).toBeLessThan(6000);
    expect(adviceContextBlock(typical)).not.toContain('（以下略）');
  });

  it('没有内容定位和商业定位时，要求先补做它们，并把打法标为推断', () => {
    const bare = buildIndustryAdvicePrompt({
      profileSummary: 'x',
      input: { purpose: 'traffic', stage: 'start', situation: '' },
    });
    expect(bare).toContain('内容定位和商业定位都还没有做');
    expect(bare).toContain('先补做内容定位、商业定位');
    expect(bare).not.toContain('逐条标出处');
  });
});
