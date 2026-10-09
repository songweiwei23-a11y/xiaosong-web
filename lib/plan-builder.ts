/**
 * 出方案（2026-10-04 产品方："各行各业、各个场景都能用；先写骨架确认一遍，第二次出完整结果"）。
 *
 * 流程：选场景（场景库或自定义）+ 行业（默认取当前档案）+ 这次要解决什么 + 已知条件
 *   → 第一次：只出大纲（章节 + 每章要点），用户在页面上改章节名、增删、调顺序、补要求
 *   → 第二次：按确认后的大纲写完整方案；缺了哪章能看出来，可以补写
 * 两次都走自由对话原来的发送（同一条会话、记忆、额度、质检、画布、导出都照旧）。
 * 不编事实：预算、日期、人数、价格这类用户没给的，写【待确认】。
 */

export interface PlanScenario { name: string }
export interface PlanCategory { id: string; label: string; scenarios: string[]; focus: string }

/** 场景库：按类别列常见场景；列不全的用「自定义方案」，任何场景都能出 */
export const PLAN_CATEGORIES: PlanCategory[] = [
  { id: 'marketing', label: '营销推广', scenarios: ['开业活动方案', '节日促销方案', '新品上市方案', '团购 / 套餐引流方案', '会员拉新方案', '异业合作方案', '周年庆方案'], focus: '目标与指标、目标人群、主题与卖点、渠道组合、执行排期、预算与投入产出测算' },
  { id: 'content', label: '内容与新媒体', scenarios: ['账号起号方案', '月度账号运营方案', '短视频拍摄执行方案', '系列内容策划方案', '达人 / 探店合作方案', '品牌宣传片方案'], focus: '账号现状、内容方向与配比、选题规划、拍摄与发布节奏、分工、数据复盘' },
  { id: 'live', label: '直播与电商', scenarios: ['直播带货方案', '直播间搭建方案', '电商店铺运营方案', '大促作战方案'], focus: '目标、货品与价格机制、流程脚本、人员分工、引流与预热、复盘指标' },
  { id: 'store', label: '门店经营', scenarios: ['新店试营业方案', '门店引流方案', '服务流程优化方案', '陈列与动线方案', '复购提升方案', '外卖运营方案'], focus: '现状问题、目标、具体动作、门店执行清单、人员培训、考核与复盘' },
  { id: 'private', label: '私域与客户', scenarios: ['私域社群运营方案', '会员体系方案', '客户回访与转介绍方案', '客户投诉处理方案'], focus: '用户分层、触达节奏、话术与内容、权益设计、执行分工、转化指标' },
  { id: 'channel', label: '招商与渠道', scenarios: ['招商加盟方案', '渠道拓展方案', '合作伙伴方案'], focus: '合作模式与政策、目标对象、招商流程、支持体系、风险控制、进度目标' },
  { id: 'brand', label: '品牌', scenarios: ['品牌定位方案', '品牌升级方案', '公关传播方案'], focus: '现状与问题、定位与差异、核心信息、传播策略、落地物料、评估方式' },
  { id: 'event', label: '活动与会议', scenarios: ['线下活动执行方案', '展会参展方案', '发布会方案', '年会方案'], focus: '目的、时间地点、流程议程、物料与场地、人员分工、预算、应急预案' },
  { id: 'team', label: '团队与管理', scenarios: ['员工培训方案', '绩效激励方案', '招聘方案', '岗位职责梳理方案'], focus: '现状、目标、具体做法、时间安排、责任人、考核与反馈' },
  { id: 'plan', label: '规划与经营', scenarios: ['年度经营计划', '季度目标拆解方案', '成本控制方案', '新店选址方案', '商业计划书'], focus: '现状与数据、目标、关键举措、资源与预算、里程碑、风险' },
  { id: 'crisis', label: '危机与风险', scenarios: ['危机公关方案', '差评应对方案', '安全事故应急方案'], focus: '事件判断、响应时限、对外口径、处理步骤、责任人、后续整改' },
  { id: 'product', label: '产品与服务', scenarios: ['产品定价方案', '服务套餐设计方案', '新服务上线方案'], focus: '目标客群、价格与套餐结构、成本与毛利测算、上线步骤、推广、验证指标' },
];

export const CUSTOM_SCENARIO = '自定义方案';

export interface PlanSection { title: string; points: string[] }

