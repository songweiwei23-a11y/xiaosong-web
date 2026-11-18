import { describe, expect, it } from 'vitest';
import { buildContentPlanPrompt, checkPlan } from '@/lib/content-plan';
import { resolveMix } from '@/lib/content-mix';
import { buildDirectionPrompt } from '@/lib/direction';
import { anchorDirectionDraft, directionAnglesPrompt, directionTopicContext, DIRECTION_TOPIC_DELIVERY, planDirectionTopics, type DirectionTopicContext } from '@/lib/direction-topic-plan';
import { finalizeTopicBatch, topicRefillPrompt } from '@/lib/topic-delivery';
import { readAssistantConfig } from '@/lib/assistant/config';
import { splitTopicSections } from '@/lib/topic-library';
import { askDify } from '@/lib/dify-task';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildTitlePrompt } from '@/lib/title-standards';

const fixture = '虚构档案，手工装订维修工作室。只有一位店主、一部手机，在店内拍。可拍素材只有线装样册、修复前后的两本旧书、用尺测裂口、翻看装订步骤卡、店主讲一次实际修复经历、用计时器记录穿线。每一种观察的结果由现场确认。没有真实价格、地区对照、人群数据或客户评价。';
const cases = [
  { round: 1, count: 4, goal: '让附近第一次想修书的人知道送修前怎么检查' },
  { round: 2, count: 5, goal: '让手作爱好者看懂线装为什么容易松' },
  { round: 3, count: 6, goal: '让新客看懂店主如何判断能否修复' },
];
const topics = new Map<number, ReturnType<typeof splitTopicSections>>();
const syntheticUser = 'kaiwu-synthetic-acceptance-20261118';

