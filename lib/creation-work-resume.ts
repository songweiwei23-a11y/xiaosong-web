import type { WorkDetail, WorkItem } from './resume';
import { buildCreationHandoff, creationScript, CREATION_SOURCES, type CreationTarget } from './creation-flow';
import { mergeCreationSettings, settingsFromInput, settingsFromText } from './creation-settings';
import { extractOpening, type HandoffPayload } from './handoff';
import { extractPlainCopy } from './script-copy';
import { isDurationHeaderCell, isShotHeaderCell } from './storyboard-standards';

const SOURCES: Record<string, string> = {
  '选题策划': 'topic', '开篇钩子': 'growth', '脚本生成': 'script',
  '审稿优化': 'review', '分镜脚本': 'storyboard', '标题封面': 'title',
};

function isStoryboardTable(text: string): boolean {
  return text.split('\n').some((line) => {
    if (!/^\s*\|/.test(line)) return false;
    const cells = line.split('|').map((cell) => cell.trim());
    return cells.some(isShotHeaderCell) && cells.some(isDurationHeaderCell);
  });
}

/**
 * 分镜、审稿的输入框要口播，不要分镜表，也不要整份审稿报告。
 * 从新到旧找：最新的审稿、分镜生成时输入框里的稿、脚本正文。分镜表本身跳过。
 */
function spokenForResume(item: WorkItem): string {
  if (item.task_type === '审稿优化') {
    const section = creationScript('review', item.result).trim();
    if (section && section !== item.result.trim()) return section;
    return extractPlainCopy(item.result);
  }
  if (item.task_type === '分镜脚本') {
    const saved = typeof item.input_data?.scriptContent === 'string' ? item.input_data.scriptContent.trim() : '';
    return saved && !isStoryboardTable(saved) ? saved : '';
  }
  if (item.task_type === '脚本生成') return (extractPlainCopy(item.result) || creationScript('script', item.result)).trim();
  return '';
}

function latestSpokenScript(items: WorkItem[] | undefined): string {
  const sorted = [...(items || [])].filter(item => item.result?.trim()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const item of sorted) {
    const spoken = spokenForResume(item);
    if (spoken) return spoken;
  }
  return '';
}

/**
 * 作品链接没有一次性交接数据，也必须恢复整条创作链的选择。
 *
 * 2026-10-04：先铺作品需求（works.creation_brief，每次跨板块跳转时服务端合并保存的目的、人群、结构、锁定原文、源资料），
 * 再按时间叠上每一版生成时实际用的设置——最新采用的稿子和设置为准；源资料以作品需求里最初那份为准，不被后来的短结果替换。
 */
export function workCreationHandoff(work: WorkDetail, target: CreationTarget): HandoffPayload {
  const items = [...(work.items || [])].filter(item => item.result).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const brief = work.creation_brief && typeof work.creation_brief === 'object' ? work.creation_brief : {};
  let settings = mergeCreationSettings({ topic: work.title }, brief.settings);
  let originContent = typeof brief.originContent === 'string' ? brief.originContent : '';
  for (const item of items) {
    const input = item.input_data || {};
    // 用户这次跳转的设置不能被跳转前生成的旧记录覆盖；之后的新版本仍可修改设置。
    const older = typeof brief.intentUpdatedAt === 'string' && Date.parse(item.created_at) < Date.parse(brief.intentUpdatedAt);
    settings = older ? mergeCreationSettings(settingsFromText(item.result), settingsFromInput(input), settings) : mergeCreationSettings(settingsFromText(item.result), settings, settingsFromInput(input));
    if (!originContent && typeof input.originContent === 'string' && input.originContent.trim()) originContent = input.originContent;
    if (['脚本生成', '审稿优化'].includes(item.task_type) && !(older && mergeCreationSettings(brief.settings).workingScript)) settings.workingScript = creationScript(SOURCES[item.task_type], item.result);
  }
  const latest = items.at(-1);
  // 还没在任何板块生成过（刚从别处带过来就刷新了）：用作品需求里带过来的内容，而不是只剩一个标题
  const briefBody = typeof brief.sourceContent === 'string' && brief.sourceContent.trim() ? brief.sourceContent : '';
  const preferBrief = Boolean(briefBody && latest && typeof brief.intentUpdatedAt === 'string' && Date.parse(latest.created_at) < Date.parse(brief.intentUpdatedAt));
  const body = preferBrief ? briefBody : latest?.result || briefBody || work.title;
  // 作品需求里那份内容是哪个板块产出的：按来源名（「审稿优化」→ review）反查，正文提取规则跟着板块走
  const briefSource = typeof brief.from === 'string' ? Object.entries(CREATION_SOURCES).find(([, label]) => label === brief.from)?.[0] ?? '' : '';
  const payload = buildCreationHandoff((preferBrief ? briefSource : SOURCES[latest?.task_type || ''] || (latest ? 'script' : briefSource)) || 'script', target, body, {
    from: '创作进度', title: work.title, topic: work.title, workId: work.id,
    originContent: originContent || items[0]?.result || work.title, settings,
  });
  payload.profileId = work.profile_id;
  payload.topic = settings.topic || work.title;
  // 刚跳过来的作品需求比旧生成新：用跳转时带的正文。否则最新口播盖过分镜表。
  const spoken = preferBrief ? '' : latestSpokenScript(items);
  if (spoken && ['review', 'storyboard'].includes(target)) {
    payload.scriptContent = spoken;
    payload.settings = { ...(payload.settings || {}), workingScript: spoken };
  } else if (settings.workingScript && ['review', 'storyboard'].includes(target)) payload.scriptContent = settings.workingScript;
  if (target === 'growth' && settings.workingScript) payload.currentOpening = settings.openingLine || extractOpening(settings.workingScript);
  return payload;
}
