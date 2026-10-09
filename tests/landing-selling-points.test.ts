/**
 * 首页卖点整理（2026-10-04，docs/首页卖点整理_草稿_20261004.md，产品方确认）。
 * 钉住：新卖点都上了首页；对比表单独成节；不用广告法禁止的绝对化用语；价格页有深度研究那一行。
 */
import { describe, it, expect } from 'vitest';
import { readCode } from './helpers/source';
import { DEEP_RESEARCH_LIMITS, quotaSummary } from '@/lib/config/plans';

const PUBLIC = ['app/page.tsx', 'app/pricing/page.tsx', 'app/login/page.tsx', 'app/dashboard/membership/page.tsx', 'components/landing/hero/TryHero.tsx', 'app/layout.tsx'];

describe('首页卖点', () => {
  const home = readCode('app/page.tsx');

  it('能解决什么、八大优势、一条内容的流程、AI 助理专区、对比表都有，导航能点到', () => {
    for (const id of ['problems', 'advantages', 'flow', 'assistant', 'features', 'compare', 'pricing']) {
      expect(home, `缺 #${id} 这一节`).toContain(`id="${id}"`);
    }
    expect(home).toContain('八大核心优势');
    expect(home).toMatch(/href="#compare"/);
  });

  it.each(['深度研究报告', '出方案', '结果画布', '拍摄交付包', '数据复盘', '多账号档案', '数据导出'])('「%s」上了功能墙', (t) => {
    expect(home).toContain(`title: "${t}"`);
  });

  it('不乱编、人设事实卡、数据回流写进了核心优势', () => {
    expect(home).toMatch(/人设事实卡/);
    expect(home).toMatch(/自动体检/);
    expect(home).toMatch(/从平台后台复制表格直接粘贴/);
  });

  it('对比表三列如实写，含请编导的费用', () => {
    expect(home).toMatch(/自己写 \/ 请编导/);
    expect(home).toMatch(/通用 AI 聊天工具/);
    expect(home).toMatch(/请编导月薪数千到上万/);
  });

  it('深度研究的次数、网页数、方案场景数都从配置算，不手写', () => {
    expect(home).toMatch(/DEEP_RESEARCH_LIMITS\.pro/);
    expect(home).toMatch(/DEPTHS\.deep\.sources \* DEPTHS\.deep\.questions\[1\]/);
    expect(home).toMatch(/PLAN_CATEGORIES\.reduce/);
  });

  it('不写用的是哪个 AI 模型（产品方定）', () => {
    for (const f of ['app/page.tsx', 'app/login/page.tsx', 'app/pricing/page.tsx', 'app/layout.tsx']) {
      expect(readCode(f), f).not.toMatch(/Claude|GPT|DeepSeek|通义|文心/);
    }
  });
});

describe('不用广告法禁止的绝对化用语', () => {
  it.each(PUBLIC)('%s', (f) => {
    const hits = readCode(f).match(/顶级|最强|最好|最佳|最优|国家级|全网第一|行业第一|第一品牌|极致|万能|全能|No\.?\s?1/g) ?? [];
    expect(hits, `${f} 里有：${hits.join('、')}`).toEqual([]);
  });
});

describe('价格与会员页同步了深度研究', () => {
  it('价格页对比表有深度研究那一行，按配置现算', () => {
    const pricing = readCode('app/pricing/page.tsx');
    expect(pricing).toMatch(/深度研究报告/);
    expect(pricing).toMatch(/DEEP_RESEARCH_LIMITS\[id\]/);
  });

  it('套餐卡片（首页、价格页、会员页都用 quotaSummary）里专业、高频有深度研究，免费、基础没有', () => {
    expect(quotaSummary('pro').join(' ')).toContain(`深度研究报告：${DEEP_RESEARCH_LIMITS.pro} 份/月`);
    expect(quotaSummary('enterprise').join(' ')).toContain(`${DEEP_RESEARCH_LIMITS.enterprise} 份/月`);
    expect(quotaSummary('free').join(' ')).not.toContain('深度研究');
  });
});
