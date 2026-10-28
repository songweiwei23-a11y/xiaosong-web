/**
 * 生成后的现实修复（2026-10-28，lib/reality-repair）：
 * 只修正则能精确认出的句子，只改那一句；拆解、自由对话、审稿、标题不改；限流只在真的要改时计数。
 * 原先的「模型审阅」已去掉：它把正常的钩子和元素句式当毛病，改完反而造出小变量推大结论。
 */
import { describe, it, expect, vi } from 'vitest';
import { needsSentenceRepair, repairReality } from '@/lib/reality-repair';
import { splitLabel } from '@/lib/reality-check';

function fakeModel(rewrite: string | null = null) {
  return vi.fn(async (prompt: string) => (prompt.includes('只改写下面这一句') ? rewrite : null));
}

describe('哪些板块要过现实修复', () => {
  it('创作类板块要修：选题、脚本、方向、分镜、开篇', () => {
    for (const t of ['选题策划', '脚本生成', '创作方向', '分镜脚本', '开篇钩子']) {
      expect(needsSentenceRepair(t)).toBe(true);
    }
  });

  it('拆解（分析别人的视频）、自由对话、审稿（问题清单引用原稿的话）、标题（标题有自己的后处理）不在这里修；没有板块名也不修', () => {
    for (const t of ['拆解爆款', '自由对话', '审稿优化', '标题封面']) expect(needsSentenceRepair(t)).toBe(false);
    expect(needsSentenceRepair(undefined)).toBe(false);
  });
});

describe('修复：只改正则认出的那一句', () => {
  it('稿子没有问题：不调用模型、不计额度，原样返回', async () => {
    const ask = fakeModel();
    const text = '这一次试坐，客户说比刚才舒服，我们只记录这一次的反应。';
    const allow = vi.fn(() => true);
    const r = await repairReality(text, ask, '脚本生成', allow);
    expect(r).toEqual({ text, tried: 0, accepted: 0 });
    expect(ask).not.toHaveBeenCalled();
    expect(allow).not.toHaveBeenCalled();
  });

  it('正常的钩子和元素句式不是毛病，不改（2026-10-28 回归里被模型审阅误改过）', async () => {
    const ask = fakeModel('不该被采用');
    const text = '客户刚坐下就说：这沙发不太对。\n当年最火的校服外套，穿错最没面子。\n川味烧烤，就得守着炭火慢慢翻。';
    const r = await repairReality(text, ask, '脚本生成');
    expect(r.text).toBe(text);
    expect(ask).not.toHaveBeenCalled();
  });

  it('正则认出的句子：换成改法，其余句子一字不动', async () => {
    const text = '开场先讲店里的事。\n这件外套收腰就能换不同风格。\n结尾收在一个真实的画面上。';
    const r = await repairReality(text, fakeModel('这件外套收腰，搭配高腰裤，显腿长。'), '脚本生成');
    expect(r.accepted).toBe(1);
    expect(r.text).toBe('开场先讲店里的事。\n这件外套收腰，搭配高腰裤，显腿长。\n结尾收在一个真实的画面上。');
  });

  it('模型改法还是不符合现实：保留原句，不为了改而改坏', async () => {
    const original = '这件外套收腰就能换不同风格。';
    const r = await repairReality(original, fakeModel('这件外套收腰就能换不同风格，马上见效。'), '脚本生成');
    expect(r.accepted).toBe(0);
    expect(r.text).toBe(original);
  });

  it('模型没有回答（出错）：保留原句', async () => {
    const original = '这件外套收腰就能换不同风格。';
    const r = await repairReality(original, async () => null, '脚本生成');
    expect(r.text).toBe(original);
  });

  it('允许修的额度用完：有问题也不改，只能原样交付', async () => {
    const text = '这件外套收腰就能换不同风格。';
    const r = await repairReality(text, fakeModel('这件外套收腰，搭配高腰裤。'), '脚本生成', () => false);
    expect(r.text).toBe(text);
    expect(r.tried).toBe(0);
  });
});

describe('句首标签：冒号在粗体里外都认，改写不丢标签', () => {
  it('「- **出发点**：」冒号在粗体外', () => {
    expect(splitLabel('- **出发点**：收腰就能换风格。')).toEqual({ label: '- **出发点**：', body: '收腰就能换风格。' });
  });

  it('「- **结果收束：** 」冒号在粗体里（原来认不出，改写后粗体和标签被吃掉）', () => {
    expect(splitLabel('- **结果收束：** 收腰就能换风格。')).toEqual({ label: '- **结果收束：** ', body: '收腰就能换风格。' });
  });

  it('改写带这种标签的句子：标签原样保留', async () => {
    const text = '- **结果收束：** 这件外套收腰就能换不同风格。';
    const r = await repairReality(text, fakeModel('这件外套收腰，搭配高腰裤，显腿长。'), '选题策划');
    expect(r.text).toBe('- **结果收束：** 这件外套收腰，搭配高腰裤，显腿长。');
  });
});
