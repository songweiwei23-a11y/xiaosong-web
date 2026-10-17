/**
 * 使用说明页（app/dashboard/help）和代码保持一致：
 * 侧栏每个板块都要在说明书里有一句话；说明书里的价格、额度、联网、深度研究数字要和套餐配置相等。
 * 改了功能或套餐，这个测试会提醒你同步改说明书。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { readCode } from './helpers/source';
import { SUBSCRIPTION_PLANS, WEB_SEARCH_LIMITS, DEEP_RESEARCH_LIMITS } from '@/lib/config/plans';

const help = readCode('app/dashboard/help/page.tsx');

describe('使用说明：侧栏每个板块都有一句话说明', () => {
  it('侧栏里有「使用说明」入口', () => {
    expect(readCode('components/dashboard/Sidebar.tsx')).toMatch(/name: "使用说明", href: "\/dashboard\/help"/);
  });
  it('侧栏的每个板块名，说明书里都提到了', () => {
    const sidebar = readCode('components/dashboard/Sidebar.tsx');
    const names = [...sidebar.matchAll(/name: "([^"]+)", href: "\/dashboard[^"]*"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(20); // 自证不是空转
    const missing = names.filter((n) => !help.includes(`name: "${n}"`) && !help.includes(`{ name: "${n}"`) && !new RegExp(`name: "${n}"`).test(help));
    expect(missing).toEqual([]);
  });
  it('说明书所在的页面真的存在', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/dashboard/help/page.tsx'))).toBe(true);
  });
});

describe('使用说明：额度和价格和套餐配置一致', () => {
  it('价格', () => {
    expect(help).toContain(`${SUBSCRIPTION_PLANS.basic.price} 元/月`);
    expect(help).toContain(`${SUBSCRIPTION_PLANS.pro.price} 元/月`);
    expect(help).toContain(`${SUBSCRIPTION_PLANS.enterprise.price} 元/月`);
  });
  it('每个功能的月额度（基础、专业、高频）', () => {
    expect(help).toContain(`每个功能 ${SUBSCRIPTION_PLANS.basic.quotas.script} 次/月`);
    expect(help).toContain(`每个功能 ${SUBSCRIPTION_PLANS.pro.quotas.script} 次/月`);
    expect(help).toContain(`每个功能 ${SUBSCRIPTION_PLANS.enterprise.quotas.script} 次/月`);
  });
  it('免费版：各板块 5 次，自由对话和知识库 10 次，前采、拆解、二创 3 次', () => {
    expect(SUBSCRIPTION_PLANS.free.quotas.script).toBe(5);
    expect(SUBSCRIPTION_PLANS.free.quotas.freeChat).toBe(10);
    expect(SUBSCRIPTION_PLANS.free.quotas.knowledge).toBe(10);
    expect(SUBSCRIPTION_PLANS.free.quotas.interview).toBe(3);
    expect(SUBSCRIPTION_PLANS.free.quotas.breakdown).toBe(3);
    expect(SUBSCRIPTION_PLANS.free.quotas.remix).toBe(3);
    expect(help).toContain('每个板块 5 次（自由对话、知识库各 10 次；前采建档、拆解爆款、跨行业二创各 3 次）');
  });
  it('联网搜索次数', () => {
    expect(help).toContain(`${WEB_SEARCH_LIMITS.basic} 次/月`);
    expect(help).toContain(`${WEB_SEARCH_LIMITS.pro} 次/月`);
    expect(help).toContain(`${WEB_SEARCH_LIMITS.enterprise} 次/月`);
    expect(help).toContain(`${WEB_SEARCH_LIMITS.free} 次，一次性体验`);
  });
  it('深度研究次数（基础、免费不提供）', () => {
    expect(help).toContain(`${DEEP_RESEARCH_LIMITS.pro} 份/月`);
    expect(help).toContain(`${DEEP_RESEARCH_LIMITS.enterprise} 份/月`);
  });
});
