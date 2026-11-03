/**
 * 生成结束后转圈一直不停（2026-11-03）：正文已经显示，页面却还在 await 存历史、标题润色，
 * 而转圈要等这些全部做完。现在这些后处理放到后台，转圈在正文收到时就停。
 */
import { describe, expect, it } from 'vitest';
import { readCode } from './helpers/source';

const BOARDS = [
  'app/dashboard/direction/page.tsx',
  'app/dashboard/topic/page.tsx',
  'app/dashboard/content-plan/page.tsx',
  'app/dashboard/remix/page.tsx',
  'app/dashboard/breakdown/page.tsx',
  'app/dashboard/knowledge/page.tsx',
  'app/dashboard/industry-advice/page.tsx',
  'app/dashboard/creative-brief/page.tsx',
  'app/dashboard/deal-reason/page.tsx',
  'app/dashboard/positioning/page.tsx',
  'app/dashboard/title/page.tsx',
  'app/dashboard/growth/page.tsx',
];

describe('生成结束后不等存历史和润色（转圈及时停）', () => {
  it('扫描没有空转：列出的板块都能读到源码', () => {
    for (const f of BOARDS) expect(readCode(f).length).toBeGreaterThan(1000);
  });

  it.each(BOARDS)('%s：流结束后不 await 存历史、润色（后台块里的 await 除外）', (f) => {
    const lines = readCode(f).split('\n');
    // 「void (async () => {」开头的后台块里，await 存历史、润色是合法的；块外的都不许有
    const offenders = lines.filter((line, i) => {
      if (!/await (saveCreativeHistory|saveGenerationHistory|polishTitlesRemote)\(/.test(line)) return false;
      const background = lines.slice(Math.max(0, i - 8), i).some((l) => /void \(async \(\) => \{/.test(l));
      return !background;
    });
    expect(offenders).toEqual([]);
  });

  it('创作方向：正文出来后润色和存历史在后台，转圈不等它们', () => {
    const code = readCode('app/dashboard/direction/page.tsx');
    expect(code).toMatch(/void \(async \(\) => \{[\s\S]*polishTitlesRemote\(full\)[\s\S]*saveCreativeHistory/);
  });

  it('标题润色有超时：服务端慢时用原文，不无限等', () => {
    const code = readCode('lib/title-polish.ts');
    expect(code).toMatch(/signal: AbortSignal\.timeout\(POLISH_TIMEOUT_MS\)/);
    expect(code).toMatch(/export const POLISH_TIMEOUT_MS = 40_000/);
  });
});
