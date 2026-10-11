import { describe, it, expect } from 'vitest';
import { spokenStep, scriptRepairReason, acceptScriptRepair, explicitBudget, buildScriptRepairPrompt } from '@/lib/script-repair';

const step = (spoken: string) => `## 第1步：脚本策略卡\n策略。\n\n## 第2步：纯文字文案\n${spoken}\n\n## 第3步：完整分镜脚本\n镜头一。\n\n## 第4步：执行与优化建议\n建议。`;
const words = (n: number) => '老板说话'.repeat(Math.ceil(n / 4)).slice(0, n);

describe('脚本修复：第 2 步口播', () => {
  it('按「第2步…纯文字文案」标题取口播，只数汉字', () => {
    expect(spokenStep(step('这一串烤得焦香。'))).toBe(7);
  });

  it('没有「纯文字文案」一步（比如交的是候选方向）返回 null', () => {
    expect(spokenStep('## 第1步：脚本策略卡\n策略。\n## 第2步：候选方向\n方向一。')).toBeNull();
  });
});

describe('脚本修复：什么时候修', () => {
  it('编导设了 30 秒，口播超过 165 字（上限 150 的 1.1 倍）才修', () => {
    expect(explicitBudget('30秒')).toBe(150);
    expect(scriptRepairReason(step(words(160)), '30秒')).toBeNull();
    expect(scriptRepairReason(step(words(307)), '30秒')).toBe('length');
  });

  it('AI推荐或没设时长：不查长度，只查结构', () => {
    expect(explicitBudget('AI推荐')).toBeNull();
    expect(scriptRepairReason(step(words(1500)), 'AI推荐')).toBeNull();
    expect(scriptRepairReason(step(words(1500)), '')).toBeNull();
  });

  it('没有第 2 步纯文字文案：结构原因，不论时长', () => {
    expect(scriptRepairReason('## 第1步：脚本策略卡\n策略。\n## 第2步：候选方向\n方向。', '30秒')).toBe('structure');
  });
});

describe('脚本修复：修复稿什么时候采用', () => {
  it('修复稿仍超过 1.1 倍上限，不采用', () => {
    expect(acceptScriptRepair(step(words(300)), '30秒')).toBe(false);
  });

  it('修复稿回到上限以内、结构完整，采用', () => {
    expect(acceptScriptRepair(step(words(140)), '30秒')).toBe(true);
  });

  it('修复稿没有第 2 步，不采用', () => {
    expect(acceptScriptRepair('## 第1步：脚本策略卡\n策略。', '30秒')).toBe(false);
  });

  it('修复稿口播太短（不到 40 字），不采用，免得为压缩把口播删空', () => {
    expect(acceptScriptRepair(step('太短。'), '30秒')).toBe(false);
  });
});

describe('脚本修复：提示词', () => {
  it('超时长时写明压到多少字，并禁止新增素材', () => {
    const p = buildScriptRepairPrompt({ text: step(words(307)), reason: 'length', spoken: 307, duration: '30秒' });
    expect(p).toContain('307 字');
    expect(p).toContain('150 字以内');
    expect(p).toContain('不新增任何素材');
  });

  it('结构缺失时要求按四步重写', () => {
    const p = buildScriptRepairPrompt({ text: '原稿', reason: 'structure', duration: 'AI推荐' });
    expect(p).toContain('第2步：纯文字文案');
    expect(p).toContain('四步结构');
  });
});
