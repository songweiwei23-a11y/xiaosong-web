/**
 * 抖音新手课。守"不报错、只是学不下去"的那类：
 * 小题的正确答案下标写错（答对了也过不了关）、"去试试"链到不存在的页面、
 * 能跳关、入口没挂上、夸大宣传。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { COURSE_TOTAL, LESSONS, clampPassed, graduated, passLevel } from '@/lib/newbie-course';
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
    expect(readCode('components/dashboard/CourseCard.tsx')).toMatch(/const COLLAPSE_KEY = "kaiwu:course-card-collapsed"/);
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
