/**
 * 选题标题认不认得出爆款元素（2026-10-28，lib/topic-element-check）。
 * 例子都来自真实产出：「赫本风旧外套，敞穿还是扣上？」是编导点名的反例——正文写了怀旧，标题却没有怀旧的看点。
 */
import { describe, expect, it } from 'vitest';
import { topicDiversityIssues } from '@/lib/topic-element-check';

describe('批次多样性提示', () => {
  it('识别同元素、重复对比句式及动作对比，只提醒人工核对', () => {
    const output = Array.from({ length: 5 }, (_, i) => `## 选题${i + 1}：裤子站着 vs 坐下 ${i}\n**1️⃣ 爆款元素**\n反差：对比\n**开篇钩子**\n开场`).join('\n');
    const issues = topicDiversityIssues(output);
    expect(issues.some((s) => s.includes('少于 3 种'))).toBe(true);
    expect(issues.some((s) => s.includes('超过 2 条'))).toBe(true);
    expect(issues.some((s) => s.includes('对比动作'))).toBe(true);
  });

  it('识别不到足够选题时不猜测批次问题', () => {
    expect(topicDiversityIssues('## 选题1：普通标题\n爆款元素：反差')).toEqual([]);
  });
});
import { elementTitleIssues, topicElementResults } from '@/lib/topic-element-check';

const batch = `## 选题1：当年最火的校服外套，穿错最没面子
**1️⃣ 爆款元素**
- 怀旧：套「当年最火的X」——当年最火的校服外套
- 最差：套「最没面子的X」

## 选题2：赫本风旧外套，敞穿还是扣上？
**1️⃣ 爆款元素**
- 怀旧：旧外套

## 选题3：花小钱办大事：一条裤子撑完整个晚上
- **成本**：套「花小钱办大事」

## 选题4：做大码女装6年，我还留着这条裤子
- **视频目的**：人设型

## 选题5：试大码外套时，坐下那一下别省掉
- **最差**：套「最没面子的X」
`;

describe('标题认不认得出元素', () => {
  it('「当年最火的X」「花小钱办大事」：标题里就是元素的句式，认得出', () => {
    const r = topicElementResults(batch);
    expect(r.find((x) => x.title.startsWith('当年最火'))?.visible).toBe(true);
    expect(r.find((x) => x.title.startsWith('花小钱'))?.visible).toBe(true);
  });

  it('「赫本风旧外套，敞穿还是扣上？」：正文写了怀旧，标题没有怀旧的看点，认不出', () => {
    const r = topicElementResults(batch);
    expect(r.find((x) => x.title.startsWith('赫本风'))).toEqual({ title: '赫本风旧外套，敞穿还是扣上？', elements: ['怀旧'], visible: false });
  });

  it('写了最差，标题只是一个操作提醒：认不出', () => {
    const r = topicElementResults(batch);
    expect(r.find((x) => x.title.startsWith('试大码外套'))?.visible).toBe(false);
  });

  it('没有写元素的选题（人设型）不算', () => {
    expect(topicElementResults(batch).map((x) => x.title)).not.toContain('做大码女装6年，我还留着这条裤子');
  });

  it('给体检的提示：只列认不出的', () => {
    expect(elementTitleIssues(batch)).toEqual([
      '「赫本风旧外套，敞穿还是扣上？」标题里认不出爆款元素（怀旧）',
      '「试大码外套时，坐下那一下别省掉」标题里认不出爆款元素（最差）',
    ]);
  });
});

describe('两种写法都认', () => {
  it('标题写在「**标题：**」行，元素写成「爆款元素：怀旧、最差」', () => {
    const text = `## 选题1\n**标题：** 20年前经典的弹簧床，为什么现在最没面子？\n**爆款元素：** 怀旧、最差`;
    expect(topicElementResults(text)).toEqual([
      { title: '20年前经典的弹簧床，为什么现在最没面子？', elements: ['怀旧', '最差'], visible: true },
    ]);
  });

  it('用了两个元素，标题认出其中一个就算', () => {
    const text = `## 选题1：贬值最快的沙发，换个摆法\n- 最差：贬值最快的X\n- 成本：花小钱办大事`;
    expect(topicElementResults(text)[0].visible).toBe(true);
  });
});
