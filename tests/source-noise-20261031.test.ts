/**
 * 旧内容不带入生成（2026-10-31）：偏好、历史里带具体场地、设备、时段的，不拼进任何创作的提示词。
 * 这些通道对所有账号、所有行业都生效，所以用固定样例守住。
 */
import { describe, expect, it } from 'vitest';
import { hasConcreteScene } from '@/lib/scene-words';
import { preferencePromptBlock } from '@/lib/preferences';

describe('具体场景判定', () => {
  it('场地、设备、时段都算具体场景；普通表达不算', () => {
    expect(hasConcreteScene('凌晨四点起锅的开头更有代入感')).toBe(true);
    expect(hasConcreteScene('每天下午4点出摊')).toBe(true);
    expect(hasConcreteScene('新加了棚子，灯光打好')).toBe(true);
    expect(hasConcreteScene('开头先说结论，再讲依据')).toBe(false);
  });
});

describe('偏好拼进提示词：带具体场景的不拼', () => {
  const item = (id: string, text: string) => ({ id, category: 'opening', text, status: 'active', evidence: {} } as never);

  it('时段、场地字样的偏好被挡掉，普通偏好保留', () => {
    const block = preferencePromptBlock([
      item('1', '凌晨四点起锅的开头更有代入感'),
      item('2', '新加了棚子，灯光打好'),
      item('3', '开头先说结论，再讲依据'),
    ]);
    expect(block).toContain('开头先说结论，再讲依据');
    expect(block).not.toContain('凌晨四点');
    expect(block).not.toContain('棚子');
  });

  it('全部是具体场景时，整段为空', () => {
    expect(preferencePromptBlock([item('1', '凌晨四点出摊')])).toBe('');
  });
});
