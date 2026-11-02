/**
 * 账号诊断（2026-11-02 产品方：「创作进度变成能对自己账号数据拆解、分析、优化的板块；用拆对标的逻辑拆自己，
 * 也能上传抖音的真实数据；分析结果同步给地基、内容规划、创作方向……配比、流量、人设、变现通通传给需要的板块」）。
 *
 * 材料：插件采集的自己主页（和对标同一套采集）+「账号作品概况」里导入的文件（抖音后台导出的数据表、脚本、截图）
 *      + 作品记录算出的确定配比和录入的数据 + 地基（档案、定位、简报——拿来对照「定的」和「实际的」）。
 * 产出：一份诊断报告（第一部分「现在的你」，第二部分「接下来怎么做」，最后一节是给各板块的指令）。
 * 存放：account_work_insights.insight.diagnosis（和作品概况同一行，不用改库表），规划类板块读它。
 */
import { allStructureNames } from './creation-tree';

export const DIAGNOSIS_TASK_TYPE = '账号诊断';

export interface AccountDiagnosis {
  /** 诊断报告的 markdown 原文 */
  report: string;
  generatedAt: string;
  /** 读到了哪些材料（一句一项），给页面和报告抬头用 */
  materials: string[];
}

export const DIAGNOSIS_FRAMEWORK = [
  '## 第一部分　现在的你：这个号实际是什么样',
  '',
  '### 一、材料清单',
  '列出读到的材料（插件采集的作品几条、覆盖大约多久、细看的作品和评论几条；导入的文件有哪些、哪些是抖音后台的真实数据；作品记录几条、录了数据的几条），以及缺了什么。',
  '没有抖音后台数据（完播率、5 秒完播、平均播放时长、涨粉、主页访问）时写明：流量诊断只能按点赞和评论，建议编导到抖音创作者中心导出「作品数据」表格，导入后再诊断一次。',
  '',
  '### 二、核心诊断（先看这 8 条）',
  '每条一行、不超过 30 字：',
  '1. **实际是什么号**：按作品倒推出来的一句话定位',
  '2. **和地基差多少**：实际做的和账号定位里定的，最大的偏差是什么（没做账号定位就写【待核实：先做账号定位】）',
  '3. **配比**：流量型 / 人设型 / 变现型实际各占多少，和计划差多少',
  '4. **流量**：哪类内容在带流量，哪类在拖后腿',
  '5. **人设**：立住没有，观众记住的是什么',
  '6. **变现**：成交路径通到哪一步、卡在哪',
  '7. **最大的问题**',
  '8. **最该先做的一件事**',
  '',
  '### 三、实际定位 vs 地基定位',
  '写成表格：维度 | 地基里定的 | 作品里实际呈现的 | 偏差 | 依据。维度按账号定位方案的六维：人设定位、用户定位、内容定位、呈现定位、风格调性、变现定位。地基里没写的那一格写「未定」。',
  '',
  '### 四、六维深度拆解（和拆对标同一套，拆的是自己）',
  '#### 1. 人设定位',
  '- **观众眼里的人设标签句**：不超过 20 字，从作品和评论倒推，不写「专业、有温度」这种谁都能用的词',
  '- **证据链**：哪几类作品在反复证明这个人设（举作品清单编号）；哪几条在拆台',
  '#### 2. 用户定位',
  '- **实际吸引来的是谁**：从选题和评论区倒推成一个具体的人；和档案里想要的人群是不是同一拨',
  '- **他们心里没说出口的那句话**',
  '#### 3. 内容定位',
  '- **选题母题**：反复出现的 3～5 个方向，各几条，各举编号；哪个母题在出数据',
  '- **脚本结构**：能从标题、文案、导入的脚本看出来的，归到注册表里的结构名（看不出写【待核实】）',
  '- **每类内容管哪一段路**：刷到 → 记住 → 信 → 联系，现在哪一步没有内容在管',
  '#### 4. 呈现定位',
  '- 主要形式、在哪拍、谁出镜、时长；和档案里的拍摄条件是不是对得上',
  '#### 5. 风格调性',
  '- 气质关键词 3 个；口吻前后一不一致（举例，引用不超过 15 字）',
  '#### 6. 变现定位',
  '- 实际在卖什么、成交路径走的是哪条（主页、橱窗、团购、私信、到店……），每条写依据；看不出的写【待核实】',
  '#### 7. 记忆点和主页五件套',
  '- 口头禅、动作、道具、场景、封面样式里反复出现的元素；头像、昵称、简介、背景图、置顶能看到的逐条说它接没接住定位',
  '#### 8. 自洽检验',
  '- 遮住字幕还认得出是你吗、只听声音知道是什么号吗、主页和作品像不像同一个号：能判断的逐条回答，判断不了的写【待核实】',
  '',
  '### 五、流量诊断',
  '- **点赞分布**：中位数、最高、明显高于中位数的有几条（样本少于 10 条注明「样本不足，仅供参考」）',
  '- **爆款和低赞差在哪**：拿「热门」和「对照」两组比选题、标题、开头第一句、时长、形式，写成表格；只说「相关」',
  '- **真实数据**（有抖音后台数据才写）：完播、5 秒完播、平均播放时长、涨粉、主页访问，哪几条好、哪几条差、和别的条比差在哪',
  '- **更新节奏**：用材料里的时间跨度（粗估）和作品记录说清多久一条、稳不稳',
  '',
  '### 六、配比诊断',
  '- 把作品清单逐条归到流量型 / 人设型 / 变现型（作品记录里写了目的的以记录为准），给出实际占比，和档案计划配比对比',
  '- 三类各自的数据表现（有数据才比），哪一类在起作用',
  '',
  '### 七、人设诊断',
  '- 观众记住的是什么人（评论区怎么称呼、问的是人还是货）；人设标签句立住没有',
  '- 哪几条作品在证明人设、哪几条在拆台（举作品编号）',
  '',
  '### 八、变现诊断',
  '- 成交路径（刷到 → 记住 → 信 → 联系 → 到店 / 下单）每一步现在有没有内容在管、卡在哪',
  '- 评论区求购、问价、问地址的有几条，作者回了没有；主页五件套（头像、昵称、简介、背景、置顶）有没有接住',
  '',
  '### 九、评论区在说什么',
  '把读到的评论按「提问 / 共鸣 / 求购求地址 / 质疑 / 玩梗」归类，各几条，各举一句（引用不超过 15 字）；观众最关心的 3 件事。',
  '',
  '## 第二部分　接下来怎么做',
  '这一部分是重点，要具体到能照着做，不写「可以考虑」「建议加强」这种空话。',
  '',
  '### 十、问题清单（按影响排序，最多 5 个）',
  '每个问题写：现象 → 依据（作品编号、数据、评论）→ 影响 → 怎么改。',
  '',
  '### 十一、接下来 30 天的布局',
  '- **配比**：流量型 / 人设型 / 变现型各占多少、为什么（和现在比怎么调）',
  '- **系列**：哪些继续做、哪些停、要不要新开（每个说理由）',
  '- **节奏**：每周发几条、哪几天发、每周拍几条',
  '- **看什么数**：每类内容用什么指标判断成没成（和自己前几条比，不写绝对合格线）',
  '',
  '### 十二、给各板块的指令',
  '每行一个板块，格式「- 板块名：一句话指令」，要具体到能直接用（多拍什么、少拍什么、开头怎么开、结尾动作是什么），开物的各板块会读这一节：',
  '- 内容规划：',
  '- 创作方向：',
  '- 选题：',
  '- 脚本：',
  '- 人设：',
  '- 变现：',
  '- 地基：账号定位 / 内容定位 / 商业定位要不要重做、为什么（只建议，不替老板改）',
  '',
  '### 十三、待核实',
  '列出报告里所有【待核实】的地方，以及补了什么材料能诊断得更准。',
].join('\n');

