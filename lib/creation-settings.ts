import type { CreatorContext } from './creator-context';
import type { HandoffPayload } from './handoff';
import { OPENING_CARDS } from './opening-cards';
import { SCRIPT_TYPES, SCRIPT_STRUCTURES, HOOK_TYPES } from '@/app/dashboard/script/constants';
import { DEAL_REASONS } from './deal-reasons';

/** 一条创作链的设置。页面字段可以不同，但意图、人群和结构只有一份。 */
export interface CreationSettings {
  topic?: string; direction?: string; audience?: string; industry?: string;
  platform?: string; duration?: string; scriptType?: string; structure?: string;
  purpose?: '流量型' | '人设型' | '变现型'; style?: string; tactic?: string;
  openingLine?: string; openingCards?: string[]; hookType?: string;
  elements?: string[]; dealReasons?: string[]; notes?: string;
  scene?: string; device?: string; budget?: string; personnel?: string;
  contentType?: string; visualStyle?: string;
  titleType?: string; titleFormula?: string; keywordStrategy?: string;
  topicCount?: number; titleCount?: number;
  workingScript?: string;
}

const STRING_FIELDS = ['topic', 'direction', 'audience', 'industry', 'platform', 'duration', 'scriptType', 'structure', 'style', 'tactic', 'openingLine', 'hookType', 'notes', 'scene', 'device', 'budget', 'personnel', 'contentType', 'visualStyle', 'titleType', 'titleFormula', 'keywordStrategy', 'workingScript'] as const;
const ARRAY_FIELDS = ['openingCards', 'elements', 'dealReasons'] as const;
const PLATFORMS = ['抖音', '小红书', '视频号', 'B站', '快手'];
export const SCRIPT_TYPE_LABELS: Record<string, string> = Object.fromEntries(Object.entries(SCRIPT_TYPES).map(([id, value]) => [id, value.label]));
export const REVIEW_SCRIPT_TYPES: Record<string, string> = { teach: '教知识型', show: '晒过程型', discuss: '聊观点型', story: '讲故事型', ad_lead: '教知识型', ad_group: '测评型', ad_offline: '探店型', ad_product: '测评型' };
export function scriptTypeForLabel(label: string): string | undefined {
  return ({ '测评型': 'show', '探店型': 'show', '剧情型': 'story', '混剪型': 'show', '口播型': 'discuss' } as Record<string, string>)[label] || Object.keys(REVIEW_SCRIPT_TYPES).find(k => !k.startsWith('ad_') && REVIEW_SCRIPT_TYPES[k] === label);
}

const SCRIPT_REASONS: Record<string, string> = { price: '性价比', quality: '质量好', unique: '有特色', expert: '专业强', service: '服务好', trust: '好评多', convenient: '便利性', result: '效果好', safe: '安全放心', time: '节省时间', custom: '定制化', gift: '赠品福利', guarantee: '效果保证', scarcity: '稀缺唯一', social: '社交认同' };
export function normalizeCreationReasons(values: string[]): string[] {
  return [...new Set(values.map(v => DEAL_REASONS.find(r => r.id === v || r.label === v)?.label || SCRIPT_REASONS[v] || v).filter(Boolean))];
}
export function scriptReasonIds(values: string[]): string[] {
  return normalizeCreationReasons(values).map(v => Object.keys(SCRIPT_REASONS).find(k => SCRIPT_REASONS[k] === v)).filter((v): v is string => Boolean(v));
}
export function topicReasonIds(values: string[]): string[] {
  return normalizeCreationReasons(values).map(v => DEAL_REASONS.find(r => r.label === v)?.id).filter((v): v is string => Boolean(v));
}

/**
 * 旧版本"猜不到就填"的占位话。2026-10-03 起不再生成，但历史记录里存着——
 * 带着它们跳转，下一个板块会把"保留原稿核心观点与创意"当成内容方向填进个人要求，所以读的时候就丢掉
 */
const PLACEHOLDERS = new Set([
  '基于已有内容继续创作', '保留原稿核心观点与创意，完成下一环节', '对这条内容主题有实际需求的人群',
  '实际经营或工作场景', '保留原稿的方向、人群与创意，基于当前档案完成二创', '知识分享',
]);