export interface PlanMeta {
  stage: 'outline' | 'full';
  /** 场景名（场景库里的或用户自己写的） */
  scenario: string;
  category?: string;
  /** 行业 / 业务：默认取档案，可改 */
  industry: string;
  /** 这次要解决什么 */
  goal: string;
  /** 已知条件：时间、预算、人手、地点…… */
  facts?: string;
  /** 第二次写全文时：确认后的大纲 */
  outline?: PlanSection[];
  /** 确认大纲时补充的要求 */
  note?: string;
  /** 确认后的方案标题 */
  title?: string;
  /** 做方案用的资料：用户直接粘贴的文字（简历、公司介绍、产品清单……） */
  material?: string;
  /** 随这次一起上传的文件名（文件本身随消息发给模型，后面几轮自动沿用） */
  files?: string[];
  /** 用户对模型提的确认问题的回答（可能答过几次，按行累积） */
  clarify?: string;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
/** 粘贴的资料最多这么长（再长请传文档） */
export const MATERIAL_MAX = 8000;

/** 存进对话记录前清洗（lib/chat-message-utils 用） */
export function readPlanMeta(raw: unknown): PlanMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.stage !== 'outline' && o.stage !== 'full') return null;
  const scenario = str(o.scenario, 60);
  const goal = str(o.goal, 1000);
  if (!scenario || !goal) return null;
  const outline = Array.isArray(o.outline)
    ? (o.outline as unknown[]).map((s) => {
        const x = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
        return { title: str(x.title, 80), points: (Array.isArray(x.points) ? x.points : []).map((p) => str(p, 200)).filter(Boolean).slice(0, 10) };
      }).filter((s) => s.title).slice(0, 20)
    : undefined;
  return {
    stage: o.stage, scenario, goal,
    industry: str(o.industry, 80),
    ...(str(o.category, 20) ? { category: str(o.category, 20) } : {}),
    ...(str(o.facts, 1500) ? { facts: str(o.facts, 1500) } : {}),
    ...(outline?.length ? { outline } : {}),
    ...(str(o.note, 800) ? { note: str(o.note, 800) } : {}),
    ...(str(o.title, 80) ? { title: str(o.title, 80) } : {}),
    ...(str(o.material, MATERIAL_MAX) ? { material: str(o.material, MATERIAL_MAX) } : {}),
    ...(Array.isArray(o.files) && o.files.length ? { files: (o.files as unknown[]).map((x) => str(x, 120)).filter(Boolean).slice(0, 6) } : {}),
    ...(str(o.clarify, 1500) ? { clarify: str(o.clarify, 1500) } : {}),
  };
}

/**
 * 模型没出大纲、而是在提问（2026-10-04）：认出这种回答，把它给的选项拿出来做成按钮。
 * 选项取最后一组编号列表（2–6 条）；回答里要有问号或「请确认 / 你希望 / 选哪」这类话才算在提问
 */
export function looksLikeQuestion(answer: string): boolean {
  return /[？?]|请(?:你)?确认|你希望|选哪|哪种方式|告诉我/.test(String(answer || '').slice(-600));
}
export function clarifyOptions(answer: string): string[] {
  const lines = String(answer || '').split('\n');
  const groups: string[][] = [];
  let cur: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:\d+[.、)）]|[-*•]|[（(]?[A-DＡ-Ｄ一二三四][)）.、])\s*(.+?)\s*$/);
    if (m) cur.push(m[1].replace(/\*\*/g, '').replace(/[？?：:。]$/, '').trim());
    else if (line.trim()) { if (cur.length) groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  const last = [...groups].reverse().find((g) => g.length >= 2 && g.length <= 6 && g.every((x) => x.length >= 2 && x.length <= 80));
  return last ?? [];
}

const focusOf = (m: Pick<PlanMeta, 'category'>) => PLAN_CATEGORIES.find((c) => c.id === m.category)?.focus;

const briefLines = (m: PlanMeta) => [
  `- 方案类型：${m.scenario}`,
  `- 行业 / 业务：${m.industry || '【待确认】'}`,
  `- 这次要解决的问题：${m.goal}`,
  m.facts ? `- 已知条件：${m.facts}` : '- 已知条件：用户没提供（预算、日期、人手、价格等一律写【待确认】，不要替用户编）',
].join('\n');

/**
 * 资料（2026-10-04 产品方：有些方案要基于做方案人的资料——文档、图片、文字）。
 * 有资料时，事实以资料为准；资料里没有的照样写【待确认】；资料和账号背景对不上，以资料为准并注明。
 */
