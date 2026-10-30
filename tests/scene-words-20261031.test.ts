/**
 * 场地、设备字样不被带进创作（2026-10-31）：偏好里的「新加了棚子」不注入提示词；其它偏好照常。
 */
import { describe, expect, it } from 'vitest';
import { SCENE_GEAR_RE } from '@/lib/scene-words';
import { PREFERENCE_CATEGORIES, preferencePromptBlock, type PreferenceItem } from '@/lib/preferences';

const cat = PREFERENCE_CATEGORIES[0].id;
const item = (text: string, status: 'active' | 'observing' = 'active') =>
  ({ id: text, category: cat, text, status, evidence: [], created_at: '2026-10-30' } as unknown as PreferenceItem);

describe('场地、设备字样', () => {
  it('棚子、灯光、稳定器等都认得出；普通写法不误伤', () => {
    expect(SCENE_GEAR_RE.test('新加了棚子，但不用每条视频都说')).toBe(true);
    expect(SCENE_GEAR_RE.test('灯光不够的时候别硬拍')).toBe(true);
    expect(SCENE_GEAR_RE.test('开口先说一句结论，再讲过程')).toBe(false);
  });
});

describe('偏好：场地、设备的条目不拼进提示词', () => {
  it('带棚子的偏好不出现在提示词里', () => {
    const block = preferencePromptBlock([item('新加了棚子，但不用每条视频都说，默认不提'), item('开口先说结论，少用术语')]);
    expect(block).not.toContain('棚子');
    expect(block).toContain('开口先说结论');
  });

  it('只有场地偏好时，整段为空', () => {
    expect(preferencePromptBlock([item('新加了棚子')])).toBe('');
  });
});
