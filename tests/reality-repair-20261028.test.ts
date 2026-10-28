/**
 * 生成后的现实修复（2026-10-28，lib/reality-repair）：
 * 正则 + 模型审阅两路找出有问题的句子，只改那一句；拆解、自由对话、审稿不改；
 * 限流只在真的要改时计数；模型审出来的句子必须是稿子里原样出现的。
 */
import { describe, it, expect, vi } from 'vitest';
import { needsRealityRepair, overreachReviewPrompt, parseOverreachAnswer, repairReality } from '@/lib/reality-repair';

/** 按提示词分工：审阅的提示词和改写的提示词各给各的回答 */
function fakeModel(review: string, rewrite: string | null = null) {
  return vi.fn(async (prompt: string) => {
    if (prompt.includes('找一种毛病')) return review;
    if (prompt.includes('只改写下面这一句')) return rewrite;
    return null;
  });
}

describe('哪些板块要过现实修复', () => {
  it('创作类板块要修：选题、脚本、方向、分镜、开篇', () => {
    for (const t of ['选题策划', '脚本生成', '创作方向', '分镜脚本', '开篇钩子']) {
      expect(needsRealityRepair(t)).toBe(true);
    }
  });

  it('拆解（分析别人的视频）、自由对话、审稿（问题清单引用原稿的话）、标题（标题有自己的后处理）不在这里修；没有板块名也不修', () => {
    for (const t of ['拆解爆款', '自由对话', '审稿优化', '标题封面']) expect(needsRealityRepair(t)).toBe(false);
    expect(needsRealityRepair(undefined)).toBe(false);
  });
});

describe('模型审阅的回答', () => {
  it('只认稿子里原样出现的句子；「无」和空回答不算', () => {
    const text = '开场先讲店里的事。\n换个靠垫，客厅就像换了一套。\n结尾收在一个真实的画面上。';
    expect(parseOverreachAnswer('无', text)).toEqual([]);
    expect(parseOverreachAnswer(null, text)).toEqual([]);
    expect(parseOverreachAnswer('1. 换个靠垫，客厅就像换了一套。\n- 「不在稿子里的一句话，要忽略」', text)).toEqual(['换个靠垫，客厅就像换了一套。']);
  });

  it('审阅的提示词要求只列原句、不改写', () => {
    const p = overreachReviewPrompt('稿子正文', '脚本生成');
    expect(p).toContain('找一种毛病');
    expect(p).toContain('只列出有这种毛病的原句');
    expect(p).toContain('稿子正文');
  });
});

describe('修复：只改扫到的那一句', () => {
  it('稿子没有问题：审阅说无、正则也没抓到，原样返回，不改、不计额度', async () => {
    const ask = fakeModel('无');
    const text = '这一次试坐，客户说比刚才舒服，我们只记录这一次的反应。';
    const allow = vi.fn(() => true);
    const r = await repairReality(text, ask, '脚本生成', allow);
    expect(r).toEqual({ text, tried: 0, accepted: 0 });
    expect(allow).not.toHaveBeenCalled();
  });

  it('正则抓到的句子：换成改法，其余句子一字不动', async () => {
    const text = '开场先讲店里的事。\n这件外套收腰就能换不同风格。\n结尾收在一个真实的画面上。';
    const ask = fakeModel('无', '这件外套收腰，搭配高腰裤，显腿长。');
    const r = await repairReality(text, ask, '脚本生成');
    expect(r.accepted).toBe(1);
    expect(r.text).toBe('开场先讲店里的事。\n这件外套收腰，搭配高腰裤，显腿长。\n结尾收在一个真实的画面上。');
  });

  it('正则抓不到、模型审出来的语义问题（一个靠垫推出整套换新）：也要改', async () => {
    const text = '开场先讲店里的事。\n换个靠垫，客厅就像换了一套。\n结尾收在一个真实的画面上。';
    const ask = fakeModel('换个靠垫，客厅就像换了一套。', '换了靠垫，客厅的感觉变了一些。');
    const r = await repairReality(text, ask, '脚本生成');
    expect(r.accepted).toBe(1);
    expect(r.text).toBe('开场先讲店里的事。\n换了靠垫，客厅的感觉变了一些。\n结尾收在一个真实的画面上。');
  });

  it('模型改法还是不符合现实：保留原句，不为了改而改坏', async () => {
    const original = '这件外套收腰就能换不同风格。';
    const r = await repairReality(original, fakeModel('无', '这件外套收腰就能换不同风格，马上见效。'), '脚本生成');
    expect(r.accepted).toBe(0);
    expect(r.text).toBe(original);
  });

  it('模型没有回答（出错）：审阅当作无，保留原句', async () => {
    const original = '这件外套收腰就能换不同风格。';
    const r = await repairReality(original, async () => null, '脚本生成');
    expect(r.text).toBe(original);
  });

  it('允许修的额度用完：有问题也不改，只能原样交付', async () => {
    const text = '这件外套收腰就能换不同风格。';
    const ask = fakeModel('无', '这件外套收腰，搭配高腰裤。');
    const r = await repairReality(text, ask, '脚本生成', () => false);
    expect(r.text).toBe(text);
    expect(r.tried).toBe(0);
  });
});