/** 忽略空默认值、占位话和未知字段；只携带创作设置。 */
export function mergeCreationSettings(...values: unknown[]): CreationSettings {
  const out: CreationSettings = {};
  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    for (const key of STRING_FIELDS) if (typeof v[key] === 'string' && v[key].trim() && !PLACEHOLDERS.has(v[key].trim())) out[key] = v[key].trim();
    for (const key of ARRAY_FIELDS) if (Array.isArray(v[key])) out[key] = v[key].filter((x): x is string => typeof x === 'string' && Boolean(x.trim())).map(x => x.trim());
    if (v.purpose === '流量型' || v.purpose === '人设型' || v.purpose === '变现型') out.purpose = v.purpose;
    for (const key of ['topicCount', 'titleCount'] as const) if (typeof v[key] === 'number' && Number.isFinite(v[key]) && v[key] > 0) out[key] = Math.round(v[key]);
  }
  return out;
}

const text = (value: unknown): string => Array.isArray(value) ? value.filter(Boolean).join('、') : typeof value === 'string' ? value.trim() : '';
function labelled(body: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = body.match(new RegExp(`(?:^|\\n)\\s*(?:[-*#]+\\s*)?(?:【${escaped}】\\s*[：:]?\\s*|${escaped}\\s*[：:]\\s*)(.+)`, 'i'));
    if (match) return match[1].replace(/^\*\*|\*\*$/g, '').trim();
    /*
     * 标签单独一行、值在下一行（选题板块的输出就是这样：「**0️⃣ 视频目的**」换行「人设型 — 讲经历」）。
     * 原来认不出来，从选题勾一条去写脚本，这条自己的目的读不到，只能拿整批的或者靠猜（2026-10-03）
     */
    const own = body.match(new RegExp(`(?:^|\\n)[^\\n\\p{L}]*${escaped}[：:]?[^\\n\\p{L}]*\\n\\s*([^\\n]+)`, 'iu'));
    if (own && !/^\s*#/.test(own[1])) return own[1].replace(/^\*\*|\*\*$/g, '').trim();
  }
  return '';
}

/**
 * 去掉条目编号：「方向1：」「选题3：」「第1条:」「方案2 -」。
 * 2026-10-03 线上：从创作方向勾一条去选题，主题被填成「方向1：师傅看不见的坚持……」
 */
