/**
 * 内容规划、创作方向的自动返工（lib/direction-rework，2026-10-29 产品方同意）。
 * 用例来自第十三轮真实原稿：大码号 7 个流量方向里 3 个讲「换季」（规定最多 2 个）、带人群身份只有 3/7。
 * 不调用模型：只守住「什么时候返工、返工提示词说了什么、什么时候采用」。
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIRECTION_REWORK_TASKS, reworkIssues, buildDirectionReworkPrompt, acceptRework } from '@/lib/direction-rework';

const PROFILE = { profile_name: '素妮朵大码女装', product_category: ['大码女装', '裤子', '外套'], target_occupation: ['宝妈', '学生'], target_interests: ['大码女装'], unique_selling_point: '价格比同款市场价低30%-50%、现场试穿' };

const dir = (n: number, name: string, around: string, sanyou: string, el: string, role = '流量型', count = 1) =>
  `### 方向${n}：${name}\n- **视频目的**：${role}\n- **出发点**：围绕：${around}｜三有：${sanyou}｜爆款元素：${el}｜看点：……\n- **内容方向**：……\n- **本月条数**：${count} 条`;

const BEFORE = [
  '# 2026年10月内容规划（共 9 条）',
  dir(1, '换季烦恼现场', '人——大码女性的换季生活', '有共鸣', '人群'),
  dir(2, '旧衣柜换季整理', '场', '有共鸣', '怀旧'),
  dir(3, '学生衣柜闲置衣', '人——预算有限的学生', '有共鸣', '成本'),
  dir(4, '尺码标签现场', '货', '有用', '奇葩'),
  dir(5, '宝妈出门前衣柜', '人——带娃生活里的宝妈', '有共鸣', '人群'),
  dir(6, '裤装日常尴尬', '场', '有共鸣', '奇葩'),
  dir(7, '换季外套闲置堆', '货', '有共鸣', '成本'),
  `### 方向8：新店开门记录\n- **视频目的**：人设型\n- **出发点**：人：让人记住店主……\n- **本月条数**：1 条`,
  `### 方向9：同镜女装实物\n- **视频目的**：变现型\n- **出发点**：成交理由：现场试穿｜主角：大码女装\n- **本月条数**：1 条`,
].join('\n\n');

describe('什么时候返工', () => {
  it('只管内容规划和创作方向', () => {
    expect([...DIRECTION_REWORK_TASKS]).toEqual(['内容规划', '创作方向']);
  });

  it('第十三轮原稿：认出话题扎堆（换季、衣柜都报，不只报最多的那个）和人群身份不到一半', () => {
    const issues = reworkIssues(BEFORE, PROFILE);
    expect(issues.some((d) => d.includes('有 3 个都在讲「换季」'))).toBe(true);
    expect(issues.some((d) => d.includes('有 3 个都在讲「衣柜」'))).toBe(true);
    expect(issues.some((d) => d.includes('只有 3/7 个带这群人的身份'))).toBe(true);
  });

  it('没有问题就不返工（不多花调用）', () => {
    const clean = [dir(1, '大码学生出门前的衣服', '人——大码学生', '有共鸣', '人群'), dir(2, '店主不进货的那几种裤子', '货——大码裤子', '有用', '最差')].join('\n\n');
    expect(reworkIssues(clean, PROFILE)).toEqual([]);
  });
});

describe('返工提示词', () => {
  const prompt = buildDirectionReworkPrompt({ task: '内容规划', text: BEFORE, issues: reworkIssues(BEFORE, PROFILE) });
  it('列出体检问题，只改出问题的方向，其余一字不动、条数和配比不变', () => {
    expect(prompt).toContain('【返工：内容规划】');
    expect(prompt).toContain('1. 流量方向里有 3 个都在讲「换季」');
    expect(prompt).toContain('请只改出问题的那几个方向');
    expect(prompt).toContain('没出问题的方向一字不动；方向的数量、编号、视频目的、本月条数、节奏都不变');
    expect(prompt).toContain('反差的两边必须是两样货、两类人或两个时代');
    expect(prompt).toContain(BEFORE);
  });

  // 返工核验：只给结果不给背景，模型只改名字躲体检（「旧衣柜换季整理」→「旧衣柜留存理由」）
  it('带上原来的任务当背景；写明改的是拍的东西，只改名字不算', () => {
    const withCtx = buildDirectionReworkPrompt({ task: '内容规划', text: BEFORE, issues: ['x'], context: '【工作任务】给这个账号做内容规划' });
    expect(withCtx).toContain('## 原来的任务（账号情况、定位和标准都照它）\n【工作任务】给这个账号做内容规划');
    expect(withCtx).toContain('只改方向名里的词、拍的还是同一件事，不算改');
    expect(withCtx.indexOf('## 原来的任务')).toBeLessThan(withCtx.indexOf('## 要返工的这份内容规划'));
    expect(prompt).not.toContain('## 原来的任务');
  });
});

describe('什么时候采用返工稿', () => {
  const fixed = BEFORE
    .replace('### 方向2：旧衣柜换季整理\n- **视频目的**：流量型\n- **出发点**：围绕：场', '### 方向2：大码女生的旧衣柜\n- **视频目的**：流量型\n- **出发点**：围绕：场——大码女生的衣柜')
    .replace('### 方向7：换季外套闲置堆', '### 方向7：大码外套最差的那几种');

  it('问题变少、方向数和配比不变：采用', () => {
    expect(reworkIssues(fixed, PROFILE).length).toBeLessThan(reworkIssues(BEFORE, PROFILE).length);
    expect(acceptRework(BEFORE, fixed, '内容规划', PROFILE)).toBe(true);
  });

  it('问题没变少：保留原稿', () => {
    expect(acceptRework(BEFORE, BEFORE, '内容规划', PROFILE)).toBe(false);
  });

  it('删掉或多出方向：保留原稿', () => {
    expect(acceptRework(BEFORE, fixed.replace(/### 方向9[\s\S]*$/, ''), '内容规划', PROFILE)).toBe(false);
  });

  it('规划改了某种目的的条数：保留原稿；创作方向没有条数，不查这一项', () => {
    const recount = fixed.replace('### 方向9：同镜女装实物\n- **视频目的**：变现型\n- **出发点**：成交理由：现场试穿｜主角：大码女装\n- **本月条数**：1 条', '### 方向9：同镜女装实物\n- **视频目的**：变现型\n- **出发点**：成交理由：现场试穿｜主角：大码女装\n- **本月条数**：2 条');
    expect(acceptRework(BEFORE, recount, '内容规划', PROFILE)).toBe(false);
    expect(acceptRework(BEFORE, recount, '创作方向', PROFILE)).toBe(true);
  });

  it('空稿：保留原稿', () => {
    expect(acceptRework(BEFORE, '  ', '内容规划', PROFILE)).toBe(false);
  });
});

describe('接进生成接口', () => {
  const route = fs.readFileSync('app/api/dify/stream/route.ts', 'utf8');
  it('生成完、在口播裁剪和事实修正之前返工一次；有限额；用整理过的返工稿；记用量', () => {
    const at = route.indexOf('DIRECTION_REWORK_TASKS.has(body.taskType)');
    expect(at).toBeGreaterThan(route.indexOf('const tidy = '));
    expect(at).toBeLessThan(route.indexOf('FACT_AUTO_FIX_TASKS.has(body.taskType) && fullResponse.trim()'));
    expect(route).toContain('!directionReworkLimited(userId)');
    expect(route).toContain('acceptRework(fullResponse, text, body.taskType, profileFull)');
    expect(route).toContain('buildDirectionReworkPrompt({ task: body.taskType, text: fullResponse, issues: found, context: query })');
    expect(route).toContain("'direction_rework_steps'");
    expect(route).toContain('profileFull = (full as Record<string, unknown> | null) ?? null;');
  });
});