async function readSyntheticTopics() {
  const base = (process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1').replace(/\/$/, '');
  const list = async (route: string, params: Record<string, string>) => {
    const response = await fetch(base + route + '?' + new URLSearchParams({ user: syntheticUser, ...params }), {
      headers: { Authorization: 'Bearer ' + process.env.DIFY_API_KEY }, signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error('测试会话读取失败');
    return (await response.json()).data;
  };
  const rows: Array<{ id: string }> = await list('/conversations', { limit: '12' });
  for (const { id } of rows) {
    const messages: Array<{ query: string; answer: string }> = await list('/messages', { conversation_id: id, limit: '2' });
    const draft = messages.find(m => m.query?.includes('本轮选题从这个地基展开') && m.answer?.includes('## 选题'))?.answer;
    if (!draft) continue;
    const context = directionTopicContext('从实际修复步骤中找新手送修前可以自行判断的小问题', undefined, fixture);
    const result = await finalizeTopicBatch(draft, [], 5, async () => '', { directionSeed: true, topicContext: context });
    if (result.count) return splitTopicSections(result.text);
  }
  return [];
}

async function generate(board: string, round: number, prompt: string, timeout = 95_000) {
  const start = performance.now();
  const result = await askDify(prompt, syntheticUser, '', { signal: AbortSignal.timeout(timeout) }).catch(error => {
    console.info('KAIWU_ACCEPTANCE', JSON.stringify({ board, round, ms: Math.round(performance.now() - start), complete: false, failure: error instanceof Error ? error.name : 'unknown' }));
    throw error;
  });
  console.info('KAIWU_ACCEPTANCE', JSON.stringify({ board, round, ms: Math.round(performance.now() - start), complete: result.ok }));
  if (!result.ok) throw new Error(board + '未取得完整正文');
  return result.text;
}

async function verifyDelivery(draft: string, context: DirectionTopicContext, round: number) {
  const result = await finalizeTopicBatch(draft, [], 5, async refill => {
    const angles = await planDirectionTopics(context, refill.count, refill.avoid, undefined, refill.preferredElements);
    const prompt = [directionAnglesPrompt(context, angles, refill.count), topicRefillPrompt(refill, true), DIRECTION_TOPIC_DELIVERY].join('\n\n');
    const extra = await generate('补题', round, prompt, 150_000);
    return anchorDirectionDraft(extra, angles);
  }, { directionSeed: true, topicContext: context });
  console.info('KAIWU_ACCEPTANCE', JSON.stringify({ board: '选题最终交付', round, raw: splitTopicSections(draft).length, accepted: result.count, checked: result.checked }));
  expect(result).toMatchObject({ requested: 5, count: 5, checked: true });
  expect(splitTopicSections(result.text)).toHaveLength(5);
  return splitTopicSections(result.text);
}

describe.skipIf(!process.env.DIFY_API_KEY)('真实 Dify 后台验收，使用虚构档案', () => {
  it.each(cases)('内容规划第 $round 轮', async ({ count, goal, round }) => {
    const resolved = resolveMix(null, null, goal);
    const prompt = buildContentPlanPrompt({
      lastMonth: '', recordedLastMonth: null, count, focus: [], events: '', notes: goal, resolved, profileSummary: fixture,
    });
    const check = checkPlan(await generate('内容规划', round, prompt), resolved, count);
    console.info('KAIWU_ACCEPTANCE', JSON.stringify({ board: '内容规划', round, expected: count, actual: check.sum, mix: check.ok }));
    expect(check.ok).toBe(true);
  });

  it.skipIf(!readAssistantConfig()).each(cases)('创作方向及选题第 $round 轮', async ({ goal, round }) => {
    const direction = await generate('创作方向', round, buildDirectionPrompt({
      purposes: ['trust'], customGoal: goal, formats: ['any'], count: 2, depth: 'quick', profileSummary: fixture,
    }));
    const directions = [...direction.matchAll(/^#{2,4}\s*方向\s*\d+/gm)];
    console.info('KAIWU_ACCEPTANCE', JSON.stringify({ board: '创作方向', round, expected: 2, actual: directions.length }));
    const context = directionTopicContext(direction.slice(0, 1800), undefined, fixture + '\n' + goal);
    expect(context).not.toBeNull();
    const angles = await planDirectionTopics(context!, 7, []);
    const draft = await generate('选题草稿', round, directionAnglesPrompt(context!, angles, 7, 5) + '\n\n' + DIRECTION_TOPIC_DELIVERY);
    expect(directions.length).toBe(2);
    topics.set(round, await verifyDelivery(anchorDirectionDraft(draft, angles), context!, round));
  }, 750_000);

  it('将同一个选题用于脚本、标题和分镜', async () => {
    const available = [...topics.values()].flat();
    const topic = available[0] ?? (process.env.KAIWU_QA_REUSE_DIFY_TOPICS === '1' ? (await readSyntheticTopics())[0] : undefined);
    if (!topic) throw new Error('没有可用于承接的选题');
    const source = topic.title + '\n' + topic.body;
    const script = await generate('脚本承接', 1, '按这条选题写 30 秒、能用手机拍的短视频脚本。保留原选题的证据与动作，勿添加新事实。\n' + fixture + '\n' + source, 135_000);
    const [title, storyboard] = await Promise.all([generate('标题承接', 1, buildTitlePrompt({
      topic: source, contextBlock: fixture, platform: '抖音', targetAudience: '想修旧书的本地读者', count: 3,
      titleTypeLabel: '实用型', titleFormulaValue: 'auto', titleFormulaLabel: '按内容选',
      keywordStrategyLabel: '常用词', keywordStrategyDesc: '保持选题事实和受众用词',
    }), 135_000), generate('分镜承接', 1, buildStoryboardPrompt({
      scriptContent: script, platform: '抖音', duration: '30秒', contentType: 'tutorial', visualStyle: 'realistic',
      visualStyleLabel: '实拍', additionalInfo: '一人、一部手机、在店里拍，镜头不能增加新素材。', contextBlock: fixture,
    }), 135_000)]);
    for (const text of [script, title, storyboard]) expect(text).toMatch(/书|装订|装线|修复/);
  }, 370_000);

  it.skipIf(process.env.KAIWU_QA_RETRY_TOPIC !== '1')('单独复测选题上游长流传输', async () => {
    const context = directionTopicContext('从店主实际修复步骤中找新手送修前能自行判断的小问题', undefined, fixture)!;
    const draft = await generate('选题长流复测', 1, directionAnglesPrompt(context, [], 5, 5) + '\n\n' + DIRECTION_TOPIC_DELIVERY, 195_000);
    expect(splitTopicSections(draft).length).toBeGreaterThanOrEqual(5);
  }, 215_000);
});
