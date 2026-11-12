import type { CreationContext } from './creation-flow';
import { splitCreationItems } from './creation-items';
import { cleanTitle, mergeCreationSettings, settingsFromText } from './creation-settings';
import { extractOpening } from './handoff';

/** 选择是用户的新指令：只换本条题目/执行稿，保留原来的目的、人群与限制。 */
export function selectedCreationContext(context: CreationContext | undefined, body: string, title: string, topics: string[] = [], partial?: 'title' | 'growth'): CreationContext {
  const settings = mergeCreationSettings(context?.settings);
  const topic = cleanTitle(partial ? context?.topic || settings.topic || title : topics.length === 1 ? topics[0] : title);
  settings.topic = topic;
  if (!partial) {
    settings.focusContent = body;
    settings.direction = settingsFromText(body).direction || (topics.length > 1 ? topics.join('；') : topic);
    delete settings.workingScript;
    delete settings.openingLine;
    delete settings.openingCards;
  } else if (partial === 'growth') settings.openingLine = extractOpening(body);
  const root = context?.originContent || '';
  const rootParts = splitCreationItems(root);
  // 根稿就是整批方案时，其他方案不能作为“原意”再带回来。
  const originContent = rootParts.items.length >= 2 && root.includes(body.trim())
    ? [rootParts.intro, body].filter(Boolean).join('\n\n') : root || body;
  return { ...context, title, topic, topicOptions: partial ? [] : topics, settings, originContent, branch: partial ? context?.branch : true, partial };
}
