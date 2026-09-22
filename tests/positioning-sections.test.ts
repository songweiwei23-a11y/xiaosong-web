import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  SECTIONS,
  SECTION_SPECS,
  parsePositioning,
  replaceSection,
  buildSectionPrompt,
  sectionOf,
} from '@/lib/positioning-sections';

/**
 * 单节重生成。
 *
 * 【为什么要有】定位 12466 字、跑一次 5 分钟。用一段时间发现某个细节不对，
 * 今天唯一的路是整份重生成——其他九成对的内容也跟着变，
 * 等于为改一句话把整份方案重赌一次。结果是用户不敢点重新生成。
 *
 * 【最大的风险】改一节，把别的节弄坏。下面「只动这一节」那一组卡的就是这个。
 */

/** 按真实产出的结构写的样本（小节标题取自实际生成的那一份） */
const DOC = `# 🎯 账号定位方案

## 📌 核心结论（先看这 8 条）

1. **这是什么号**：to B 本地服务商
2. **给谁看**：被坑过的南乐老板

## 🔍 先说这一行

**归口**：B 类服务商
收费：月费 1500-3000

## 🗣 我会先问老板的几个问题

- **问题**：你做这行多少年了？
  - 待确认

## 一句话定位

接单先看人、不合适的钱不赚的南乐本土编导

## 六维地基

### 1. 人设定位

**原料在哪**：档案里写了"有温度"
**人设标签句**：接单先看人的南乐编导

### 2. 用户定位

**一句话画像**：被上一个代运营坑过的南乐餐馆老板

### 3. 内容定位

**主打内容类型**：晒过程 50%

### 4. 呈现定位（只给结论）

口播为主，一周两条

### 5. 风格调性（只给结论）

唠嗑口气

### 6. 变现定位（只给结论）

月费 2000，完整拆解见商业定位板块

## 🧠 记忆点设计

### 1. 语言类：口头禅

"这单我没接"

### 2. 动作类

固定手势

## ⚡ 差异化：A + 变量B

### 组合1：工作过程类

常规A：拍成品

## 📇 账号五件套（可以今天就改）

### 头像

真人出镜

## ✅ 自洽检验

1. 遮住字幕能看出气质吗？能

## ⚠️ 这个号最大的风险

### 风险1：客户资源不够

说明文字`;

describe('小节定义', () => {
  it('每节都有标签、匹配规则和说明', () => {
    for (const s of SECTIONS) {
      expect(s.label, `${s.key} 缺标签`).toBeTruthy();
      expect(s.hint, `${s.key} 缺说明`).toBeTruthy();
      expect(s.match, `${s.key} 缺匹配规则`).toBeInstanceOf(RegExp);
    }
  });

  it('key 不重复', () => {
    const k = SECTIONS.map((s) => s.key);
    expect(new Set(k).size).toBe(k.length);
  });

  it('六维是三级标题，其余是二级', () => {
    const six = ['persona', 'audience', 'content', 'presentation', 'tone', 'monetize'];
    for (const s of SECTIONS) {
      expect(s.level, `${s.label} 的层级不对`).toBe(six.includes(s.key) ? 3 : 2);
    }
  });

  /**
   * 产出要求必须从 OUTPUT_FULL 切出来，不能另写一份。
   * 两处各记一份，同一节两次生成的结构会不一样。
   */
  it('每一节都从整份提示词里切到了产出要求', () => {
    const missing = SECTIONS.filter((s) => !SECTION_SPECS[s.key]?.trim()).map((s) => s.label);
    expect(missing, `这些节没切到产出要求：${missing.join('、')}`).toEqual([]);
  });

  it('切出来的要求确实是那一节的', () => {
    expect(SECTION_SPECS.persona).toContain('把形容词翻译成具体行为');
    expect(SECTION_SPECS.audience).toContain('不敢排除人群');
    expect(SECTION_SPECS.monetize).toContain('商业定位」板块专门深挖');
  });
});

describe('解析', () => {
  const p = parsePositioning(DOC);

  it('十五节全部解析出来', () => {
    const missing = SECTIONS.filter((s) => !p[s.key]).map((s) => s.label);
    expect(missing, `没解析出：${missing.join('、')}`).toEqual([]);
  });

  it('内容归属正确，没被上下节串走', () => {
    expect(p.oneline).toBe('接单先看人、不合适的钱不赚的南乐本土编导');
    expect(p.persona).toContain('人设标签句');
    expect(p.persona).not.toContain('一句话画像'); // 下一节的内容不能漏进来
    expect(p.monetize).toContain('月费 2000');
  });

  it('模型自己分的三级标题跟着所属小节走，不单独成节', () => {
    // 记忆点下面的「1. 语言类」「2. 动作类」是模型自己分的，
    // 不在注册清单里，应当留在记忆点这一节内
    expect(p.memory).toContain('语言类');
    expect(p.memory).toContain('动作类');
  });

  it('「## 六维地基」这种容器标题不会吃掉下一节', () => {
    expect(p.persona).toBeTruthy();
    expect(p.oneline).not.toContain('人设标签句');
  });

  it('空值不炸', () => {
    for (const x of [null, undefined, '', '  ']) expect(parsePositioning(x)).toEqual({});
  });
});

