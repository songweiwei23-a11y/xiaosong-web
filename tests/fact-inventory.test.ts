import { describe, expect, it } from 'vitest';
import { INVENTORY_MAX, factInventoryBlock, inventoryOf } from '@/lib/fact-inventory';

describe('本次能用的具体数字（整改 A3）', () => {
  it('从档案的价格、真实情况里抽出数字，并写明来自哪一项', () => {
    const items = inventoryOf({ price_range: '一元串串，人均68元', interview_highlights: '在杭州开美甲店9年' });
    expect(items).toEqual([
      { value: '68元', from: '价格区间' },
      { value: '9年', from: '真实情况' },
    ]);
  });

  it('年份不算年限：2026年是日期，不进清单', () => {
    const items = inventoryOf({ interview_highlights: '2026年开始做抖音，做了9年餐饮' });
    expect(items.map((i) => i.value)).toEqual(['9年']);
  });

  it('同一个写法在几处出现只列一次', () => {
    const items = inventoryOf({ price_range: '68元', unique_selling_point: '招牌68元起' });
    expect(items.map((i) => i.value)).toEqual(['68元']);
  });

  it('事实卡（对象）里的数字也会抽出来', () => {
    const items = inventoryOf({ persona_facts: { experience: '做了18年', city: '南乐' } });
    expect(items).toEqual([{ value: '18年', from: '人设事实卡' }]);
  });

  it('数量有上限，超过的不列', () => {
    const many = Array.from({ length: 30 }, (_, i) => `第${i + 1}个${i + 10}元`).join('，');
    expect(inventoryOf({ content_value: many }).length).toBe(INVENTORY_MAX);
  });

  it('清单段：有数字时一行列出来，并写明清单之外不写', () => {
    const block = factInventoryBlock({ price_range: '68元' });
    expect(block).toContain('「68元」（价格区间）');
    expect(block).toContain('清单之外的数字一律不写');
    expect(block).toContain('【待确认：xx】');
  });

  it('清单段：档案里没有任何数字时，明说没有，不让模型以为是清单漏了', () => {
    const block = factInventoryBlock({ profile_name: '测试号', price_range: '' });
    expect(block).toContain('本次资料里没有具体数字');
    expect(block).toContain('【待确认：xx】');
    expect(block).not.toMatch(/「\d/);
  });

  it('没有档案就不生成这一段', () => {
    expect(factInventoryBlock(null)).toBe('');
  });
});
