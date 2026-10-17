/**
 * 抖音新手课。守"不报错、只是学不下去"的那类：
 * 小题的正确答案下标写错（答对了也过不了关）、"去试试"链到不存在的页面、
 * 能跳关、入口没挂上、夸大宣传。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { COURSE_TOTAL, LESSONS, MAX_STAR, TOTAL_STARS, badgesFor, clampPassed, graduated, passLevel, starsFor } from '@/lib/newbie-course';
import { readCode } from './helpers/source';

describe('课程内容', () => {
  it('6 课，编号 1~6 连续，id 不重复', () => {
    expect(COURSE_TOTAL).toBe(6);
    expect(LESSONS.map((l) => l.no)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(6);
  });

  it('每道小题：3 个选项、正确答案下标在范围内、有解释（下标写错 = 答对了也过不了关）', () => {
    for (const l of LESSONS) {
      expect(l.quiz.options.length, l.title).toBe(3);
      expect(l.quiz.answer, l.title).toBeGreaterThanOrEqual(0);
      expect(l.quiz.answer, l.title).toBeLessThan(l.quiz.options.length);
      expect(l.quiz.why.length, l.title).toBeGreaterThan(10);
    }
  });

  it('每课 4~5 条要点，每条都有标题和一句话', () => {
    for (const l of LESSONS) {
      expect(l.points.length, l.title).toBeGreaterThanOrEqual(4);
      expect(l.points.length, l.title).toBeLessThanOrEqual(5);
      for (const p of l.points) {
        expect(p.head.length, l.title).toBeGreaterThan(1);
        expect(p.body.length, l.title).toBeGreaterThan(8);
      }
    }
  });

  it('"去试试"都链到真实存在的页面', () => {
    for (const l of LESSONS) {
      const route = l.action.href.split(/[?#]/)[0];
      expect(fs.existsSync(path.join(process.cwd(), 'app', route, 'page.tsx')), l.action.href).toBe(true);
    }
  });

  it('讲推荐机制的那课写明"平台不公开具体规则"；全课不承诺效果', () => {
    expect(LESSONS[0].quiz.why).toContain('平台不公开具体规则');
    const all = LESSONS.map((l) => [l.title, l.hook, ...l.points.map((p) => p.head + p.body), l.quiz.why].join(' ')).join(' ');
    expect(all).not.toMatch(/保证|一定火|必火|月入|稳赚/);
  });
});

describe('闯关规则', () => {
  it('只能按顺序过：跳关不算，重复过不减少', () => {
    expect(passLevel(0, 1)).toBe(1);
    expect(passLevel(1, 2)).toBe(2);
    expect(passLevel(1, 5)).toBe(1); // 跳关
    expect(passLevel(4, 2)).toBe(4); // 重复过前面的关
    expect(passLevel(6, 6)).toBe(6);
    expect(passLevel(0, 0)).toBe(0);
    expect(passLevel(0, 99)).toBe(0);
  });

  it('进度夹在 0~6，脏数据当 0；过完 6 关算毕业', () => {
    expect(clampPassed('3')).toBe(3);
    expect(clampPassed(-1)).toBe(0);
    expect(clampPassed(99)).toBe(6);
    expect(clampPassed('abc')).toBe(0);
    expect(graduated(6)).toBe(true);
    expect(graduated(5)).toBe(false);
  });
});

describe('入口和存储', () => {
  it('侧边栏、工作台首页、注册后的引导页都有入口', () => {
    expect(readCode('components/dashboard/Sidebar.tsx')).toMatch(/name: "新手课堂", href: "\/dashboard\/course"/);
    expect(readCode('app/dashboard/page.tsx')).toContain('<CourseCard className="mb-5" />');
    expect(readCode('app/onboarding/page.tsx')).toMatch(/href="\/dashboard\/course"/);
  });

  it('首页卡片先学后做：新手课在 7 天计划上面；两张都能折叠', () => {
    const home = readCode('app/dashboard/page.tsx');
    expect(home.indexOf('<CourseCard')).toBeLessThan(home.indexOf('<LaunchPlanCard'));
    // 收没收按账号分开记（lib/home-prefs）；毕业了默认收起
    expect(readCode('components/dashboard/CourseCard.tsx')).toMatch(/useCollapsed\("course", ready \? graduated\(passed\) : null\)/);
  });

  it('毕业后引到 7 天起号计划，锚点在计划卡片上', () => {
    expect(readCode('app/dashboard/course/page.tsx')).toMatch(/href="\/dashboard#launch-plan"/);
    expect(readCode('components/dashboard/LaunchPlanCard.tsx')).toMatch(/id="launch-plan"/);
  });

  it('进度存数据库；表没建时退回存本机、照样能学', () => {
    const api = readCode('app/api/course-progress/route.ts');
    expect(api).toContain('requireUser()');
    expect(api).toMatch(/unavailable: true/);
    expect(api).toMatch(/passLevel\(clampPassed\(data\?\.passed\), Number\(body\.no\)\)/); // 服务端也按顺序判，改请求跳不了关
    const hook = readCode('hooks/useCourseProgress.ts');
    expect(hook).toMatch(/if \(d\.unavailable\) \{\s*setLocal\(true\)/);
    expect(hook).toMatch(/Math\.max\(clampPassed\(d\.passed\), readLocal\(\)\)/);
    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260928_course_progress.sql'), 'utf8');
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/);
  });

  it('每关里：Esc 关闭、方向键翻卡、打开时后面的页面不跟着滚', () => {
    const sheet = readCode('components/course/LevelSheet.tsx');
    expect(sheet).toMatch(/e\.key === "Escape"\) onClose\(\)/);
    expect(sheet).toMatch(/e\.key === "ArrowDown"/);
    expect(sheet).toMatch(/document\.body\.style\.overflow = "hidden"/);
  });
});

describe('小挑战内容', () => {
  it('每关都有一个挑战，判断题和排顺序两种玩法都有', () => {
    for (const l of LESSONS) expect(l.challenge, l.title).toBeDefined();
    expect(new Set(LESSONS.map((l) => l.challenge.kind))).toEqual(new Set(['judge', 'order']));
  });

  it('判断题：至少 4 条，对的和不对的都有（不能全选一个答案蒙过），每条都有解释', () => {
    for (const l of LESSONS) {
      const ch = l.challenge;
      if (ch.kind !== 'judge') continue;
      expect(ch.cases.length, l.title).toBeGreaterThanOrEqual(4);
      expect(ch.cases.some((c) => c.ok), l.title).toBe(true);
      expect(ch.cases.some((c) => !c.ok), l.title).toBe(true);
      for (const c of ch.cases) {
        expect(typeof c.ok, l.title).toBe('boolean');
        expect(c.why.length, l.title).toBeGreaterThan(10);
      }
    }
  });

  it('排顺序：4 段、每段不一样、排对的顺序有解释', () => {
    for (const l of LESSONS) {
      const ch = l.challenge;
      if (ch.kind !== 'order') continue;
      expect(ch.steps.length, l.title).toBe(4);
      expect(new Set(ch.steps).size, l.title).toBe(ch.steps.length);
      expect(ch.why.length, l.title).toBeGreaterThan(10);
    }
  });

  it('挑战文字也不承诺效果', () => {
    const all = JSON.stringify(LESSONS.map((l) => l.challenge));
    expect(all).not.toMatch(/保证|一定火|必火|月入|稳赚/);
  });
});

describe('星星和徽章', () => {
  it('答题第一次就对得 2 颗，错过再对得 1 颗，挑战第一次全对再 +1，最多 3 颗', () => {
    expect(starsFor(true, false)).toBe(2);
    expect(starsFor(false, false)).toBe(1);
    expect(starsFor(true, true)).toBe(3);
    expect(starsFor(false, true)).toBe(2);
    expect(MAX_STAR).toBe(3);
    expect(TOTAL_STARS).toBe(COURSE_TOTAL * MAX_STAR);
  });

  it('徽章：没有进度时都没拿到；过第一关、某关满星、全程满星、毕业按条件亮', () => {
    expect(badgesFor(0, {}).every((b) => !b.earned)).toBe(true);
    expect(badgesFor(1, {}).find((b) => b.id === 'first')!.earned).toBe(true);
    expect(badgesFor(0, { '3': 3 }).find((b) => b.id === 'perfect-one')!.earned).toBe(true);
    const all = Object.fromEntries(LESSONS.map((l) => [String(l.no), MAX_STAR]));
    expect(badgesFor(6, all).every((b) => b.earned)).toBe(true);
    expect(badgesFor(6, { ...all, '4': 2 }).find((b) => b.id === 'perfect-all')!.earned).toBe(false);
    expect(badgesFor(5, all).find((b) => b.id === 'graduate')!.earned).toBe(false);
  });

  it('星星只升不降，只存本机，不发请求（不改数据库、不改过关规则）', () => {
    const hook = readCode('hooks/useCourseStars.ts');
    expect(hook).toMatch(/if \(next <= cur\) return prev;/);
    expect(hook).toMatch(/kaiwu:course-stars/);
    expect(hook).not.toMatch(/fetch\(/);
  });

  it('过关不靠挑战：答对就 onPassed，挑战只通过 onStars 加星', () => {
    const sheet = readCode('components/course/LevelSheet.tsx');
    expect(sheet).toMatch(/onPassed\(\);\s*onStars\(starsFor\(first, false\)\);/);
    expect(sheet).toMatch(/onReport=\{\(perfect\) => \{/);
    expect(readCode('components/course/ChallengePanel.tsx')).toMatch(/if \(counted\) onReport\(miss === 0\);/);
  });

  it('排顺序必须整段都对才算全对', () => {
    expect(readCode('components/course/ChallengePanel.tsx')).toMatch(/next\.every\(\(v, k\) => v === k\)/);
  });

  it('课程页：显示星星总数和徽章，地图和复习目录每关都有星', () => {
    const page = readCode('app/dashboard/course/page.tsx');
    expect(page).toMatch(/useCourseStars\(\)/);
    expect(page).toMatch(/badgesFor\(passed, stars\)/);
    expect(page.match(/<StarRow /g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
