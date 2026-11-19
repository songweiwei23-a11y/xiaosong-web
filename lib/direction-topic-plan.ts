import { readAssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm } from '@/lib/assistant/llm';
import { tacticByName } from '@/lib/growth-tactics';
import { topicScopeText } from '@/lib/direction-seed';
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
  currentRequest = constraints,
): DirectionTopicContext | null {
  const method = tacticByName(tactic || '');
  const allowParallelComparison = explicitParallelComparison(currentRequest);
  const direction = method?.name === '南北/地域差异'
    ? `地域提供取材范围。选一处能在镜头中核实的联系，例如物件的出处、一个当地用词或一段亲历。${allowParallelComparison ? '用户明确要求两地实测/直接对照，最多一条按共同标准取证。' : '用户没有明确要求两地实测/直接对照，每条围绕各自的问题独立展开。'}`
    : method ? `从以下内容范围找可拍的切口：${method.fit}` : '';
  const foundation = [cleanTopicReference(reference), method && `方向参考：${method.name}。创作边界：${method.limit}`, direction].filter(Boolean).join('\n');
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

/** 历史结果可能已经存成范围行，续聊时同样处理。 */
export function cleanTopicReference(reference: string): string {
  return reference.split('\n').map(line => /^(?:[-*\s]*)(?:范围|内容方向|核心思路|角度|思路)\**[：:]/u.test(line.trim())
    ? topicScopeText(line) : line).join('\n').trim();
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

export function selectTopicAngles(raw: string, elements: string[], count: number, materialSource?: string, allowParallelComparison = false, sources: string[] = []): TopicAngle[] {
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
      const sourceIndex = Number(/^S(\d+)$/.exec(String(row.sourceId))?.[1]) - 1;
      const sourceQuote = sources[sourceIndex] || shortField(row.sourceQuote, 130);
      const parallel = row.parallel === true;
      if (parallel && !allowParallelComparison) continue;
      if (materialSource !== undefined && (!anchor || !evidenceKey || !narrative || sourceQuote.length < 6 || !materialSource.includes(sourceQuote) || typeof row.parallel !== 'boolean')) continue;
      const title = shortField(row.title, 80) || shortField(question, 80);
      const angle = { element, title, question: shortField(question, 100), material: shortField(material, 140), shoot: shortField(shoot, 230), payoff: shortField(payoff, 140), frame, anchor, evidenceKey, actionKey: narrative, sourceQuote, parallel };
      const group = groups.get(element) ?? [];
      group.push(angle);
      groups.set(element, group);
    }
    const angles = [...groups.values()];
    const ordered: TopicAngle[] = [];
    const occupied = new Set<string>();
    const frameUsage = new Map<string, number>();
    const maxFrameRepeat = Math.max(1, Math.ceil(count / Math.min(3, Math.max(1, count))));
    for (const parallel of [false, true]) {
      // 轮到另一个元素前，组合选题不能抢走两件原本可各自拍摄的证据。
      for (const compound of [false, true]) {
        const candidates = angles.map((group) => group.filter((angle) =>
          angle.parallel === parallel && (mainEvidenceKeys(angle).length > 1) === compound));
        for (let position = 0; position < Math.max(0, ...candidates.map((group) => group.length)); position++) {
          for (const group of candidates) {
            const angle = group[position];
            if (!angle) continue;
            const keys = [
              `question:${topicKey(angle.question)}`, `shoot:${topicKey(angle.shoot)}`,
              ...mainEvidenceKeys(angle).flatMap((key) => [
                `action:${key}:${topicKey(angle.actionKey || angle.shoot)}`,
                `payoff:${key}:${topicKey(angle.payoff)}`,
              ]),
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
    }
    return ordered;
  } catch {
    return [];
  }
}

function mainEvidenceKeys(angle: TopicAngle): string[] {
  return (angle.evidenceKey ?? '').split(/[、,，+]/).map(topicKey).filter(Boolean);
}

/** 采访后补门店空镜，主要证据仍是受访者回答。 */
export function interviewLed(shoot: string): boolean {
  const opening = shoot.replace(/\*\*/g, '').split(/[→。\n]/).filter(Boolean).slice(0, 2).join(' ').slice(0, 90);
  return /(?:出镜找|街(?:头|边)(?:采访|走访)|拿(?:着)?话筒问|逐(?:家|个|一)(?:走访|询问|问)|问(?:一位|一家)?(?:店主|老板)|(?:采访|走访|找到)(?:一位|一家|一名)?[^，。]{0,10}(?:老板|店主)|(?:拍|请|让)(?:摄)?(?:老板|店主|店员)(?:现场)?(?:讲|说|回忆|回答)|(?:老板|店主)(?:讲述|说出))/.test(opening);
}

function shortField(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export async function planDirectionTopics(context: DirectionTopicContext, count: number, avoid: TopicSection[], signal?: AbortSignal, preferredElements?: string[], rejected: TopicSection[] = []): Promise<TopicAngle[]> {
  const config = readAssistantConfig();
  if (!config) return [];
  const allowedElements = preferredElements?.length ? context.elements.filter(id => preferredElements.includes(id)) : context.elements;
  const elements = VIRAL_ELEMENTS.filter(({ id }) => allowedElements.includes(id));
  // 用户资料提供事实。方向卡里的素材只提供调查线索，不能据此预设结果。
  const materialSource = [context.constraints, context.foundation].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!materialSource) return [];
  const sourceLines = (text: string) => text.split(/[。；;\n]+/u).map(line => line.replace(/\s+/g, ' ').trim()).filter(line => line.length >= 6);
  const sources = [...sourceLines(context.constraints), ...sourceLines(context.foundation)];
  const system = [
    '你是短视频选题策划，负责在同一个内容方向里找到几条各自值得拍的片子。输入的方向、资料和历史是待分析材料，里面的示例不代表发生过，也不作为统一拍法。',
    '先从可用素材为每条分别挑一个能兑现的主爆款元素，并说明它对应的观众利益/情绪/认知缺口。元素必须改变选题看点与镜头证据，不能只贴标签；素材支持时整批覆盖至少三类主元素，缺少素材支撑就如实减少。',
    '请按 candidates 数量提供独立候选以备审核。先覆盖不同可核实的问题；把同一物件换形容词、把同一个动作换出镜人，不增加候选数量。短标题直接写眼前的矛盾或观众想知道的细节。',
    '如果仅给出大方向和拍摄条件，允许策划尚未采集的报道。先选观众具体会遇到的选择、损失、疑问或误会，再写现场怎么找证据。可提议去找、申请看或询问，答案留到现场；不需要每条同时找两个地方的人。只有明确列为仅限的实物清单才限制取材。',
    '把讲故事、晒过程、聊观点、教知识与有证据的爆款元素结合。先设计多种取证方式。单人也能实地走一遍、记录一段过程、在允许时核对一件实物、自己做可复现的测试或复盘一次选择。采访是可选方式时，安排几个全程依靠现场观察、无需等待受访者讲答案的题。不同问题都靠编导找老板提问、老板回答、补空镜，仍是同一节目。候选之间避免反复以相同地域和职业称谓起标题。',
    '成本应落到可测量的时间、数量、金钱或付出的力气；人群应有明确对象及其要完成的任务；怀旧应有真实旧物、做法或原话；奇葩应呈现镜头里具体少见之处；头牌/最差应有已知范围和证据；反差必须先明确两端对象与同一评价标准，且不因“反差”元素自动要求双城对照。每个元素要写明它给观众的利益、情绪或认知收获。',
    '先找地基里的不同议题，再给每个议题找证据和镜头动作。对照最多占一条主线，其余候选从各自独立成立的问题展开。每条把地基关系落在具体镜头或可核实的讲述上。地区、门店、人群或商品只是取材的范围，不能用范围词替代这一条真实能拍的内容。',
    '先盘点每个实物、可复现动作、现场可记录现象和当事人亲历。用最少的证据写成独立的片子，先给每个不同证据一个机会。单个证据已经能回答观众问题，就不要把另一个物件、地区或流程拼进正文结尾。背景物件不要列进主证据。两地只是方向时，只在有独立看点的情况下做并排比较。',
    '动笔前核对每条标题、证据和镜头里的细节。事实只能来自本轮约束和素材。旧物的形状、文字是否消失、现成样品的外观差异、人物的反应和原因都不能预设。已知物件可以拍其现有细节，未知结果改写成现场要回答的具体问题。访谈写请当事人讲自己的实际经历，不能指定当事人的答案。若列了封闭的素材清单，不能加新的道具、人员或场景。实测用安全、可重复的方法，不能用身体接触来判断是否会烫伤或受伤。',
    '历史选题用于避开已经交付的问题、素材和节目结构。保留地基里的内容范围与目的，系列和参考元素用于启发。',
    '先区分拍摄设备、可拍对象、可演示的步骤和明确允许采访的经历。手机作为机位不能转成盘查手机内容的选题。物件可拍只说明它存在，可以记录已知细节；采访对象未说明保存原因，就不要自行添加怀旧动机。把能在现场验证的独立操作与只能讲述的经历分别安排。',
    '按 sources 逐句盘点，尽量覆盖不同句子。每条选一个具体问题，写清看哪个动作或细节能得到答案，再决定用哪个元素放大看点。有确切素材时填 sourceId 对应资料编号。只有待调查的方向线索时留空，并用 sourceQuote 标明线索。把两地分别演同一件事换成同一个人演两遍仍是两地对照。只有旧物一件，不知道有没有磨损、是否仍在使用时，不能预写痕迹或追问为什么不换。',
    'sourceQuote 优先从 constraints 逐字引用支撑本题的完整短句。只有方向线索时可引用 foundation，并写成待调查的问题和取证步骤。方向中的例子不能作为已发生事实。引用只说“留下”，不能在标题、开头或采访提问中擅加唯一、最后、只带走一件等排他结论。开放式问题也要逐项核对其前提。',
    '只输出紧凑 JSON 对象，angles 数组每项写 element（元素 id）、title（短标题）、frame（稳定的表达框架，如实测挑战/人物采访/过程记录/物件解密/价格拆账/反转验证，整批不能全部相同）、anchor（承接地基哪一层）、question、material（可拍证据）、shoot（连续的镜头动作）、payoff（镜头怎样兑现看点）、sourceQuote（逐字摘录）、parallel（布尔值；只有本轮约束明确写了“实测/直接对照/比较/各自/分别”才可 true，否则全部 false；true 最多一条）、evidenceKey（关键证据在素材里的原名，多个用顿号分开，背景省略）、actionKey（具体的主要镜头动作，实质相同的用同名）。每项一句话，给出可独立执行的内容。',
  ].join('\n');
  try {
    const timeout = AbortSignal.timeout(80_000);
    const poolSize = Math.min(count + 3, 36);
    const soloReport = /(?:街头采访|街采|走访)/.test(context.constraints) && /(?:自己出镜|一人全包|单人拍摄)/.test(context.constraints) && !/(?:只能|必须|只做)[^。\n]{0,16}(?:采访|街采)/.test(context.constraints);
    const briefs = soloReport && count >= 3 ? [
      { n: Math.ceil(poolSize * 0.6), brief: '这组全部是编导独立现场调查。整组不安排问答、招募老板、转述采访或等待别人提供私有账本。先从议题选不同的观众难题，再在可进入的现场用自己能完成的动作求证。每条都能在一处顺路拍完。标题直接从各自独特的物件、动作或待解决的事起笔。未知结果留给现场，payoff 写测量能回答什么，不抢先说哪边更贵、更便宜或哪个人必然会怎么做。' },
      { n: Math.floor(poolSize * 0.4), brief: '这组可以从人出发。本地只是受众和线索。按可采访的前提设计可独立拍成的人物、判断或经营取舍，不把本人尚未说过的经历当作事实。' },
    ] : [{ n: poolSize, brief: '' }];
    const planned = await Promise.allSettled(briefs.map(async ({ n, brief }) => {
      const result = await callAssistantLlm(config, {
        system: brief ? system + '\n本组专项任务：' + brief : system,
        messages: [{ role: 'user', content: JSON.stringify({
          ...context,
          materialSource,
          sources: sources.map((text, index) => ({ id: 'S' + (index + 1), kind: context.constraints.includes(text) ? '本轮条件' : '仅供立题的方向线索', text })),
          candidates: n,
          preferredElements,
          ...(!brief && !/(?:只能|只做|必须|每条都)[^。\n]{0,10}(?:采访|街采)/.test(context.constraints) ? { evidenceBrief: '先构思可以独自拍完的内容。至少一半候选的主要证据来自可见的环境、物件、直接测量或编导的亲自操作，全片拿掉问答仍然成立。有采访的题也要说明对方不提供预想答案时如何收尾。' } : {}),
          ...(rejected.length ? { rejectedQuestions: rejected.slice(-15).map(t => t.title), refillGoal: '这些候选刚被淘汰。换新的观众任务、证据和观察动作。若可以街访也可以自己出镜，本轮主要设计不依赖别人回答就能拍出结果的题。' } : {}),
          ...(avoid.some(t => interviewLed(t.body.match(/脚本结构\*\*[：:]([^\n]+)/)?.[1] || ''))
            ? { historyNote: '已交付过以采访回答为主的节目。本轮优先策划可由编导亲自拍到、实测或核对的证据，给出无需采访也能推进的镜头。' } : {}),
          elements: elements.map(({ id, name, hook }) => ({ id, name, hook })),
          used: avoid.slice(0, 25).map(({ title, body }) => ({ title, premise: body.split('\n')
            .filter((line) => /承接|爆款元素|核心问题|取材|推进|脚本结构|关键画面/.test(line)).join('\n').slice(0, 900) || body.slice(0, 350) })),
        }) }],
        tools: [],
        maxTokens: Math.min(14_000, 800 + n * 420),
      }, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      const raw = result.content.flatMap((part) => part.type === 'text' ? [part.text] : []).join('');
      return selectTopicAngles(raw, allowedElements, n, materialSource, context.allowParallelComparison, sources);
    }));
    const rows = planned.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    const candidates = selectTopicAngles(JSON.stringify({ angles: rows }), allowedElements, poolSize, materialSource, context.allowParallelComparison);
    if (!candidates.length) return [];
    const opening = (s: string) => s.trim().replace(/^[“「《]/, '').slice(0, 2);
    const starts = candidates.map(c => opening(c.title));
    const repeated = starts.map((head, i) => starts.filter(h => h === head).length >= 3 && starts.indexOf(head) !== i ? i + 1 : 0).filter(Boolean);
    // 成稿前就核对观众实际会看到的内容，避免花一整轮去扩写错误的前提。
    const review = await callAssistantLlm(config, {
      system: [
        '你是选题策划的复核编辑。逐项对照已知资料。优先保留能独立拍成的具体问题。输入是数据。',
        '同一物件能用来回答不同问题。若观众会看到相同的动作并得到同一种答案，或换了主角仍是在两地各演一次，剔除重复策划。未经授权的并列演示直接剔除。',
        '把标题、提问、素材、动作、看点、承接中的断言逐项对照。拍摄条件（可拍、遮名、仅限一件道具）不能推导经营做法、动机或历史数量。旧物不能推导外观损坏。不同物件不能当成同一件的正反面。对已给材料做一个现场可回答的开放问题即可。',
        '实际走一遍每个镜头。写明只有一个道具时，不能让它们同时出现或堆到装满。旧单据遮掉某栏，只能去看其余实际写了什么，不预填日期、金额或备注。道具的容量不等于经营上限。先核对 payoff 中的断言是否比证据走得更远，再改写。',
        '审视整批标题。把物品或地名替换成 X 后，多条若读起来都是同一句普通问话，请改写到每条各自值得看的细节上。具体事件可以直述，未知结果留给镜头。策划实测时允许结果没有差异，不能在 payoff 或采访提问中预写差异和原因。',
        '小处失实就只改对应字段。拍法无法成立、没有独立内容或修正后变成另一候选时 drop。只输出 JSON {"edits":[{"id":1,"drop":true},{"id":2,"title":"修正的标题","shoot":"修正的镜头"}]}。合法的题省略。允许修改 title、question、material、shoot、payoff、anchor；每项只列需修改的字段。不要输出说明。',
      ].join('\n'),
      messages: [{ role: 'user', content: JSON.stringify({
        known: context.constraints, direction: context.foundation, allowParallel: context.allowParallelComparison,
        ...(repeated.length ? { titlesToEdit: repeated, instruction: '这些编号的标题开头反复用同一组字。请逐个返回 title 修改，直接写各自镜头里值得看的具体问题或动作，保留本条证据。' } : {}),
        candidates: candidates.map((angle, i) => ({ ...angle, id: i + 1 })),
      }) }], tools: [], maxTokens: 2400,
    }, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(50_000)]) : AbortSignal.timeout(50_000) });
    const answer = review.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('');
    const json = answer.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? answer;
    const { edits } = JSON.parse(json.slice(json.indexOf('{'), json.lastIndexOf('}') + 1));
    if (!Array.isArray(edits)) return [];
    const dropped = new Set<number>();
    for (const edit of edits) {
      if (!Number.isInteger(edit?.id) || !candidates[edit.id - 1]) return [];
      if (edit.drop === true) dropped.add(edit.id - 1);
      else for (const key of ['title', 'question', 'material', 'shoot', 'payoff', 'anchor'] as const) {
        const updated = shortField(edit[key], key === 'shoot' ? 230 : 140);
        if (updated) candidates[edit.id - 1][key] = updated;
      }
    }
    const vetted = candidates.filter((_, index) => !dropped.has(index));
    const usedOpenings = new Set<string>();
    for (const c of vetted) {
      const head = opening(c.title);
      if (usedOpenings.has(head) && repeated.length && starts.filter(s => s === head).length >= 3 &&
          c.question.length <= 32 && /[？?]$/.test(c.question) && !usedOpenings.has(opening(c.question))) c.title = c.question;
      usedOpenings.add(opening(c.title));
    }
    // 把有限的成稿位置先分给不同取证方式，防止候选已足够丰富却只扩写排在前面的街访。
    const frames = new Map<string, TopicAngle[]>();
    for (const angle of vetted) {
      const frame = interviewLed(angle.shoot) ? '采访' : angle.frame || angle.actionKey || angle.shoot;
      const group = frames.get(frame) ?? [];
      group.push(angle);
      frames.set(frame, group);
    }
    const diverse: TopicAngle[] = [];
    for (let i = 0; diverse.length < vetted.length; i++) {
      for (const group of frames.values()) if (group[i]) diverse.push(group[i]);
    }
    return diverse.slice(0, count);
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
      '按以下策划顺序各写一条，标题格式「## 选题1：【P1】原策划标题」。保留每条自己的证据、镜头动作和看点。开头用具体行动或问题引出，不填未知结果。',
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
    ).map((block) => /^\s*(?:[-*][\t ]+)?\*\*[\d\uFE0F\u20E3🅰\s]*开篇钩子/.test(block)
      ? `**开篇钩子**：${angles[index].question}`
      : block.trim());
    extras.set(index, extra);
  }
  const planned = angles.map((angle, index) => [
      `## 选题${index + 1}：${angle.title}`,
      ...(angle.anchor ? [`**承接**：${angle.anchor}`] : []),
      `**爆款元素**：${VIRAL_ELEMENTS.find(({ id }) => id === angle.element)?.name}｜${angle.payoff}`,
      ...(angle.frame ? [`**表达框架**：${angle.frame}`] : []),
      `**核心问题与观众价值**：${angle.question}`,
      `**取材与内容推进**：${angle.material}`,
      `**脚本结构**：${angle.shoot}`,
      ...(extras.get(index) ?? []),
    ].join('\n\n'));
  return planned.join('\n\n');
}

export const DIRECTION_TOPIC_DELIVERY = [
  '【成稿格式】用 Markdown，直接从第一条开始。每条用「## 选题1：标题」起头。',
  '每条包含「承接」「视频目的」「视频任务」「打法」「爆款元素」「开篇钩子」「核心问题与观众价值」「取材与内容推进」「脚本结构」「结尾行动指令」「执行要点」。按本轮要求关闭钩子时省去开篇钩子。变现型写成交理由和转化路径。每项一两句，拍摄动作要具体。',
  '正片写拍摄计划。只有本轮资料明确提供的事实可以写成结果，不能从方向参考、假设、历史稿、既有案例中补经营事实。未知内容只写要如何观察、记录或验证。不能预设顾客说什么、哪种食物更好或测试有多大差距。',
  '承接一项写明：选了地基中的哪一层差异或议题，准备拍哪项证据把这个关系讲出来。标题写到的关系必须在正片兑现。只在标题、标签或旁白提到地基，内容是泛泛日常的题，改从有具体关联的素材重新选。',
  '不同主元素要对应不同看点、证据与镜头动作。按每条已选的核心问题和证据安排镜头。把地名、人名和元素名遮住后，观众仍应能说出每条解决什么问题、会看到什么新东西。',
].join('\n');
