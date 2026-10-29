/**
 * 实时监控的「用户动态流水」读取失败要明示（2026-10-29）。
 *
 * 线上现象：「最近活跃用户」「实时动态」是空的，页面不报错，看不出是没人用还是读失败。
 * 原因是快照里读 user_activity 的那一步曾经 `.catch(() => [])`，失败就悄悄当作没有动态。
 * 守的是：读失败时错误随快照返回，页面上写出来，不再静默。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(join(process.cwd(), 'app/api/admin/monitor/route.ts'), 'utf8');
const page = readFileSync(join(process.cwd(), 'app/admin/monitor/page.tsx'), 'utf8');

describe('用户动态流水读取失败不静默', () => {
  it('快照里不再把读取失败吞成空数组', () => {
    expect(route).not.toMatch(/\.catch\(\(\) => \[\] as ActivityRow\[\]\)/);
  });

  it('读取失败的原因随快照的 status.activityError 返回，成功时为空串', () => {
    expect(route).toMatch(/activityError: activityRead\.error/);
    expect(route).toMatch(/error: e instanceof Error \? e\.message : String\(e\)/);
    expect(route).toMatch(/error: ''/);
  });

  it('页面上有明示：读失败时显示原因，并说明最近活跃和实时动态可能不全', () => {
    expect(page).toMatch(/snap\?\.status\?\.activityError/);
    expect(page).toMatch(/用户动态流水读取失败/);
    expect(page).toMatch(/「最近活跃用户」和「实时动态」可能不全/);
  });
});
