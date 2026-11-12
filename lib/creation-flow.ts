import { extractOpening, parseTopicOptions, type HandoffPayload } from './handoff';
import { extractPlainCopy } from './script-copy';
import { isDurationHeaderCell, isShotHeaderCell, isShotNumber, spokenChars } from './storyboard-standards';
import { splitRemixPlans } from './remix-plans';
import { creationReference, continuationRules } from './creation-continuation';
import { cleanTitle, mergeCreationSettings, settingsFromText, creationSettingsBlock, isBatch, type CreationSettings } from './creation-settings';

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
export interface CreationContext { from?: string; title?: string; topic?: string; workId?: string; originContent?: string; settings?: CreationSettings; topicOptions?: string[]; branch?: boolean; partial?: 'title' | 'growth';
  /** 结果里已经拆出了二创结构（拆解报告的模版）：下一步建议据此优先给脚本、选题 */
  structured?: boolean;
  /** 全部二创结构的纯文本（拆解的 5 个方向）：不显示在正文里，「继续创作」和收藏时整份带过去，其他板块才能 1:1 复刻 */
  structure?: string; }
export const CREATION_SOURCES: Record<string, string> = {
  breakdown: '拆解爆款', remix: '跨行业二创', review: '审稿优化', storyboard: '分镜脚本',
  // 体检 P2-1：和侧栏的名字保持一致（侧栏叫「起号」「自由对话」）
  topic: '选题策划', script: '脚本生成', title: '标题封面', growth: '起号',
  'free-chat': '自由对话', positioning: '账号定位', 'deal-reason': '成交理由', knowledge: '知识库',
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
  // 体检 P0-3：定位做完，下一步直接推创作简报（简报是让选题、脚本用上账号信息的那一环，线上只有 10% 的人做到）
  positioning: ['creative-brief', 'content-positioning', 'topic'], 'content-positioning': ['topic', 'growth'],
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

/** 分镜表的「台词/旁白」列。没有纯文字文案时，审稿只能带这些要念的字，不能带整张表。 */
function storyboardSpeechColumn(body: string): string {
  let speech = -1;
  let shot = -1;
  let current: string[] = [];
  let last: string[] = [];
  const flush = () => { if (current.length) last = current; current = []; speech = -1; shot = -1; };
  for (const raw of body.split('\n')) {
    if (!/^\s*\|/.test(raw)) { flush(); continue; }
    const cells = raw.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.replace(/\*\*/g, '').trim());
    if (cells.every(cell => /^:?-{2,}:?$/.test(cell.replace(/\s/g, '')))) continue;
    const speechCol = cells.findIndex(cell => /台词|口播|旁白/.test(cell));
    const shotCol = cells.findIndex(isShotHeaderCell);
    if (shotCol >= 0 && speechCol >= 0 && cells.some(cell => isDurationHeaderCell(cell) || /画面|景别/.test(cell))) {
      flush();
      speech = speechCol;
      shot = shotCol;
      continue;
    }
    if (speech < 0 || shot < 0) continue;
    const number = (cells[shot] ?? '').trim();
    const line = (cells[speech] ?? '').replace(/^["“‘'「]|["”’'」]$/g, '').trim();
    if (!number) {
      if (current.length && spokenChars(line) > 0) current[current.length - 1] += `\n${line}`;
      continue;
    }
    if (!isShotNumber(number)) { flush(); continue; }
    if (spokenChars(line) > 0) current.push(line);
  }
  flush();
  return last.join('\n');
}

/** 「开篇钩子」得是这一行的标题或标签。打法正文里顺口提到，不算这一节。 */
function hookLabel(line: string): string | null {
  const label = line.replace(/\*\*/g, '').trim().replace(/^[^\p{Script=Han}]+/u, '');
  const matched = label.match(/^开篇钩子(?:\s*[（(][^）)]*[）)])?\s*(?:[：:]\s*([\s\S]*))?$/);
  if (!matched) return null;
  return (matched[1] || '').trim();
}

function cleanHookText(raw: string): string {
  let line = raw.replace(/\*\*/g, '').trim();
  line = line.replace(/^(?:[-*•]\s*)?(?:文案|台词|口播|开场台词|开头一句)\s*[：:]\s*/, '').trim();
  line = line.replace(/^["“‘'「]+|["”’'」]+$/g, '').trim();
  return line;
}

/**
 * 选题里能念的开头只在「开篇钩子」那一节。
 * 第一节通常是「承接」，拿它预填会把参考句当成要改的口播。这一节没有，或只带了题目，就留空。
 * 标签和要念的字可以写在同一行。
 */
function topicHookLine(body: string): string {
  const lines = body.split('\n');
  let start = -1;
  let inline = '';
  for (let i = 0; i < lines.length; i++) {
    const found = hookLabel(lines[i]);
    if (found !== null) { start = i; inline = found; break; }
  }
  if (start < 0) return '';
  const chunk: string[] = [];
  if (inline) chunk.push(inline);
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#{1,4}\s+/.test(line) || hookLabel(line) !== null) break;
    const label = line.replace(/\*\*/g, '').trim().replace(/^[^\p{Script=Han}]+/u, '');
    if (/^(?:承接|视频目的|视频任务|打法|爆款元素|内容方向|脚本结构)/.test(label)) break;
    chunk.push(line);
  }
  const text = chunk.join('\n').trim();
  if (!text || /用户本次不需要/.test(text)) return '';
  const line = text.split('\n').map(cleanHookText).find(item => item && !/^(?:承接|视频目的|打法|开篇钩子)/.test(item)) || '';
  if (!line || /^(?:承接|视频目的|打法)/.test(line)) return '';
  return line.slice(0, 120);
}

/**
 * 继续创作：收藏、推荐、带去其他板块用画面上的正文。
 * 只有去审稿、起标题时，输入框另用口播（分镜页传进来的脚本）。
 */
export function creationLinkPieces(body: string, spokenBody: string | undefined, target: CreationTarget): { material: string; handoffBody: string; scriptContent?: string } {
  const spoken = spokenBody?.trim() || '';
  if (spoken && target === 'title') return { material: body, handoffBody: spoken };
  if (spoken && target === 'review') return { material: body, handoffBody: body, scriptContent: spoken };
  return { material: body, handoffBody: body };
}

/** 收藏和「建议的下一步」用的正文。口播只影响审稿和标题的输入框。 */
export function creationLinkMaterial(body: string, spokenBody?: string): string {
  return creationLinkPieces(body, spokenBody, 'free-chat').material;
}

export function handoffFromCreationLinks(source: string, target: CreationTarget, body: string, context: CreationContext = {}, spokenBody?: string): HandoffPayload {
  const pieces = creationLinkPieces(body, spokenBody, target);
  const payload = buildCreationHandoff(source, target, pieces.handoffBody, context);
  if (pieces.scriptContent) {
    payload.scriptContent = pieces.scriptContent;
    payload.settings = { ...(payload.settings || {}), workingScript: pieces.scriptContent };
  }
  return payload;
}

/** 明确存在正文栏目时，只让正文进入审稿/分镜输入框，整份方案仍作为参考带入。 */
export function creationScript(source: string, body: string): string {
  // 整批选择必须保留全部方案，不能只提取第一份的口播。
  if (source === 'remix' && splitRemixPlans(body).plans.length > 1) return body;
  // 纯文字文案优先。行首「台词：」只在没有这一节时兜底，不能压过完整口播。
  // 分镜表没有这两种标记时，只取台词列，不把镜号和景别送去审稿。
  if (source === 'script' || source === 'storyboard') {
    const plain = extractPlainCopy(body);
    if (plain) return plain;
    const speech = body.replace(/\*\*/g, '').split('\n').map(line => line.match(/^\s*(?:[-*>]\s*)?(?:台词(?:外音)?|口播)[：:]\s*(.+)/)?.[1]?.replace(/^["“‘]|["”’]$/g, '').trim()).filter((v): v is string => Boolean(v));
    if (speech.length >= 2 && splitRemixPlans(body).plans.length <= 1) return speech.join('\n');
    if (source === 'storyboard') {
      const column = storyboardSpeechColumn(body);
      if (column) return column;
    }
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
  // 素材库带出去的来源写作「素材库·选题策划」：去掉前缀再认，原来带前缀认不出，选题、脚本都当成普通内容带（2026-11-08）
  const fromLibrary = source === 'library';
  if (fromLibrary) {
    const label = (context.from || '').replace(/^素材库[·・]/, '');
    source = Object.entries(CREATION_SOURCES).find(([, l]) => l === label)?.[0] || (label === '起号方案' || label === '开篇钩子' ? 'growth' : source);
  }
  if (context.partial && (fromLibrary || source === 'free-chat')) source = context.partial;
  const title = context.title || context.topic || creationTitle(body);
  // 勾选带走的以勾中的为准；选题页整批带走时从正文解析
  const topicOptions = context.topicOptions?.length ? context.topicOptions : source === 'topic' ? parseTopicOptions(body) : [];
  // 单独选择某个方案时，该方案明确标注的类型、结构、目的优先于整批设置。
  // 用户/生成时保存的选择比 AI 成稿标签可靠；无明确选择的字段才由所选条目补齐。
  /*
   * 正文里的标签不一定是用户的设置：整批读到的是第 1 条的「视频目的」「内容方向」；
   * 拆解报告里的标签描述的是别人的原片（2026-10-11：拆解的「视频目的」被当成二创的目的）。
   * 这两种情况只用调用方明确给的设置。
   */
  const settings = mergeCreationSettings(isBatch(body) || source === 'breakdown' ? {} : settingsFromText(body), context.settings);
  if (['review', 'script', 'remix'].includes(source)) settings.workingScript = creationScript(source, body);
  /*
   * 去任何板块：只有这几个板块带的才是「一条脚本」。别的板块（创作方向、自由对话的方案……）设置里可能还挂着之前某一步的旧脚本，
   * 带过去会拿旧脚本当出发点、丢了这次勾的方案。选题页原来才这样处理（2026-10-05）；2026-10-17 链路验证发现脚本页也会带过去，
   * 所以所有目标板块都一样处理。
   */
  // 开篇、标题只改局部：续接完整稿时要保留已经审好的正文（growth/title 在列表里），所以只清掉不产出脚本的来源
  const producesScript = ['review', 'script', 'remix', 'title', 'growth'].includes(source);
  if (source === 'storyboard') settings.workingScript = creationScript(source, body);
  else if (!producesScript || (target === 'topic' && source === 'growth' && !context.topic)) delete settings.workingScript;
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
  if (target === 'growth') return { ...common, topic, topicOptions, tab: 'opening', currentOpening: source === 'topic' ? topicHookLine(body) : extractOpening(creationScript(source, body)) };
  return { ...common, topic, scriptContent: ['review', 'storyboard'].includes(target) ? draft : body };
}