const materialBlock = (m: PlanMeta) => {
  if (!m.material && !m.files?.length) return '';
  return [
    '',
    '【做方案用的资料——方案必须基于这些资料来写】',
    /*
     * 2026-10-04 线上实测：原来这里写「请先读完这些文件」，模型以为要自己去打开文件，回答「我无法直接读取上传的文件」——
     * 其实三份表格的正文早已由工作流读好（「用户上传的文档正文」那一段）。所以要明说：正文已经在你面前，直接用
     */
    m.files?.length ? `- 用户上传了 ${m.files.length} 份文件：${m.files.join('、')}。这些文件的正文系统已经读取好了，在本条消息最后的「附件正文」和「用户上传的文档正文」里（表格已转成 Markdown 表格），直接使用，不要说读不到、不要让用户再把内容发一遍；只有确实是空的或乱码时，才说明是哪一份没读出来` : '',
    m.material ? `- 用户提供的文字资料：\n${m.material}` : '',
    '- 先从资料里提取能用的事实（人物、经历、资质、产品与服务、价格、数据、案例），方案里用到的事实以资料为准',
    '- 资料里没有、用户也没说的，照样写【待确认】，不要从资料推测出新的数字或经历',
    '- 资料和账号背景对不上时，以资料为准，并在那一处注明「以资料为准」',
  ].filter(Boolean).join('\n');
};

/**
 * 疑点不停工（2026-10-04 线上：资料里「快手数据.xlsx」的数据看起来是抖音的，模型停下来只问「按数据还是按文件名」，大纲没出来）。
 * 先按最合理的判断出完整的东西，疑点单独标出来给用户确认；用户回答过的写进来，同样的问题不再问
 */
const DOUBTS = `- 资料里有矛盾、看起来放错（比如文件名和内容对不上）、缺关键数据时：不要停下来只提问，先按最合理的判断把内容写完整，再把疑点单独标出来让用户确认，写成「> ⚠️ 需要你确认：疑点是什么（我暂按……处理）」，每条一行`;
const clarifyBlock = (m: PlanMeta) => (m.clarify ? `\n\n【用户对你之前提的问题的回答——按这个处理，同样的问题不要再问】\n${m.clarify}` : '');

const NO_FABRICATION =`- 不编事实：预算金额、日期、人数、价格、门店数据、历史业绩、行业统计，用户和账号背景里没有的，一律写「【待确认：要填什么】」，不要编数字
- 引用行业做法可以，但不要写"据统计""数据显示"这类没有出处的数据`;

/** 第一次：只出大纲 */
export function buildOutlinePrompt(m: PlanMeta, context = ''): string {
  const focus = focusOf(m);
  return `${context ? `${context}\n\n` : ''}【任务：出方案 · 第一步，只写大纲】
${briefLines(m)}${materialBlock(m)}${clarifyBlock(m)}

请先只写这份方案的大纲（章节骨架），等用户确认后再写全文。要求：
- 严格按这个格式输出，不要写正文、不要写开场白和总结：
  # 方案标题
  ## 第1章 章节名
  - 这一章要写清的要点（2–5 条，每条一句话）
  ## 第2章 章节名
  - ……
${m.material || m.files?.length ? `- 在「# 方案标题」下面、第 1 章之前，先用引用格式（每行以 > 开头）写 3–6 行「从资料里读到的关键信息」：具体的数据、事实，让用户确认你读对了\n` : ''}- 6–12 章，按这个行业、这个场景的真实做法来定章节，不要套一个万能模板${focus ? `\n- 这类方案通常要覆盖：${focus}（按实际需要取舍、可以增加）` : ''}
- 要点写"这一章要回答什么问题"，具体到这个行业和这次的目标${m.material || m.files?.length ? '；用到资料里的信息时，在要点后标（据资料）' : ''}
- 这一步一定要出完整的大纲，不要只提问不出大纲
${DOUBTS}（放在第 1 章之前）
${NO_FABRICATION}`;
}

/** 从大纲回答里拆出章节：认「## 第N章 标题」「## 一、标题」「## 1. 标题」等二级 / 三级标题，下面的列表是要点 */
export function parseOutline(markdown: string): { title: string; sections: PlanSection[] } {
  const lines = String(markdown || '').split('\n');
  const title = lines.map((l) => l.match(/^\s*#\s+(.+?)\s*$/)?.[1]).find(Boolean)?.replace(/\*\*/g, '').trim() ?? '';
  const sections: PlanSection[] = [];
  for (const line of lines) {
    const h = line.match(/^\s*#{2,3}\s+(.+?)\s*$/);
    if (h) {
      const t = h[1].replace(/\*\*/g, '').replace(/^第\s*[\d一二三四五六七八九十]+\s*[章节部分]\s*[：:、.]?\s*/, '').replace(/^[\d一二三四五六七八九十]+\s*[、.．)）]\s*/, '').trim();
      if (t) sections.push({ title: t.slice(0, 80), points: [] });
      continue;
    }
    const p = line.match(/^\s*(?:[-*+]|\d+[.、)])\s+(.+?)\s*$/);
    if (p && sections.length) sections[sections.length - 1].points.push(p[1].replace(/\*\*/g, '').trim().slice(0, 200));
  }
  return { title, sections: sections.slice(0, 20) };
}

/** 大纲写回 Markdown（给第二次的提示词，也给页面预览） */
export function outlineToMarkdown(sections: PlanSection[], title = ''): string {
  return [title ? `# ${title}` : '', ...sections.flatMap((s, i) => [`## 第${i + 1}章 ${s.title}`, ...s.points.map((p) => `- ${p}`)])].filter(Boolean).join('\n');
}

