/**
 * 首页动画「一镜到底的手机」：让完全不懂的小白看完敢试。
 *
 * 这几条守的都是"不报错、只是出事"的那类：
 * - 数字和人物是示意，不标就是虚假宣传；也不能承诺收益（广告法）
 * - 看不见还在跑是白耗电；系统要求减少动效还在动是不尊重设置
 * - 设计尺寸 560 宽，手机上先按 560 排版会把整页撑出横向滚动（预览时实测过）
 */
import { describe, it, expect } from 'vitest';
import { readCode } from './helpers/source';
import { seg, easeInOut } from '@/components/landing/hero/loop';

const story = readCode('components/landing/hero/PhoneStory.tsx');
const loop = readCode('components/landing/hero/loop.ts');

describe('首页动画', () => {
  it('首页首屏真的用上了它（在「一句话开始」的右栏，没试之前放它）', () => {
    expect(readCode('app/page.tsx')).toContain('<TryHero />');
    const hero = readCode('components/landing/hero/TryHero.tsx');
    // 左右两栏，右栏允许收缩（不被内容撑宽）
    expect(hero).toMatch(/lg:grid-cols-\[1fr_1\.05fr\]/);
    expect(hero).toMatch(/<div className="min-w-0">[\s\S]{0,2500}<PhoneStory \/>/);
  });

  it('场景是餐饮店（拍短视频引客需求最大的一类，产品方定）', () => {
    expect(story).toMatch(/const PROMPT = "我在县城开了家面馆/);
    expect(story).not.toMatch(/宠物|猫粮|PawPrint/);
  });

  it('虚构场景与数据标明仅作演示；不承诺收益', () => {
    expect(story).toContain('虚构场景与数据，仅作演示');
    expect(story).not.toMatch(/月入|年入|赚了|收入翻|保证/);
  });

  it('看不见就停：滚出屏幕、切到后台', () => {
    expect(loop).toMatch(/new IntersectionObserver/);
    expect(loop).toMatch(/visible && !document\.hidden/);
  });

  it('系统要求减少动效时停在完整的一帧', () => {
    expect(loop).toMatch(/prefers-reduced-motion: reduce[\s\S]{0,40}setT\(still\)/);
  });

  it('手机上不撑出横向滚动：舞台绝对定位、外层裁掉溢出', () => {
    expect(story).toMatch(/className="relative w-full min-w-0 overflow-hidden"/);
    expect(story).toMatch(/className="absolute left-1\/2 top-0 -translate-x-1\/2 overflow-hidden/);
  });

  it('时间换算函数：两头夹住，中间平滑', () => {
    expect(seg(-1, 0, 2)).toBe(0);
    expect(seg(1, 0, 2)).toBe(0.5);
    expect(seg(9, 0, 2)).toBe(1);
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });
});
