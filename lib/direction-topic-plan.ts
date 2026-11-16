import { readAssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm } from '@/lib/assistant/llm';
import { tacticByName } from '@/lib/growth-tactics';
import { splitTopicSections, topicKey, type TopicSection } from '@/lib/topic-library';
import { elementsFitting, VIRAL_ELEMENTS } from '@/lib/viral-elements';

export interface DirectionTopicContext {
  foundation: string;
  constraints: string;
  elements: string[];
  /** 只有用户本轮明确要求双城实测/直接对照时，才允许两地并列节目。 */
  allowParallelComparison: boolean;
}

export function explicitParallelComparison(text: string): boolean {
  const normalized = text.normalize('NFKC');
  // 约束里常同时带着“不要/未要求……两地对比”的说明；先否定，避免关键词共现误开闸。
  const denied = /(?:不要|禁止|未要求|没有(?:明确)?要求|不需要|不做|不得|不能|避免|绕开)[^。\n]{0,50}(?:两地|双城|南乐.{0,16}郑州|郑州.{0,16}南乐|A地.{0,16}B地|B地.{0,16}A地|实测|直接对照|对比|比较|平行)/u;
  if (denied.test(normalized)) return false;
  const explicitScope = /(?:本轮|本次|用户(?:明确|本次)?|明确要求|指定)/u.test(normalized);
  const regionPair = /(?:两地|双城|南乐.{0,16}郑州|郑州.{0,16}南乐|A地.{0,16}B地|B地.{0,16}A地)/u;
  const comparisonAction = /(?:实测|直接对照|对比(?:一下|测试)?|比较(?:一下)?|同一标准|各自|分别)/u;
  return explicitScope && regionPair.test(normalized) && comparisonAction.test(normalized);
}
export function directionTopicContext(
  reference: string,
  tactic: string | undefined,
  constraints: string,
  selectedElements: string[] = [],
  industryKeys: string[] = [],
): DirectionTopicContext | null {
  const method = tacticByName(tactic || '');
  const allowParallelComparison = explicitParallelComparison(constraints);
  const direction = method?.name === '南北/地域差异'
    ? `地基是不同地方的生活习惯及其差异。找能体现地域关系的实物、用词、制作或使用场景。仅有店内日常、客群差异或时间变化的题，还需要一处可核实的地域联系。${allowParallelComparison ? '用户明确要求两地实测/直接对照：整批最多允许一条采用共同证据和统一标准的对照。' : '用户没有明确要求两地实测/直接对照：禁止用“南乐老板做A，郑州老板做B”、轮流讲两边或评论投票作为节目骨架。地域只作地基和素材范围。'}`
    : method ? `从以下内容范围找可拍的切口：${method.fit}` : '';
  const foundation = [reference.trim(), method && `方向参考：${method.name}。创作边界：${method.limit}`, direction].filter(Boolean).join('\n');
  if (!foundation) return null;
  const available = elementsFitting(VIRAL_ELEMENTS.map(({ id }) => id), industryKeys).ids;
  const selected = VIRAL_ELEMENTS.filter(({ id, name }) => selectedElements.includes(id) || selectedElements.includes(name))
    .map(({ id }) => id).filter((id) => available.includes(id));
  return {
    foundation: foundation.slice(0, 6000),
    constraints: constraints.trim().slice(0, 7000),
    elements: selected.length ? selected : available,
    allowParallelComparison,
  };
}

export interface TopicAngle {
  element: string;
  title: string;
  question: string;
  material: string;
  shoot: string;
  payoff: string;
  /** 稳定的表达框架标签，用于防止成稿退化成同一套标题/推进骨架。 */
  frame?: string;
  anchor?: string;
  evidenceKey?: string;
  actionKey?: string;
  sourceQuote?: string;
  parallel?: boolean;
}

