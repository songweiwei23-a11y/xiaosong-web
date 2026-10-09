import { describe, it, expect } from 'vitest';
import { unsupportedFacts, runQualityChecks } from '@/lib/quality-checks';
import { buildFactFixPrompt } from '@/lib/fact-fix';

describe('事前采访方案的真实性', () => {
  it('未采访时拦截已采访的标题与开头，不把拟访谈问题当事实', () => {
    const source='尚未采访，没有采访结果，要国庆前后门店生意对比。';
    const issues=unsupportedFacts('## 问了一圈老板，他们说生意没变\n开头：今天去问了几家店，发现大家都很闲。',source);
    expect(issues.filter(i=>i.startsWith('采访经历'))).toHaveLength(2);
    expect(unsupportedFacts('开头：国庆前后生意变没变？今天去问问老板。主问题：跟假期比，现在有什么变化？',source)).toEqual([]);
  });
  it('真实提供的采访和明确假设不被当成虚假报道', () => {
    expect(unsupportedFacts('我问了一圈老板，保留现场原话。','我问了一圈老板，有录音和实录。')).toEqual([]);
    expect(unsupportedFacts('如果采访了老板，就保留现场原话；不要写问了一圈老板。','尚未采访')).toEqual([]);
  });
  it('没有“问了”字样的预设结果也不能逃过检查，创作方向同样检查', () => {
    const output='开头：有人说回暖了，有人说更冷清了。\n标题：他们的答案完全不一样。\n台词：国庆一过，店里突然安静下来。';
    const r=runQualityChecks({output,profile:null,taskType:'创作方向',source:'尚未采访，没有采访实录。'});
    expect(r.issues.filter(i=>i.detail.startsWith('采访结果'))).toHaveLength(3);
  });
  it('真实原话、可能性、结果条件分支和问题不被当成编结果', () => {
    const source='尚未采访。';
    for (const text of ['如果他们的答案完全不一样，再比各自依据。','有的可能店里突然安静下来，也可能更忙，实际要问。','他们的答案完全不一样吗？']) {
      expect(unsupportedFacts(text,source)).toEqual([]);
    }
    expect(unsupportedFacts('店里突然安静下来。','店里突然安静下来，这是我自己的真实观察，其他店尚未采访。')).toEqual([]);
  });
  it('修正标题和开头时保留具体采访方案及原意', () => {
    const prompt=buildFactFixPrompt({text:'问了一圈老板',issues:['采访经历「问了一圈老板」没有素材'],context:'国庆前后门店生意对比，尚未采访'});
    expect(prompt).toContain('标题被标为虚假经历时也要改成待验证的问题');
    expect(prompt).toContain('保留原主题、具体主问题、追问、前后比较与取材安排');
  });
});

