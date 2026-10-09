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
    expect(p).toContain('- **内容类型**：从下面的 36 计清单里选一计');
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

  it('带 36 计清单和结构公式', () => {
    const p = buildDirectionPrompt(base);
    expect(p).toContain('#### 起号 36 计清单');
    expect(p).toMatch(/第\d+计 \*\*反向操作\*\*/);
  });

  it('36 计为主，四大脚本作为辅助讲法', () => {
    const p = buildDirectionPrompt(base);
    expect(p).toContain('## 四大脚本（薛老师）：辅助');
    expect(p).toContain('- **讲法**：从四大脚本里挑一个结构');
    expect(p.indexOf('#### 起号 36 计清单')).toBeLessThan(p.indexOf('## 四大脚本（薛老师）'));
  });

  it('禁忌写了不揭秘时，清单里不出现内幕揭秘', () => {
    const p = buildDirectionPrompt({ ...base, contextBlock: '## 禁忌\n- 不揭秘行业内幕' });
    expect(p).not.toMatch(/\*\*内幕揭秘\*\*/);
    expect(p).toMatch(/\*\*反向操作\*\*/);
  });

  it('没有配比时不出配比一览', () => {
    const p = buildDirectionPrompt(base);
    expect(p).not.toContain('## 📊 配比一览');
    expect(p).toContain('- **对应目的**：');
  });
});