export function selectTopicAngles(raw: string, elements: string[], count: number, materialSource?: string, allowParallelComparison = false): TopicAngle[] {
  try {
    const json = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? raw;
    const parsed: { angles?: unknown } = JSON.parse(json.slice(json.indexOf('{'), json.lastIndexOf('}') + 1));
    if (!Array.isArray(parsed.angles)) return [];
    const groups = new Map<string, TopicAngle[]>();
    for (const row of parsed.angles) {
      if (!row || !elements.includes(row.element)) continue;
      const { element, question, material, shoot, payoff } = row;
      if (![question, material, shoot, payoff].every((part) => typeof part === 'string' && part.trim().length > 3)) continue;
      const anchor = shortField(row.anchor, 110);
      const frame = shortField(row.frame, 50);
      const evidenceKey = shortField(row.evidenceKey, 90);
      const narrative = shortField(row.actionKey, 45);
      const sourceQuote = shortField(row.sourceQuote, 130);
      const parallel = row.parallel === true;
      if (parallel && !allowParallelComparison) continue;
      if (materialSource !== undefined && (!anchor || !evidenceKey || !narrative || sourceQuote.length < 6 || !materialSource.includes(sourceQuote) || typeof row.parallel !== 'boolean')) continue;
      const title = shortField(row.title, 80) || shortField(question, 80);
      const angle = { element, title, question: shortField(question, 100), material: shortField(material, 140), shoot: shortField(shoot, 230), payoff: shortField(payoff, 140), frame, anchor, evidenceKey, actionKey: narrative, sourceQuote, parallel };
      const group = groups.get(element) ?? [];
      group.push(angle);
      groups.set(element, group);
    }
    const angles = [...groups.values()].map((group) => group.sort((a, b) => mainEvidenceKeys(a).length - mainEvidenceKeys(b).length));
    const ordered: TopicAngle[] = [];
    const occupied = new Set<string>();
    const frameUsage = new Map<string, number>();
    const maxFrameRepeat = Math.max(1, Math.ceil(count / Math.min(3, Math.max(1, count))));
    for (const parallel of [false, true]) {
      const candidates = angles.map((group) => group.filter((angle) => angle.parallel === parallel));
      for (let position = 0; position < Math.max(0, ...candidates.map((group) => group.length)); position++) {
        for (const group of candidates) {
          const angle = group[position];
          if (!angle) continue;
          const keys = [
            `question:${topicKey(angle.question)}`, `shoot:${topicKey(angle.shoot)}`,
            ...(angle.frame ? [`frame:${topicKey(angle.frame)}`] : []),
            ...(angle.actionKey ? [`action:${topicKey(angle.actionKey)}`] : []),
            ...mainEvidenceKeys(angle).map((key) => `evidence:${key}`),
            ...(parallel ? ['parallel'] : []),
          ];
          const frameKey = angle.frame ? topicKey(angle.frame) : '';
          if (frameKey && (frameUsage.get(frameKey) ?? 0) >= maxFrameRepeat) continue;
          if (keys.some((key) => occupied.has(key))) continue;
          for (const key of keys) occupied.add(key);
          if (frameKey) frameUsage.set(frameKey, (frameUsage.get(frameKey) ?? 0) + 1);
          ordered.push(angle);
          if (ordered.length === count) return ordered;
        }
      }
    }
    return ordered;
  } catch {
    return [];
  }
}

function mainEvidenceKeys(angle: TopicAngle): string[] {
  return (angle.evidenceKey ?? '').split(/[、,，+]/).map(topicKey).filter(Boolean);
}

