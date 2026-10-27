import { describe, expect, it, vi } from 'vitest';
import { directionSeedOf, hooksOfSeed } from '@/lib/direction-seed';
import { assignTopicSlots, topicSlotsBlock } from '@/lib/topic-slots';
import { duplicateTitleCount, dedupeTitles } from '@/lib/title-dedupe';
import { hasDuplicateTitle, titleOfLine } from '@/lib/title-polish';

const DIR = [
  '### 方向1：同一件外套，换搭配看差别',
  '- **核心目的**：涨粉曝光',
  '- **内容方向**：围绕日常出门、上学、接送孩子的穿搭场景，拍同一件外套的搭配变化',
  '- **切入角度**：',
  '  - 对比切入 ｜ 同一件外套换搭配 ｜ 对比 ｜ 看的是搭配维度',
  '  - 场景切入 ｜ 同一件外套在不同场景 ｜ 季节 ｜ 看的是场景维度',
  '- **思路提示**：买衣服最怕买回家不敢穿，可以从这件事往下想',
  '- **可拍性**：店内现有外套和裤子，手机即可，缺出镜人待补',
  '- **节奏**：第1周',
].join('\n');

describe('方向种子：核心目的、角度、思路提示带过去；种子里不带题眼（题眼会误导模型）', () => {
  it('种子里有核心目的、角度列表、思路', () => {
    const seed = directionSeedOf(DIR) ?? '';
    expect(seed).toContain('核心目的（不能改）：涨粉曝光');
    expect(seed).toContain('角度：对比切入');
    expect(seed).toContain('角度：场景切入');
    expect(seed).toContain('思路：买衣服最怕买回家不敢穿');
    expect(seed).not.toContain('可拍性');
    expect(seed).not.toContain('节奏');
  });
  it('种子里没有题眼，所以没有题眼可分配', () => {
    const hooks = hooksOfSeed(directionSeedOf(DIR) ?? '');
    expect(hooks).toEqual([]);
  });
  it('没有思路提示时，种子不报错', () => {
    expect(hooksOfSeed(directionSeedOf('### 方向1：A\n- **内容方向**：范围') ?? '')).toEqual([]);
  });
});

describe('选题分配：题眼逐条分配，题眼不同选题才不同', () => {
  it('每条分到一个题眼，题眼轮换', () => {
    const slots = assignTopicSlots({
      count: 6,
      audiences: ['宝妈', '学生'],
      elements: ['反差', '人群'],
      tactics: ['反向操作', '换个视角'],
      hooks: ['题眼A', '题眼B', '题眼C'],
    });
    expect(slots.map((s) => s.hook)).toEqual(['题眼A', '题眼B', '题眼C', '题眼A', '题眼B', '题眼C']);
    expect(topicSlotsBlock(slots)).toContain('题眼=题眼A');
    expect(topicSlotsBlock(slots)).toContain('题眼是这条选题的出发线索');
  });
  it('没有题眼时分配表不出现题眼', () => {
    const slots = assignTopicSlots({ count: 2, audiences: ['宝妈'], elements: ['反差'], tactics: ['反向操作'] });
    expect(topicSlotsBlock(slots)).not.toContain('题眼=');
  });
});

describe('重复标题：第二次及以后出现的那一行只重写，并避开已有标题', () => {
  const TOPICS = [
    '## 选题1：站着合身的裤子坐下还合身吗',
    '正文一',
    '## 选题2：站着合身的裤子坐下还合身吗',
    '正文二',
    '## 选题3：宝妈试裤弯腰后还要提裤腰吗',
  ].join('\n');

  it('识别选题标题行，数出重复', () => {
    expect(titleOfLine('## 选题1：站着合身的裤子坐下还合身吗')).toBe('站着合身的裤子坐下还合身吗');
    expect(duplicateTitleCount(TOPICS)).toBe(1);
    expect(hasDuplicateTitle(TOPICS)).toBe(true);
    expect(hasDuplicateTitle('## 选题1：甲\n## 选题2：乙')).toBe(false);
  });

  it('只改重复的那一行，其它行一字不动，并把已有标题放进提示词', async () => {
    const ask = vi.fn(async (prompt: string) => (prompt.includes('站着合身的裤子坐下还合身吗') ? '裤子坐下一站起，腰头是紧还是松' : null));
    const { text, tried, accepted } = await dedupeTitles(TOPICS, ask);
    expect(tried).toBe(1);
    expect(accepted).toBe(1);
    expect(text).toContain('## 选题1：站着合身的裤子坐下还合身吗');
    expect(text).toContain('## 选题2：裤子坐下一站起，腰头是紧还是松');
    expect(text).toContain('## 选题3：宝妈试裤弯腰后还要提裤腰吗');
    expect(ask.mock.calls[0][0]).toContain('不要和下面这些已有标题相同或相近');
  });

  it('模型给出的还是重复标题，就保留原行', async () => {
    const { text, accepted } = await dedupeTitles(TOPICS, async () => '站着合身的裤子坐下还合身吗');
    expect(accepted).toBe(0);
    expect(text).toBe(TOPICS);
  });

  it('没有重复时不调用模型', async () => {
    const ask = vi.fn(async () => 'x');
    const { tried } = await dedupeTitles('## 选题1：甲\n## 选题2：乙', ask);
    expect(tried).toBe(0);
    expect(ask).not.toHaveBeenCalled();
  });
});
