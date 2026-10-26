import { describe, expect, it } from 'vitest';
import { buildDirectionPrompt, clampDirectionCount, DEFAULT_DIRECTION_COUNT } from '@/lib/direction';
import { defaultPickIds, splitCreationItems } from '@/lib/creation-items';

const dirMarkdown = [
  ...Array.from({ length: 8 }, (_, i) => `### 方向${i + 1}：拍法${i + 1}\n- **内容方向**：内容${i + 1}\n- **内容类型**：反向操作\n- **节奏**：第${i + 1}周`),
  '### 我推荐先做：方向8「拍法8」\n- **为什么是它**：最适合现在',
].join('\n\n---\n\n');

describe('创作方向默认勾选', () => {
  it('只勾前五个和推荐的那一个', () => {
    const parts = splitCreationItems(dirMarkdown);
    const ids = defaultPickIds(parts);
    expect(ids).toEqual(expect.arrayContaining(parts.items.slice(0, 5).map((it) => it.id)));
    expect(ids.length).toBeLessThan(parts.items.length);
    const recommended = parts.items.filter((it) => /我推荐/.test(`${it.label}${it.body}`));
    recommended.forEach((it) => expect(ids).toContain(it.id));
  });
});

const base = { purposes: ['fans'], formats: ['any'], count: 5 as const, depth: 'quick' as const };

describe('创作方向只给范围（2026-10-26）：目的、人群、形式、拍法都留给选题层', () => {
  it('方向数最少 10 个，默认 20，可自由填', () => {
    expect(clampDirectionCount(3)).toBe(10);
    expect(clampDirectionCount(13)).toBe(13);
    expect(clampDirectionCount(999)).toBe(40);
    expect(clampDirectionCount(NaN)).toBe(DEFAULT_DIRECTION_COUNT);
    expect(DEFAULT_DIRECTION_COUNT).toBe(20);
  });

  it('有思路、内容方向、切入角度、可展开的选题，并保留方向标题', () => {
    const p = buildDirectionPrompt(base);
    expect(p).toContain('## 📌 这个方向的思路');
    expect(p).toContain('## 🧭 内容方向');
    expect(p).toContain('- **内容方向**：');
    expect(p).toContain('- **切入角度**：');
    expect(p).toContain('- **题眼池**：');
    expect(p).toContain('- **核心目的**：');
    expect(p).toContain('## ⚠️ 这次先别做的');
    expect(p).toContain('### 方向1：');
  });

  it('不出视频目的、对应目的，也不出配比一览（配比在内容规划里定）', () => {
    const p = buildDirectionPrompt({ ...base, mixBlock: '配比：流量型 3 条' });
    expect(p).not.toContain('## 📊 配比一览');
    expect(p).not.toContain('- **视频目的**：');
    expect(p).not.toContain('- **对应目的**：');
  });

  it('不带 36 计清单，也不让方向填形式（拍法留给选题层）', () => {
    const p = buildDirectionPrompt(base);
    expect(p).not.toContain('#### 起号 36 计清单');
    expect(p).not.toContain('- **内容类型**：从下面的 36 计清单里选一计');
  });

  it('不带四大脚本讲法（形式留给选题层）', () => {
    const p = buildDirectionPrompt(base);
    expect(p).not.toContain('## 四大脚本（薛老师）');
    expect(p).not.toContain('- **讲法**：');
  });

  it('禁忌写了不揭秘时，方向里也不出现内幕揭秘', () => {
    const p = buildDirectionPrompt({ ...base, contextBlock: '## 禁忌\n- 不揭秘行业内幕' });
    expect(p).not.toMatch(/\*\*内幕揭秘\*\*/);
  });
});
