/**
 * 内容配比（2026-10-02 产品方："让用户自己选配比，或者根据账号阶段系统推荐，不然结果跟预期差距很大"）。
 * 配比错了不会报错，只会"选题全是变现型"——所以算法、接线、核对三处都守住
 */
import { describe, it, expect } from 'vitest';
import {
  STAGE_MIX, PRESETS, recommendMix, resolveMix, readSetting, normalizeMix, mixToCounts,
  mixPromptBlock, countRoles, checkMix, formatMix,
} from '@/lib/content-mix';
import { PROFILE_CHOICES } from '@/lib/profile-fields';
import { buildContextBlock } from '@/lib/creator-context';
import { buildDirectionPrompt } from '@/lib/direction';
import { buildGrowthPlanPrompt } from '@/lib/growth-standards';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import { buildBriefPrompt } from '@/lib/creative-brief';
import { readCode, readSource } from './helpers/source';

const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

describe('系统推荐', () => {
  it('四个账号阶段都有推荐，和档案选项一一对上，每份加起来 100', () => {
    expect(STAGE_MIX.map((s) => s.stage)).toEqual(PROFILE_CHOICES.account_stage);
    for (const s of STAGE_MIX) expect(sum(s.mix), s.stage).toBe(100);
  });

  it('刚起号：流量型最大、变现型最小但不为 0（知识库：变现型从第一周就要有）', () => {
    const { mix } = recommendMix({ account_stage: '刚起号，定位未确定' });
    expect(mix.流量型).toBeGreaterThan(mix.人设型);
    expect(mix.流量型).toBeGreaterThan(mix.变现型);
    expect(mix.变现型).toBeGreaterThan(0);
  });

  it('稳定运营：代运营 SOP 原数 30 / 20 / 50', () => {
    expect(recommendMix({ account_stage: '稳定运营，需要新选题' }).mix).toEqual({ 流量型: 30, 人设型: 20, 变现型: 50 });
  });

  it('变现方式只选了「暂不考虑」：变现型压到 10%', () => {
    const { mix, reason } = recommendMix({ account_stage: '稳定运营，需要新选题', monetization_model: ['暂不考虑'] });
    expect(mix.变现型).toBe(10);
    expect(sum(mix)).toBe(100);
    expect(reason).toContain('暂不考虑');
  });

  it('用户写了要大流量 / 要成交，按目标微调', () => {
    const base = recommendMix({ account_stage: '有定位，需要内容方向' }).mix;
    expect(recommendMix({ account_stage: '有定位，需要内容方向' }, '想做大流量、涨粉').mix.流量型).toBe(base.流量型 + 10);
    expect(recommendMix({ account_stage: '有定位，需要内容方向' }, '只要精准客户').mix.变现型).toBe(base.变现型 + 10);
  });

  it('没填阶段：按过渡档，并说明原因', () => {
    const r = recommendMix({});
    expect(r.mix).toEqual(STAGE_MIX[1].mix);
    expect(r.reason).toContain('没填账号阶段');
  });
});

describe('生效顺序：这次临时改的 → 档案设置 → 系统推荐', () => {
  const profile = { account_stage: '刚起号，定位未确定', content_mix: { preset: 'convert' } };

  it('档案设了预设就用档案的', () => {
    const r = resolveMix(profile);
    expect(r.source).toBe('profile');
    expect(r.mix).toEqual(PRESETS.find((p) => p.id === 'convert')!.mix);
    expect(r.label).toBe('档案设置·成交优先');
  });

  it('这次临时改的压过档案', () => {
    const r = resolveMix(profile, { preset: 'custom', custom: { 流量型: 50, 人设型: 50, 变现型: 0 } });
    expect(r.source).toBe('override');
    expect(r.mix).toEqual({ 流量型: 50, 人设型: 50, 变现型: 0 });
  });

  it('档案没设或设成系统推荐：按阶段推荐，并带上理由', () => {
    for (const content_mix of [undefined, { preset: 'auto' }, { preset: '乱写' }]) {
      const r = resolveMix({ account_stage: '刚起号，定位未确定', content_mix });
      expect(r.source).toBe('auto');
      expect(r.label).toBe('系统推荐（刚起号）');
      expect(r.reason).toBeTruthy();
    }
  });

  it('库里的自定义值不规整也能读：归一成 5 的倍数、和为 100', () => {
    expect(readSetting({ preset: 'custom', custom: { 流量型: 1, 人设型: 1, 变现型: 2 } })?.custom).toEqual({ 流量型: 25, 人设型: 25, 变现型: 50 });
    expect(normalizeMix({ 流量型: 33, 人设型: 33, 变现型: 33 })).toSatisfy((m: Record<string, number>) => sum(m) === 100);
    expect(readSetting({ preset: 'custom' })).toBeNull();
    expect(readSetting(null)).toBeNull();
  });
});

