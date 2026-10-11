import { describe, it, expect } from 'vitest';
import { splitBreakdownResult, parseBreakdownTemplates, renderCanonical, TEMPLATE_SPEC } from '@/lib/breakdown-templates';
import { buildTextBreakdownPrompt } from '@/lib/text-breakdown';

const tpl = (n: number, name: string, purpose: string) => ({
  no: n,
  name,
  purpose,
  direction: `第${n}个方向`,
  segments: [
    { time: '0–3 秒', function: '抓人', knowledge: '四大脚本：情绪型', do: '近景开场', lines: '你有没有遇到过' },
    { time: '3–12 秒', function: '证据', knowledge: '八大元素：反认知', do: '演示', lines: '其实是这样' },
  ],
  opening: { hook: '盲盒', first_2s: '反问', first_5s: '埋期待', payoff_at: '第 9 秒' },
  emotion: { curve: '反转型', peaks: '第 6 秒' },
  shots: [{ no: 1, time: '0–3 秒', size: '近景', camera: '固定', visual: '人物开口', line: '你有没有', role: '抓人', knowledge: '开篇 36 计' }],
  first_line: '你有没有遇到过这种事',
  boards: ['脚本'],
});

const REPORT_JSON = JSON.stringify([1, 2, 3, 4, 5].map((n) => tpl(n, `名称${n}`, ['流量型', '人设型', '变现型', '流量型', '变现型'][n - 1])), null, 2);
const RESULT = `# 拆解报告
## 一、账号层
内容正文
## 八、套用模版（二创结构，至少 5 个）

\`\`\`json
${REPORT_JSON}
\`\`\``;

describe('拆解结果：正文与结构分开', () => {
  it('正文不含 JSON 和模版，结构全部解析出来', () => {
    const s = splitBreakdownResult(RESULT);
    expect(s.hasStructure).toBe(true);
    expect(s.templates).toHaveLength(5);
    expect(s.report).toContain('内容正文');
    expect(s.report).not.toContain('```json');
    expect(s.report).not.toContain('八、套用模版');
  });

  it('每个模版的字段取得到：编号、名称、目的、方向、分段、开篇、情绪曲线、镜头、开头第一句', () => {
    const [first, second] = parseBreakdownTemplates(RESULT);
    expect(first).toMatchObject({ no: 1, name: '名称1', purpose: '流量型', direction: '第1个方向' });
    expect(first.segments).toHaveLength(2);
    expect(first.segments[0]).toMatchObject({ time: '0–3 秒', function: '抓人', knowledge: '四大脚本：情绪型' });
    expect(first.opening.payoff_at).toBe('第 9 秒');
    expect(first.emotion.curve).toBe('反转型');
    expect(first.shots).toHaveLength(1);
    expect(first.first_line).toBe('你有没有遇到过这种事');
    expect(second.purpose).toBe('人设型');
  });

  it('JSON 坏掉时不崩溃：标记有结构但解析失败，正文照样显示', () => {
    const bad = '## 一、账号层\n正文\n## 八、套用模版\n```json\n[{"no": 1, "name": \n```';
    const s = splitBreakdownResult(bad);
    expect(s.hasStructure).toBe(true);
    expect(s.templates).toEqual([]);
    expect(s.report).toContain('正文');
  });

  it('没写「八、套用模版」标题，也能在整份结果里找到 JSON', () => {
    const noHeading = `## 一、账号层\n正文\n\`\`\`json\n${REPORT_JSON}\n\`\`\``;
    const s = splitBreakdownResult(noHeading);
    expect(s.templates).toHaveLength(5);
    expect(s.report).toContain('正文');
    expect(s.report).not.toContain('```json');
  });

  it('没有结构的结果：hasStructure 为 false', () => {
    expect(splitBreakdownResult('## 一、账号层\n只有正文').hasStructure).toBe(false);
  });
});

describe('二创结构纯文本：1:1 复刻，原样交给其他板块', () => {
  it('分段按顺序编号，写明段数，并带「1:1 复刻」要求', () => {
    const [first] = parseBreakdownTemplates(RESULT);
    const text = renderCanonical(first);
    expect(text).toContain('【二创结构 · 模版1：名称1】');
    expect(text).toContain('分段（2 段，按顺序 1:1 复刻');
    expect(text).toContain('1. 0–3 秒｜抓人｜知识：四大脚本：情绪型');
    expect(text).toContain('2. 3–12 秒｜证据｜知识：八大元素：反认知');
    expect(text).toContain('镜头（1 个，与原片逐镜头对应）');
    expect(text).toContain('1:1 复刻');
  });

  it('文字拆解没有镜头：不输出镜头小节', () => {
    const [first] = parseBreakdownTemplates(RESULT);
    const text = renderCanonical({ ...first, shots: [] });
    expect(text).not.toContain('镜头（');
  });

  it('同一个模版两次渲染完全一样（可以复制、可以比对）', () => {
    const [first] = parseBreakdownTemplates(RESULT);
    expect(renderCanonical(first)).toBe(renderCanonical(first));
  });
});

describe('提示词：模版要求 JSON，文字拆解也一样', () => {
  it('模版格式要求 JSON 代码块，字段固定', () => {
    expect(TEMPLATE_SPEC).toContain('```json');
    expect(TEMPLATE_SPEC).toContain('"segments"');
    expect(TEMPLATE_SPEC).toContain('"shots"');
    expect(TEMPLATE_SPEC).toContain('至少 5 个');
  });

  it('文字拆解：至少 5 个模版，没有档案时不写第 6 点，不再给 2～3 个延伸方向', () => {
    const p = buildTextBreakdownPrompt('今天教你挑牛肉', '', {} as any);
    expect(p).toContain(TEMPLATE_SPEC);
    expect(p).toContain('八大爆款元素');
    expect(p).toContain('没有档案就不写第 6 点');
    expect(p).not.toContain('下一步可以延伸的方向');
  });
});
