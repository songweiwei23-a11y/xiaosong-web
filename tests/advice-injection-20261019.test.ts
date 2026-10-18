import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adviceContextBlock, buildIndustryAdvicePrompt } from '@/lib/industry-advice';

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

describe('行业建议要进到每一个创作板块（2026-10-19 修复）', () => {
  it('选题页手动拼的上下文带上行业建议；脚本页不带（方案 D：脚本只给档案和写作底线）', () => {
    expect(read('app/dashboard/topic/page.tsx')).toContain('advice: creatorContext.advice');
    expect(read('app/dashboard/script/page.tsx')).not.toContain('advice: creatorContext.advice');
  });
});

describe('行业建议提示词：分工版（只管这个阶段怎么打，不重述定位）', () => {
  const withBaselines = buildIndustryAdvicePrompt({
    profileSummary: '- 账号：锦园串串',
    baseline: '六维地基',
    businessBaseline: '商业定位：到店咨询是主路径',
    contentBaseline: '内容定位：烧烤做法系列',
    input: { purpose: 'monetize', stage: 'accumulate', situation: '' },
  });

  it('输出结构：本阶段判断、重心系列、结尾动作、暂停、执行规则、复诊条件', () => {
    for (const part of ['本阶段判断', '本阶段重心方向', '每类目的的结尾动作', '本阶段暂停什么', '30 天执行规则', '复诊条件']) {
      expect(withBaselines, part).toContain(part);
    }
    // 不再重述定位：「行业真实打法」「核心策略」这些和定位重叠的部分已经去掉
    expect(withBaselines).not.toContain('行业真实打法');
    expect(withBaselines).not.toContain('核心策略');
  });

  it('药方是建议不是命令：用户选定的方向优先，不替用户改写内容定位', () => {
    expect(withBaselines).toContain('药方是建议，不是命令。用户选定的方向优先');
    expect(withBaselines).toContain('不阻止、不改写');
    expect(withBaselines).toContain('不替用户新增或改写内容定位');
    expect(withBaselines).toContain('建议把它加进内容定位');
    expect(withBaselines).toContain('优先引用它的原系列名');
  });

  it('复诊条件不写具体数字；拍小票、价格画面的金额不编', () => {
    expect(withBaselines).toContain('不写任何具体数字');
    expect(withBaselines).toContain('金额一律用【待确认】或「金额打码」');
  });

  it('变现动作要对应商业定位里的步骤，写出原步骤名', () => {
    expect(withBaselines).toContain('商业定位已有，第 3 节的变现动作写出原步骤名');
  });

  it('没有内容定位、商业定位时：先补做内容定位，变现动作待商业定位', () => {
    const bare = buildIndustryAdvicePrompt({
      profileSummary: 'x',
      input: { purpose: 'traffic', stage: 'start', situation: '' },
    });
    expect(bare).toContain('内容定位还没有做');
    expect(bare).toContain('【待内容定位】');
    expect(bare).toContain('方向先按用户选定的来给建议');
    expect(bare).toContain('商业定位还没有做');
    expect(bare).toContain('【待商业定位】');
  });

  it('价格和阈值数字的硬约束（对照实验里出现过的编造）', () => {
    expect(withBaselines).toContain('价格、价位、人均、营业时间、地址、作息');
    expect(withBaselines).toContain('阈值类数字');
    expect(withBaselines).toContain('和这个号自己过去的数据比较');
  });

  it('注入上限能容纳典型输出（实测约 4100 字），复诊条件不会被截掉', () => {
    const typical = Array.from({ length: 12 }, (_, i) => `## 第${i + 1}节\n${'这是一段有内容的打法说明。'.repeat(20)}\n`).join('\n');
    expect(typical.length).toBeGreaterThan(3000);
    expect(typical.length).toBeLessThan(6000);
    expect(adviceContextBlock(typical)).not.toContain('（以下略）');
  });
});
