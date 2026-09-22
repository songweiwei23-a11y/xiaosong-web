import { describe, it, expect } from 'vitest';
import {
  CONTENT_TYPES,
  CONTENT_TYPE_GROUPS,
  CONTENT_TYPE_VALUES,
  VISUAL_STYLES,
  VISUAL_STYLE_VALUES,
  contentTypeGuide,
  contentTypeExample,
  visualStyleGuide,
} from '@/lib/content-types';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';

/**
 * 内容类型原来只有 6 个（美食/VLOG/教程/产品/故事/访谈），
 * 恰恰漏掉了实体店老板最常拍的几类：口播、探店、晒过程、测评对比、
 * 挑战体验、客户案例。补齐的依据是我们自己的知识库，不是凭空分的。
 *
 * 更要紧的是原来界面选项和提示词里的方法论**在两个文件里各存一份**，
 * 中间没有任何关联。加一个类型只要忘了写方法论，提示词里
 * 「本类内容的特殊要求」那一整段就静默消失——不报错、不影响构建，
 * 只是产出质量降一档。下面第一组就是卡这个的。
 */

describe('每个类型都配齐了方法论，没有半成品', () => {
  for (const t of CONTENT_TYPES) {
    it(`${t.label}（${t.value}）有要点、有示例、有分组`, () => {
      expect(t.guide, `${t.value} 没写分镜要点`).toBeTruthy();
      expect(t.example, `${t.value} 没写示例脚本`).toBeTruthy();
      expect(CONTENT_TYPE_GROUPS).toContain(t.group);
    });
  }

  it('要点要写到可执行，不是一句空话', () => {
    for (const t of CONTENT_TYPES) {
      const bullets = t.guide.split('\n').filter((l) => l.trim().startsWith('- '));
      expect(bullets.length, `${t.value} 只有 ${bullets.length} 条要点，太少`).toBeGreaterThanOrEqual(4);
      expect(t.guide.length, `${t.value} 的要点只有 ${t.guide.length} 字，多半是敷衍`).toBeGreaterThan(150);
    }
  });

  it('value 不重复', () => {
    expect(new Set(CONTENT_TYPE_VALUES).size).toBe(CONTENT_TYPE_VALUES.length);
  });

  it('每个分组下都有类型，不出现空标题', () => {
    for (const g of CONTENT_TYPE_GROUPS) {
      expect(CONTENT_TYPES.filter((t) => t.group === g).length, `${g} 组是空的`).toBeGreaterThan(0);
    }
  });
});

describe('老数据还认得出来', () => {
  // 历史记录里存的是这六个 value，改名会让老的分镜记录对不上类型
  for (const old of ['food', 'vlog', 'tutorial', 'product', 'story', 'interview']) {
    it(`保留了原有取值 ${old}`, () => {
      expect(CONTENT_TYPE_VALUES).toContain(old);
    });
  }
});

describe('知识库里那几类真的补上了', () => {
  const should: Array<[string, string]> = [
    ['talking', '口播'],
    ['visit', '探店'],
    ['process', '晒过程'],
    ['review', '测评对比'],
    ['challenge', '挑战体验'],
    ['case', '客户案例'],
    ['knowledge', '知识讲解'],
  ];
  for (const [value, label] of should) {
    it(`${label}`, () => {
      const t = CONTENT_TYPES.find((x) => x.value === value);
      expect(t, `缺少 ${label}（${value}）`).toBeDefined();
      expect(t!.label).toBe(label);
    });
  }
});

describe('接进分镜提示词', () => {
  const base = {
    scriptContent: '测试脚本内容，足够长以便解析。',
    platform: '抖音',
    duration: '60秒',
    visualStyle: 'cinematic',
    visualStyleLabel: '电影感',
    additionalInfo: '',
  };

  it('每个类型都能把自己的要点带进提示词', () => {
    for (const t of CONTENT_TYPES) {
      const p = buildStoryboardPrompt({ ...base, contentType: t.value });
      expect(p, `${t.value} 的要点没进提示词`).toContain('本类内容的特殊要求');
      // 取要点里的第一条比对，确认进去的是这个类型的、不是别人的
      const first = t.guide.split('\n').find((l) => l.trim().startsWith('- '))!.trim();
      expect(p).toContain(first);
    }
  });

  it('不同类型给的是不同的要点', () => {
    const talking = buildStoryboardPrompt({ ...base, contentType: 'talking' });
    const visit = buildStoryboardPrompt({ ...base, contentType: 'visit' });
    expect(talking).toContain('别贴墙拍');
    expect(visit).toContain('跟随镜头');
    expect(talking).not.toContain('静音的探店');
  });

  it('未知类型不会让整段塌掉', () => {
    const p = buildStoryboardPrompt({ ...base, contentType: 'not-a-type' });
    expect(p).not.toContain('本类内容的特殊要求');
    expect(p).toContain('分镜'); // 其余部分照常
  });
});

describe('视觉风格：AI 推荐的可选值必须和实际选项一致', () => {
  /**
   * 这条是有来由的：AI 推荐的提示词里曾写着可选值
   * cinematic/bright/dark/vintage/minimalist/warm，而实际选项是
   * cinematic/bright/warm/cool/vintage/minimal。dark 和 minimalist
   * 根本不存在，cool 和 minimal 从没被推荐过。模型返回 dark 时界面
   * 被设成无效值：卡片一个都不高亮，提示词里的风格段落静默消失。
   */
  it('每个风格都有可执行的光线与色彩说明', () => {
    for (const s of VISUAL_STYLES) {
      expect(visualStyleGuide(s.value), `${s.value} 没写指引`).toBeTruthy();
    }
  });

  it('不存在 dark / minimalist 这两个当年写错的值', () => {
    expect(VISUAL_STYLE_VALUES).not.toContain('dark');
    expect(VISUAL_STYLE_VALUES).not.toContain('minimalist');
    expect(VISUAL_STYLE_VALUES).toContain('cool');
    expect(VISUAL_STYLE_VALUES).toContain('minimal');
  });

  it('未知风格取不到指引，但不抛错', () => {
    expect(visualStyleGuide('dark')).toBe('');
    expect(visualStyleGuide(undefined)).toBe('');
  });
});

describe('取值函数的边界', () => {
  it('未知类型取不到要点，示例退回第一个而不是崩', () => {
    expect(contentTypeGuide('xxx')).toBe('');
    expect(contentTypeGuide(undefined)).toBe('');
    expect(contentTypeExample('xxx')).toBe(CONTENT_TYPES[0].example);
  });
});
