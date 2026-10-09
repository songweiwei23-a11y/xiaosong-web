import { extractOpening, parseTopicOptions, type HandoffPayload } from './handoff';
import { splitRemixPlans } from './remix-plans';
import { creationReference, continuationRules } from './creation-continuation';
import { cleanTitle, mergeCreationSettings, settingsFromText, creationSettingsBlock, type CreationSettings } from './creation-settings';

export const CREATION_DESTINATIONS = [
  { id: 'breakdown', label: '拆解分析' },
  { id: 'remix', label: '跨行业二创' },
  { id: 'review', label: '审稿优化' },
  { id: 'storyboard', label: '分镜脚本' },
  { id: 'topic', label: '生成选题' },
  { id: 'script', label: '脚本生成' },
  { id: 'title', label: '标题封面' },
  { id: 'growth', label: '开篇钩子' },
  { id: 'free-chat', label: '自由对话' },
  /*
   * 定位类和成交理由（2026-10-02 补）：原来只能从它们出发、不能往里带——
   * 自由对话里聊清楚的账号方向、写好的脚本，没法一键带去做定位或找成交理由。
   * 带进去的内容填进它们的「补充说明 / 店铺特色」，见 incomingNote。
   */
  { id: 'positioning', label: '账号定位' },
  { id: 'content-positioning', label: '内容定位' },
  { id: 'business-positioning', label: '商业定位' },
  { id: 'deal-reason', label: '成交理由' },
  // 创作方向（2026-10-02）：自由对话里聊出来的目的、想法，带过去展开成方向
  { id: 'direction', label: '创作方向' },
  { id: 'creative-brief', label: '创作简报' },
] as const;
export type CreationTarget = typeof CREATION_DESTINATIONS[number]['id'];
/** topicOptions：用户在结果里勾中的几条题目（lib/creation-items），到脚本页成为候选 */
export interface CreationContext { from?: string; title?: string; topic?: string; workId?: string; originContent?: string; settings?: CreationSettings; topicOptions?: string[]; branch?: boolean; partial?: 'title' | 'growth'; }
export const CREATION_SOURCES: Record<string, string> = {
  breakdown: '拆解爆款', remix: '跨行业二创', review: '审稿优化', storyboard: '分镜脚本',
  topic: '选题策划', script: '脚本生成', title: '标题封面', growth: '起号与开篇',
  'free-chat': '高阶自由对话', positioning: '账号定位', 'deal-reason': '成交理由', knowledge: '知识库',
  // 2026-10-02 补：这三个生成完原来是断头路
  'content-positioning': '内容定位', 'business-positioning': '商业定位', 'creative-brief': '创作简报',
  'industry-advice': '行业建议',
  // 素材库里收藏的素材也能拿去继续创作（推荐的下一步按分类给，见 lib/library 的 CATEGORY_NEXT）
  library: '素材库',
  direction: '创作方向',
  // 当月内容规划（2026-10-09）：勾方向 → 去创作方向、选题、脚本
  'content-plan': '内容规划',
};
export const RECOMMENDED_NEXT: Record<string, CreationTarget[]> = {
  breakdown: ['remix', 'topic'], remix: ['review', 'storyboard', 'topic'],
  review: ['storyboard', 'topic', 'script'], storyboard: ['review', 'title'],
  topic: ['script', 'growth'], script: ['review', 'storyboard', 'title'],
  title: ['script', 'review'], growth: ['topic', 'script'], 'free-chat': ['review', 'script'],
  positioning: ['content-positioning', 'topic'], 'content-positioning': ['topic', 'growth'],
  'business-positioning': ['deal-reason', 'topic'], 'creative-brief': ['topic', 'script'],
  'deal-reason': ['topic', 'script'], knowledge: ['topic', 'script'],
  direction: ['topic', 'script', 'growth'],
  'content-plan': ['direction', 'topic', 'script'],
};

/** 定位类、成交理由、创作方向没有正文框，带进来的内容填进「补充说明 / 店铺特色 / 已有的想法」 */
export const NOTE_TARGETS = new Set<string>(['positioning', 'content-positioning', 'business-positioning', 'deal-reason', 'direction', 'creative-brief']);

/**
 * 带进定位类 / 成交理由的那段补充说明。
 * 截断：这几个板块的补充说明会整段进提示词，成交理由那一栏存库时还有 2000 字上限。
 */
export function incomingNote(data: Pick<HandoffPayload, 'from' | 'sourceContent' | 'originContent' | 'settings'>, max = 1800): string {
  const ref = creationReference(data).trim();
  // 表单字段受长度限制，但完整材料与设置由独立上下文传给模型，不能只截根稿前半段。
  const current = data.sourceContent?.trim() || ref;
  const body = current.length > max ? current.slice(0, Math.floor(max / 2)) + '\n……（完整材料随创作上下文带入）\n' + current.slice(-Math.floor(max / 2)) : current;
  return `【来自${data.from || '其他板块'}的内容，请一并纳入分析】\n${body}`;
}

