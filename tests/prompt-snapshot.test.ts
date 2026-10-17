/**
 * 提示词快照（体检 E1）：固定输入，把关键提示词的完整文字存成快照。
 * 改了提示词（哪怕一句）快照会变，测试会红——这时要看一眼差异，确认是有意改的，再更新快照。
 * 这不是质量评估，只保证「改了什么」是看得见的。质量仍要用真实样本回归。
 */
import { describe, it, expect } from 'vitest';
import { buildAdaptiveScriptPrompt } from '@/lib/script-design';
import { buildStoryboardPrompt, FOLLOW_SCRIPT } from '@/lib/storyboard-standards';

const base = {
  topic: '沙发怎么挑才不踩坑',
  platform: '抖音',
  context: '账号：家具店，老板做了 12 年',
  source: '她在揉面，手上全是白。',
  requirements: '',
  settings: {},
};

describe('提示词快照：固定输入，文字不能悄悄变', () => {
  it('脚本生成（AI 推荐时长）', () => {
    expect(buildAdaptiveScriptPrompt({ ...base, duration: 'AI推荐' })).toMatchSnapshot();
  });

  it('脚本生成（设了 60 秒）', () => {
    expect(buildAdaptiveScriptPrompt({ ...base, duration: '60秒' })).toMatchSnapshot();
  });

  it('分镜（按脚本长度）', () => {
    expect(buildStoryboardPrompt({
      scriptContent: '这家人预算只有几万，一进店就说我们钱不多你看着给配吧。',
      platform: '抖音', contentType: 'talking', visualStyle: 'bright', visualStyleLabel: '明亮', additionalInfo: '',
      duration: FOLLOW_SCRIPT,
    })).toMatchSnapshot();
  });
});
