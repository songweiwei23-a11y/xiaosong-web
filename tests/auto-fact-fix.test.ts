/**
 * 自动按资料修正 + 删掉模型的自我认证（2026-10-05 现状研究的头号建议，产品方确认）。
 */
import { describe, expect, it } from 'vitest';
import { stripSelfCert } from '@/lib/self-cert';
import { readCode } from './helpers/source';

describe('删掉模型给自己发的合格证', () => {
  it('真实样例：「✅ 安全核查通过」和下面那串清单一起删，正文不动', () => {
    const out = '## 开头\n来南乐半年。\n\n## 结尾\n地址在主页置顶，过来找老王。\n\n---\n\n**✅ 安全核查通过**  \n- 无具体价格、销量、顾客数量\n- 无绝对化用语\n- 无虚构顾客故事\n- 地域、年限信息符合人设事实卡';
    const s = stripSelfCert(out);
    expect(s).not.toMatch(/安全核查通过|无虚构|符合人设事实卡/);
    expect(s).toContain('地址在主页置顶，过来找老王。');
    expect(s).toContain('## 开头');
  });
  it('「## 自检」整节删掉；下一节照留', () => {
    const s = stripSelfCert('## 开篇\n台词。\n## 自检\n- 年限按事实卡\n- 未编造\n## 结尾\n收尾。');
    expect(s).not.toMatch(/自检|未编造|年限按事实卡/);
    expect(s).toMatch(/## 结尾\n收尾。/);
  });
  it('正文里顺带的一句只删那几个词；没有认证的原样返回', () => {
    expect(stripSelfCert('所有选题一人一机可拍，无虚构数据。')).toBe('所有选题一人一机可拍');
    const plain = '一元一串，锅底现炒。\n- 第一条\n- 第二条';
    expect(stripSelfCert(plain)).toBe(plain);
  });
  it('不误删正常内容：「检查一下尺寸」「通过率」', () => {
    const t = '先检查一下门的尺寸，量完再定。\n这样能提高通过率。';
    expect(stripSelfCert(t)).toBe(t);
  });
});

describe('接到页面', () => {
  it('结果区展示、复制、带去下一步前都先删；自由对话写完删了再存', () => {
    expect(readCode('components/workspace/ResultPanel.tsx')).toMatch(/const cleanBody = stripSelfCert\(split\.body\)/);
    expect(readCode('app/dashboard/free-chat/page.tsx')).toMatch(/const cleaned = stripSelfCert\(assistantText\)/);
  });
  it('只对刚生成的结果自动修正一次（翻历史不自动跑，免得重复花钱）', () => {
    const panel = readCode('components/workspace/ResultPanel.tsx');
    expect(panel).toMatch(/autoFix=\{!!canvasTask && freshBody === body\}/);
    expect(panel).toMatch(/setFreshBody\(body\)/);
    const notice = readCode('components/workspace/FactCheckNotice.tsx');
    expect(notice).toMatch(/autoTried\.current === autoKey\) return/);
  });
});