export const PLAN_END = '—— 方案完 ——';

/** 第二次：按确认后的大纲写全文 */
export function buildFullPlanPrompt(m: PlanMeta, context = '', title = m.title ?? ''): string {
  const sections = m.outline ?? [];
  return `${context ? `${context}\n\n` : ''}【任务：出方案 · 第二步，按确认后的大纲写完整方案】
${briefLines(m)}${materialBlock(m)}${clarifyBlock(m)}

用户确认过的大纲（章节名和顺序不要改，不要增删章节）：
${outlineToMarkdown(sections, title)}
${m.note ? `\n用户补充的要求：${m.note}\n` : ''}
写作要求：
- 第一行写 # 方案标题，每章用「## 第N章 章节名」做标题，和上面的大纲一一对应
- 每章把列出的要点都写到，写成能直接照着执行的内容：谁、在什么时候、做什么、做到什么程度
- 排期、分工、预算、指标这类内容用表格（Markdown 表格）
- 语言是给老板和员工看的方案，不是给 AI 的提示词：不要出现"作为 AI"之类的话
- 资料有矛盾、缺关键数据时，不要停下来提问：按最合理的判断写完，在那一处写「【待确认：疑点是什么（暂按……）】」
${NO_FABRICATION}
- 篇幅不够时优先保证每一章都有，可以把单章写精简；写完所有章节后，最后单独一行写：${PLAN_END}`;
}

/** 全文里缺了哪些章（按章节名找标题），以及有没有写到结尾 */
export function planCompleteness(sections: PlanSection[], text: string): { missing: string[]; ended: boolean } {
  const heads = String(text || '').split('\n').filter((l) => /^\s*#{2,3}\s+/.test(l)).join('\n');
  const norm = (s: string) => s.replace(/[\s*#：:、.．，,（）()]/g, '');
  const missing = sections.map((s) => s.title).filter((t) => !norm(heads).includes(norm(t)));
  return { missing, ended: String(text || '').includes(PLAN_END) };
}

/** 补写：写到一半断了，接着把缺的章节写完 */
export function buildContinuePrompt(m: PlanMeta, missing: string[]): string {
  return `【任务：出方案 · 补写】上一条回答没写完。请接着写下面这些章节（标题用「## 第N章 章节名」，编号和确认的大纲一致），已经写过的不要重复：
${missing.map((t) => `- ${t}`).join('\n')}${materialBlock(m)}
${NO_FABRICATION}
- 全部写完后最后单独一行写：${PLAN_END}`;
}

/** 对话里显示的提问（真正发给模型的是上面那几段长提示词） */
export function planDisplayText(m: PlanMeta): string {
  const mat = [m.files?.length ? `附 ${m.files.length} 份文件` : '', m.material ? `粘贴资料 ${m.material.length} 字` : ''].filter(Boolean).join('，');
  if (m.stage === 'outline' && m.clarify) return `📋 出方案（回答确认的问题，接着出大纲）\n我的回答：${(m.clarify.split('\n').at(-1) ?? '').replace(/^答：/, '')}`;
  if (m.stage === 'outline') return `📋 出方案（第一步：大纲）\n类型：${m.scenario}\n行业：${m.industry || '未填'}\n要解决：${m.goal}${m.facts ? `\n已知条件：${m.facts}` : ''}${mat ? `\n资料：${mat}` : ''}`;
  return `📋 出方案（第二步：按确认的大纲写全文，共 ${m.outline?.length ?? 0} 章）${m.note ? `\n补充要求：${m.note}` : ''}`;
}
