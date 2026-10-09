import { describe, it, expect } from 'vitest';
import { readSource as read, readCode } from './helpers/source';
import {
  setupSteps, nextSetupStep, setupDone, setupProgress, landingPath,
} from '@/lib/setup-progress';
import {
  QUICK_SECTION_KEYS, buildQuickOutputSpec, SECTIONS, parsePositioning,
} from '@/lib/positioning-sections';
import { OUTPUT_FULL, buildPositioningPrompt } from '@/lib/positioning-standards';

/**
 * 上手转化。
 *
 * 线上漏斗实测（10 个注册用户）：
 *   建了档案 10 人(100%) → 做完账号定位 4 人(40%) → 做完创作简报 1 人(10%)
 *
 * 而创作简报正是让选题、脚本真正用上账号信息的那一环——
 * 90% 的人从没体验过这个产品值钱的部分，然后就走了。
 * 6 个用过的人里有 4 个只在一天之内用过，再没回来。
 *
 * 这一组用例守的就是那三个坎。
 */

describe('定位快速版', () => {
  /*
   * 完整版 15 节、12000 多字，实测跑一次 287 秒。
   * 新用户在上手第二步就要对着五分钟不动的等待。
   */
  it('只包含核心五节', () => {
    expect([...QUICK_SECTION_KEYS]).toEqual(['summary', 'oneline', 'persona', 'audience', 'content']);
  });

  it('每一节都真的从完整版里切到了内容', () => {
    const spec = buildQuickOutputSpec();
    for (const key of QUICK_SECTION_KEYS) {
      const def = SECTIONS.find((s) => s.key === key)!;
      expect(spec, `${def.label} 没切到`).toMatch(def.match);
    }
    // 切到的不能只是标题，得带上产出要求
    expect(spec.length).toBeGreaterThan(800);
  });

  it('明确要求不要输出别的小节', () => {
    // 不说的话模型会按它记得的完整结构继续写，快速版就白设了
    expect(buildQuickOutputSpec()).toContain('只输出上面这几节');
  });

  it('确实比完整版短', () => {
    expect(buildQuickOutputSpec().length).toBeLessThan(OUTPUT_FULL.length);
  });

  it('被砍掉的那些节不在快速版里', () => {
    /*
     * 只看标题行。第一版直接在全文里查 def.match，结果「差异化」这个词
     * 出现在保留下来的小节正文里（人设那节在讲差异化怎么体现），
     * 用例当场误报——查的是词，而要查的是"有没有这一节"。
     */
    const headings = buildQuickOutputSpec()
      .split('\n')
      .filter((l) => /^#{1,3}\s/.test(l.trim()));

    for (const key of ['monetize', 'memory', 'diff', 'fivepack', 'risk', 'industry', 'interview']) {
      const def = SECTIONS.find((s) => s.key === key)!;
      const hit = headings.find((h) => def.match.test(h));
      expect(hit, `${def.label} 这一节不该出现在快速版（命中标题：${hit}）`).toBeUndefined();
    }
  });

  it('快速版的标题行恰好就是那五节', () => {
    const headings = buildQuickOutputSpec()
      .split('\n')
      .filter((l) => /^#{2,3}\s/.test(l.trim()) && !/输出格式/.test(l));

    const matched = headings
      .map((h) => SECTIONS.find((s) => s.match.test(h))?.key)
      .filter(Boolean);
    expect([...new Set(matched)].sort()).toEqual([...QUICK_SECTION_KEYS].sort());
  });

  it('产出要求能被覆盖进提示词', () => {
    const base = { profileSummary: '测试档案' };
    const full = buildPositioningPrompt(base);
    const quick = buildPositioningPrompt({ ...base, outputSpec: buildQuickOutputSpec() });
    expect(quick.length).toBeLessThan(full.length);
    expect(quick).toContain('只输出上面这几节');
  });

  it('不传 outputSpec 时行为不变', () => {
    const a = buildPositioningPrompt({ profileSummary: 'x' });
    const b = buildPositioningPrompt({ profileSummary: 'x', outputSpec: '   ' });
    expect(a).toBe(b);
  });

  it('快速版用的是完整版原样的标题，不是另写一套', () => {
    /*
     * 这条很重要：用户先做快速版、之后再补完整版时，
     * 两次的小节标题必须一致，否则解析器会把它们当成不同的节，
     * 单节重生成和创作简报的提取都会错位。
     *
     * 所以断言"快速版里的标题行在完整版里逐字存在"。
     */
    const fullLines = new Set(OUTPUT_FULL.split('\n').map((l) => l.trim()));
    const quickHeadings = buildQuickOutputSpec()
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^#{2,3}\s/.test(l) && !/输出格式/.test(l));

    expect(quickHeadings.length).toBeGreaterThanOrEqual(5);
    for (const h of quickHeadings) {
      expect(fullLines.has(h), `标题「${h}」和完整版对不上`).toBe(true);
    }
  });
});

describe('地基三步的进度判断', () => {
  const none = { profileCount: 0, positioningTypes: [] };
  const halfway = { profileCount: 1, positioningTypes: ['账号定位'] };
  const all = { profileCount: 1, positioningTypes: ['账号定位', '创作简报'] };

  it('一步没做时下一步是建档案', () => {
    expect(nextSetupStep(none)?.key).toBe('profile');
    expect(setupProgress(none)).toEqual({ done: 0, total: 3 });
  });

  it('做到一半时下一步是简报', () => {
    expect(nextSetupStep(halfway)?.key).toBe('brief');
    expect(setupProgress(halfway)).toEqual({ done: 2, total: 3 });
  });

  it('三步做完就没有下一步了', () => {
    expect(nextSetupStep(all)).toBeNull();
    expect(setupDone(all)).toBe(true);
  });

  it('每一步都说清了"为什么要做"', () => {
    // 不说的话用户会跳过——这正是 90% 的人没做简报的原因
    for (const s of setupSteps(none)) {
      expect(s.why.length, `${s.title} 没说为什么`).toBeGreaterThan(10);
      expect(s.href).toMatch(/^\//);
    }
  });

  it('其他类型的定位不算数', () => {
    // 商业定位、内容定位是深化，不是地基
    const x = { profileCount: 1, positioningTypes: ['商业定位', '内容定位'] };
    expect(nextSetupStep(x)?.key).toBe('positioning');
  });

  it('脏数据不炸', () => {
    expect(setupProgress({ profileCount: 0, positioningTypes: [] }).done).toBe(0);
    expect(() =>
      setupSteps({ profileCount: NaN, positioningTypes: [] })
    ).not.toThrow();
  });

  it('全新用户送去引导页，做过的人不打扰', () => {
    expect(landingPath(none)).toBe('/onboarding');
    expect(landingPath(halfway)).toBe('/dashboard');
    expect(landingPath(all)).toBe('/dashboard');
  });
});

describe('引导页不再是孤岛', () => {
  /*
   * 原来 app/onboarding/page.tsx 有 147 行、完整可用，
   * 但全站没有任何地方跳转过去——写了却一个用户都没看到过。
   */
  it('注册成功后会送到引导页', () => {
    const code = readCode('app/login/page.tsx');
    expect(code).toContain('/onboarding');
  });

  it('工作台在没打完地基时给入口', () => {
    const code = readCode('app/dashboard/page.tsx');
    expect(code).toContain('/onboarding');
    expect(code).toContain('setupState');
  });

  it('引导页读的是真实状态，不是走马灯', () => {
    const code = readCode('app/onboarding/page.tsx');
    expect(code).toContain('setupSteps');
    expect(code).toContain('/api/profiles');
    expect(code).toContain('/api/positioning');
    // 原来那版是三张静态欢迎页
    expect(code).not.toContain('你的免费额度');
  });

  it('画和取数是分开的——页面带登录校验，界面要能单独看', () => {
    const code = readCode('app/onboarding/page.tsx');
    expect(code).toContain('SetupChecklist');
    // 取数留在页面里，组件只接 steps
    const comp = readCode('components/onboarding/SetupChecklist.tsx');
    expect(comp).not.toContain('fetch(');
    expect(comp).toContain('steps');
  });

  it('引导页和工作台共用同一份判断', () => {
    for (const f of ['app/onboarding/page.tsx', 'app/dashboard/page.tsx']) {
      expect(read(f), `${f} 没用 setup-progress`).toContain('@/lib/setup-progress');
    }
  });
});

describe('定位做完直接能去简报', () => {
  it('定位页有一键入口并带上交接标记', () => {
    const code = readCode('app/dashboard/positioning/page.tsx');
    expect(code).toContain('一键生成创作简报');
    expect(code).toContain("buildCreationHandoff('positioning', 'creative-brief', result, bridge.flowContext(result))");
    expect(code).toContain('openCreationSafely');
  });

  it('简报页收到交接就自动开跑', () => {
    const code = readCode('app/dashboard/creative-brief/page.tsx');
    expect(code).toContain('useCreationBridge');
    expect(code).toMatch(/from !== '账号定位'/);
    // 只跑一次，不能每次渲染都触发
    expect(code).toContain('autoRan');
  });

  it('没有定位时不会空跑', () => {
    const code = readCode('app/dashboard/creative-brief/page.tsx');
    expect(code).toMatch(/!positioning/);
  });
});

describe('生成过程有进度可看', () => {
  it('定位页按小节显示进度', () => {
    const code = readCode('app/dashboard/positioning/page.tsx');
    expect(code).toContain('doneSections');
    expect(code).toContain('expectedSections');
    expect(code).toMatch(/已写完/);
  });

  it('快速版和完整版的预期节数不同', () => {
    const code = readCode('app/dashboard/positioning/page.tsx');
    expect(code).toMatch(/depth === 'quick'/);
  });

  it('生成完要说清这是删减版', () => {
    // 不说的话用户以为定位就这么点内容
    expect(readCode('app/dashboard/positioning/page.tsx')).toContain('这是快速版');
  });
});
