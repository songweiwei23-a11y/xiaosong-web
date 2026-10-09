/**
 * 首页「行业样例」能取消（2026-10-04 产品方：选了行业再点取消不掉，回不到动画）。
 */
import { describe, expect, it } from 'vitest';
import { readCode } from './helpers/source';

describe('行业样例能取消、能回到动画', () => {
  const hero = readCode('components/landing/hero/TryHero.tsx');
  it('再点一次已选中的行业：取消，回到手机动画', () => {
    expect(hero).toMatch(/if \(shown\?\.ind\.id === ind\.id && !shown\.guessed\) \{\s*reset\(\);/);
    expect(hero).toMatch(/setShown\(null\)/);
    expect(hero).toMatch(/<PhoneStory \/>/);
  });
  it('样例卡片上有「看演示」按钮，点了也回动画', () => {
    expect(hero).toMatch(/onClick=\{reset\}[\s\S]{0,300}看演示/);
  });
  it('取消时只清掉点行业自动填的那句，自己写的留着', () => {
    expect(hero).toMatch(/if \(shown && text === shown\.ind\.who\) setText\(""\)/);
  });
});