export function creationTitle(body: string): string {
  const heading = body.split('\n').find(line => /^#{1,4}\s+/.test(line));
  return (heading || body.split('\n').find(line => line.trim()) || '已有创作内容')
    .replace(/^#+\s*/, '').replace(/\*\*/g, '').trim().slice(0, 180);
}

/** 明确存在正文栏目时，只让正文进入审稿/分镜输入框，整份方案仍作为参考带入。 */
export function creationScript(source: string, body: string): string {
  // 整批选择必须保留全部方案，不能只提取第一份的口播。
  if (source === 'remix' && splitRemixPlans(body).plans.length > 1) return body;
  // 模型未输出“纯文字文案”栏目时，从明确标出的台词恢复正文。
  // 策略卡、拍摄建议仍保存在 sourceContent 中，不能算作待审口播。
  if (source === 'script' || source === 'storyboard') {
    const speech = body.replace(/\*\*/g, '').split('\n').map(line => line.match(/^\s*(?:[-*>]\s*)?(?:台词(?:外音)?|口播)[：:]\s*(.+)/)?.[1]?.replace(/^["“‘]|["”’]$/g, '').trim()).filter((v): v is string => Boolean(v));
    if (speech.length >= 2 && splitRemixPlans(body).plans.length <= 1) return speech.join('\n');
  }
  const name = source === 'remix' ? /(?:口播全文|完整口播|完整脚本)/ : source === 'review' ? /优化后的完整脚本/ : /(?:纯文字文案|口播全文|完整口播|完整脚本)/;
  if (!name) return body;
  const lines = body.split('\n');
  const start = lines.findIndex(line => /^\s*#{1,4}\s+/.test(line) && name.test(line));
  if (start < 0) return body;
  const level = lines[start].match(/^\s*(#+)/)![1].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const next = lines[i].match(/^\s*(#{1,4})\s+(.*)$/);
    /*
     * 「# 【开场钩子】0-5秒」这类段落标记不算这一节的结尾——线上实测（2026-10-02）模型在
     * 「## 4. 优化后的完整脚本」下面用了一级标题写段落，原来在这里就截断了，
     * 带去分镜的变成整份审稿报告
     */
    if (next && next[1].length <= level && !/^[^\p{L}\p{N}]*【/u.test(next[2])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n').replace(/\n\s*---\s*$/, '').trim() || body;
}

/** 每个目标拿到完整参考正文；方案入口传入的 body 只有该方案。 */
export function buildCreationHandoff(source: string, target: CreationTarget, body: string, context: CreationContext = {}): HandoffPayload {
  const from = context.from || CREATION_SOURCES[source] || '创作结果';
  // 收藏里的标题/开篇仍是局部修改，回到审稿或分镜时携带完整稿。
  if (source === 'library') source = Object.entries(CREATION_SOURCES).find(([, label]) => label === context.from)?.[0] || source;
  if (context.partial && ['library', 'free-chat'].includes(source)) source = context.partial;
  const title = context.title || context.topic || creationTitle(body);
  // 勾选带走的以勾中的为准；选题页整批带走时从正文解析
  const topicOptions = context.topicOptions?.length ? context.topicOptions : source === 'topic' ? parseTopicOptions(body) : [];
  // 单独选择某个方案时，该方案明确标注的类型、结构、目的优先于整批设置。
  // 用户/生成时保存的选择比 AI 成稿标签可靠；无明确选择的字段才由所选条目补齐。
  const settings = mergeCreationSettings(settingsFromText(body), context.settings);
  if (['review', 'script', 'remix'].includes(source)) settings.workingScript = creationScript(source, body);
  /*
   * 去做选题：只有这几个板块带的才是「一条脚本」（选题页据此从脚本取材）。别的板块（创作方向、自由对话的方案……）
   * 设置里可能还挂着之前某一步的旧脚本，带过去会让选题页拿旧脚本当出发点、丢了这次勾的方案（2026-10-05）
   */
  if (target === 'topic') {
    if (source === 'storyboard') settings.workingScript = creationScript(source, body);
    else if (!['review', 'script', 'remix', 'title'].includes(source) && !(source === 'growth' && context.topic)) delete settings.workingScript;
  }
  // 开篇/标题只改局部，继续处理完整稿时保留已经审好的正文。
  let draft = ['growth', 'title'].includes(source) && settings.workingScript ? settings.workingScript : creationScript(source, body);
  if (source === 'growth' && settings.openingLine && !draft.startsWith(settings.openingLine)) {
    const spokenField = /((?:^|\n)[\t ]*(?:[-*>]\s*)?(?:\*\*)?(?:台词|口播)(?:\*\*)?\s*[：:]\s*)[^\n]+/;
    draft = spokenField.test(draft) ? draft.replace(spokenField, (_m, prefix: string) => prefix + '“' + settings.openingLine + '”') : settings.openingLine + '\n' + draft.replace(/^[^\n。！？]*[。！？]\s*/, '');
    settings.workingScript = draft;
  }
  const common: HandoffPayload = { from, target: `/dashboard/${target}`, sourceContent: body, sourceTitle: title, originContent: context.originContent || body, settings, intentUpdatedAt: new Date().toISOString() };
  // 生成选题是一批待选方向；选中单条后再建立作品，避免覆盖当前作品。
  if (target !== 'topic') common.workId = context.workId;
  if (target === 'remix') return { ...common, remixSource: { title, text: body } };
  if (target === 'topic' || target === 'free-chat' || target === 'breakdown' || NOTE_TARGETS.has(target)) return common;
  const topic = cleanTitle(topicOptions[0] || settings.topic || context.topic || title) || title;
  settings.topic = topic;
  if (target === 'script') return { ...common, topic, topicOptions, openingLine: settings.openingLine, openingCards: settings.openingCards, tactic: settings.tactic, note: `【来自${from}的参考内容】\n${creationReference(common)}${creationSettingsBlock(settings)}${continuationRules('script')}` };
  if (target === 'growth') return { ...common, topic, topicOptions, tab: 'opening', currentOpening: extractOpening(creationScript(source, body)) };
  return { ...common, topic, scriptContent: ['review', 'storyboard'].includes(target) ? draft : body };
}
