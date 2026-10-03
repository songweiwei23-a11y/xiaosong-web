/**
 * 创作方向（2026-10-02 新板块）：说目的 → 基于档案铺开方向和思路 → 推荐一个 → 勾选跳去其他板块。
 */
import { describe, it, expect } from 'vitest';
import { buildDirectionPrompt, hasGoal, PURPOSES, DIRECTION_TASK_TYPE } from '@/lib/direction';
import { splitCreationItems, itemsNoun } from '@/lib/creation-items';
import { buildCreationHandoff, CREATION_DESTINATIONS, CREATION_SOURCES, NOTE_TARGETS, RECOMMENDED_NEXT } from '@/lib/creation-flow';
import { libraryCategory } from '@/lib/library';
import { TASK_TYPE_TO_FEATURE } from '@/lib/task-type';
import { ISOLATED_TASKS } from '@/lib/topic-library';
import { COUNTED_FEATURES, SUBSCRIPTION_PLANS } from '@/lib/config/plans';
import { DURABLE_CREATIVE_TASKS } from '@/lib/creative-history';
import { manifestOf } from '@/lib/context-manifest';
import { readCode } from './helpers/source';

const base = { purposes: ['store', 'persona'], formats: ['any'], count: 5 as const, depth: 'full' as const, profileSummary: '- 档案名称：锦园地摊串串\n- 经营品类（每一个都在卖，定位里都要体现）：川味串串火锅、川味烧烤、川菜' };