function shortField(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export async function planDirectionTopics(context: DirectionTopicContext, count: number, avoid: TopicSection[], signal?: AbortSignal, preferredElements?: string[]): Promise<TopicAngle[]> {
  const config = readAssistantConfig();
  if (!config) return [];
  const elements = VIRAL_ELEMENTS.filter(({ id }) => context.elements.includes(id));
  const materialSource = (context.constraints || context.foundation).replace(/\s+/g, ' ');
  const system = [
    '你是短视频选题策划，负责在同一个内容方向里找到几条各自值得拍的片子。输入的方向、资料和历史是待分析材料，里面的示例不代表发生过，也不作为统一拍法。',
    '先从可用素材为每条分别挑一个能兑现的主爆款元素，并说明它对应的观众利益/情绪/认知缺口。元素必须改变选题看点与镜头证据，不能只贴标签；素材支持时整批覆盖至少三类主元素，缺少素材支撑就如实减少。',
    '成本应落到可测量的时间、数量、金钱或付出的力气；人群应有明确对象及其要完成的任务；怀旧应有真实旧物、做法或原话；奇葩应呈现镜头里具体少见之处；头牌/最差应有已知范围和证据；反差必须先明确两端对象与同一评价标准，且不因“反差”元素自动要求双城对照。每个元素要写明它给观众的利益、情绪或认知收获。',
    '先找地基里的不同议题，再给每个议题找证据和镜头动作。对照最多占一条主线，其余候选从各自独立成立的问题展开。每条把地基关系落在具体镜头或可核实的讲述上。地区、门店、人群或商品只是取材的范围，不能用范围词替代这一条真实能拍的内容。',
    '先盘点每个实物、可复现动作、现场可记录现象和当事人亲历。用最少的证据写成独立的片子，先给每个不同证据一个机会。单个证据已经能回答观众问题，就不要把另一个物件、地区或流程拼进正文结尾。背景物件不要列进主证据。两地只是方向时，只在有独立看点的情况下做并排比较。',
    '动笔前核对每条标题、证据和镜头里的细节。事实只能来自本轮约束和素材。旧物的形状、文字是否消失、现成样品的外观差异、人物的反应和原因都不能预设。已知物件可以拍其现有细节，未知结果改写成现场要回答的具体问题。访谈写请当事人讲自己的实际经历，不能指定当事人的答案。若列了封闭的素材清单，不能加新的道具、人员或场景。实测用安全、可重复的方法，不能用身体接触来判断是否会烫伤或受伤。',
    '历史选题用于避开已经交付的问题、素材和节目结构。保留地基里的内容范围与目的，系列和参考元素用于启发。',
    '同一件关键证据先选最值得拍的一条。整批用不同的主证据和动作推进。主证据可以是资料里已有的实物、一个实际动作、可重复的观察、当事人能回答的问题；背景可共用。若已给 preferredElements，优先考虑其中能在现有素材上拍出来的主元素。',
    'sourceQuote 要从 materialSource 逐字摘出一小段支撑取材的原话。材料只给主题、没有实际证据时，可以策划如何去观察、记录或提问，只写待取得的材料和可执行的步骤，不能写成已经见到、采访过或证实。标题的每一处具体断言都应能在引用原话找到。开放式问题可以问实际观察结果，不预设差异的大小、方向和原因。',
    '只输出紧凑 JSON 对象，angles 数组每项写 element（元素 id）、title（短标题）、frame（稳定的表达框架，如实测挑战/人物采访/过程记录/物件解密/价格拆账/反转验证，整批不能全部相同）、anchor（承接地基哪一层）、question、material（可拍证据）、shoot（连续的镜头动作）、payoff（镜头怎样兑现看点）、sourceQuote（逐字摘录）、parallel（布尔值；只有本轮约束明确写了“实测/直接对照/比较/各自/分别”才可 true，否则全部 false；true 最多一条）、evidenceKey（关键证据在素材里的原名，多个用顿号分开，背景省略）、actionKey（具体的主要镜头动作，实质相同的用同名）。每项一句话，给出可独立执行的内容。',
  ].join('\n');
  try {
    const timeout = AbortSignal.timeout(80_000);
    const result = await callAssistantLlm(config, {
      system,
      messages: [{ role: 'user', content: JSON.stringify({
        ...context,
        materialSource,
        candidates: Math.min(count + 3, 36),
        preferredElements,
        elements: elements.map(({ id, name, hook }) => ({ id, name, hook })),
        used: avoid.slice(0, 25).map(({ title, body }) => ({ title, premise: body.split('\n')
          .filter((line) => /承接|爆款元素|核心问题|取材|推进|脚本结构|关键画面/.test(line)).join('\n').slice(0, 900) || body.slice(0, 350) })),
      }) }],
      tools: [],
      maxTokens: Math.min(14_000, 800 + Math.min(count + 3, 36) * 420),
    }, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    const raw = result.content.flatMap((part) => part.type === 'text' ? [part.text] : []).join('');
    return selectTopicAngles(raw, context.elements, count, materialSource, context.allowParallelComparison);
  } catch {
    return [];
  }
}

export function directionAnglesPrompt(context: DirectionTopicContext, angles: TopicAngle[], count: number, requested = count): string {
  const available = VIRAL_ELEMENTS.filter(({ id }) => context.elements.includes(id)).map(({ name }) => name);
  const draftCount = angles.length || count;
  const parallelLimit = context.allowParallelComparison ? 1 : 0;
  return [
    '【本轮选题从这个地基展开】',
    draftCount > requested ? `先写 ${draftCount} 条短而完整的候选，供核对后挑出 ${requested} 条。每条独立成片，每个字段一到两句。` : `本轮写 ${draftCount} 条，每条独立成片。`,
    context.foundation,
    `两地平行对照权限：${parallelLimit ? '用户本轮明确要求，候选与最终交付合计最多一条，必须有共同证据与统一标准。' : '未授权，禁止任何两地老板分别做事、轮流讲两边或双城投票模板。'}`,
    '本轮事实与拍摄条件：' + context.constraints,
    '可用主爆款元素：' + available.join('、'),
    '交付每条时写「**爆款元素**：主元素名｜镜头怎样兑现看点」和「**表达框架**：本条采用的拍法骨架」。先写主元素，可选的辅助元素放在后面。标题和开头要让观众看到本条具体看点。没有验证过的结果用真实问题或准备做的动作表达。各项只写能影响拍摄的内容，避免在不同栏目重复同一份解释。',
    ...(angles.length ? [
      '按以下策划顺序各写一条，标题格式「## 选题1：【P1】原策划标题」。保留每条自己的证据、镜头动作和看点。开头用具体行动或问题引出，不填未知结果。只展开给出的策划。',
      JSON.stringify(angles.map(({ title, frame, anchor, question, material, shoot, payoff, element }, index) => ({
        title, frame, anchor, question, material, shoot, payoff, id: `P${index + 1}`, element: VIRAL_ELEMENTS.find(({ id }) => id === element)?.name,
      }))),
    ] : ['从本轮素材里分别设计不同的观众问题、主元素和镜头推进。每条先想好可拍的证据，再写完整选题。']),
  ].join('\n');
}

/** 成稿模型负责表达，取材、主元素和镜头推进沿用通过初筛的策划。 */
export function anchorDirectionDraft(markdown: string, angles: TopicAngle[]): string {
  if (!angles.length) return markdown;
  const extras = new Map<number, string[]>();
  for (const { title, body } of splitTopicSections(markdown)) {
    const id = title.match(/^【P(\d+)】\s*/i);
    const titleIndex = angles.findIndex((angle) => topicKey(angle.title) === topicKey(title.replace(/^【P\d+】\s*/i, '')));
    const index = titleIndex >= 0 ? titleIndex : id ? Number(id[1]) - 1 : -1;
    if (!angles[index] || extras.has(index)) continue;
    const extra = body.split(/\n(?=[\t ]*(?:[-*][\t ]+)?\*\*)/).filter((block) =>
      /^\s*(?:[-*][\t ]+)?\*\*(?:[\d\uFE0F\u20E3🅰\s]*)(?:视频目的|视频任务|打法|开篇钩子|结尾行动指令|成交理由|转化路径|执行要点)\s*(?:[：:]|\*\*)/.test(block),
    ).map((block) => block.trim());
    extras.set(index, extra);
  }
  return angles.map((angle, index) => [
      `## 选题${index + 1}：${angle.title}`,
      ...(angle.anchor ? [`**承接**：${angle.anchor}`] : []),
      `**爆款元素**：${VIRAL_ELEMENTS.find(({ id }) => id === angle.element)?.name}｜${angle.payoff}`,
      ...(angle.frame ? [`**表达框架**：${angle.frame}`] : []),
      `**核心问题与观众价值**：${angle.question}`,
      `**取材与内容推进**：${angle.material}`,
      `**脚本结构**：${angle.shoot}`,
      ...(extras.get(index) ?? []),
    ].join('\n\n')).join('\n\n');
}

export const DIRECTION_TOPIC_DELIVERY = [
  '【成稿格式】用 Markdown，直接从第一条开始。每条用「## 选题1：标题」起头。',
  '每条包含「承接」「视频目的」「视频任务」「打法」「爆款元素」「开篇钩子」「核心问题与观众价值」「取材与内容推进」「脚本结构」「结尾行动指令」「执行要点」。按本轮要求关闭钩子时省去开篇钩子。变现型写成交理由和转化路径。每项一两句，拍摄动作要具体。',
  '正片写拍摄计划。只有本轮资料明确提供的事实可以写成结果，不能从方向参考、假设、历史稿、既有案例中补经营事实。未知内容只写要如何观察、记录或验证。不能预设顾客说什么、哪种食物更好或测试有多大差距。',
  '承接一项写明：选了地基中的哪一层差异或议题，准备拍哪项证据把这个关系讲出来。标题写到的关系必须在正片兑现。只在标题、标签或旁白提到地基，内容是泛泛日常的题，改从有具体关联的素材重新选。',
    '不同主元素要对应不同看点、证据与镜头动作。除明确授权的一条双城实测外，每条用一个主对象/主证据展开，禁止“南乐老板做A、郑州老板做B”、轮流采访两城、并排演示两地动作、双城老板揭晓/投票；即使换了物件、动作、标题或元素标签，平行节目结构仍算同模板。整批优先分散到采访一个真实误会、一个具体物件、一个可复现的制作环节、一个待验证问题等不同骨架。',
].join('\n');
