/**
 * 内容创作树的数据契约（2026-10-30，lib/creation-tree）。
 *
 * 守的是：两个大类各自的结构都在注册表里；大类和类型由结构名推出来；
 * 写进提示词的块能原样读回来；认不出的结构直接报错或返回空，不静默猜。
 */
import { describe, expect, it } from 'vitest';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';
import { FOUR_SCRIPT_CHOICES } from '@/lib/creation-settings';
import {
  allStructureNames,
  bigTypeOfStructure,
  formatTreeBlock,
  isKnownStructure,
  kindOfStructure,
  makeTreeNode,
  parseTreeBlock,
  tacticStructureName,
} from '@/lib/creation-tree';

describe('注册表：两个大类的结构都在', () => {
  it('四大脚本的结构全部在注册表里，36 计每一计也都在', () => {
    for (const c of FOUR_SCRIPT_CHOICES) expect(isKnownStructure(c.name)).toBe(true);
    for (const t of GROWTH_TACTICS) expect(isKnownStructure(tacticStructureName(t.no, t.name))).toBe(true);
  });

  it('总数 = 四大脚本的结构 + 36 计', () => {
    expect(allStructureNames()).toHaveLength(FOUR_SCRIPT_CHOICES.length + GROWTH_TACTICS.length);
  });
});

describe('大类和类型由结构名推出来', () => {
  it('四大脚本的结构：大类是四大脚本，类型是结构前面那一段', () => {
    expect(bigTypeOfStructure('聊观点·论证型')).toBe('四大脚本');
    expect(kindOfStructure('聊观点·论证型')).toBe('聊观点');
    expect(kindOfStructure('晒过程·火车节')).toBe('晒过程');
  });

  it('36 计的结构：大类是 36 计，没有四大脚本的类型', () => {
    const name = tacticStructureName(GROWTH_TACTICS[0].no, GROWTH_TACTICS[0].name);
    expect(bigTypeOfStructure(name)).toBe('36计');
    expect(kindOfStructure(name)).toBe('');
  });

  it('认不出的结构：大类为空', () => {
    expect(bigTypeOfStructure('乱写的结构')).toBe('');
  });
});

describe('生成契约节点', () => {
  it('四大脚本的节点：大类、类型、结构、目的、任务、元素、来源都带上', () => {
    const n = makeTreeNode({ structure: '聊观点·论证型', purpose: '人设型', task: '让人信你这个人', elements: ['反差', '反差'], source: '方向2' });
    expect(n).toEqual({ bigType: '四大脚本', kind: '聊观点', structure: '聊观点·论证型', purpose: '人设型', task: '让人信你这个人', elements: ['反差'], source: '方向2' });
  });

  it('结构名不在注册表里：直接报错，不静默放过', () => {
    expect(() => makeTreeNode({ structure: '瞎写的结构' })).toThrow('结构名不在注册表里');
  });

  it('目的不合法：置空，不写进去', () => {
    expect(makeTreeNode({ structure: '聊观点·论证型', purpose: '乱写的目的' }).purpose).toBe('');
  });
});

describe('提示词块：写出去再读回来，字段不丢', () => {
  it('四大脚本节点往返一致', () => {
    const node = makeTreeNode({ structure: '晒过程·火车节', purpose: '变现型', task: '看到过程就想来店里', elements: ['怀旧', '成本'], source: '选题3' });
    const block = formatTreeBlock(node);
    expect(block).toContain('- 具体结构：晒过程·火车节');
    expect(parseTreeBlock(block)).toEqual(node);
  });

  it('36 计节点往返一致', () => {
    const name = tacticStructureName(GROWTH_TACTICS[0].no, GROWTH_TACTICS[0].name);
    const node = makeTreeNode({ structure: name, purpose: '流量型', task: '一眼看懂的反差' });
    expect(parseTreeBlock(formatTreeBlock(node))).toEqual(node);
  });

  it('块里没有具体结构：读不出，返回空', () => {
    expect(parseTreeBlock('【内容树】\n- 大类：四大脚本')).toBeNull();
  });

  it('块里的结构认不出：返回空，不猜', () => {
    expect(parseTreeBlock('【内容树】\n- 具体结构：乱写的结构')).toBeNull();
  });
});
