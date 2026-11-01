/**
 * 对标拆解（整改 C · 对标拆解，2026-10-18）：编导给什么材料（截图、文档、文字、视频）都行，
 * 统一拆成同一套框架（11-02 起按账号定位方案的维度倒着拆，见 BENCHMARK_FRAMEWORK）。这里是分类、限制、汇总和提示词（纯函数）。
 * 视频的抽帧和语音转文字、图片上传、模型调用都在组件里，复用拆解爆款的现成流程。
 */
import { attachmentReadable } from './document-text';

export const BENCHMARK_TASK_TYPE = '对标拆解';

export const BENCHMARK_LIMITS = {
  images: 9,
  documents: 3,
  videos: 2,
  files: 12,
  /** 文档大小上限（字节）：和聊天附件一致 */
  documentBytes: 10 * 1024 * 1024,
} as const;

export type MaterialKind = 'image' | 'video' | 'document' | 'unsupported';

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

/** 按文件名和类型判断材料是什么。图片只收 JPG/PNG/WebP（上传接口只认这三种） */
export function classifyMaterial(name: string, type: string): MaterialKind {
  const IMAGE_TYPE = /^image\/(jpeg|png|webp)$/;
  // 类型认得就按类型；浏览器没填类型时才看后缀。GIF、HEIC 这类认不了，直接告诉编导
  if (IMAGE_TYPE.test(type) || (!type && IMAGE_EXT.test(name))) return 'image';
  if (/^image\//.test(type) || IMAGE_EXT.test(name)) return 'unsupported';
  if (/^video\//.test(type) || VIDEO_EXT.test(name)) return 'video';
  if (attachmentReadable(name)) return 'document';
  return 'unsupported';
}

export interface MaterialFile {
  name: string;
  type: string;
  size: number;
}

/** 数量和大小的检查：通过返回 null，不通过返回一句给编导看的话 */
export function checkMaterials(files: MaterialFile[]): string | null {
  if (!files.length) return null;
  const kinds = files.map((f) => ({ f, kind: classifyMaterial(f.name, f.type) }));
  const bad = kinds.find((k) => k.kind === 'unsupported');
  if (bad) return `「${bad.f.name}」读不了。截图请存成 JPG 或 PNG，文档请用 TXT、Word、Excel、PPT 或 CSV，视频用 MP4 或 MOV`;
  if (files.length > BENCHMARK_LIMITS.files) return `一次最多 ${BENCHMARK_LIMITS.files} 个文件`;
  const count = (k: MaterialKind) => kinds.filter((x) => x.kind === k).length;
  if (count('image') > BENCHMARK_LIMITS.images) return `截图最多 ${BENCHMARK_LIMITS.images} 张`;
  if (count('video') > BENCHMARK_LIMITS.videos) return `视频最多 ${BENCHMARK_LIMITS.videos} 个（每个不超过 3 分钟，超出的只拆前 3 分钟）`;
  if (count('document') > BENCHMARK_LIMITS.documents) return `文档最多 ${BENCHMARK_LIMITS.documents} 个`;
  const bigDoc = kinds.find((k) => k.kind === 'document' && k.f.size > BENCHMARK_LIMITS.documentBytes);
  if (bigDoc) return `「${bigDoc.f.name}」超过 10MB，请拆小一点再传`;
  return null;
}

export interface MaterialSummaryInput {
  images: number;
  texts: { name: string; chars: number }[];
  videos: { name: string; frames: number; speechChars: number; truncated: boolean }[];
}

/** 「读到了什么」：给编导看，也写进提示词，让模型知道分析基于什么 */
export function summarizeMaterials(input: MaterialSummaryInput): string[] {
  const lines: string[] = [];
  if (input.images) lines.push(`截图 ${input.images} 张`);
  for (const t of input.texts) lines.push(`文字资料「${t.name}」约 ${t.chars} 字`);
  for (const v of input.videos) {
    const speech = v.speechChars ? `，转写了约 ${v.speechChars} 字口播` : '，没识别出口播（可能是纯画面或音乐）';
    lines.push(`视频「${v.name}」抽了 ${v.frames} 张画面${speech}${v.truncated ? '（只拆了前 3 分钟）' : ''}`);
  }
  return lines.length ? lines : ['没有提供材料'];
}

/**
 * 固定的拆解框架：每次都按这个顺序和标题输出，方便对照和保存。
 * 2026-11-02 产品方：「像做定位那样详细，只不过是拆定位，换个角度」——
 * 所以按账号定位方案（lib/positioning-standards 的 OUTPUT_FULL）同一套维度倒着拆：
 * 定位是「我们该是什么号」，这里是「他是什么号、凭什么做起来的」，每条都要拿作品、数据、评论作证。
 */
export const BENCHMARK_FRAMEWORK = [
  '### 一、材料清单',
  '列出读到的材料（插件采集的作品几条、热门作品评论几条、截图和封面几张、文字几段、视频几个），以及缺了什么、哪些看不清。',
  '',
  '### 二、核心结论（先看这 8 条）',
  '每条一行、不超过 30 字：',
  '1. **这是什么号**：主体类型 + 倒推出来的一句话定位',
  '2. **给谁看**：一句话画像',
  '3. **人设标签**：观众能跟朋友复述的那句话',
  '4. **主打内容**：流量型 / 人设型 / 变现型大致各占多少 + 主力形式',
  '5. **怎么赚钱**：成交路径一句话（看不出就写【待核实】）',
  '6. **靠什么爆**：爆款作品的共同点',
  '7. **最值得我们学的一招**',
  '8. **他的软肋**',
  '',
  '### 三、一句话定位（倒推）',
  '按 [身份] + [特点] + [价值] 倒推他的定位，不超过 30 字，要写出立场：他替观众做的哪一件具体的事、凭什么是他。后面写依据（主页简介、置顶、作品标题里反复出现的说法）。',
  '',
  '### 四、六维拆解',
  '#### 1. 人设定位',
  '- **人设标签句**：不超过 20 字，具体到能复述，不写「专业、有温度」这种谁都能用的词',
  '- **用了哪个入口**：痛点+职业 / 特殊经历 / 外形身份 / 性格 / 关系 / 反差，选一个并说依据',
  '- **证据链**：他靠哪几类作品反复证明这个人设（举作品清单里的编号）',
  '- **边界**：他从来不碰、一碰人设就崩的东西',
  '#### 2. 用户定位',
  '- **一句话画像**：从选题和评论区倒推，写成一个具体的人，不写年龄段加职业',
  '- **评论区在说什么**：把读到的评论按「提问 / 共鸣 / 求购求地址 / 质疑 / 玩梗」归类，各几条，各举一句（引用不超过 15 字）',
  '- **他们心里没说出口的那句话**',
  '- **他们在平台上会搜什么词**',
  '#### 3. 内容定位',
  '- **长期提供什么价值**：一句话',
  '- **作品归类**：把作品清单逐条归到流量型 / 人设型 / 变现型，给出各几条、占比；每类再写主要用什么形式（知识/故事/过程/观点/段子）',
  '- **选题母题**：反复出现的 3～5 个选题方向，各几条，各举编号',
  '- **脚本结构**：能从标题和口播看出来的，归到注册表里的结构名（看不出写【待核实】）',
  '- **每类内容管哪一段路**：刷到 → 记住 → 信 → 联系，哪类作品负责哪一步',
  '#### 4. 呈现定位',
  '- 主要形式（图文/口播/Vlog/情景剧……）、在哪拍、谁出镜；更新频率（有发布时间才写，没有写【待核实】）',
  '#### 5. 风格调性',
  '- 气质关键词 3 个；他会说的一句话 / 他不会说的一句话（各举一例，引用不超过 15 字）',
  '#### 6. 变现定位',
  '- 卖什么、大概什么价位、成交路径（主页、橱窗、团购、私信、到店……），每条写依据；看不出的写【待核实】',
  '',
  '### 五、数据表现',
  '- **点赞分布**：中位数、最高、明显高于中位数的有几条（样本少于 10 条注明「样本不足，仅供参考」）',
  '- **爆款共同点**：点赞最高的几条在选题、标题写法、形式上有什么共同点，和普通作品差在哪（只说「相关」，不说「因为所以」）',
  '- **置顶作品**：他置顶了什么，说明他最想让新访客先看到什么',
  '- **热门作品的评论区**：观众最关心的 3 件事',
  '',
  '### 六、记忆点',
  '口头禅、动作、道具、服装、场景、封面样式里，能看到的反复出现的元素，各说依据；看不到的不写。',
  '',
  '### 七、差异化：常规A + 变量B',
  '- **同赛道常规A**：同行最常见的拍法（按常识判断，注明是推测）',
  '- **他的变量B**：他在人物 / 情境 / 行为 / 表达里改了哪一个，所以和别人不一样',
  '',
  '### 八、账号五件套',
  '头像、昵称、简介、背景图、置顶：能看到的逐条说它怎么服务这个定位，看不到的写【待核实】。',
  '',
  '### 九、自洽检验',
  '遮住字幕还认得出是他吗、只听声音知道是什么号吗、五件套和作品像不像同一个号：能判断的逐条回答，判断不了的写【待核实】。',
  '',
  '### 十、他的软肋和风险',
  '1～2 条：哪里撑不久、哪里容易被模仿、哪里数据在掉。说实话。',
  '',
  '### 十一、对我们的参考',
  '- 值得借鉴的 2～3 条，每条说清楚为什么适合我们的账号',
  '- 不建议照搬的 1～2 条，说明为什么和我们不匹配',
  '- 下一条可以试的一个选题方向（只给方向，不写成稿）',
  '',
  '### 十二、待核实',
  '列出报告里所有【待核实】的地方，方便编导补充资料后再拆一次。',
].join('\n');

export interface BenchmarkQueryInput {
  accountName: string;
  platform: string | null;
  materialLines: string[];
  materialText: string;
  contextBlock: string;
}

import { allStructureNames } from './creation-tree';

/** 拆解提示词：对标方的材料 + 我们的账号背景（只用于「对我们的参考」）+ 固定框架和依据规则 */
export function buildBenchmarkQuery(input: BenchmarkQueryInput): string {
  return [
    '你是做实体店短视频代运营的资深编导。下面是一个「对标账号」的资料，请像给客户做账号定位方案那样详细，倒过来拆出这个账号的定位：他是什么号、给谁看、靠什么做起来、怎么赚钱。每条结论都要说明依据来自哪份材料。',
    // 对标账号的结构归类只能用注册表里的名字，和选题、脚本接得上（2026-10-30，lib/creation-tree）
    `对标账号的脚本结构归类只能从注册表里选，一字不差：${allStructureNames().join('、')}。写不进去的写「未归入注册表」。`,
    '',
    `【对标账号】${input.accountName}（${input.platform || '平台未填'}）`,
    '【材料清单】',
    ...input.materialLines.map((l) => `- ${l}`),
    '',
    '【编导提供的文字资料】',
    input.materialText.trim() || '（没有文字资料，只有截图或视频，结论依据请写清楚是哪张图或哪段视频）',
    '',
    '【我们的账号背景（只用于「对我们的参考」，拆解对方本身只看上面的材料）】',
    input.contextBlock.trim() || '（还没有账号档案）',
    '',
    '## 拆解要求（每条都要有依据）',
    '1. 只能依据上面提供的材料下结论。材料里没有的，写【待核实】，不要猜。',
    '2. 每条结论后面用括号标明依据来自哪份材料，比如「（主页信息）」「（作品清单第 3、7、12 条）」「（热门作品 1 的评论区）」「（封面）」「（视频 1 的口播）」「（文字资料）」。',
    '3. 数据类结论只能说「相关」，不要写成「因为……所以……」；样本少于 10 条时注明「样本不足，仅供参考」。',
    '4. 不要照抄对方的原话或文案；需要引用时，最多 15 个字并加引号。',
    '5. 不评价对方是否违规，只拆结构和打法。',
    '',
    '## 输出框架（严格按这个顺序和标题）',
    BENCHMARK_FRAMEWORK,
  ].join('\n');
}
