/**
 * 「已经有的想法」只对本次有效（2026-10-31）：创作方向页不再从带过来的 bridge 里接旧想法、补充要求、原始内容。
 * 以前 userIntent 用 `bridge.creationSettings.userIntent ||`，旧想法一直优先，之后被存进历史，每次方向都接着走。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(process.cwd(), 'app/dashboard/direction/page.tsx'), 'utf8');

describe('创作方向页：想法只用本次输入', () => {
  it('不再用 bridge 里的旧想法优先', () => {
    expect(src).not.toContain('bridge.creationSettings.userIntent ||');
    expect(src).not.toContain('bridge.originContent ||');
  });

  it('从历史回填时，不把旧的「也可以自己写」「已经有的想法」填回输入框', () => {
    expect(src).not.toContain('if (typeof d.ideas === "string") setIdeas(d.ideas);');
    expect(src).not.toContain('if (typeof d.customGoal === "string") setCustomGoal(d.customGoal);');
  });

  it('带过来的想法和补充要求不进本次设置', () => {
    expect(src).toContain('const carriedSettings = { ...bridge.creationSettings, userIntent: undefined, notes: undefined }');
  });
});
