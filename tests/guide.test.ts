/**
 * 新手引导（2026-10-20）：lib/guide.ts 的阶段判断、选项、额度提醒。
 * 引导只列出选项，不替用户选：每个阶段有 2–3 个选项，最多一个标「建议」。
 * 数据没齐（null）时不给建议，不拿空数据去猜。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildGuide, doneStages, type GuideInput, type GuideOutput } from '@/lib/guide';
import { loadSetupStepsStrict } from '@/hooks/useSetupProgress';
import { workStageUrl } from '@/lib/resume';
import type { SetupStep } from '@/lib/setup-progress';
import type { Work } from '@/lib/works';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-20T04:00:00Z');

const step = (key: SetupStep['key'], index: number, done: boolean): SetupStep => ({
  key,
  index,
  title: `第${index}步`,
  why: `为什么 ${key}`,
  href: `/dashboard/${key}`,
  done,
});

const SETUP_EMPTY = [step('profile', 1, false), step('positioning', 2, false), step('brief', 3, false)];
const SETUP_PROFILE_ONLY = [step('profile', 1, true), step('positioning', 2, false), step('brief', 3, false)];
const SETUP_DONE = [step('profile', 1, true), step('positioning', 2, true), step('brief', 3, true)];

const ALL_STAGES = ['选题策划', '脚本生成', '分镜脚本', '审稿优化', '标题封面'];
/** 只标了指定的环节做完，其余未完成 */
const stagesDone = (...doneNames: string[]) =>
  ALL_STAGES.map((name) => ({ name, done: doneNames.includes(name) }));

const work = (over: Partial<Record<string, unknown>> = {}): Work =>
  ({
    id: 'w1',
    title: '南乐餐饮老板 7 天',
    is_done: false,
    shoot_status: 'none',
    updated_at: new Date(NOW - 2 * DAY).toISOString(),
    stages: stagesDone('选题策划', '脚本生成'),
    ...over,
  }) as unknown as Work;

const input = (over: Partial<GuideInput> = {}): GuideInput => ({
  setupSteps: SETUP_DONE,
  works: [],
  quota: null,
  nowMs: NOW,
  ...over,
});

/** 建议项（最多一个）。没有建议项时返回 undefined */
const recommended = (g: GuideOutput) => g.options.find((o) => o.recommended);

describe('数据没齐时不给建议', () => {
  it('地基还没取到，或作品还没取到：返回 null（页面显示加载中）', () => {
    expect(buildGuide(input({ setupSteps: null }))).toBeNull();
    expect(buildGuide(input({ works: null }))).toBeNull();
  });
});

describe('新用户：阶段判断', () => {
  it('没有档案：第一步是建档案，建议项是建档案', () => {
    const g = buildGuide(input({ setupSteps: SETUP_EMPTY, works: [] }))!;
    expect(g.stage).toBe('start');
    expect(g.stageLabel).toContain('第 1 步');
    expect(recommended(g)!.href).toBe('/dashboard/profiles/new');
    expect(g.progress).toEqual({ done: 0, total: 3 });
  });

  it('档案有了，地基没做完：建议项是地基里的下一项', () => {
    const g = buildGuide(input({ setupSteps: SETUP_PROFILE_ONLY, works: [] }))!;
    expect(g.stage).toBe('foundation');
    expect(g.stageLabel).toBe('地基 1/3');
    expect(recommended(g)!.href).toBe('/dashboard/positioning');
    expect(g.progress).toEqual({ done: 1, total: 3 });
  });

  it('地基做完、一条内容都没有：建议从选题开始，也给了已有文案去审稿的选项', () => {
    const g = buildGuide(input({ works: [] }))!;
    expect(g.stage).toBe('first_work');
    expect(recommended(g)!.href).toBe('/dashboard/topic');
    expect(g.options.map((o) => o.href)).toContain('/dashboard/review');
    expect(g.progress).toBeNull();
  });
});