export interface DiagnosisQueryInput {
  profileName: string;
  /** 材料清单，一句一项 */
  materialLines: string[];
  /** 插件采集的自己主页（lib/benchmark-collection 的 formatCollection） */
  collectedText: string;
  /** 「账号作品概况」里导入的文件读出的文字 */
  fileTexts: { name: string; text: string }[];
  /** 作品记录算出的配比、数据（lib/work-insight 的 workInsightPromptBlock） */
  insightBlock: string;
  /** 地基：档案、定位、简报（buildContextBlock） */
  contextBlock: string;
}

const FILE_CHARS = 12_000;
const FILES_TOTAL = 40_000;

export function buildDiagnosisQuery(input: DiagnosisQueryInput): string {
  let budget = FILES_TOTAL;
  const files: string[] = [];
  for (const f of input.fileTexts) {
    if (budget <= 0) break;
    const body = f.text.slice(0, Math.min(FILE_CHARS, budget));
    budget -= body.length;
    files.push(`### 文件：${f.name}\n${body}`);
  }
  return [
    '你是做实体店短视频代运营的资深编导，现在给自己接手的账号做一次诊断：先看清这个号实际做成了什么样、和当初定的方向差多少，再给出接下来 30 天怎么做。',
    '用和拆对标账号同一套维度（账号定位方案的六维），只是拆的是自己的号，而且要拿「地基里定的」和「作品里实际的」对照。每条结论都要说明依据来自哪份材料。',
    `脚本结构归类只能从注册表里选，一字不差：${allStructureNames().join('、')}。写不进去的写「未归入注册表」。`,
    '',
    `【诊断的账号】${input.profileName || '我的账号'}`,
    '【材料清单】',
    ...input.materialLines.map((l) => `- ${l}`),
    '',
    '【插件采集的主页数据】',
    input.collectedText.trim() || '（这次没有采集主页，只用导入的文件和作品记录）',
    '',
    '【导入的文件（抖音后台导出的数据、脚本、字幕等）】',
    ...(files.length ? files : ['（没有导入文件）']),
    '',
    '【作品记录：确定的配比和录入的数据】',
    input.insightBlock.trim() || '（还没有作品记录或分析）',
    '',
    '【地基：档案、账号定位、创作简报（拿来对照「定的」和「实际的」）】',
    input.contextBlock.trim() || '（还没有账号档案）',
    '',
    '## 诊断要求（每条都要有依据）',
    '1. 只能依据上面的材料下结论。材料里没有的，写【待核实】，不要猜，不编数字。',
    '2. 每条结论后面用括号标明依据，比如「（作品清单第 3、7 条）」「（热门 1 的评论区）」「（对照 2）」「（文件：作品数据.xlsx）」「（作品记录）」「（账号定位）」。',
    '3. 数据类结论只能说「相关」，不写成「因为……所以……」；样本少于 10 条时注明「样本不足，仅供参考」。',
    '4. 地基（账号定位、内容定位）是老板定的方向：现状和它不一致时，先说清偏差和数据，再建议是调整做法还是重做地基，不替老板改方向。',
    '5. 不评价是否违规，不写广告法禁用词。',
    '',
    '## 输出框架（严格按这个顺序和标题）',
    DIAGNOSIS_FRAMEWORK,
  ].join('\n');
}

