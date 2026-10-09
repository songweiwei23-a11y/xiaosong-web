import { describe, expect, it } from 'vitest';
import { buildReviewPrompt, reviewDimensionLabels, AMBIGUOUS_REVIEW_DURATION } from '@/lib/review-standards';
import { reviewDraftStats, resultStats, spokenText } from '@/lib/script-result-utils';
import { buildSearchQuery } from '@/lib/search-query';
import { ISOLATED_TASKS } from '@/lib/topic-library';
import { buildAdaptiveScriptPrompt } from '@/lib/script-design';
import { reviewSource, combinedReviewUsage, reconcileReviewSpeechStats } from '@/lib/review-verification';

describe('真实审稿回归：纯文字素材、完整要求与当前会话', () => {
  it('识别实际有歧义的时长写法，已明确的时长不阻挡', () => {
    expect(AMBIGUOUS_REVIEW_DURATION.test('时长1-30秒')).toBe(true);
    for (const value of ['30秒以内', '1分30秒', '90秒', '11-30秒']) expect(AMBIGUOUS_REVIEW_DURATION.test(value)).toBe(false);
  });
  it('旧页面的完整审稿提示词也能提取原稿，不混入评分与背景', () => {
    expect(reviewSource({query:'## 账号背景\n编导\n## 📄 待审稿件\n她在揉面。\n---\n手上全是白。\n## 📌 稿件背景\n抖音'})).toBe('她在揉面。\n---\n手上全是白。');
    expect(reviewSource({query:'没有原稿'})).toBe('');
  });
  it('两次模型调用合并用量，不把用户成功次数增加为两次', () => {
    expect(combinedReviewUsage({prompt_tokens:100,completion_tokens:20,total_tokens:120},{prompt_tokens:50,completion_tokens:10,total_tokens:60})).toMatchObject({prompt_tokens:150,completion_tokens:30,total_tokens:180});
  });
  it('按实际纯文案纠正交付统计，原稿引用中的数字不被改写', () => {
    const corrected = reconcileReviewSpeechStats('原稿引用：约360字\n时长说明：约360字，口播72秒\n### 纯文字文案\n' + '一'.repeat(100) + '\n---\n- 时长1分30秒：约72秒台词，需补实拍素材');
    expect(corrected).toContain('原稿引用：约360字');
    expect(corrected).toContain('口播估算：100字，按5字/秒朗读约20秒');
    expect(corrected).toContain('约20秒台词');
  });
  it.each(['**估算时长**: 约270字，约54秒', '**字数统计**: 约100字，约20秒'])('真实模型统计行 %s 也使用实际台词计数', line => {
    const corrected = reconcileReviewSpeechStats(line + '\n### 纯文字文案\n' + '一'.repeat(105) + '\n---\n总评');
    expect(corrected).toContain('口播估算：105字，按5字/秒朗读约21秒');
    expect(corrected).not.toContain(line);
  });
  const draft = '扫帚划过地面。\n---\n她在揉面，手上全是白。\n我问她几点来的。她说两点半。';
  it('未标口播的文字原稿有朗读估算，含拍摄表的材料则报告未知', () => {
    expect(reviewDraftStats(draft).chars).toBeGreaterThan(20);
    expect(reviewDraftStats(draft).seconds).toBeGreaterThan(0);
    expect(reviewDraftStats('## 分镜表\n|画面|时长|\n|扫地|10秒|').chars).toBe(0);
    const prompt = buildReviewPrompt({ draftContent: draft, platform: '抖音', duration: 'AI推荐', scriptType: '晒过程型', reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: true, severityLabels: true });
    expect(prompt).toContain('原稿纯文本估算');
    expect(prompt).not.toContain('可识别口播：0 字');
  });
  it('口播后的补充总评不会被计入口播时长，兼容纯文案标题', () => {
    const result = '### 纯文案\n她在揉面。\n---\n总评补充说明：' + '分析文字'.repeat(100);
    expect(spokenText(result)).toBe('她在揉面。');
    expect(resultStats(result).spokenChars).toBe(4);
  });
  it('页面点击保存的标签和旧编号都能成为真实审稿要求', () => {
    const options = [{ id: 'logic', label: '逻辑是否清晰' }, { id: 'transition', label: '过渡是否自然' }];
    expect(reviewDimensionLabels(['逻辑是否清晰', '过渡是否自然'], options)).toBe('逻辑是否清晰、过渡是否自然');
    expect(reviewDimensionLabels(['logic', 'transition'], options)).toBe('逻辑是否清晰、过渡是否自然');
  });
  it('检索短句带当前选题与要求，排除长原稿', () => {
    const q = buildSearchQuery('审稿优化', { platform: '抖音', reviewFocus: '凌晨4点的南乐，观察记录，口语化，拍起来简单。' + '补充要求'.repeat(20), draftContent: draft.repeat(30) }, '完整指令');
    expect(q).toContain('凌晨4点的南乐');
    expect(q).not.toContain('扫帚');
    expect(q.length).toBeLessThanOrEqual(200);
  });
  it.each(['审稿优化', '脚本生成', '标题封面', '分镜脚本', '开篇钩子'])('%s 不读取跨板块共用 Dify 会话', task => {
    expect(ISOLATED_TASKS.has(task)).toBe(true);
  });
  it('自由对话保留其自己的连续会话', () => {
    expect(ISOLATED_TASKS.has('自由对话')).toBe(false);
  });
  it('手选脚本方法和表达重点在适配分支中得到完整传递', () => {
    const prompt = buildAdaptiveScriptPrompt({ topic: '县城凌晨', platform: '抖音', duration: '90秒', context: '', source: '她在揉面。', requirements: '', settings: {}, scriptTypeGuide: '晒过程：交代目标→记录行动→展示发现', craftFocus: '声音细节与自然转场' });
    expect(prompt).toContain('晒过程：交代目标→记录行动→展示发现');
    expect(prompt).toContain('声音细节与自然转场');
  });
});
