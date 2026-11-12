/**
 * 选题页「自定义」点「生成 N 条选题」没反应（线上实测）。
 *
 * 根因：自定义模式没选账号阶段就 return，字段徽章写着「可选」，
 * 只有右上角一句 3 秒提示。快速模式不查这一项，所以同一颗按钮是正常的。
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildTopicBoardQuery, type TopicBoardInput } from '@/lib/boards/topic-query';
import { resolveMix } from '@/lib/content-mix';
import { customTopicFieldMessage, missingCustomTopicFields } from '@/lib/topic-form';
import type { CreatorContext } from '@/lib/creator-context';

const EMPTY_CTX = { profile: null, positioning: null, dealReasons: [] } as unknown as CreatorContext;

function baseInput(over: Partial<TopicBoardInput> = {}): TopicBoardInput {
  return {
    creatorContext: EMPTY_CTX,
    selectedProfile: null,
    positioningForCtx: null,
    topicCount: 10,
    topicType: '选题（流量型、人设型、变现型按配比搭配）',
    topicRole: '按配比',
    mode: 'custom',
    sourceReference: '',
    sourceFrom: '',
    incomingSetup: null,
    keyword1: '',
    keyword2: '',
    keyword3: '',
    personalRequirement: '',
    currentSettings: {},
    accountStage: '',
    fansLevel: '',
    avgViewsInput: '',
    selectedPlatforms: [],
    selectedTracks: [],
    selectedContentTypes: [],
    selectedStyles: [],
    positioningExtra: '',
    selectedElements: [],
    dealReasonLabels: [],
    benchmarkAccounts: '',
    viralCases: '',
    difficulty: '中等创意',
    withHook: true,
    tactic: '',
    route: '两种都出',
    routeExplicit: false,
    resolvedMix: resolveMix(null, null, ''),
    quickTopics: false,
    ...over,
  };
}

describe('自定义选题缺必填项', () => {
  it('没选账号阶段：用中文点名这一项，不给一句笼统的失败', () => {
    const missing = missingCustomTopicFields({ mode: 'custom', accountStage: '' });
    expect(missing.map((field) => field.label)).toEqual(['账号阶段']);
    const message = customTopicFieldMessage(missing);
    expect(message).toBe('请先选择账号阶段，再生成选题');
    expect(message).toContain('账号阶段');
  });

  it('只填了空格也算没选', () => {
    expect(missingCustomTopicFields({ mode: 'custom', accountStage: '   ' })).toHaveLength(1);
  });

  it('选了账号阶段就不再拦截，生成可以开始', () => {
    expect(missingCustomTopicFields({ mode: 'custom', accountStage: '刚起号' })).toEqual([]);
    expect(customTopicFieldMessage([])).toBe('');
  });

  it('快速模式不检查账号阶段', () => {
    expect(missingCustomTopicFields({ mode: 'quick', accountStage: '' })).toEqual([]);
  });

  it('自定义模式填了阶段：提示词拼得出来，不会在发请求前抛错', () => {
    const { query } = buildTopicBoardQuery(baseInput({ accountStage: '刚起号', topicCount: 10 }));
    expect(query).toContain('【模式】🎨 自定义模式（手动填写）');
    expect(query).toContain('账号阶段：刚起号');
    expect(query).toContain('生成10条');
  });
});

describe('选题页把缺字段写在按钮旁边', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/topic/page.tsx'), 'utf8');

  it('缺字段时先提示再 return，不会进入生成；提示留在按钮上方', () => {
    const beforeGenerate = page.slice(page.indexOf('const missing = missingCustomTopicFields'), page.indexOf('setIsGenerating(true)'));
    expect(beforeGenerate).toContain('setFormError(message)');
    expect(beforeGenerate).toContain('return');
    expect(page).toContain('role="alert"');
    expect(page).toContain('{mode === "custom" && formError && (');
    expect(page).toContain('{formError}');
    expect(page.indexOf('role="alert"')).toBeLessThan(page.indexOf('onClick={handleGenerate}'));
  });

  it('账号阶段标成必填，不再写成可选', () => {
    expect(page).toContain('label="账号阶段" required');
    expect(page).not.toContain('label="账号阶段" optional');
    expect(page).not.toContain('notify("请选择账号阶段")');
  });

  it('快速模式的生成按钮和提前返回条件还在，不因这次校验改掉', () => {
    expect(page).toContain('生成 {topicCount} 条选题');
    expect(page).toContain('if (finishing)');
    expect(page).toContain('if (!resultScope)');
    expect(page).toContain('id: "quick"');
  });
});