describe('提示词', () => {
  const p = buildDirectionPrompt({ ...base, customGoal: '下个月开第二家店', ideas: '想拍老板凌晨去市场挑肉', onCamera: 'boss', capacity: 'mid', horizon: 'month' });

  it('目的（勾的 + 自己写的）、已有想法、条件都进提示词', () => {
    expect(p).toMatch(/## 他的目的\n引流到店、立人设；下个月开第二家店/);
    expect(p).toMatch(/他自己已经有的想法[\s\S]*想拍老板凌晨去市场挑肉/);
    expect(p).toMatch(/出镜：老板愿意出镜/);
    expect(p).toMatch(/产能：一周 3～5 条——方向要拍得过来/);
    expect(p).toMatch(/时间：一个月内/);
    expect(p).toContain('经营品类');
  });

  it('出几个方向、最后推荐一个、第一周怎么开始', () => {
    expect(p).toMatch(/然后出 5 个方向/);
    expect(p).toMatch(/### 方向1：/);
    expect(p).toMatch(/### 我推荐先做：方向N/);
    expect(p).toMatch(/\*\*第一周怎么开始\*\*/);
  });

  it('完整版有选题示例、怎么拍、开头示范、看什么数据；快速版只有几行', () => {
    expect(p).toMatch(/\*\*可拍的选题示例\*\*/);
    expect(p).toMatch(/\*\*开头示范\*\*/);
    expect(p).toMatch(/\*\*看什么数据\*\*/);
    const quick = buildDirectionPrompt({ ...base, depth: 'quick' });
    expect(quick).not.toMatch(/开头示范/);
  });

  it('守住老规矩：拍得出来、不编经历和数字', () => {
    expect(p).toMatch(/档案里没有的资源不要安排/);
    expect(p).toMatch(/【换成你的：……】/);
    expect(p).toMatch(/写成 X/);
  });

  it('选题示例不写成「选题：」开头——否则勾选列表会把示例当成这个方向的题目', () => {
    expect(p).not.toMatch(/^\s*[-*]?\s*\**选题\**\s*[：:]/m);
  });

  it('没档案时用手填的行业；都没有就提醒建档案', () => {
    expect(buildDirectionPrompt({ ...base, profileSummary: undefined, industry: '美甲店' })).toMatch(/做的是：美甲店/);
    expect(buildDirectionPrompt({ ...base, profileSummary: undefined })).toMatch(/提醒他建好档案/);
  });

  it('至少要有一个目的', () => {
    expect(hasGoal({ purposes: [], customGoal: ' ' })).toBe(false);
    expect(hasGoal({ purposes: [], customGoal: '开第二家店' })).toBe(true);
    expect(PURPOSES.length).toBeGreaterThanOrEqual(12);
  });
});

describe('按格式出的结果，勾选列表认得出、跳得过去', () => {
  const OUT = `你的目的拆开是两件事……\n\n### 方向1：老板凌晨挑肉\n- **对应目的**：立人设\n- **核心思路**：……\n\n---\n\n### 方向2：熟客回访\n- **对应目的**：引流到店\n\n---\n\n### 方向3：一元串串算账\n- **对应目的**：引流到店\n\n### 我推荐先做：方向1「老板凌晨挑肉」\n- **为什么是它**：……`;

  it('一个方向一条，推荐那段不算一条', () => {
    const p = splitCreationItems(OUT);
    expect(p.items.map((x) => x.label)).toEqual(['方向1：老板凌晨挑肉', '方向2：熟客回访', '方向3：一元串串算账']);
    expect(itemsNoun(p.items)).toBe('方向思路');
    expect(p.footer).toMatch(/我推荐先做/);
  });

  it('模型手误「方方向3」也认（线上实测 5 个方向漏了这一个）；「我推荐先做：方向1」不算一条', () => {
    // 方向3 正文里有开头示范的口播，也不能因此被认成脚本
    const p = splitCreationItems('### 方向1：甲\n…\n### 方向2：乙\n…\n### 方方向3：丙\n- **开头示范**：口播：今天教你\n### 方向4:丁\n…\n### 我推荐先做:方向1「甲」\n…');
    expect(p.items.map((x) => x.label)).toEqual(['方向1：甲', '方向2：乙', '方方向3：丙', '方向4:丁']);
    expect(p.items.every((x) => x.kind === 'direction')).toBe(true);
    expect(p.footer).toMatch(/我推荐先做/);
  });

  it('推荐去生成选题、脚本、开篇；收藏归「方向思路」', () => {
    expect(RECOMMENDED_NEXT.direction).toEqual(['topic', 'script', 'growth']);
    expect(libraryCategory('direction', 'direction')).toBe('direction');
    expect(CREATION_SOURCES.direction).toBe('创作方向');
  });

  it('也能作为目的地：别的板块的内容带进来填进「已有的想法」', () => {
    expect(CREATION_DESTINATIONS.some((d) => d.id === 'direction')).toBe(true);
    expect(NOTE_TARGETS.has('direction')).toBe(true);
    expect(buildCreationHandoff('free-chat', 'direction', '我想下个月开第二家店').target).toBe('/dashboard/direction');
    expect(readCode('app/dashboard/direction/page.tsx')).toMatch(/setIdeas\(incomingNote\(data\)\)/);
  });
});

describe('接到全站', () => {
  it('单独一项额度：免费 5 次；任务类型、存档、会话隔离都登记了', () => {
    expect(TASK_TYPE_TO_FEATURE[DIRECTION_TASK_TYPE]).toBe('direction');
    expect(COUNTED_FEATURES.find((f) => f.key === 'direction')?.column).toBe('direction_used');
    expect(SUBSCRIPTION_PLANS.free.quotas.direction).toBe(5);
    expect(SUBSCRIPTION_PLANS.basic.quotas.direction).toBe(50);
    expect(DURABLE_CREATIVE_TASKS.has(DIRECTION_TASK_TYPE)).toBe(true);
    expect(ISOLATED_TASKS.has(DIRECTION_TASK_TYPE)).toBe(true);
    expect(readCode('supabase/migrations/20261002_direction.sql')).toMatch(/add column if not exists direction_used integer not null default 0/);
  });

  it('带上账号记忆：简报、成交理由、禁忌', () => {
    const m = manifestOf('direction')!;
    expect(m.dealReasons).toBe(true);
    expect(m.brief).toContain('direction');
    expect(readCode('app/dashboard/direction/page.tsx')).toMatch(/buildContextBlock\(context, "direction"\)/);
  });

  it('页面：先查额度、按创作方向发、服务端存档；侧边栏、工作台、首页都有入口', () => {
    const page = readCode('app/dashboard/direction/page.tsx');
    expect(page).toMatch(/checkQuota\("direction"\)/);
    expect(page).toMatch(/openUpgrade\("direction"\)/);
    expect(page).toMatch(/taskType: DIRECTION_TASK_TYPE, query/);
    expect(page).toMatch(/historyId, historyInput, historyOwnerId/);
    expect(readCode('components/dashboard/Sidebar.tsx')).toMatch(/name: "创作方向", href: "\/dashboard\/direction"/);
    expect(readCode('app/dashboard/page.tsx')).toMatch(/href: "\/dashboard\/direction"/);
    expect(readCode('app/page.tsx')).toMatch(/title: "创作方向"/);
  });
});
