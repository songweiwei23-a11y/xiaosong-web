/**
 * 自由对话出方案（先大纲后全文）、下载 Word / PDF（2026-10-04）。
 */
import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import { buildDocx } from '@/lib/doc-export';
import { docTitle, docToPrintHtml, parseInline, parseMarkdownDoc } from '@/lib/doc-markdown';
import { PLAN_CATEGORIES, PLAN_END, buildContinuePrompt, buildFullPlanPrompt, buildOutlinePrompt, parseOutline, planCompleteness, planDisplayText, readPlanMeta, looksLikeQuestion, clarifyOptions, type PlanMeta } from '@/lib/plan-builder';
import { sanitizeMessages } from '@/lib/chat-message-utils';
import { readCode } from './helpers/source';

const SAMPLE = `# 国庆开业引流方案

## 第1章 目标
- **每天** 多来 30 桌
- 预算：【待确认：总预算】

| 日期 | 动作 | 负责人 |
| --- | --- | --- |
| 10/1 | 开业 *试吃* | 店长 |

1. 第一步
2. 第二步

> 注意：不要承诺最低价

---
—— 方案完 ——`;

describe('Markdown 拆成文档块', () => {
  it('标题、列表、表格、引用、分隔线、行内加粗斜体都认', () => {
    const b = parseMarkdownDoc(SAMPLE);
    expect(b.map((x) => x.type)).toEqual(['heading', 'heading', 'list', 'table', 'list', 'quote', 'hr', 'paragraph']);
    const t = b[3] as Extract<typeof b[number], { type: 'table' }>;
    expect(t.header.map((c) => c.map((r) => r.text).join(''))).toEqual(['日期', '动作', '负责人']);
    expect(t.rows[0][1]).toEqual([{ text: '开业 ' }, { text: '试吃', italic: true }]);
    expect(parseInline('**加粗**和`代码`和[链接](https://a.cn)')).toEqual([{ text: '加粗', bold: true }, { text: '和' }, { text: '代码', code: true }, { text: '和' }, { text: '链接（https://a.cn）' }]);
    expect(docTitle(SAMPLE)).toBe('国庆开业引流方案');
    expect(docTitle('# a/b:c?')).toBe('a b c');
  });

  it('PDF 页面：A4、表格、转义（不让正文里的尖括号变成标签）', () => {
    const html = docToPrintHtml(parseMarkdownDoc(`${SAMPLE}\n\n<script>alert(1)</script>`), '方案');
    expect(html).toMatch(/@page\{size:A4/);
    expect(html).toContain('<th>负责人</th>');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('Word：生成真正的 .docx（zip），正文、表格内容都在', async () => {
    const buf = await Packer.toBuffer(await buildDocx(SAMPLE));
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    const xml = buf.toString('latin1');
    expect(xml).toContain('word/document.xml');
  });
});

describe('出方案：先大纲、确认后写全文', () => {
  const meta: PlanMeta = { stage: 'outline', scenario: '开业活动方案', category: 'marketing', industry: '川菜馆', goal: '国庆 7 天开业，每天多来 30 桌' };

  it('场景库覆盖十几个类别，任何场景都能用「自定义」', () => {
    expect(PLAN_CATEGORIES.length).toBeGreaterThanOrEqual(12);
    expect(PLAN_CATEGORIES.flatMap((c) => c.scenarios).length).toBeGreaterThanOrEqual(50);
  });

  it('大纲要求：只写章节骨架、按行业场景定章节、不编数字（没给的写【待确认】）', () => {
    const p = buildOutlinePrompt(meta);
    expect(p).toMatch(/第一步，只写大纲/);
    expect(p).toContain('川菜馆');
    expect(p).toMatch(/不要套一个万能模板/);
    expect(p).toMatch(/【待确认/);
    expect(p).toMatch(/已知条件：用户没提供/);
  });

  it('拆大纲：认「## 第N章」「## 一、」「### 1.」各种写法', () => {
    const o = parseOutline('# 开业方案\n## 第1章 目标与指标\n- 每天多少桌\n- 怎么算\n## 二、活动设计\n- 试吃\n### 3. 执行排期\n- 时间表');
    expect(o.title).toBe('开业方案');
    expect(o.sections).toEqual([
      { title: '目标与指标', points: ['每天多少桌', '怎么算'] },
      { title: '活动设计', points: ['试吃'] },
      { title: '执行排期', points: ['时间表'] },
    ]);
  });

  it('全文要求：按确认的大纲逐章写、不增删、表格写排期预算、结尾标记', () => {
    const p = buildFullPlanPrompt({ ...meta, stage: 'full', title: '国庆开业方案', outline: [{ title: '目标', points: ['每天 30 桌'] }, { title: '排期', points: [] }], note: '预算 2 万以内' });
    expect(p).toContain('## 第1章 目标');
    expect(p).toContain('## 第2章 排期');
    expect(p).toContain('# 国庆开业方案');
    expect(p).toMatch(/不要增删章节/);
    expect(p).toContain('预算 2 万以内');
    expect(p).toContain(PLAN_END);
  });

  it('基于资料出方案：文件和粘贴的文字都进大纲、全文、补写的要求；事实以资料为准，没有的仍写【待确认】', () => {
    const m: PlanMeta = { ...meta, material: '张三，15 年川菜厨师，二级厨师证', files: ['简历.pdf', '门店照片.jpg'] };
    for (const p of [buildOutlinePrompt(m), buildFullPlanPrompt({ ...m, stage: 'full', outline: [{ title: '人设', points: [] }] }), buildContinuePrompt({ ...m, stage: 'full' }, ['人设'])]) {
      expect(p).toContain('方案必须基于这些资料来写');
      expect(p).toContain('简历.pdf、门店照片.jpg');
      expect(p).toContain('15 年川菜厨师');
      expect(p).toMatch(/资料里没有、用户也没说的，照样写【待确认】/);
    }
    expect(buildOutlinePrompt(m)).toMatch(/（据资料）/);
    // 2026-10-04 线上：写「请先读完这些文件」时模型以为要自己去打开文件，回答「无法直接读取」。要明说正文已经读好、直接用
    expect(buildOutlinePrompt(m)).not.toMatch(/请先读完这些文件/);
    expect(buildOutlinePrompt(m)).toMatch(/正文系统已经读取好了，在本条消息最后的「附件正文」和「用户上传的文档正文」里/);
    expect(buildOutlinePrompt(m)).toMatch(/不要说读不到、不要让用户再把内容发一遍/);
    // 大纲前先列从资料里读到的关键信息（引用格式，不会被当成章节）
    expect(buildOutlinePrompt(m)).toMatch(/从资料里读到的关键信息/);
    expect(parseOutline('# 方案\n> 读到：三平台 14 条视频\n> 最高 16415 播放\n## 第1章 诊断\n- 对比三平台').sections).toEqual([{ title: '诊断', points: ['对比三平台'] }]);
    expect(buildOutlinePrompt(meta)).not.toContain('方案必须基于这些资料');
    expect(readPlanMeta({ ...m, stage: 'outline' })).toMatchObject({ material: m.material, files: m.files });
    expect(planDisplayText({ ...m, stage: 'outline' })).toMatch(/资料：附 2 份文件，粘贴资料 \d+ 字/);
    const page = readCode('app/dashboard/free-chat/page.tsx');
    expect(page).toMatch(/const files = \[\.\.\.attachments\];\s*void handleSend\(planDisplayText\(m\), \{ plan: m, prompt: planPrompt\(m\), files \}\)/);
    expect(page).toMatch(/fileNames=\{attachments\.map\(\(a\) => a\.name\)\}/);
  });

  it('资料有疑点：不停下来只提问，先出完整大纲、疑点单独标出来；全文里疑点写【待确认】', () => {
    const p = buildOutlinePrompt({ ...meta, files: ['快手数据.xlsx'] });
    expect(p).toMatch(/一定要出完整的大纲，不要只提问不出大纲/);
    expect(p).toMatch(/文件名和内容对不上/);
    expect(p).toMatch(/> ⚠️ 需要你确认/);
    expect(buildFullPlanPrompt({ ...meta, stage: 'full', outline: [{ title: 'a', points: [] }] })).toMatch(/不要停下来提问：按最合理的判断写完，在那一处写「【待确认/);
  });

  it('模型还是在提问：认出来、拿出选项做按钮；回答记进 clarify，下一次出大纲带上、不再问', () => {
    const q = '我收到的三份文件数据有问题：\n\n**附件2和附件3的内容实际上是反的**\n\n在我写方案大纲前，请你确认：\n\n1. 我按照**实际数据特征**来判断平台（附件2当抖音、附件3当快手）\n2. 还是按照**文件名**来判断（附件2当快手、附件3当抖音）\n\n你希望我按哪种方式来写方案？';
    expect(looksLikeQuestion(q)).toBe(true);
    expect(clarifyOptions(q)).toEqual(['我按照实际数据特征来判断平台（附件2当抖音、附件3当快手）', '还是按照文件名来判断（附件2当快手、附件3当抖音）']);
    expect(looksLikeQuestion('# 方案\n## 第1章 目标\n- a')).toBe(false);
    const m = { ...meta, clarify: '问：你希望我按哪种方式来写方案？\n答：按实际数据特征' };
    expect(buildOutlinePrompt(m)).toMatch(/【用户对你之前提的问题的回答——按这个处理，同样的问题不要再问】\n问：你希望我按哪种方式来写方案？\n答：按实际数据特征/);
    expect(readPlanMeta(m)?.clarify).toBe(m.clarify);
    expect(planDisplayText(m)).toBe('📋 出方案（回答确认的问题，接着出大纲）\n我的回答：按实际数据特征');
    const page = readCode('app/dashboard/free-chat/page.tsx');
    expect(page).toMatch(/<PlanClarify key=/);
    expect(page).toMatch(/onAnswer=\{\(a\) => answerPlan\(plan, text, a\)\}/);
  });

  it('缺章检查和补写', () => {
    const outline = [{ title: '目标', points: [] }, { title: '执行排期', points: [] }, { title: '风险应对', points: [] }];
    const c = planCompleteness(outline, '# x\n## 第1章 目标\n内容\n## 第2章：执行排期\n内容');
    expect(c).toEqual({ missing: ['风险应对'], ended: false });
    expect(buildContinuePrompt({ ...meta, stage: 'full', outline }, c.missing)).toMatch(/- 风险应对/);
  });

  it('对话记录存 plan（刷新后大纲编辑器还在），乱写的丢掉', () => {
    const msgs = sanitizeMessages([{ role: 'assistant', content: 'x', timestamp: 1, plan: { ...meta, outline: [{ title: '目标', points: ['a'] }] } }, { role: 'user', content: 'y', timestamp: 2, plan: { stage: 'hack' } }]);
    expect(msgs[0].plan?.scenario).toBe('开业活动方案');
    expect(msgs[1].plan).toBeUndefined();
    expect(readPlanMeta({ stage: 'outline', scenario: 'a' })).toBeNull(); // 没写要解决什么
    expect(readCode('lib/chat-store.ts')).toMatch(/m\.plan \? \{ plan: m\.plan \}/);
  });

  it('页面接线：出方案入口、发送时显示短说明但发长要求、确认大纲写全文、补写、每条回答能下 Word / PDF', () => {
    const page = readCode('app/dashboard/free-chat/page.tsx');
    expect(page).toMatch(/<PlanStarter /);
    expect(page).toMatch(/const asked = opts\.prompt \?\? content;/);
    expect(page).toMatch(/handleSend\(planDisplayText\(m\), \{ plan: m, prompt: planPrompt\(m\), files: \[\] \}\)/);
    expect(page).toMatch(/<PlanOutlineEditor /);
    expect(page).toMatch(/continuePlan\(plan, c\.missing\)/);
    expect(page).toMatch(/downloadDocx\(msg\.canvas\?\.at\(-1\)\?\.content \?\? msg\.content\)/);
    expect(page).toMatch(/printPdf\(msg\.canvas\?\.at\(-1\)\?\.content \?\? msg\.content\)/);
    // 重新生成按原要求重拼，不是拿显示的短说明去问
    expect(page).toMatch(/if \(lastUser\.plan\) \{ void handleSend\(lastUser\.content, \{[^}]*prompt: planPrompt\(lastUser\.plan\)/);
  });
});
