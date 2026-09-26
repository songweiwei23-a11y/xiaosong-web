/**
 * 切换档案：点了要真的切，而且切了所有地方都跟着变。
 *
 * 线上 bug：首页右上角「切换档案」只是跳到档案管理页，那一页只能编辑、删除，切不了；
 * 在侧边栏切了，首页只在打开时读过一次档案、不听广播，还停在上一个号上。
 * 这两处都不报错，只是"点了没反应"，所以用扫描守住。
 */
import { describe, it, expect } from 'vitest';
import { readCode } from './helpers/source';

describe('切换档案', () => {
  it('首页右上角是真的切换器：列出档案，点了走统一入口切换', () => {
    const page = readCode('app/dashboard/page.tsx');
    expect(page).toMatch(/<ProfileQuickSwitch /);
    expect(page).not.toMatch(/href="\/dashboard\/profiles"[^>]*>\s*<User/);
    const sw = readCode('components/dashboard/ProfileQuickSwitch.tsx');
    expect(sw).toMatch(/setActiveProfileId\(p\.id, p\)/);
    expect(sw).toMatch(/fetch\("\/api\/profiles"\)/);
  });

  it('首页听"档案切换了"的广播，切了就重新定当前档案', () => {
    const page = readCode('app/dashboard/page.tsx');
    expect(page).toMatch(/onActiveProfileChange\(\(\) => \{[\s\S]{0,200}applyProfiles/);
  });

  it('档案管理页能"设为当前"，并标出当前在用的', () => {
    const src = readCode('app/dashboard/profiles/page.tsx');
    expect(src).toMatch(/setActiveProfileId\(profile\.id, profile\)/);
    expect(src).toContain('设为当前');
    expect(src).toContain('当前在用');
    expect(src).toMatch(/onActiveProfileChange\(/);
  });

  it('侧边栏也听广播：别处切了它跟着变', () => {
    expect(readCode('app/dashboard/components/ProfileSwitcher.tsx')).toMatch(/onActiveProfileChange\(handleProfileUpdate\)/);
  });
});
