import { describe, it, expect } from 'vitest';
import { splitForFix, fixInChunks, mergeUsage, CHUNK_TRIGGER_CHARS } from '@/lib/fact-fix-chunks';

const issuesOf = (t: string) => (/90%/.test(t) ? ['百分比「90%的人都会犯的错」没有出处'] : []);

describe('长文分段修正：切分', () => {
  it('按二级标题切开，用换行拼回去与原文一致', () => {
    const text = '## A\n甲\n## B\n乙\n\n## C\n丙';
    expect(splitForFix(text)).toEqual(['## A\n甲', '## B\n乙\n', '## C\n丙']);
    expect(splitForFix(text).join('\n')).toBe(text);
  });

  it('没有二级标题的文本整段作为一块', () => {
    expect(splitForFix('一段话，没有标题。')).toEqual(['一段话，没有标题。']);
  });

  it('触发线是 6000 字', () => {
    expect(CHUNK_TRIGGER_CHARS).toBe(6000);
  });
});

describe('长文分段修正：只修有问题的段落', () => {
  it('只对有问题的段落发修正请求；修好的段落替换，其余段落原样保留', async () => {
    const text = '## A\n这里是开头，没有问题。\n## B\n这一段讲90%的人都会犯的错。\n另一句保持不动。\n## C\n结尾也没有问题。';
    const asked: string[] = [];
    const r = await fixInChunks(text, issuesOf, async (prompt) => {
      asked.push(prompt);
      return '## B\n这一段讲到常见的错误。\n另一句保持不动。';
    }, '');
    expect(asked).toHaveLength(1);
    expect(r.tried).toBe(1);
    expect(r.accepted).toBe(1);
    expect(r.text).toContain('这里是开头，没有问题。');
    expect(r.text).toContain('结尾也没有问题。');
    expect(r.text).not.toContain('90%');
    expect(r.text).toContain('这一段讲到常见的错误。');
  });

  it('修正请求失败（返回 null）时保留原段', async () => {
    const text = '## A\n前文。\n## B\n这一段讲90%的人都会犯的错。\n另一句保持不动。';
    const r = await fixInChunks(text, issuesOf, async () => null, '');
    expect(r.accepted).toBe(0);
    expect(r.text).toBe(text);
  });

  it('修正后问题没有减少时，不采用', async () => {
    const text = '## A\n前文。\n## B\n这一段讲90%的人都会犯的错。\n另一句保持不动。';
    const r = await fixInChunks(text, issuesOf, async () => '## B\n这一段讲90%的人都会犯的错。\n另一句保持不动。', '');
    expect(r.accepted).toBe(0);
    expect(r.text).toBe(text);
  });

  it('没有任何问题时不调用模型', async () => {
    const text = '## A\n没有问题。\n## B\n也没有问题。';
    let calls = 0;
    const r = await fixInChunks(text, issuesOf, async () => { calls++; return null; }, '');
    expect(calls).toBe(0);
    expect(r.tried).toBe(0);
    expect(r.text).toBe(text);
  });
});

describe('长文分段修正：用量合并', () => {
  it('数字字段相加，其余保留', () => {
    expect(mergeUsage({ total_tokens: 10, model: 'a' }, { total_tokens: 5, total_price: '0.1' })).toMatchObject({ total_tokens: 15, model: 'a' });
  });
});