describe('换算成条数', () => {
  it('总数一定对得上', () => {
    for (const n of [1, 3, 5, 8, 10, 13, 30]) {
      for (const s of STAGE_MIX) expect(sum(mixToCounts(s.mix, n)), `${s.stage} ${n}`).toBe(n);
    }
  });

  it('10 条 60/25/15 → 6 / 2-3 / 1-2；占比 ≥10% 的至少 1 条', () => {
    const c = mixToCounts({ 流量型: 60, 人设型: 25, 变现型: 15 }, 10);
    expect(c.流量型).toBe(6);
    expect(c.人设型 + c.变现型).toBe(4);
    const small = mixToCounts({ 流量型: 70, 人设型: 20, 变现型: 10 }, 3);
    expect(small.变现型).toBeGreaterThanOrEqual(1);
    expect(sum(small)).toBe(3);
  });

  it('占 0% 的一条都不给', () => {
    expect(mixToCounts({ 流量型: 50, 人设型: 50, 变现型: 0 }, 5).变现型).toBe(0);
  });
});

describe('写进提示词', () => {
  const r = resolveMix({ account_stage: '刚起号，定位未确定' });

  it('有条数：写成每种几条，并说明以这里为准', () => {
    const b = mixPromptBlock(r, { count: 10 });
    expect(b).toContain('流量型 6 条');
    expect(b).toMatch(/以这里为准/);
    expect(b).toContain('视频目的');
  });

  it('没有条数：给百分比，作用配比直接用', () => {
    const b = mixPromptBlock(r);
    expect(b).toContain(formatMix(r.mix));
    expect(b).toMatch(/直接用这个数/);
  });

  it('选题、方向、起号、定位、简报的提示词都接得上', () => {
    const block = mixPromptBlock(r);
    expect(buildGrowthPlanPrompt({ mixBlock: block })).toContain('照上面「内容配比」的数写');
    expect(buildPositioningPrompt({ profileSummary: '- 档案名称：x', mixBlock: block })).toMatch(/第一步、第二步（定作用配比）已经定好/);
    expect(buildBriefPrompt({ positioningFull: '定位', mixBlock: block })).toMatch(/三种视频的配比\*\*照这个数写/);
    const dir = buildDirectionPrompt({ purposes: ['store'], formats: ['any'], count: 5, depth: 'quick', mixBlock: mixPromptBlock(r, { count: 5, unit: '个' }) });
    expect(dir).toContain('**视频目的**：流量型 / 人设型 / 变现型');
    expect(dir).toContain('流量型 3 个');
    // 没配比时不加「视频目的」这一行
    expect(buildDirectionPrompt({ purposes: ['store'], formats: ['any'], count: 5, depth: 'quick' })).not.toContain('**视频目的**');
  });

  it('自由对话的上下文里带一行配比', () => {
    const block = buildContextBlock({ profile: { id: 'p', profile_name: 'x', account_stage: '刚起号，定位未确定' }, positioning: null, dealReasons: [] }, 'freeChat');
    expect(block).toMatch(/内容配比\*\*：流量型 60%/);
    expect(buildContextBlock({ profile: { id: 'p', profile_name: 'x', account_stage: '刚起号，定位未确定' }, positioning: null, dealReasons: [] }, 'script')).not.toContain('内容配比');
  });
});

