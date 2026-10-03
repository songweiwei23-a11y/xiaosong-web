/**
 * 新上的功能要同步到工作台首页和宣传页（产品方，2026-10-02）。
 * 这里钉住：创作方向、素材库、创作进度、高阶自由对话（联网、附件、勾选带走）都有入口和介绍。
 */
import { describe, it, expect } from 'vitest';
import { FACTS } from '@/lib/showcase';
import { readCode } from './helpers/source';

describe('宣传页（官网首页）', () => {
  const landing = readCode('app/page.tsx');
  it.each(['创作方向', '素材库', '创作进度', '高阶自由对话'])('有「%s」功能卡片', (t) => {
    expect(landing).toContain(`title: "${t}"`);
  });

  it('板块互通、收藏、进度写进了核心优势和常见问题', () => {
    expect(landing).toMatch(/任何板块的结果都能勾选几条，带去别的板块接着做，自动填好/);
    expect(landing).toMatch(/q: "生成的内容怎么接着用？"/);
  });

  it('主流程从创作方向开始', () => {
    expect(FACTS.pipeline[0]).toBe('创作方向');
  });

  it('网站描述也更新了', () => {
    expect(readCode('app/layout.tsx')).toMatch(/创作方向[\s\S]*素材库/);
  });
});

describe('工作台首页', () => {
  const home = readCode('app/dashboard/page.tsx');
  it('「开始创作」第一步是创作方向，更多工具里不再重复', () => {
    const flow = home.slice(home.indexOf('const MAIN_FLOW'), home.indexOf('const FOUNDATION'));
    const tools = home.slice(home.indexOf('const MORE_TOOLS'), home.indexOf('const TASK_ROUTES'));
    expect(flow.indexOf('/dashboard/direction')).toBeGreaterThan(-1);
    expect(flow.indexOf('/dashboard/direction')).toBeLessThan(flow.indexOf('/dashboard/topic'));
    expect(tools).not.toContain('/dashboard/direction');
  });

  it('右侧有素材库卡片，「接着上次」点进去是创作进度', () => {
    expect(home).toMatch(/<LibraryCard \/>/);
    expect(home).toMatch(/works\.length > 0 \? "创作进度" : "全部"/);
    expect(readCode('components/dashboard/LibraryCard.tsx')).toMatch(/href="\/dashboard\/library"/);
  });

  it('提到了勾选带走和收藏——不说用户不知道', () => {
    expect(home).toMatch(/结果里能勾选几条带走，好的点收藏存进素材库/);
  });
});
