import type { AssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm, type LlmResponse } from '@/lib/assistant/llm';

/**
 * 图片（数据截图、脚本页面、选题表的截图）交给模型读：照抄图里的文字和数字，不编造，不评价。
 * 读出来的内容和文件里的文字一样参与分析，但会标明「由模型读取，可能有误差」。
 */

/** 送去识别的图片上限（base64 之后会再大三分之一） */
export const VISION_MAX_BYTES = 4 * 1024 * 1024;

const MEDIA_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export function imageMediaType(name: string): string | null {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return MEDIA_TYPES[ext] ?? null;
}

const VISION_SYSTEM = [
  '你在帮短视频创作者读取他上传的一张图片。图片可能是：后台数据截图（每条内容的标题、播放、点赞等）、脚本或文案页面、选题表、或视频封面。',
  '请按这些要求输出：',
  '1. 图中的文字、表格、数字照抄，不要改写、不要补全、不要猜测看不清的字，看不清就写「看不清」。',
  '2. 如果是数据截图：每条内容一行，写清标题、播放、点赞、完播等能看到的指标。',
  '3. 如果是脚本或文案：写清脚本类型（教知识、讲故事、聊观点、晒过程等，图里没有就不写）、开篇、结构、风格、面向的人群，只写图里有的。',
  '4. 不做评价，不给建议。只输出提取到的内容。',
].join('\n');

export type VisionCall = (
  cfg: AssistantConfig,
  req: Parameters<typeof callAssistantLlm>[1],
  opts: Parameters<typeof callAssistantLlm>[2],
) => Promise<LlmResponse>;

/** 读一张图片，返回提取出来的文字（读不出来是空串）。模型出错会抛出，由调用方决定怎么说 */
export async function describeImageMaterial(
  cfg: AssistantConfig,
  bytes: Uint8Array,
  mediaType: string,
  call: VisionCall = callAssistantLlm,
): Promise<string> {
  const data = Buffer.from(bytes).toString('base64');
  const res = await call(
    cfg,
    {
      system: VISION_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: '请按要求提取这张图片的内容。' },
          ],
        },
      ],
      tools: [],
      maxTokens: 1500,
    },
    { signal: AbortSignal.timeout(60_000) },
  );
  return res.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
