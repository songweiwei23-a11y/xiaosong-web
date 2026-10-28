import { describe, expect, it, vi } from 'vitest';
import { buildDirectionPrompt } from '@/lib/direction';
import { REALITY_RULE } from '@/lib/sharp-rules';
import { acceptRealityRepair, findUnrealisticSentences, isUnrealisticSentence, polishReality, repairRealityPrompt, splitLabel } from '@/lib/reality-check';
import { viralElementPrompt } from '@/lib/viral-elements';

describe('识别不符合现实的说法', () => {
  it('用户举的例子都要抓到', () => {
    expect(isUnrealisticSentence('同一件外套，两种人，你信哪种')).toBe(true);
    expect(isUnrealisticSentence('这件外套收腰就能换不同风格')).toBe(true);
    expect(isUnrealisticSentence('同一件衬衫，换个塞法就是两种身材')).toBe(true);
    expect(isUnrealisticSentence('一件白 T 穿出 5 种风格')).toBe(true);
    expect(isUnrealisticSentence('这条裤子穿上显高 10 厘米')).toBe(true);
  });
  it('小细节撑不起「有多牛」：穿法、动作有多牛要抓到；整套穿搭有多牛不误伤', () => {
    expect(isUnrealisticSentence('当年最火的大码女装穿法有多牛')).toBe(true);
    expect(isUnrealisticSentence('这个系扣子的动作有多厉害')).toBe(true);
    expect(isUnrealisticSentence('当年最火的穿搭有多牛')).toBe(false);
    expect(isUnrealisticSentence('当年最火的大码外套，穿搭有多牛，我们拆开看')).toBe(false);
  });
  it('一次现场的反应不推成普遍的道理：一位客户说好，就说明所有人都要……要抓到；只记录这一次不误伤', () => {
    expect(isUnrealisticSentence('一位客户说舒服，就说明挑沙发所有人都要试靠垫')).toBe(true);
    expect(isUnrealisticSentence('这一次试坐，客户说比刚才舒服，我们只记录这一次的反应')).toBe(false);
    expect(isUnrealisticSentence('一位客户说舒服，这一次的情况如实记下')).toBe(false);
  });
  it('选题的爆款元素提示词要求：句式里的 X 是有分量的东西，穿法只能落在衣服上', () => {
    const prompt = viralElementPrompt(['celebrity', 'nostalgia']);
    expect(prompt).toContain('句式里的 X 要是本身有分量的东西');
    expect(prompt).toContain('不能只是一个做法、技巧、动作或细节');
  });
  it('正常的搭配、穿法说法不误伤', () => {
    expect(isUnrealisticSentence('这件外套收腰，搭配高腰裤，显腿长')).toBe(false);
    expect(isUnrealisticSentence('同一件外套，配白裤和黑裤各拍一条')).toBe(false);
    expect(isUnrealisticSentence('换三条裤子，叠两种外套，镜头里对比')).toBe(false);
    expect(isUnrealisticSentence('同一件外套，学生和宝妈看中的根本不是一处')).toBe(false);
  });
  it('全文里找出这些句子，带上标签；标签不同就是不同的句子，各自处理', () => {
    const text = '- **出发点**：同一件外套，两种人，你信哪种。其余正常。\n- **讲法**：这件外套收腰就能换不同风格。\n- **为什么**：同一件外套，两种人，你信哪种。';
    expect(findUnrealisticSentences(text)).toEqual([
      '- **出发点**：同一件外套，两种人，你信哪种。',
      '- **讲法**：这件外套收腰就能换不同风格。',
      '- **为什么**：同一件外套，两种人，你信哪种。',
    ]);
  });
  it('标签单独拿出来', () => {
    expect(splitLabel('- **出发点**：同一件外套，两种人')).toEqual({ label: '- **出发点**：', body: '同一件外套，两种人' });
    expect(splitLabel('没有标签的一句话')).toEqual({ label: '', body: '没有标签的一句话' });
  });
});

describe('采用标准：改写后要符合现实，过不了就保留原句', () => {
  it('一行、不超标、不再不符合现实、和原句不同，才采用', () => {
    expect(acceptRealityRepair('收腰就能换风格', '同一件外套，换一条阔腿裤，坐下和走路的感觉完全不同')).toBe('同一件外套，换一条阔腿裤，坐下和走路的感觉完全不同');
  });
  it('拒绝：空、多行、超长、仍不符合现实、和原句一样', () => {
    expect(acceptRealityRepair('原句', null)).toBeNull();
    expect(acceptRealityRepair('原句', '第一行\n第二行')).toBeNull();
    expect(acceptRealityRepair('原句', '一'.repeat(90))).toBeNull();
    expect(acceptRealityRepair('原句', '收腰就能换不同风格')).toBeNull();
    expect(acceptRealityRepair('- **讲法**：原句', '原句')).toBeNull();
  });
  it('改写提示词只改这一句，并写明只能改搭配、穿法和场景', () => {
    const p = repairRealityPrompt('- **讲法**：这件外套收腰就能换不同风格', '');
    expect(p).toContain('原句：这件外套收腰就能换不同风格');
    expect(p).toContain('一样东西的本质改不了');
  });
});

describe('精准小改：只改那一句，标签保留，其余一字不动', () => {
  it('合格的改写只替换这一句，标签保留', async () => {
    const text = '### 方向1\n- **出发点**：同一件外套，两种人，你信哪种。\n- **讲法**：晒过程，记录同一件外套配两条裤子。';
    const ask = vi.fn(async () => '同一件外套，配两条裤子，走路和坐下的样子不一样');
    const { text: out, tried, accepted } = await polishReality(text, ask);
    expect(tried).toBe(1);
    expect(accepted).toBe(1);
    expect(out).toBe('### 方向1\n- **出发点**：同一件外套，配两条裤子，走路和坐下的样子不一样\n- **讲法**：晒过程，记录同一件外套配两条裤子。');
  });
  it('模型失败或仍不合格：原样保留', async () => {
    const text = '- **出发点**：同一件外套，两种人，你信哪种。';
    const { text: out, accepted } = await polishReality(text, async () => '同一件外套，两种人，你信哪种');
    expect(accepted).toBe(0);
    expect(out).toBe(text);
  });
  it('没有不符合现实的句子时不调用模型', async () => {
    const ask = vi.fn(async () => 'x');
    const { tried } = await polishReality('- **讲法**：晒过程，记录穿法。', ask);
    expect(tried).toBe(0);
    expect(ask).not.toHaveBeenCalled();
  });
});

describe('接线：现实规则写进了创作方向提示词', () => {
  it('规则常量写明：来源只能是现实中存在、大多数人认可的事；三类说法一律不写', () => {
    expect(REALITY_RULE).toContain('创作的来源只能是现实中真实存在、大多数人认可的事');
    expect(REALITY_RULE).toContain('太离谱');
    expect(REALITY_RULE).toContain('太简单');
    expect(REALITY_RULE).toContain('太不科学');
    expect(REALITY_RULE).toContain('括号里的例子只说明是什么类型，不是清单');
  });
  it('创作方向提示词包含现实规则', () => {
    const p = buildDirectionPrompt({ purposes: ['fans'], formats: ['any'], count: 8, depth: 'quick', profileSummary: '测试档案' });
    expect(p).toContain('任何创作都必须符合现实的生活逻辑');
  });
});
