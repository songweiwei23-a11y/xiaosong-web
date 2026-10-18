/**
 * 对标拆解（整改 C · 对标拆解，2026-10-18）：编导给什么材料（截图、文档、文字、视频）都行，
 * 统一拆成同一套框架：账号定位 + 内容打法 + 对我们的参考。这里是分类、限制、汇总和提示词（纯函数）。
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

/** 固定的拆解框架：每次都按这个顺序和标题输出，方便对照和保存 */
export const BENCHMARK_FRAMEWORK = [
  '### 一、材料清单',
  '列出读到的材料（截图几张、文字几段、视频几个），以及有哪些地方看不清或缺失。',
  '',
  '### 二、账号定位拆解',
  '- 人设：他在拍谁，以什么身份出镜',
  '- 目标人群：主要给谁看',
  '- 赛道与细分：具体做哪一块',
  '- 核心卖点：他反复强调什么',
  '- 变现方式：带货、引流到店、咨询，还是别的（没有依据就写【待核实】）',
  '- 差异化：和同赛道常见做法比，他不一样的地方',
  '',
  '### 三、内容拆解',
  '- 选题类型占比：把能看到的作品标题归类，给出各类的数量和占比',
  '- 常见开头：问题型、数字型、场景型、结论型等，各出现几次',
  '- 视频结构：通常怎么安排开头、主体、结尾',
  '- 时长规律：多数视频多长（没有依据就写【待核实】）',
  '- 数据表现：如果有数据，哪类内容播放、完播、点赞更好（没有数据就写「未提供数据」）',
  '',
  '### 四、对我们的参考',
  '- 值得借鉴的 2～3 条，每条说清楚为什么适合我们的账号',
  '- 不建议照搬的 1～2 条，说明为什么和我们不匹配',
  '- 下一条可以试的一个选题方向（只给方向，不写成稿）',
  '',
  '### 五、待核实',
  '列出报告里所有【待核实】的地方，方便编导补充资料后再拆一次。',
].join('\n');

export interface BenchmarkQueryInput {
  accountName: string;
  platform: string | null;
  materialLines: string[];
  materialText: string;
  contextBlock: string;
}

/** 拆解提示词：对标方的材料 + 我们的账号背景（只用于「对我们的参考」）+ 固定框架和依据规则 */
export function buildBenchmarkQuery(input: BenchmarkQueryInput): string {
  return [
    '你是编导的对标分析助手。下面是编导提供的「对标账号」资料，请按固定框架拆解这个账号，并说明每条结论依据来自哪份材料。',
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
    '2. 每条结论后面用括号标明依据来自哪份材料，比如「（主页截图）」「（视频 1 的口播）」「（文字资料）」。',
    '3. 数据类结论只能说「相关」，不要写成「因为……所以……」；样本少于 10 条时注明「样本不足，仅供参考」。',
    '4. 不要照抄对方的原话或文案；需要引用时，最多 15 个字并加引号。',
    '5. 不评价对方是否违规，只拆结构和打法。',
    '',
    '## 输出框架（严格按这个顺序和标题）',
    BENCHMARK_FRAMEWORK,
  ].join('\n');
}