export function cleanTitle(title: string): string {
  return title
    .replace(/^#+\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/^(?:方向|选题|方案|思路)\s*[0-9一二三四五六七八九十]+\s*[：:、.．\-—]\s*/, '')
    .replace(/^第\s*[0-9一二三四五六七八九十]+\s*(?:条|个|期|集)\s*[：:、.．\-—]?\s*/, '')
    .trim();
}

/**
 * 目的那一行 → 三种视频之一。先认原话里写明的「×型」；没写型的，认这一行里的说法（"立人设""引流到店"）。
 * 只看目的那一行，不看全文——原来按全文里有没有"私信""团购"去猜，同一个"立人设"的方向跳了四次填出三种目的
 */
export function purposeOf(roleLine: string): CreationSettings['purpose'] {
  const line = roleLine.trim();
  if (!line) return undefined;
  const typed = (['流量型', '人设型', '变现型'] as const).find((r) => line.includes(r));
  if (typed) return typed;
  const hits = (
    [
      ['人设型', /立人设|人设|记住(?:老板|你|这个人)|建立信任|让人信你/],
      ['流量型', /涨粉|曝光|拉新|播放|上热门|流量/],
      ['变现型', /引流到店|到店|成交|团购|下单|卖货|促销|转化|客单价|复购|推新品/],
    ] as [NonNullable<CreationSettings['purpose']>, RegExp][]
  ).filter(([, re]) => re.test(line));
  // 只指向一种才填；一行里写了好几种（"口碑、建立信任、涨粉曝光"）就不替编导挑，留给页面默认（选题是「按配比」）
  return hits.length === 1 ? hits[0][0] : undefined;
}

/** 一整批（两条以上的「## 选题N」「### 方向N」「### 方案N」）：不能从它身上读标签，读到的是第 1 条的 */
function isBatch(text: string): boolean {
  return (text.match(/^\s*#{2,4}\s*(?:选题|方向|方案)\s*[0-9一二三四五六七八九十]+/gm) ?? []).length >= 2;
}

/** 整批的总标题、问句，不是一条内容的主题 */
function looksLikeBatchTitle(t: string): boolean {
  // 「2 条：A、B」是勾了好几条时的合称，不是一条的主题
  // 问号结尾不算：很多选题标题本来就是问句（"南方人和北方人买家具的区别，你们发现了吗?"）
  return /^\d+\s*条：|\d+\s*(?:个|条)(?:爆款)?(?:选题|方向|方案|脚本)|分析与建议|创作简报|选题方案|帮我|给我/.test(t);
}

/** 从旧稿的明确标签恢复设置。正文提到其他行业或人群不会覆盖原设置。 */
export function settingsFromText(body: string): CreationSettings {
  const clean = body.replace(/\*\*/g, '');
  const heading = clean.split('\n').find(line => /^#{1,4}\s/.test(line)) || '';
  const typeLine = labelled(clean, ['脚本类型', '内容类型', '类型']) || heading;
  const structureLine = labelled(clean, ['脚本结构', '结构模型', '使用结构', '结构']) || typeLine;
  const scriptType = Object.keys(SCRIPT_TYPE_LABELS).find(key => typeLine.includes(SCRIPT_TYPE_LABELS[key]));
  const structure = SCRIPT_STRUCTURES.filter(s => s.id !== 'auto').find(s => structureLine.includes(s.label.replace(/^\S+\s*/, '')))?.id;
  const roleLine = labelled(clean, ['视频目的', '内容目的', '对应目的', '目的']);
  // 没有目的那一行时，标题里明写了「×型」才算；标题里的"到店""成交"这类字不拿来猜
  const role = roleLine || (['流量型', '人设型', '变现型'].find((r) => heading.includes(r)) ?? '');
  const duration = labelled(clean, ['视频时长', '建议时长', '目标时长', '时长']);
  const platform = labelled(clean, ['发布平台', '目标平台', '平台']);
  return mergeCreationSettings({
    topic: cleanTitle(labelled(clean, ['视频主题', '主题', '选题'])),
    // 创作方向的每一条写的是「核心思路」，选题写的是「核心内容方向」
    direction: labelled(clean, ['内容方向', '核心内容方向', '创作方向', '方向', '核心思路', '核心观点', '核心创意', '视频目的说明']),
    audience: labelled(clean, ['目标受众', '目标人群', '写作人群', '受众人群', '目标用户', '写给谁', '受众', '人群']),
    industry: labelled(clean, ['行业领域', '行业', '赛道']),
    platform: PLATFORMS.find(p => platform.includes(p)),
    duration: duration.match(/\d+(?:\s*[-~至]\s*\d+)?\s*(?:秒|分钟)/)?.[0].replace(/\s/g, ''),
    scriptType, structure,
    purpose: purposeOf(role),
    style: labelled(clean, ['内容风格', '写作风格', '风格', '口吻']),
    openingLine: labelled(clean, ['确定的开头', '已选开头']),
    openingCards: labelled(clean, ['开篇卡']) ? labelled(clean, ['开篇卡']).split('、').filter(Boolean) : undefined,
    tactic: labelled(clean, ['用的计', '使用打法', '拍法', '起号打法']).split(/[（(]/)[0].trim(),
    scene: labelled(clean, ['场景', '拍摄场地']),
  });
}

/** 兼容旧历史；新历史显式保存 creationSettings。 */
export function settingsFromInput(input: Record<string, unknown> | null | undefined): CreationSettings {
  if (!input) return {};
  const type = text(input.scriptType);
  const mappedType = type in SCRIPT_TYPE_LABELS ? type : scriptTypeForLabel(type);
  return mergeCreationSettings({
    topic: text(input.topic), platform: text(input.platform || input.platforms).split('、')[0],
    duration: text(input.duration), scriptType: mappedType, industry: text(input.industry || input.tracks),
    audience: text(input.targetGroup || input.targetAudience), style: text(input.style || input.styles),
    structure: text(input.scriptStructure), purpose: input.scriptRole || input.topicRole || input.role,
    tactic: text(input.tactic), openingLine: text(input.openingLine), openingCards: input.openingCards,
    elements: input.boomElements || input.selectedElements, dealReasons: input.dealReasons,
    contentType: text(input.contentType), visualStyle: text(input.visualStyle),
    titleType: text(input.titleType), titleFormula: text(input.titleFormula), keywordStrategy: text(input.keywordStrategy),
    topicCount: input.topicCount, titleCount: input.abTestCount, notes: text(input.notes),
  }, input.creationSettings);
}

export function settingsForResult(result: string, history: Array<{ result: string; input_data?: Record<string, unknown> | null }>, current: CreationSettings): CreationSettings {
  const record = history.find(item => item.result === result);
  return record ? mergeCreationSettings(settingsFromText(result), settingsFromInput(record.input_data)) : current;
}

/**
 * 跳到下一个板块时自动填的设置。
 *
 * 【原则】（2026-10-03 产品方："系统自动接管填写的信息必须准确，不能乱填，必须按照原来的内容填写"）
 * 1. 原内容写明了的 → 照填（勾中的那一条自己的标签优先，整批的标签不读——读到的是第 1 条的）
 * 2. 档案里有的（平台、人群、行业、语气、场地设备、成交理由）→ 照填
 * 3. 两边都没有的 → 不填，页面保持自己的默认（"自动""按配比"、空着）
 *
 * 原来第 3 种情况全靠猜：全文出现"私信""团购"就判变现型、"宝宝们"就判育儿人群、有"步骤"就判教知识，
 * 再补几句占位话（"保留原稿核心观点与创意"填进个人要求）——页面把这些当成原内容填进去，
 * 还写进提示词的「连续设置」标成"不得擅自更换"，再随历史记录传给下一个板块。线上实测：
 * 同一个"立人设"的创作方向跳了四次，目的填出变现、变现、流量、人设三种。
 */
export function resolveCreationSettings(data: HandoffPayload, context?: CreatorContext | null): CreationSettings {
  const source = data.sourceContent || data.scriptContent || data.remixSource?.text || '';
  const original = data.originContent || source;
  const p = context?.profile;
  // 原稿是一整批时不读它的标签：「视频目的」「脚本类型」会取到第 1 条的
  const fromOriginal = original !== source && !isBatch(original) ? settingsFromText(original) : {};
  const fromSource = isBatch(source) ? {} : settingsFromText(source);
  const explicit = mergeCreationSettings(fromOriginal, fromSource, data.settings);
  const type = explicit.scriptType && explicit.scriptType in SCRIPT_TYPE_LABELS ? explicit.scriptType : undefined;
  const structure = explicit.structure && SCRIPT_STRUCTURES.some(s => s.id === explicit.structure && s.id !== 'auto') ? explicit.structure : undefined;
  const audience = explicit.audience || [text(p?.target_age), text(p?.target_occupation), text(p?.target_interests)].filter(Boolean).join('；') || undefined;
  const industry = explicit.industry || text(p?.account_track) || text((p as unknown as Record<string, unknown>)?.content_category) || undefined;
  const normalizeDuration = (value: string) => value.match(/\d+(?:\.\d+)?(?:\s*[-~至]\s*\d+)?\s*(?:秒|分钟)/)?.[0].replace(/\s/g, '').replace(/[~至]/g, '-') || '';
  const duration = normalizeDuration(explicit.duration || '') || normalizeDuration(text(p?.video_duration).split(/[、,]/)[0]) || '60秒';
  const cardNames = mergeCreationSettings({ openingCards: data.openingCards }, explicit).openingCards;
  const openingCards = cardNames?.filter(name => OPENING_CARDS.some(c => c.name === name)) ?? [];
  // 主题：带过来的 > 稿子里写明的 > 这一条的标题。整批的总标题、问句不算主题
  const titled = [data.topic, explicit.topic, data.sourceTitle].map((t) => cleanTitle(t || '')).find((t) => t && !looksLikeBatchTitle(t));
  const resolved = mergeCreationSettings({
    topic: titled,
    // 方向只认写明了的；原来找不到就拿主题顶上，结果「内容方向」和主题一字不差
    direction: explicit.direction && cleanTitle(explicit.direction) !== titled ? explicit.direction : undefined,
    audience, industry, platform: PLATFORMS.find(v => (explicit.platform || text(p?.account_platform)).includes(v)) || '抖音',
    duration, scriptType: type, structure, purpose: explicit.purpose,
    style: explicit.style || text(p?.content_tone) || text(p?.content_style).split('、')[0] || undefined,
    tactic: data.tactic || explicit.tactic,
    openingLine: data.openingLine || explicit.openingLine,
    openingCards,
    elements: explicit.elements,
    dealReasons: normalizeCreationReasons(explicit.dealReasons?.length ? explicit.dealReasons : context?.dealReasons || []),
    scene: text(p?.shooting_location) || undefined, device: text(p?.equipment) || undefined,
    personnel: text(p?.team_structure) || undefined, budget: text(p?.budget_per_video) || undefined,
    // 这几样由脚本类型推出来：类型是写明的才推
    contentType: type ? ({ show: 'process', teach: 'knowledge', story: 'story', discuss: 'talking' } as Record<string, string>)[type] : undefined,
    visualStyle: type ? (type === 'story' ? 'warm' : 'bright') : undefined,
    titleType: type ? (type === 'story' ? 'story' : 'question') : undefined,
    titleFormula: type ? (type === 'story' ? 'time-twist' : 'why-reason') : undefined,
  }, explicit);
  // 非法或 AI推荐的旧值不能盖过已解析出的有效设置。
  resolved.scriptType = type; resolved.structure = structure; resolved.platform = PLATFORMS.find(v => (explicit.platform || resolved.platform || '').includes(v)) || '抖音';
  resolved.duration = duration; resolved.openingCards = openingCards;
  // 主题、方向用清理过的（上面 merge 时带过来的原值会把「方向1：」又盖回去）
  if (titled) resolved.topic = titled; else delete resolved.topic;
  const direction = explicit.direction && cleanTitle(explicit.direction) !== titled ? explicit.direction : undefined;
  if (direction) resolved.direction = direction; else delete resolved.direction;
  if (!resolved.scriptType) delete resolved.scriptType;
  if (!resolved.structure) delete resolved.structure;
  if (data.openingLine) resolved.openingLine = data.openingLine;
  if (data.tactic) resolved.tactic = data.tactic;
  resolved.dealReasons = normalizeCreationReasons(resolved.dealReasons || []);
  if (resolved.hookType && !HOOK_TYPES.some(v => v.id === resolved.hookType)) delete resolved.hookType;
  return resolved;
}

/** 不支持自定义时长的页面仍显示精确原时长，由提示词和质检使用。 */
export function durationSeconds(value: string): number {
  const n = Number(value.match(/\d+(?:\.\d+)?/)?.[0] || 60);
  return /分钟/.test(value) ? Math.round(n * 60) : Math.round(n);
}

export function creationSettingsBlock(settings: CreationSettings): string {
  const b = mergeCreationSettings(settings);
  const lines = [['主题', b.topic], ['内容方向', b.direction], ['目标人群', b.audience], ['行业', b.industry], ['发布平台', b.platform], ['视频时长', b.duration], ['脚本类型', b.scriptType && SCRIPT_TYPE_LABELS[b.scriptType]], ['脚本结构', SCRIPT_STRUCTURES.find(s => s.id === b.structure)?.label], ['视频目的', b.purpose], ['内容风格', b.style], ['拍法', b.tactic], ['确定的开头', b.openingLine], ['开篇卡', b.openingCards?.join('、')], ['成交理由', b.dealReasons?.join('、')], ['拍摄场地', b.scene], ['设备', b.device], ['预算', b.budget], ['人员', b.personnel], ['补充要求', b.notes]].filter(([, v]) => v);
  return lines.length ? `\n\n【本条创作的连续设置】\n${lines.map(([k, v]) => `- ${k}：${v}`).join('\n')}\n这些是本条内容的创作设置，优先于通用行业模板，后续环节保持一致。方向、人群、目的、结构和时长不得擅自更换；保留已选开头。不得把过程展示改成无关创业故事，也不得把人设稿改成促销广告。缺失的信息不能编造成经营事实；次数、销量、价格和经历没有原稿依据时用待核实占位，建议和优化稿也不能擅自填数字。` : '';
}
