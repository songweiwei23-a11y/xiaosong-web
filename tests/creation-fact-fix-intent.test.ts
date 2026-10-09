import { describe, expect, it } from 'vitest';
import { unsupportedFacts } from '@/lib/quality-checks';
import { buildFactFixContext, buildFactFixPrompt, factCheckCreationSource } from '@/lib/fact-fix';

describe('资料修正仍守住原意', () => {
  it('返乡与县城等普通词不会被当成地名，从而自动删掉主题', () => {
    const text = '引发县城返乡青年的讨论。听说我回县城，好像返乡只有一个原因。观众在评论区聊聊。';
    expect(unsupportedFacts(text, '')).toEqual([]);
    expect(unsupportedFacts('郑州市、南乐县的朋友来聊聊。', '').join('|')).toMatch(/郑州市/);
    expect(unsupportedFacts('郑州市、南乐县的朋友来聊聊。', '').join('|')).toMatch(/南乐县/);
  });
  it('修正携带目的、限制、受众和原始要求；不能只带通用账号背景', () => {
    const context = { originContent: '讨论返乡的选择，不卖课。', settings: {
      topic: '返乡选择', audience: '县城返乡青年', purpose: '流量型' as const,
      userIntent: '不卖课、不私信、不编造个人经历。', workingScript: 'AI 凭空写了赚一百万。',
    } };
    const source = factCheckCreationSource(context);
    expect(source).toContain('县城返乡青年');
    expect(source).not.toContain('一百万');
    const prompt = buildFactFixPrompt({ text: '返乡怎么选', issues: ['误报'], context: buildFactFixContext(context, '通用商业档案'.repeat(2000)) });
    expect(prompt).toContain('不卖课、不私信、不编造个人经历');
    expect(prompt).toContain('流量型');
    expect(prompt).toContain('主题、人群、立场和限制必须保留');
    expect(prompt.indexOf('不卖课')).toBeLessThan(prompt.indexOf('通用商业档案'));
  });
  it('长原始要求仍进入修正上下文，不被原来的4000字截断', () => {
    const original = '返乡讨论。'.repeat(1000) + '最后要求不推销、不改变方向。';
    const prompt = buildFactFixPrompt({ text: '讨论稿', issues: ['核对'], context: buildFactFixContext({ originContent: original }) });
    expect(prompt).toContain('最后要求不推销、不改变方向');
  });
});
