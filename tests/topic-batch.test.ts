/**
 * 选题条数不够自动补写一次（2026-10-27）。
 * 补写会再扣一次额度，所以只补一次；补的那次出错或没有更多条，就保留第一次的结果。
 */

import { describe, it, expect, vi } from 'vitest';
import { completeBatch, countTopicsIn } from '@/lib/topic-batch';

const topics = (n: number) =>
  Array.from({ length: n }, (_, i) => `## 选题${i + 1}：第${i + 1}条的标题\n视频目的：流量型\n拍法：街头采访`).join('\n\n');

describe('选题条数', () => {
  it('按「## 选题N」数条数，和选题库的拆分规则一致', () => {
    expect(countTopicsIn(topics(6))).toBe(6);
    expect(countTopicsIn('')).toBe(0);
  });
});

describe('条数够就不补写', () => {
  it('第一次已经写满，不再调用补写（不多扣额度）', async () => {
    const again = vi.fn(async () => topics(6));
    const out = await completeBatch(topics(6), 6, again);
    expect(out).toBe(topics(6));
    expect(again).not.toHaveBeenCalled();
  });
});

describe('条数不够补写一次', () => {
  it('补写后条数更多，就用补写的那批', async () => {
    const again = vi.fn(async () => topics(6));
    const out = await completeBatch(topics(4), 6, again);
    expect(again).toHaveBeenCalledTimes(1);
    expect(countTopicsIn(out)).toBe(6);
  });

  it('补写没有比第一次多，保留第一次的结果', async () => {
    const first = topics(4);
    const out = await completeBatch(first, 6, async () => topics(3));
    expect(out).toBe(first);
  });

  it('补写出错，保留第一次的结果，不把它丢掉', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = topics(5);
    const out = await completeBatch(first, 6, async () => {
      throw new Error('额度用完了');
    });
    expect(out).toBe(first);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('第一次是空的（模型没写出来），补写一次', async () => {
    const out = await completeBatch('', 3, async () => topics(3));
    expect(countTopicsIn(out)).toBe(3);
  });
});