describe('只动这一节——这是单节重生成的全部意义', () => {
  it('替换后其余各节一个字不变', () => {
    const before = parsePositioning(DOC);
    const next = replaceSection(DOC, 'audience', '**一句话画像**：改成了新的人群描述');
    const after = parsePositioning(next);

    expect(after.audience).toContain('改成了新的人群描述');
    for (const s of SECTIONS) {
      if (s.key === 'audience') continue;
      expect(after[s.key], `${s.label} 被改动了`).toBe(before[s.key]);
    }
  });

  it('替换六维里的一维，不影响相邻两维', () => {
    const next = replaceSection(DOC, 'content', '**主打内容类型**：改成讲故事 60%');
    const after = parsePositioning(next);
    expect(after.content).toContain('讲故事 60%');
    expect(after.audience).toContain('被上一个代运营坑过');
    expect(after.presentation).toContain('口播为主');
  });

  it('替换最后一节不会丢内容', () => {
    const next = replaceSection(DOC, 'risk', '新的风险说明');
    expect(parsePositioning(next).risk).toBe('新的风险说明');
    expect(parsePositioning(next).coherence).toContain('遮住字幕');
  });

  it('替换第一节不会丢前面的大标题', () => {
    const next = replaceSection(DOC, 'summary', '新的核心结论');
    expect(next).toContain('# 🎯 账号定位方案');
    expect(parsePositioning(next).summary).toBe('新的核心结论');
  });

  it('原文里没有这一节时，原样返回，不乱插', () => {
    const doc = '## 一句话定位\n\n只有一节';
    expect(replaceSection(doc, 'persona', '插不进去')).toBe(doc);
  });

  it('标题行本身保留下来', () => {
    const next = replaceSection(DOC, 'oneline', '新定位');
    expect(next).toContain('## 一句话定位');
  });
});

/**
 * 功能做了、入口出不来，是白做。
 *
 * 第一版的渲染条件是 `result && selectedPositioning &&…`，
 * 而生成完只刷新了列表、没设选中——于是生成完看不到「逐节调整」，
 * 得先去左边历史里点一下才出现。用户直接问"页面上没有单独修改的地方"。
 */
describe('页面上的入口确实会出现', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'app/dashboard/positioning/page.tsx'),
    'utf8'
  );

  it('生成完把新定位设为当前选中', () => {
    // 不设的话逐节修改不知道要 PATCH 哪一行，入口也出不来
    expect(src).toMatch(/setSelectedPositioning\(newPositioning\)/);
  });

  it('刷新页面后也有兜底：按内容匹配库里的行', () => {
    expect(src).toMatch(/const editTarget\s*=/);
    expect(src, '必须内容对得上才认，否则会 PATCH 到不相干的定位上').toMatch(
      /full_content\?\.trim\(\) === result\.trim\(\)/
    );
  });

  it('渲染条件用 editTarget，不再只看 selectedPositioning', () => {
    expect(src).toMatch(/\{result && editTarget && viewMode !== 'summary'/);
  });

  it('对不上任何一行时给出说明，而不是静默不显示', () => {
    expect(src).toContain('和已保存的定位对不上');
  });
});

describe('单节重生成的提示词', () => {
  const p = buildSectionPrompt({
    sectionKey: 'persona',
    positioningFull: DOC,
    note: '人设标签太泛了，我想突出"先干活后收钱"',
  });

  it('明确只改这一节', () => {
    expect(p).toContain('只重写其中的「人设定位」这一节');
    expect(p).toContain('其余各节保持不变');
    expect(p).toContain('不要写小节标题');
  });

  it('带上锚点，保证和其余部分对得上', () => {
    expect(p).toContain('接单先看人、不合适的钱不赚的南乐本土编导'); // 一句话定位
    expect(p).toContain('to B 本地服务商'); // 核心结论
  });

  it('带上这一节的现状和用户说的问题', () => {
    expect(p).toContain('人设标签句');
    expect(p).toContain('先干活后收钱');
  });

  it('只带这一节需要的参考资料，不发整份方法论', () => {
    expect(p).toContain('七个入口'); // 人设七入口，这节要用
    expect(p).not.toContain('小镇青年'); // 人群词根，这节用不上
    expect(p).not.toContain('30 天起号实验');
    // 整份方法论一万两千字，为一节付这个成本不值
    expect(p.length).toBeLessThan(9000);
  });

  it('不同的节带不同的参考资料', () => {
    const a = buildSectionPrompt({ sectionKey: 'audience', positioningFull: DOC, note: '' });
    expect(a).toContain('小镇青年'); // 人群词根，这节要用
    expect(a).not.toContain('七个入口'); // 人设入口，这节用不上
  });

  it('用户没说具体问题时也能跑', () => {
    const p2 = buildSectionPrompt({ sectionKey: 'oneline', positioningFull: DOC, note: '' });
    expect(p2).toContain('用户没说具体问题');
  });

  it('未知的节返回空串，调用方照常工作', () => {
    expect(buildSectionPrompt({ sectionKey: 'xxx', positioningFull: DOC, note: '' })).toBe('');
    expect(sectionOf('xxx')).toBeUndefined();
  });
});