describe('生成完核对', () => {
  const r = resolveMix({ account_stage: '稳定运营，需要新选题' }); // 30 / 20 / 50
  const topics = (roles: string[]) => roles.map((x, i) => `## 选题${i + 1}：标题${i}\n\n**0️⃣ 视频目的**\n${x} — 因为……\n\n**🅰 打法**\n变现型也能用（这句不该被数到）`).join('\n\n');

  it('按「视频目的」那一行数，不被正文里别的目的词带偏', () => {
    const c = countRoles(topics(['流量型', '人设型', '变现型', '变现型']));
    expect(c.counts).toEqual({ 流量型: 1, 人设型: 1, 变现型: 2 });
    expect(c.total).toBe(4);
  });

  it('条数对得上就 ok；对不上给出差在哪', () => {
    expect(checkMix(topics(['流量型', '流量型', '流量型', '人设型', '人设型', '变现型', '变现型', '变现型', '变现型', '变现型']), r, 10).ok).toBe(true);
    const bad = checkMix(topics(Array(10).fill('变现型')), r, 10);
    expect(bad.ok).toBe(false);
    expect(bad.summary).toBe('流量 0 / 人设 0 / 变现 10');
    expect(bad.expected).toBe('流量 3 / 人设 2 / 变现 5');
  });

  it('创作方向的「### 方向N」也数得出来；「我推荐先做」不算一条', () => {
    const text = '开头\n\n### 方向1：A\n- **视频目的**：流量型\n\n---\n\n### 方向2：B\n- **视频目的**：变现型\n\n### 我推荐先做：方向1「A」\n- 变现型';
    expect(countRoles(text)).toMatchObject({ total: 2, counts: { 流量型: 1, 人设型: 0, 变现型: 1 } });
  });
});

describe('页面接线', () => {
  it('档案表单能设配比；没动过、库里也没有就不发这一栏（迁移没跑时老表单照样能存）', () => {
    const form = readCode('components/profile/ProfileForm.tsx');
    expect(form).toContain('<ContentMixPicker');
    expect(form).toMatch(/if \(mixTouched \|\| hadMix\) extras\.content_mix = mixSetting/);
    expect(form).toMatch(/onSubmit\(\{ \.\.\.formData, \.\.\.extras \}\)/);
  });

  it('档案接口：库里还没有新列时去掉它再存，不让整条保存失败', () => {
    const route = readCode('app/api/profiles/route.ts');
    expect(route).toMatch(/PGRST204/);
    expect(route.match(/await withoutMissingColumns\(/g)?.length).toBe(2); // 新建 + 更新都走它
  });

  it('选题、方向、起号、账号定位、深挖定位、简报都有配比条，并把配比写进提示词', () => {
    const pages: [string, RegExp][] = [
      ['app/dashboard/topic/page.tsx', /mixPromptBlock\(resolvedMix, \{ count: topicCount \}\)/],
      ['app/dashboard/direction/page.tsx', /mixBlock: useMix \? mixPromptBlock\(resolvedMix, \{ count, unit: "个" \}\)/],
      ['app/dashboard/growth/page.tsx', /mixBlock: mixPromptBlock\(resolveMix\(/],
      ['app/dashboard/positioning/page.tsx', /mixBlock: mixPromptBlock\(resolveMix\(/],
      ['components/positioning/DeepDivePage.tsx', /mixBlock: mixPromptBlock\(resolveMix\(/],
      ['app/dashboard/creative-brief/page.tsx', /mixBlock: mixPromptBlock\(resolveMix\(/],
    ];
    for (const [file, re] of pages) {
      const src = readCode(file);
      expect(src, file).toContain('<ContentMixBar');
      expect(src, file).toMatch(re);
    }
  });

  it('选题和方向生成完在结果下面核对条数', () => {
    for (const f of ['app/dashboard/topic/page.tsx', 'app/dashboard/direction/page.tsx']) {
      expect(readCode(f), f).toMatch(/footer=\{mixUsed \? <MixCheckLine/);
    }
    // 选题页原来那句"按上面账号定位里定好的配比分配"不在了
    expect(readCode('app/dashboard/topic/page.tsx')).not.toContain('按上面账号定位里定好的配比分配');
  });

  it('迁移文件加了两列', () => {
    const sql = readSource('supabase/migrations/20261002_content_mix_and_taboos.sql');
    expect(sql).toMatch(/add column if not exists content_mix jsonb/);
    expect(sql).toMatch(/add column if not exists taboo_settings jsonb/);
  });
});
