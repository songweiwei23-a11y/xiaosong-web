import { describe, it, expect } from 'vitest';
import { holdUnsupported, PENDING_MARK } from '@/lib/evidence-guard';

const issuesOf = (t: string) => (/90%/.test(t) ? ['百分比「90%」没有出处'] : []);

describe('没有出处的句子换成【待确认】（确定性，不靠模型改写）', () => {
  it('只替换有问题的那一句，其余原样保留', () => {
    const r = holdUnsupported('这一顿 90% 的人都会选错。另一句保持。', issuesOf);
    expect(r.held).toBe(1);
    expect(r.text).toBe(`${PENDING_MARK}另一句保持。`);
    expect(r.text).not.toContain('90%');
  });

  it('连续有问题的句子合并成一个占位', () => {
    const r = holdUnsupported('90%的人都错。90%的人都怕。', issuesOf);
    expect(r.text).toBe(PENDING_MARK);
  });

  it('否定或警告语境的行不动（「不要写 90%」是提醒）', () => {
    const line = '不要写90%的人都会选错。';
    const r = holdUnsupported(line, issuesOf);
    expect(r.text).toBe(line);
    expect(r.held).toBe(0);
  });

  it('已经标了【示例】的行不动', () => {
    const line = '【示例】90%的人都会选错。';
    expect(holdUnsupported(line, issuesOf).text).toBe(line);
  });

  it('没有问题的文字原样返回', () => {
    const text = '## 标题\n普通的一句话。';
    const r = holdUnsupported(text, issuesOf);
    expect(r.text).toBe(text);
    expect(r.held).toBe(0);
  });
});
