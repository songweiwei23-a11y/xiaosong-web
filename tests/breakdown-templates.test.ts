import { describe, it, expect } from 'vitest';
import { splitBreakdownResult, parseBreakdownTemplates, renderCanonical, renderAllCanonical, directionSettings, TEMPLATE_SPEC } from '@/lib/breakdown-templates';
import { buildTextBreakdownPrompt } from '@/lib/text-breakdown';

const tpl = (n: number, goal: string, purpose: string) => ({
  no: n,
  name: `名称${n}`,
  goal,
  purpose,
  direction: `第${n}个方向`,
  profile_fit: `档案事实${n}`,
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

const GOALS = ['吸引更多客户', '卖服务', '招代理', '引到私域成交', '建立信任'];
const PURPOSES = ['变现型', '变现型', '变现型', '变现型', '人设型'];
const REPORT_JSON = JSON.stringify(GOALS.map((g, i) => tpl(i + 1, g, PURPOSES[i])), null, 2);
const RESULT = `# 拆解报告
## 一、账号层
内容正文
## 八、变现方向（二创结构，5 个）

\`\`\`json
${REPORT_JSON}
\`\`\``;

describe('拆解结果：正文与结构分开', () => {
  it('正文不含 JSON 和方向标题，结构全部解析出来', () => {
    const s = splitBreakdownResult(RESULT);
    expect(s.hasStructure).toBe(true);
    expect(s.templates).toHaveLength(5);
    expect(s.report).toContain('内容正文');
    expect(s.report).not.toContain('```json');
    expect(s.report).not.toContain('八、变现方向');
  });

  it('每个方向的字段取得到：变现目的、目的类别、方向、档案契合、分段、开篇、情绪曲线、镜头、开头第一句', () => {
    const [first, second] = parseBreakdownTemplates(RESULT);
    expect(first).toMatchObject({ no: 1, goal: '吸引更多客户', purpose: '变现型', direction: '第1个方向', profile_fit: '档案事实1' });
    expect(first.segments).toHaveLength(2);
    expect(first.segments[0]).toMatchObject({ time: '0–3 秒', function: '抓人', knowledge: '四大脚本：情绪型' });
    expect(first.opening.payoff_at).toBe('第 9 秒');
    expect(first.emotion.curve).toBe('反转型');
    expect(first.shots).toHaveLength(1);
    expect(first.first_line).toBe('你有没有遇到过这种事');
    expect(second.goal).toBe('卖服务');
    expect(parseBreakdownTemplates(RESULT)[4].purpose).toBe('人设型');
  });

  it('目的类别只认三种：「变现型（吸引客户）」归为变现型，写别的归为空', () => {
    const raw = JSON.stringify([
      { ...tpl(1, '吸引更多客户', '变现型（吸引客户）') },
      { ...tpl(2, '卖服务', '其他') },
    ]);
    const [a, b] = parseBreakdownTemplates(`## 八、变现方向\n\`\`\`json\n${raw}\n\`\`\``);
    expect(a.purpose).toBe('变现型');
    expect(b.purpose).toBe('');
  });

  it('JSON 坏掉时不崩溃：标记有结构但解析失败，正文照样显示', () => {
    const bad = '## 一、账号层\n正文\n## 八、变现方向\n```json\n[{"no": 1, "goal": \n```';
    const s = splitBreakdownResult(bad);
    expect(s.hasStructure).toBe(true);
    expect(s.templates).toEqual([]);
    expect(s.report).toContain('正文');
  });

  it('没写「八、」标题，也能在整份结果里找到 JSON', () => {
    const noHeading = `## 一、账号层\n正文\n\`\`\`json\n${REPORT_JSON}\n\`\`\``;
    const s = splitBreakdownResult(noHeading);
    expect(s.templates).toHaveLength(5);
    expect(s.report).toContain('正文');
    expect(s.report).not.toContain('```json');
  });

  it('JSON 之后的内容保留在正文里，只去掉代码块本身', () => {
    const s = splitBreakdownResult(`${RESULT}\n\n## 九、补充说明\n这一段要留着`);
    expect(s.report).toContain('## 九、补充说明');
    expect(s.report).not.toContain('```json');
  });

  it('没有结构的结果：hasStructure 为 false', () => {
    expect(splitBreakdownResult('## 一、账号层\n只有正文').hasStructure).toBe(false);
  });
});

describe('二创结构纯文本：1:1 复刻，原样交给其他板块', () => {
  it('标题带变现目的，分段按顺序编号，写明段数，并带「1:1 复刻」要求', () => {
    const [first] = parseBreakdownTemplates(RESULT);
    const text = renderCanonical(first);
    expect(text).toContain('【二创结构 · 方向1：吸引更多客户】');
    expect(text).toContain('变现目的：吸引更多客户');
    expect(text).toContain('为什么适合这个账号：档案事实1');
    expect(text).toContain('分段（2 段，按顺序 1:1 复刻');
    expect(text).toContain('1. 0–3 秒｜抓人｜知识：四大脚本：情绪型');
    expect(text).toContain('2. 3–12 秒｜证据｜知识：八大元素：反认知');
    expect(text).toContain('镜头（1 个，与原片逐镜头对应）');
    expect(text).toContain('1:1 复刻');
  });

  it('行业不写死在结构里：标注未指定，到用的板块再指定', () => {
    const [first] = parseBreakdownTemplates(RESULT);
    expect(renderCanonical(first)).toContain('行业：未指定');
  });

  it('没有档案（profile_fit 为空）就不写「为什么适合」那一行', () => {
    const [first] = parseBreakdownTemplates(RESULT);
    expect(renderCanonical({ ...first, profile_fit: '' })).not.toContain('为什么适合这个账号');
  });

  it('文字拆解没有镜头：不输出镜头小节', () => {
    const [first] = parseBreakdownTemplates(RESULT);
    const text = renderCanonical({ ...first, shots: [] });
    expect(text).not.toContain('镜头（');
  });

  it('同一个方向两次渲染完全一样（可以复制、可以比对）', () => {
    const [first] = parseBreakdownTemplates(RESULT);
    expect(renderCanonical(first)).toBe(renderCanonical(first));
  });

  it('整份带去其他板块：5 个方向全部带上；没有方向时是空串', () => {
    const all = renderAllCanonical(parseBreakdownTemplates(RESULT));
    expect(all).toContain('【二创结构（全部变现方向，每个都可 1:1 复刻）】');
    expect(all.match(/【二创结构 · 方向/g)).toHaveLength(5);
    expect(renderAllCanonical([])).toBe('');
  });

  it('选中方向的创作设置：目的类别、完整目的（变现目的）、主线；不带行业', () => {
    const [first] = parseBreakdownTemplates(RESULT);
    expect(directionSettings(first)).toEqual({
      purpose: '变现型',
      purposeText: '吸引更多客户',
      focusContent: '吸引更多客户：第1个方向',
    });
    expect(directionSettings({ ...first, goal: '', direction: '', purpose: '' })).toEqual({
      purpose: undefined,
      purposeText: undefined,
      focusContent: undefined,
    });
  });
});

describe('提示词：变现方向要求 JSON，文字拆解也一样', () => {
  it('方向格式要求 JSON 代码块，字段固定，5 个方向，带变现目的和档案契合', () => {
    expect(TEMPLATE_SPEC).toContain('```json');
    expect(TEMPLATE_SPEC).toContain('"goal"');
    expect(TEMPLATE_SPEC).toContain('"profile_fit"');
    expect(TEMPLATE_SPEC).toContain('"segments"');
    expect(TEMPLATE_SPEC).toContain('"shots"');
    expect(TEMPLATE_SPEC).toContain('5 个');
    expect(TEMPLATE_SPEC).not.toContain('### 九');
  });

  it('文字拆解：5 个变现方向，没有档案时不写第 6 点，不再给 2～3 个延伸方向', () => {
    const p = buildTextBreakdownPrompt('今天教你挑牛肉', '', {} as any);
    expect(p).toContain(TEMPLATE_SPEC);
    expect(p).toContain('八大爆款元素');
    expect(p).toContain('没有档案就不写第 6 点');
    expect(p).not.toContain('下一步可以延伸的方向');
    expect(p).not.toContain('### 九');
  });
});
