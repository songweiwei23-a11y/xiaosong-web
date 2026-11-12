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
import { PROFILE_CHOICES } from '@/lib/profile-fields';
import {
  TOPIC_ACCOUNT_STAGE_OPTIONS,
  customTopicFieldMessage,
  decideTopicAccountStage,
  handoffOwnsProfile,
  missingCustomTopicFields,
  prefillTopicAccountStage,
  topicAccountStageOptions,
} from '@/lib/topic-form';
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

describe('自定义账号阶段用档案原文预填', () => {
  const fresh = { current: '', settledProfileId: null as string | null, userEdited: false, loading: false, handoffForProfile: false };

  it('档案表单的四句和下拉的四项对不上，不把一句猜成另一项', () => {
    for (const stage of PROFILE_CHOICES.account_stage) {
      expect(TOPIC_ACCOUNT_STAGE_OPTIONS).not.toContain(stage);
      expect(prefillTopicAccountStage(stage)).toBe(stage);
      expect(topicAccountStageOptions(stage)).toEqual([...TOPIC_ACCOUNT_STAGE_OPTIONS, stage]);
    }
  });

  it('原文正好是下拉里的一项：选中它，不另加一行', () => {
    expect(prefillTopicAccountStage('刚起号')).toBe('刚起号');
    expect(topicAccountStageOptions('刚起号')).toEqual([...TOPIC_ACCOUNT_STAGE_OPTIONS]);
  });

  it('旧数据「起号期」原样保留，不改成「刚起号」', () => {
    expect(prefillTopicAccountStage('起号期')).toBe('起号期');
    expect(topicAccountStageOptions('起号期')).toContain('起号期');
    expect(topicAccountStageOptions('起号期')).toContain('刚起号');
  });

  it('没填、空白、不是字符串：不预填，必填提示照旧', () => {
    for (const empty of ['', '  ', null, undefined, 3]) {
      expect(prefillTopicAccountStage(empty)).toBe('');
      expect(missingCustomTopicFields({ mode: 'custom', accountStage: prefillTopicAccountStage(empty) })).toHaveLength(1);
    }
    expect(topicAccountStageOptions('')).toEqual([...TOPIC_ACCOUNT_STAGE_OPTIONS]);
  });

  it('档案还在加载时不预填', () => {
    const decision = decideTopicAccountStage({ ...fresh, loading: true, profileId: 'p1', profileStage: '有定位，需要内容方向' });
    expect(decision.value).toBeNull();
    expect(decision.settledProfileId).toBeNull();
  });

  it('档案还没到时用户已经手选：加载完不覆盖', () => {
    const decision = decideTopicAccountStage({
      ...fresh,
      profileId: 'p1',
      profileStage: '稳定运营，需要新选题',
      current: '有基础',
      settledProfileId: null,
      userEdited: true,
    });
    expect(decision.value).toBeNull();
    expect(decision.userEdited).toBe(true);
  });

  it('加载完成且用户还没选：写成档案原文', () => {
    const decision = decideTopicAccountStage({ ...fresh, profileId: 'p1', profileStage: '稳定运营，需要新选题' });
    expect(decision).toMatchObject({ value: '稳定运营，需要新选题', settledProfileId: 'p1', userEdited: false });
  });

  it('同一个档案上用户改过之后，不再覆盖', () => {
    const decision = decideTopicAccountStage({
      ...fresh,
      profileId: 'p1',
      profileStage: '稳定运营，需要新选题',
      current: '刚起号',
      settledProfileId: 'p1',
      userEdited: true,
    });
    expect(decision.value).toBeNull();
    expect(decision.userEdited).toBe(true);
  });

  it('换了档案：按新档案重填，旧的手选不带过去', () => {
    const decision = decideTopicAccountStage({
      ...fresh,
      profileId: 'p2',
      profileStage: '成熟期，需要突破',
      current: '刚起号',
      settledProfileId: 'p1',
      userEdited: true,
    });
    expect(decision).toMatchObject({ value: '成熟期，需要突破', settledProfileId: 'p2', userEdited: false });
  });

  it('新档案没填阶段：下拉清空，仍然要提示必填', () => {
    const decision = decideTopicAccountStage({
      ...fresh,
      profileId: 'p2',
      profileStage: '',
      current: '刚起号',
      settledProfileId: 'p1',
      userEdited: false,
    });
    expect(decision.value).toBe('');
    expect(missingCustomTopicFields({ mode: 'custom', accountStage: decision.value ?? '' })).toHaveLength(1);
  });

  it('从别的板块承接、而且就是当前档案：不盖掉承接写上的阶段', () => {
    expect(handoffOwnsProfile({ profileId: 'p1' }, 'p1')).toBe(true);
    expect(handoffOwnsProfile({ profileId: 'p1' }, 'p2')).toBe(false);
    expect(handoffOwnsProfile(null, 'p1')).toBe(false);
    const decision = decideTopicAccountStage({
      ...fresh,
      handoffForProfile: true,
      profileId: 'p1',
      profileStage: '刚起号，定位未确定',
      current: '有定位，需要内容方向',
    });
    expect(decision.value).toBeNull();
    expect(decision.settledProfileId).toBe('p1');
  });

  it('承接的是上一个档案，切到新档案后按新档案预填', () => {
    const decision = decideTopicAccountStage({
      ...fresh,
      handoffForProfile: false,
      profileId: 'p2',
      profileStage: '刚起号，定位未确定',
      current: '有定位，需要内容方向',
      settledProfileId: 'p1',
      userEdited: false,
    });
    expect(decision.value).toBe('刚起号，定位未确定');
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
    expect(page).toContain('mode === "quick" && !stageTouchedForQuick');
  });

  it('下拉用档案原文预填，用户改过才记成手选', () => {
    expect(page).toContain('decideTopicAccountStage({');
    expect(page).toContain('topicAccountStageOptions(');
    expect(page).toContain('setStageMeta({ profileId: creatorContext.profile?.id ?? \'\', edited: true })');
  });
});