describe('审稿优化之后：推荐同步进度，不再推荐生成脚本（用户反馈的问题）', () => {
  it('审稿优化已经做完，但脚本没标完成：建议是同步创作进度，不是接着生成脚本', () => {
    // 脚本记录缺了一块，审稿却已经做完：按流程，脚本必然做过了
    const reviewed = work({ stages: stagesDone('选题策划', '审稿优化') });
    const g = buildGuide(input({ works: [reviewed] }))!;
    expect(g.stage).toBe('in_progress');
    expect(g.stageLabel).toBe('待拍摄');
    expect(recommended(g)!.key).toBe('sync');
    expect(recommended(g)!.href).toBe('/dashboard/works');
    // 任何选项都不能让用户回到「生成脚本」
    expect(g.options.some((o) => o.href.includes('/dashboard/script'))).toBe(false);
    expect(g.options.some((o) => o.label.includes('脚本生成'))).toBe(false);
  });

  it('审稿优化做完后，标题封面没做：可以补做，但只是可选项，不是建议', () => {
    const reviewed = work({ stages: stagesDone('选题策划', '脚本生成', '分镜脚本', '审稿优化') });
    const g = buildGuide(input({ works: [reviewed] }))!;
    const title = g.options.find((o) => o.key === 'title');
    expect(title).toBeDefined();
    expect(title!.recommended).toBe(false);
    expect(title!.href).toBe(workStageUrl('w1', '标题封面'));
    expect(recommended(g)!.key).toBe('sync');
  });

  it('全部环节都做完、但没标记拍摄：同样推荐同步进度', () => {
    const all = work({ stages: stagesDone(...ALL_STAGES) });
    const g = buildGuide(input({ works: [all] }))!;
    expect(recommended(g)!.key).toBe('sync');
  });

  it('描述里写明是哪一条、还有几条没做完', () => {
    const reviewed = work({ stages: stagesDone('选题策划', '审稿优化') });
    const other = work({ id: 'w2', title: '另一条', updated_at: new Date(NOW - 3 * DAY).toISOString() });
    const g = buildGuide(input({ works: [reviewed, other] }))!;
    expect(g.stageDesc).toContain('「南乐餐饮老板 7 天」已经审稿优化');
    expect(g.stageDesc).toContain('还有 1 条没做完');
  });
});

describe('还没审稿：推荐接着做下一个环节，但给出其他选择', () => {
  it('有没做完的作品：建议接着做下一个环节，并且直接到那个环节', () => {
    const g = buildGuide(input({ works: [work()] }))!;
    expect(g.stage).toBe('in_progress');
    expect(recommended(g)!.key).toBe('continue');
    expect(recommended(g)!.label).toContain('分镜脚本');
    expect(recommended(g)!.href).toBe(workStageUrl('w1', '分镜脚本'));
  });

  it('这一阶段有其他选项：看看作品、开始新的一条（都不是建议）', () => {
    const g = buildGuide(input({ works: [work()] }))!;
    const others = g.options.filter((o) => !o.recommended);
    expect(others.map((o) => o.key)).toEqual(['works', 'new']);
  });

  it('最近更新的那条作品排在前面', () => {
    const older = work({ id: 'old', title: '旧的', updated_at: new Date(NOW - 5 * DAY).toISOString() });
    const newer = work({ id: 'new', title: '新的', updated_at: new Date(NOW - 1 * DAY).toISOString() });
    const g = buildGuide(input({ works: [older, newer] }))!;
    // 建议项直接指向那条作品（链接里带它的编号）
    expect(recommended(g)!.href).toContain('work=new');
  });

  it('环节状态缺了一块时，按流程往前补齐：脚本没标、分镜标了，建议是标题或审稿，不是脚本', () => {
    const gappy = work({ stages: stagesDone('选题策划', '分镜脚本') });
    const g = buildGuide(input({ works: [gappy] }))!;
    expect(recommended(g)!.href).not.toBe(workStageUrl('w1', '脚本生成'));
    expect(recommended(g)!.href).toBe(workStageUrl('w1', '审稿优化'));
  });
});

