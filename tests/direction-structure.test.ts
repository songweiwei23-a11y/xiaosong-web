import { describe, expect, it } from 'vitest';
import { buildDirectionPrompt, COUNT_OPTIONS } from '@/lib/direction';

const base = { purposes: ['fans'], formats: ['any'], count: 5 as const, depth: 'quick' as const };

describe('创作方向沿用内容规划的结构', () => {
  it('方向数至少 20 个，默认 20', () => {
    expect(Math.min(...COUNT_OPTIONS)).toBe(20);
  });

  it('有思路、内容方向、内容类型、先别做的，并保留方向标题', () => {
    const p = buildDirectionPrompt(base);
    expect(p).toContain('## 📌 这个方向的思路');
    expect(p).toContain('## 🧭 内容方向');
    expect(p).toContain('- **内容类型**：按小黄的脚本结构选一个');
    expect(p).toContain('- **内容方向**：');
    expect(p).toContain('## ⚠️ 这次先别做的');
    expect(p).toContain('### 方向1：');
  });

  it('有配比时带配比一览，流量型不许写教知识', () => {
    const p = buildDirectionPrompt({ ...base, mixBlock: '配比：流量型 3 条' });
    expect(p).toContain('## 📊 配比一览');
    expect(p).toContain('流量型那一行只写流量打法');
    expect(p).toContain('- **视频目的**：流量型 / 人设型 / 变现型，只写一个');
  });

  it('没有配比时不出配比一览', () => {
    const p = buildDirectionPrompt(base);
    expect(p).not.toContain('## 📊 配比一览');
    expect(p).toContain('- **对应目的**：');
  });
});
