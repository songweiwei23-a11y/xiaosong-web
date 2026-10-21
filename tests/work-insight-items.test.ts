/**
 * 创作进度：上传的各种文件（字幕、视频、图片）和识别出的每条内容（脚本类型、结构、风格、开篇、人群、发布、数据）。
 * 模型调用都用假的，不碰真实的中转接口。
 */
import { describe, it, expect } from 'vitest';
import { extractMaterial } from '@/lib/work-materials/extract';
import { describeImageMaterial, imageMediaType, VISION_MAX_BYTES } from '@/lib/work-materials/vision';
import { itemDigestLine, insightPrompt, mixReport, parseInsightJson, roleFeedback, workInsightPromptBlock, type WorkInsight, type MaterialItem } from '@/lib/work-insight';
import { summarizePerformance } from '@/lib/performance';
import type { AssistantConfig } from '@/lib/assistant/config';

const enc = (s: string) => new TextEncoder().encode(s);
const cfg: AssistantConfig = { baseUrl: 'https://x', apiKey: 'k', model: 'm' };

function item(over: Partial<MaterialItem> = {}): MaterialItem {
  return { title: 't', role: '不确定', scriptType: null, structure: null, style: null, opening: null, audience: null, published: null, views: null, file: null, ...over };
}

describe('字幕和视频', () => {
  it('srt 字幕按台词读出来（带时间码的行也保留了说话内容）', () => {
    const srt = '1\n00:00:01,000 --> 00:00:03,000\n今天摊主说了一句实话\n\n2\n00:00:03,500 --> 00:00:06,000\n我们收摊很晚';
    const r = extractMaterial('开箱.srt', enc(srt));
    expect(r.status).toBe('ok');
    expect(r.text).toContain('摊主说了一句实话');
    expect(r.text).toContain('我们收摊很晚');
  });

  it('视频本身读不出来，但会告诉用户需要导入脚本或字幕', () => {
    const r = extractMaterial('收摊.mp4', enc('fake video bytes'));
    expect(r.kind).toBe('video');
    expect(r.status).toBe('unsupported');
    expect(r.note).toContain('字幕');
    expect(r.note).toContain('脚本');
  });
});

describe('图片识别（交给模型读，不编造）', () => {
  it('能认出图片类型；不认识的格式不送去识别', () => {
    expect(imageMediaType('截图.PNG')).toBe('image/png');
    expect(imageMediaType('封面.jpeg')).toBe('image/jpeg');
    expect(imageMediaType('动图.gif')).toBe('image/gif');
    expect(imageMediaType('设计.psd')).toBeNull();
    expect(VISION_MAX_BYTES).toBe(4 * 1024 * 1024);
  });

  it('把图片作为图片块发给模型，取回模型读出来的文字', async () => {
    let sent: { messages: { content: unknown }[]; system: string } | null = null;
    const text = await describeImageMaterial(cfg, enc('png-bytes'), 'image/png', async (_c, req) => {
      sent = req as unknown as { messages: { content: unknown }[]; system: string };
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: '第一条 12000 播放' }] };
    });
    expect(text).toBe('第一条 12000 播放');
    const blocks = (sent!.messages[0].content as { type: string; source?: { media_type: string } }[]);
    expect(blocks[0].type).toBe('image');
    expect(blocks[0].source?.media_type).toBe('image/png');
    expect(sent!.system).toContain('照抄');
    expect(sent!.system).toContain('不做评价');
  });

  it('模型没有读出文字：返回空串，不当成内容', async () => {
    const text = await describeImageMaterial(cfg, enc('x'), 'image/jpeg', async () => ({ stop_reason: null, content: [] }));
    expect(text).toBe('');
  });
});

describe('识别出的每条内容：字段只认文件里写明的', () => {
  it('完整解析脚本类型、结构、风格、开篇、人群、发布和播放；没写的是 null，不猜', () => {
    const raw = JSON.stringify({
      planning: [],
      feedback: [],
      materials: [],
      items: [
        {
          title: '摊主的一句实话',
          file: '脚本.docx',
          role: '人设型',
          scriptType: '讲故事',
          structure: '经历 → 感受 → 收住',
          style: '口语',
          opening: '收摊时摊主说了一句话',
          audience: '本地夜宵人群',
          published: true,
          views: '1.2 万',
        },
        { title: '没写的内容', role: '别的', published: 'yes', views: 0 },
        'not-an-object',
      ],
    });
    const p = parseInsightJson(raw)!;
    expect(p.items).toHaveLength(2);
    expect(p.items[0]).toMatchObject({
      title: '摊主的一句实话',
      role: '人设型',
      scriptType: '讲故事',
      structure: '经历 → 感受 → 收住',
      style: '口语',
      opening: '收摊时摊主说了一句话',
      audience: '本地夜宵人群',
      published: true,
      views: '1.2 万',
      file: '脚本.docx',
    });
    // 没写的字段、非布尔的发布状态、数字形式的播放，都不当成确定的值
    expect(p.items[1]).toMatchObject({ role: '不确定', scriptType: null, published: null, views: null, file: null });
  });

  it('内容概况一句话：条数、已发布几条，脚本类型和人群的分布', () => {
    const line = itemDigestLine([
      item({ title: 'a', scriptType: '讲故事', audience: '夜宵人群', published: true }),
      item({ title: 'b', scriptType: '讲故事', audience: '夜宵人群', published: false }),
      item({ title: 'c', scriptType: '教知识', published: true }),
    ]);
    expect(line).toContain('文件里识别出 3 条内容（已发布 2 条）');
    expect(line).toContain('讲故事 2 条');
    expect(line).toContain('夜宵人群 2 条');
    expect(itemDigestLine([])).toBeNull();
  });

  it('作品概况的提示块带上这份内容概况（标明是推测），规划类板块能看到', () => {
    const insight: WorkInsight = {
      generatedAt: '2026-10-21T08:00:00.000Z',
      overview: { works: 0, shot: 0, published: 0, withData: 0, materials: 1 },
      mix: mixReport([], null),
      feedback: roleFeedback(summarizePerformance([])),
      dataNotes: [],
      materialMix: null,
      items: [item({ title: 'a', scriptType: '讲故事', published: true })],
      planning: [],
      reviewNotes: [],
      materialNotes: [],
      modelUsed: true,
      caveats: [],
    };
    const block = workInsightPromptBlock(insight);
    expect(block).toContain('文件里的内容概况（推测）');
    expect(block).toContain('讲故事 1 条');
  });

  it('分析的提示词要求模型逐项填这些字段，并且文件里没有的写 null', () => {
    const p = insightPrompt({
      profileSummary: '',
      works: [],
      mix: mixReport([], null),
      feedback: roleFeedback(summarizePerformance([])),
      dataNotes: [],
      materialTexts: [],
    });
    for (const key of ['scriptType', 'structure', 'style', 'opening', 'audience', 'published', 'views']) {
      expect(p.system).toContain(`"${key}"`);
    }
    expect(p.system).toContain('文件里没有的一律写 null');
  });
});