describe('老用户：做过但不活跃、或者正常在用', () => {
  it('做过，但最近 7 天没动过：欢迎回来，并说明是几天前，建议开始新的一条', () => {
    const finished = work({ is_done: true, updated_at: new Date(NOW - 10 * DAY).toISOString() });
    const g = buildGuide(input({ works: [finished] }))!;
    expect(g.stage).toBe('returning');
    expect(g.stageDesc).toContain('10 天前');
    expect(recommended(g)!.key).toBe('new');
    expect(g.options.map((o) => o.key)).toEqual(['new', 'works', 'positioning']);
  });

  it('最近在用：正常创作，建议做下一条，并且可以去作品库标记拍摄或发布', () => {
    const recent = work({ is_done: true, updated_at: new Date(NOW - 1 * DAY).toISOString() });
    const g = buildGuide(input({ works: [recent] }))!;
    expect(g.stage).toBe('active');
    expect(recommended(g)!.label).toBe('做下一条');
    expect(g.options.map((o) => o.key)).toEqual(['new', 'works']);
  });
});

describe('每个阶段都只列选项，不替用户选', () => {
  it('每个阶段有 2–3 个选项，最多一个标建议，每个选项都是站内地址，并且说明了选项上面有一句「你自己选」', () => {
    const cases: GuideInput[] = [
      input({ setupSteps: SETUP_EMPTY, works: [] }),
      input({ setupSteps: SETUP_PROFILE_ONLY, works: [] }),
      input({ works: [] }),
      input({ works: [work()] }),
      input({ works: [work({ stages: stagesDone('选题策划', '审稿优化') })] }),
      input({ works: [work({ is_done: true, updated_at: new Date(NOW - 10 * DAY).toISOString() })] }),
      input({ works: [work({ is_done: true, updated_at: new Date(NOW - 1 * DAY).toISOString() })] }),
    ];
    for (const c of cases) {
      const g = buildGuide(c)!;
      expect(g.options.length).toBeGreaterThanOrEqual(2);
      expect(g.options.length).toBeLessThanOrEqual(3);
      expect(g.options.filter((o) => o.recommended).length).toBeLessThanOrEqual(1);
      for (const o of g.options) {
        expect(o.href.startsWith('/')).toBe(true);
        expect(o.label.length).toBeGreaterThan(0);
        expect(o.why.length).toBeGreaterThan(0);
      }
      expect(g.intro).toContain('你自己选');
      expect(g.tips.length).toBeLessThanOrEqual(3);
    }
  });

  it('地基没做完时也能跳过：给出「先不做，直接去选题」，并说明会偏通用', () => {
    const g = buildGuide(input({ setupSteps: SETUP_PROFILE_ONLY, works: [] }))!;
    const skip = g.options.find((o) => o.key === 'skip');
    expect(skip).toBeDefined();
    expect(skip!.recommended).toBe(false);
    expect(skip!.why).toContain('通用');
  });
});

describe('已完成环节的推断', () => {
  it('后面的环节做完了，前面的环节也算做完；选题策划永远算做完', () => {
    const done = doneStages([{ name: '审稿优化', done: true }]);
    expect(done.has('选题策划')).toBe(true);
    expect(done.has('脚本生成')).toBe(true);
    expect(done.has('分镜脚本')).toBe(true);
    expect(done.has('审稿优化')).toBe(true);
    expect(done.has('标题封面')).toBe(false);
  });

  it('什么都没做：只有选题策划算做完', () => {
    const done = doneStages([{ name: '脚本生成', done: false }]);
    expect(Array.from(done)).toEqual(['选题策划']);
  });
});

