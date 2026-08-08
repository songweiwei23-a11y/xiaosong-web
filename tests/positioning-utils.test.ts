import { describe, it, expect } from 'vitest';
import { extractStrategySummary, extractScriptContext } from '@/lib/positioning-utils';

describe('extractStrategySummary', () => {
  it('returns empty string for empty input', () => {
    expect(extractStrategySummary('')).toBe('');
  });

  it('drops execution-layer sections (15天冷启动 / 内容配比)', () => {
    const input = [
      '## 账号核心定位',
      '专注职场穿搭的知识博主，输出实用的通勤搭配与面试形象建议。',
      '目标用户是刚入职场的年轻白领，追求高性价比又得体的穿搭方案。',
      '差异化优势在于把预算控制、身材扬长避短和场合礼仪结合讲透。',
      '## 内容方向与配比',
      '流量型内容 40%',
      '变现型内容 30%',
      '## 15天冷启动执行计划',
      'Day 1 发布开箱视频',
    ].join('\n');
    const out = extractStrategySummary(input);
    expect(out).toContain('账号核心定位');
    expect(out).toContain('专注职场穿搭');
    expect(out).not.toContain('内容方向与配比');
    expect(out).not.toContain('流量型内容');
    expect(out).not.toContain('Day 1');
  });

  it('falls back to first 800 chars when extraction is too small', () => {
    const input = '内容配比 '.repeat(300); // all blacklisted -> nothing kept
    const out = extractStrategySummary(input);
    expect(out.endsWith('...')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(803);
  });
});

describe('extractScriptContext', () => {
  it('returns empty string for empty input', () => {
    expect(extractScriptContext('')).toBe('');
  });

  it('keeps whitelisted persona/visual sections and drops ops sections', () => {
    const input = [
      '核心人设标签：真实、专业',
      '话术风格：口语化',
      '口头禅：记得点赞',
      '内容配比：流量型 40%',
      '发布节奏：每周三更',
    ].join('\n');
    const out = extractScriptContext(input);
    expect(out).toContain('核心人设标签');
    expect(out).toContain('话术风格');
    expect(out).toContain('口头禅');
    expect(out).not.toContain('内容配比');
    expect(out).not.toContain('发布节奏');
  });

  it('returns empty string when nothing relevant is found', () => {
    const input = ['内容配比：流量型 40%', '发布节奏：每周三更'].join('\n');
    expect(extractScriptContext(input)).toBe('');
  });
});