/** 报告里按「### 标题」切出某一节的正文（不含标题行）；找不到返回空串 */
export function diagnosisSection(report: string, title: RegExp): string {
  const sections = report.split(/\n(?=#{2,3}\s)/);
  const hit = sections.find((s) => /^#{3}\s/.test(s.trim()) && title.test(s.trim().split('\n')[0]));
  return hit ? hit.trim().split('\n').slice(1).join('\n').trim() : '';
}

/** 「给各板块的指令」那一节里，某个板块的那一行（「- 选题：……」）；没有返回空串 */
export function diagnosisInstruction(report: string, board: string): string {
  const body = diagnosisSection(report, /给各板块的指令/);
  const line = body.split('\n').find((l) => new RegExp(`^[-*]\\s*\\**${board}\\**[：:]`).test(l.trim()));
  return line ? line.trim().replace(/^[-*]\s*/, '').replace(/\*\*/g, '').replace(new RegExp(`^${board}[：:]\\s*`), '').trim() : '';
}

const BLOCK_CHARS = 2600;

/**
 * 诊断给多少（板块按 lib/context-manifest 的 diagnosis 字段领，地基板块固定 foundation，助理用 assistant）：
 *   planning   诊断要点 + 30 天布局 + 给各板块的指令（规划类）
 *   single     只有脚本、人设、变现三行指令（写单条内容的）
 *   foundation 诊断要点 + 实际 vs 地基 + 对地基的建议（账号定位、内容定位、商业定位、行业建议）
 *   assistant  诊断要点 + 最大的问题和先做什么（助理每轮的老板现状）
 */
export type DiagnosisScope = 'planning' | 'single' | 'foundation' | 'assistant';

/** 写进提示词的「账号诊断」。没有诊断返回空串 */
export function diagnosisPromptBlock(diag: AccountDiagnosis | null | undefined, scope: DiagnosisScope | null | undefined): string {
  if (!scope || !diag?.report?.trim()) return '';
  const date = diag.generatedAt.slice(0, 10);
  const r = diag.report;
  const key = diagnosisSection(r, /核心诊断/);
  const plan = diagnosisSection(r, /30 ?天的布局/);
  const orders = diagnosisSection(r, /给各板块的指令/);
  let body: string[];
  if (scope === 'assistant') {
    body = [key && `核心诊断：\n${key}`, orders && `诊断给各板块的指令（派活时照这个补全派活单）：\n${orders}`].filter(Boolean) as string[];
    if (!body.length) return '';
  } else if (scope === 'foundation') {
    const foundation = diagnosisInstruction(r, '地基');
    body = [
      key && `核心诊断：\n${key}`,
      diagnosisSection(r, /实际定位 vs 地基定位/) && `实际 vs 地基：\n${diagnosisSection(r, /实际定位 vs 地基定位/)}`,
      foundation && `诊断对地基的建议：${foundation}`,
      '这是账号现状的反馈：重做定位时参考「实际做成了什么、哪里有效」，方向仍以老板这次的要求和档案为准，不因为某类数据好就替他改方向。',
    ].filter(Boolean) as string[];
  } else if (scope === 'planning') {
    body = [
      key && `核心诊断：\n${key}`,
      plan && `接下来 30 天的布局：\n${plan}`,
      orders && `给各板块的指令：\n${orders}`,
      '以上是账号现状和诊断给的方向，规划时照它调整配比和系列；本次用户另有要求的，以本次要求为准。',
    ].filter(Boolean) as string[];
  } else {
    const lines = ['脚本', '人设', '变现'].map((b) => [b, diagnosisInstruction(r, b)] as const).filter(([, v]) => v);
    if (!lines.length) return '';
    body = [lines.map(([b, v]) => `- ${b}：${v}`).join('\n'), '这几条是账号诊断给单条内容的提醒，和本条的选题、目的冲突时以本条为准。'];
  }
  const text = body.join('\n\n');
  return [`### 🩺 账号诊断（${date}）`, '', text.length > BLOCK_CHARS ? `${text.slice(0, BLOCK_CHARS)}…（诊断全文在创作进度页）` : text].join('\n');
}