describe('建议与提醒', () => {
  it('额度用完了：给提醒；次数包还有余额时说明会自动接着用', () => {
    const g = buildGuide(input({ works: [], quota: { exhaustedFeature: '脚本生成', packCredits: 5 } }))!;
    expect(g.alert).not.toBeNull();
    expect(g.alert!.text).toContain('「脚本生成」本期额度用完了');
    expect(g.alert!.text).toContain('次数包还有 5 次');
    expect(g.alert!.href).toBe('/dashboard/membership');
  });

  it('额度用完、次数包也没有：提示可以买次数包或升级', () => {
    const g = buildGuide(input({ works: [], quota: { exhaustedFeature: '选题策划', packCredits: 0 } }))!;
    expect(g.alert!.text).toContain('可以买尝鲜次数包');
  });

  it('额度没用完，或额度没取到：没有提醒', () => {
    expect(buildGuide(input({ works: [], quota: { exhaustedFeature: null, packCredits: 0 } }))!.alert).toBeNull();
    expect(buildGuide(input({ works: [], quota: null }))!.alert).toBeNull();
  });

  it('提醒不改变建议：额度用完的新用户仍然先看地基的建议', () => {
    const g = buildGuide(input({ setupSteps: SETUP_EMPTY, works: [], quota: { exhaustedFeature: '选题策划', packCredits: 0 } }))!;
    expect(g.stage).toBe('start');
    expect(recommended(g)!.href).toBe('/dashboard/profiles/new');
    expect(g.alert).not.toBeNull();
  });
});

describe('地基的严格版取数', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('档案接口失败：抛错，不按「一步都没做」猜（否则老用户会被当成新用户）', async () => {
    vi.stubGlobal('fetch', async () => new Response('err', { status: 500 }));
    await expect(loadSetupStepsStrict()).rejects.toThrow();
  });

  it('定位接口失败：抛错', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url.startsWith('/api/profiles') ? json([{ id: 'p1' }]) : new Response('err', { status: 500 }),
    );
    await expect(loadSetupStepsStrict()).rejects.toThrow();
  });

  it('没有档案：三步都没做', async () => {
    vi.stubGlobal('fetch', async () => json([]));
    const steps = await loadSetupStepsStrict();
    expect(steps.filter((s) => s.done)).toEqual([]);
  });

  it('有档案、有账号定位：地基完成两步', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url.startsWith('/api/profiles') ? json([{ id: 'p1' }]) : json([{ positioning_type: '账号定位' }]),
    );
    const steps = await loadSetupStepsStrict();
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(['profile', 'positioning']);
  });
});

describe('接线：首页大卡和顶栏小条都用上了引导', () => {
  const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

  it('首页用 GuideCard，不再用已删除的 NextStepHero', () => {
    const src = read('app/dashboard/page.tsx');
    expect(src).toContain('<GuideCard />');
    expect(src).not.toContain('NextStepHero');
    expect(fs.existsSync(path.join(process.cwd(), 'components/dashboard/NextStepHero.tsx'))).toBe(false);
  });

  it('顶栏放了 GuideChip', () => {
    const src = read('app/dashboard/layout.tsx');
    expect(src).toContain('<GuideChip');
  });

  it('引导只列选项，不自动跳转：组件里没有 router.push / window.location 的自动跳转', () => {
    for (const rel of ['components/guide/GuideCard.tsx', 'components/guide/GuideChip.tsx']) {
      const src = read(rel);
      expect(src).not.toMatch(/router\.push|window\.location|location\.href/);
    }
  });

  it('引导用的是会抛错的 listWorksPage：取失败时整块不显示，不拿空列表去猜', () => {
    const src = read('hooks/useGuide.ts');
    expect(src).toContain('listWorksPage');
    expect(src).not.toContain('listWorks(');
  });

  it('实时：路由变化时重新取，窗口获得焦点也重新取，建档/定位/作品变化也重新取', () => {
    const src = read('hooks/useGuide.ts');
    expect(src).toContain('usePathname()');
    expect(src).toMatch(/\}, \[tick, pathname\]\);/);
    expect(src).toContain('"focus"');
    expect(src).toContain('GENERATED_EVENT');
    expect(src).toContain('onProgressChanged');
  });

  it('地基用的是严格版', () => {
    const src = read('hooks/useGuide.ts');
    expect(src).toContain('loadSetupStepsStrict');
    expect(src).not.toMatch(/useSetupProgress\(\)/);
  });
});
