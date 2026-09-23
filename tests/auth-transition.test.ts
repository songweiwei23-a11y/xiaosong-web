import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readSource as read, readCode, stripComments } from './helpers/source';




/**
 * 登录到工作台那段等待的反馈。
 *
 * 原来按钮上是有转圈的，但它在真正的等待**开始之前**就停了：
 *   signInWithPassword 成功
 *   → setMessage("登录成功！正在跳转...")
 *   → setTimeout(500ms) 排期
 *   → finally 立刻 setLoading(false)   ← 转圈没了，按钮变回"登录账户"
 *   → 500ms 后才 router.push
 *   → 再等 /dashboard 加载（挂载后还要并发拉四个接口）
 *
 * 用户看到的是：转一下 → 停了 → 按钮好像又能点了 → 卡住不动 → 才进去。
 * 这组用例守住「整段等待都有反馈」这件事。
 */

describe('登录成功后不提前收起加载态', () => {
  const code = readCode('app/login/page.tsx');

  it('成功路径直接跳转，不再空等 500 毫秒', () => {
    // 那 500ms 原本只是为了让人看清"登录成功"四个字，
    // 现在过渡层自己在说话，这段就是白等
    expect(code).not.toMatch(/setTimeout\([\s\S]{0,80}router\.push\("\/dashboard"\)/);
  });

  it('跳转封装成一个函数，登录和注册两条路径共用', () => {
    expect(code).toContain('const goDashboard');
    // 两处成功分支都要走它，不能只改登录那条。
    // 恰好 2 次调用：函数定义写作 `const goDashboard = () =>`，不含 `goDashboard()`
    expect((code.match(/goDashboard\(\)/g) ?? []).length).toBe(2);
  });

  it('成功时提前 return，不落到 finally 的 setLoading(false)', () => {
    // 落进去的话按钮会在页面被替换前恢复成可点状态，看着像失败了
    const successBlocks = code.match(/goDashboard\(\);\s*return;/g) ?? [];
    expect(successBlocks.length).toBe(2);
  });

  it('只有出错时才撤掉过渡层', () => {
    expect(code).toMatch(/catch[\s\S]{0,200}setHandingOff\(false\)/);
  });

  it('页面上挂了过渡层组件', () => {
    expect(code).toContain('AuthTransition');
    expect(code).toMatch(/show=\{handingOff\}/);
  });
});

describe('过渡层本身', () => {
  const src = read('components/auth/AuthTransition.tsx');

  it('分阶段推进，而不是一个不动的圈', () => {
    // 同样等三秒，不动的圈让人怀疑死了；文字往前走，人就知道它在推进
    expect(src).toContain('正在验证身份');
    expect(src).toContain('正在读取你的账号档案');
    expect(src).toContain('正在准备工作台');
    expect(src).toContain('马上就好');
  });

  it('不报百分比、不说还剩几秒', () => {
    /*
     * 这些阶段是按经验节奏推的，不是真实进度。
     * 把估不准的数字摆给用户看，进度条卡在 87% 比没有进度条更糟。
     *
     * 查的是"阶段文案"本身，不是整个文件：
     *   第一版查 /\d+%/ 命中了 CSS 里的 `transparent 70%`；
     *   第二版抽中文串，又命中了注释里"不说还剩几秒"这句话本身。
     * 两次都是扫错了范围——要查的就是 STAGES 里那几句。
     */
    const stages = readCode('components/auth/AuthTransition.tsx')
      .match(/const STAGES = \[[\s\S]*?\];/)?.[0] ?? '';
    expect(stages, '没取到阶段文案，用例会空过').toContain('正在验证身份');
    expect(stages).not.toMatch(/剩余|还剩|\d+\s*%/);
  });

  it('卡太久要给出口，不能让人永远盯着动画', () => {
    expect(src).toContain('STUCK_AFTER');
    expect(src).toContain('点这里重新试一次');
  });

  it('隐藏时计时归零，下次重新从第一阶段开始', () => {
    expect(src).toMatch(/if \(!show\)[\s\S]{0,80}setElapsed\(0\)/);
  });

  it('对读屏软件声明这是状态区域', () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-live');
  });
});

describe('三段加载用同一个动画', () => {
  /*
   * 登录过渡层 → 路由切换的 loading.tsx → 工作台自己拉数据，
   * 三处各画各的话，用户会连着看到三种不同的加载画面闪过，
   * 那比只有一个转圈更像"卡"。
   */
  it('都用 LoadingRings', () => {
    for (const f of [
      'components/auth/AuthTransition.tsx',
      'app/dashboard/loading.tsx',
      'app/dashboard/page.tsx',
    ]) {
      expect(read(f), `${f} 没有用统一的加载动画`).toContain('LoadingRings');
    }
  });

  it('工作台不再用另一个 spinner', () => {
    expect(readCode('app/dashboard/page.tsx')).not.toContain('Loader2');
  });

  it('关键帧放在全局，三处共用', () => {
    const css = read('app/globals.css');
    for (const k of ['authSpin', 'authRise', 'authPulse', 'authSlide']) {
      expect(css, `globals.css 缺 ${k}`).toContain(`@keyframes ${k}`);
    }
  });

  it('尊重系统的"减少动效"设置', () => {
    // 全屏动画最容易引起不适，关了动效就不该硬播
    const css = read('app/globals.css');
    expect(css).toMatch(/prefers-reduced-motion[\s\S]{0,200}\.auth-anim/);

    /*
     * 每个会动的组件都要带上这个类，而不是"文件里有就行"。
     * 第一版只断言文件包含 auth-anim，而该文件有两处——
     * 把其中一处删掉用例照样绿（变异验证时就是这么漏掉的）。
     */
    const rings = read('components/auth/LoadingRings.tsx');
    const animated = rings.match(/export function (\w+)/g) ?? [];
    expect(animated.length, '没找到导出的动画组件').toBeGreaterThanOrEqual(2);
    expect(
      (rings.match(/auth-anim/g) ?? []).length,
      '每个会动的组件都要带 auth-anim，否则关了动效仍会硬播'
    ).toBe(animated.length);

    // 全屏过渡层自己也要带
    expect(read('components/auth/AuthTransition.tsx')).toMatch(/className="auth-anim /);
  });
});
