import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm } from '@/lib/assistant/llm';
import { finalizeTopicBatch, parseTopicOverlap, topicCountInRequest } from '@/lib/topic-delivery';
import { splitTopicSections, type TopicSection } from '@/lib/topic-library';

vi.mock('@/lib/assistant/config', () => ({ readAssistantConfig: vi.fn() }));
vi.mock('@/lib/assistant/llm', () => ({ callAssistantLlm: vi.fn() }));

const topic = (title: string, body: string): TopicSection => ({ title, body });
const batch = (...topics: TopicSection[]) => topics.map(({ title, body }, index) => '## 选题' + (index + 1) + '：' + title + '\n' + body).join('\n\n');
const decision = (raw: string) => ({ content: [{ type: 'text' as const, text: raw }], stop_reason: 'end_turn' });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readAssistantConfig).mockReturnValue({ baseUrl: 'https://example.invalid', apiKey: 'fixture', model: 'fixture' });
});

describe('选题交付前查重', () => {
  const history = topic('前后对比看铰链', '拍同一副铰链松动前后的柜门开合');
  const rewrite = topic('柜门关不严的原因', '拍原来松动的那副铰链调整前后如何开合');
  const fresh = topic('抽屉满载拉起来顺不顺', '拍同一个抽屉分别空载和放入实物时的拉动');
  const replacement = topic('层板高度调整演示', '拍移动层板前后分别能不能放入高瓶');

  it('追问中取实际要求的条数，兼容中文和全角数字', () => {
    expect(topicCountInRequest('再给我二十条')).toBe(20);
    expect(topicCountInRequest('再来１２条')).toBe(12);
    expect(topicCountInRequest('这版有3条，我想换一批')).toBeUndefined();
  });

  it('用正文识别换标题的历史撞题，只补写撞题位置，保留新角度', async () => {
    vi.mocked(callAssistantLlm)
      .mockResolvedValueOnce(decision('{"duplicates":[{"candidate":1,"sameAs":"H1"}]}'))
      .mockResolvedValueOnce(decision('{"duplicates":[]}'));
    const refill = vi.fn(async () => batch(replacement));
    const result = await finalizeTopicBatch(batch(rewrite, fresh), [history], 2, refill);
    expect(refill).toHaveBeenCalledOnce();
    expect(refill.mock.calls[0]).toEqual([expect.objectContaining({ count: 1, blocked: [rewrite] })]);
    expect(splitTopicSections(result.text)).toEqual([replacement, fresh]);
    expect(result).toMatchObject({ count: 2, checked: true, removed: 1, replaced: 1 });
    const judgeInput = vi.mocked(callAssistantLlm).mock.calls[0][1].messages[0].content;
    expect(judgeInput).toContain(history.body);
    expect(judgeInput).toContain(rewrite.body);
  });

  it('补写还撞本批时只交付已通过的题', async () => {
    vi.mocked(callAssistantLlm)
      .mockResolvedValueOnce(decision('{"duplicates":[{"candidate":2,"sameAs":"B1"}]}'))
      .mockResolvedValueOnce(decision('{"duplicates":[{"candidate":1,"sameAs":"H1"}]}'));
    const refill = vi.fn(async () => batch(replacement));
    const result = await finalizeTopicBatch(batch(fresh, rewrite), [history], 2, refill);
    expect(splitTopicSections(result.text)).toEqual([fresh]);
    expect(result).toMatchObject({ count: 1, requested: 2, removed: 1, replaced: 0 });
  });

  it('内容查重不可用时仍剔除标点变化的重复，并如实标注核对状态', async () => {
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('没有可解析的数据'));
    const result = await finalizeTopicBatch(batch(topic(history.title + '！', rewrite.body), fresh), [history], 2, async () => batch(replacement));
    expect(splitTopicSections(result.text)).toEqual([fresh]);
    expect(result.checked).toBe(false);
    expect(parseTopicOverlap('{"duplicates":[{"candidate":1,"sameAs":"B2"}]}', 2, 0)).toBeNull();
  });
});
