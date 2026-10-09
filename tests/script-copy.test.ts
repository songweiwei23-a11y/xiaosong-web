/**
 * 脚本结果新增「第2步：纯文字文案」：只有要念出来的话，方便复制。
 * 原来的结构不动，只是正文脚本从第2步挪到第3步、优化建议挪到第4步。
 */
import { describe, it, expect } from 'vitest';
import { extractPlainCopy } from '@/lib/script-copy';
import { buildReviewPrompt } from '@/lib/review-standards';
import { creationScript } from '@/lib/creation-flow';
import { readSource, readCode } from './helpers/source';

const SAMPLE = `### 第1步：脚本策略卡
- 视频目的：变现型
- 主钩子：被坑过的老板

### 第2步：纯文字文案
这个老板见我第一句话是：你们代运营都是骗子。
我说，先不收钱，给你拍一条试试。

三个月后，他店里周末要排队。
县城做事，看的是人。

### 第3步：正文脚本
【开场钩子】0-3秒：……
**金句**："县城做事，看的是人"（8字）

### 第4步：优化建议
- 开头可以更快进入冲突`;

describe('取出纯文字文案', () => {
  it('只取第2步那一段，到下一个标题为止，保留分段', () => {
    expect(extractPlainCopy(SAMPLE)).toBe(
      '这个老板见我第一句话是：你们代运营都是骗子。\n我说，先不收钱，给你拍一条试试。\n\n三个月后，他店里周末要排队。\n县城做事，看的是人。'
    );
  });

  it('模型多包了代码块、列表符号、加粗，也只留要念的字', () => {
    const md = '## 第2步：纯文字文案\n```\n- **第一句**\n1. 第二句\n> 第三句\n```\n---\n## 第3步：正文脚本\n镜头1';
    expect(extractPlainCopy(md)).toBe('第一句\n第二句\n第三句');
  });

  it('旧结果没有这一段，返回空串（界面据此提示重新生成）', () => {
    expect(extractPlainCopy('### 第1步：脚本策略卡\n- x\n### 第2步：正文脚本\n镜头')).toBe('');
    expect(extractPlainCopy('')).toBe('');
  });
  it('采访执行标记不进入提词器，主问、追问和真实台词原样保留', () => {
    const md = '## 纯文案版本\n国庆前后，这条街上的生意到底有什么变化？\n**[第一家店]**\n老板您好。\n（按现场真实回答）\n[根据回答选择追问方向]\n能说一件让您这样判断的具体事吗？\n（继续追问）\n我说（也可能没变），您实际是哪种？\n## 分镜\n镜头1';
    expect(extractPlainCopy(md)).toBe('国庆前后，这条街上的生意到底有什么变化？\n老板您好。\n能说一件让您这样判断的具体事吗？\n我说（也可能没变），您实际是哪种？');
  });
});

describe('脚本页的输出顺序', () => {
  const src = readSource('app/dashboard/script/page.tsx');

  it('1 策略卡 → 2 纯文字文案 → 3 正文脚本 → 4 优化建议，原来的要求一条没少', () => {
    const at = (s: string) => src.indexOf(s);
    const steps = ['### 第1步：脚本策略卡', '### 第2步：纯文字文案', '### 第3步：正文脚本', '### 第4步：优化建议'];
    for (const s of steps) expect(at(s), s).toBeGreaterThan(0);
    for (let i = 1; i < steps.length; i++) expect(at(steps[i])).toBeGreaterThan(at(steps[i - 1]));
    // 复制与镜头格式保留，但不再锁住会改变原意的金句/波点数量要求。
    for (const keep of ['【开场钩子】0-8秒', '【镜头X】', '台词必须和这段逐字一致']) expect(src).toContain(keep);
    expect(src).not.toContain('至少标注3处情绪波点');
    expect(src).toContain('不强制字数，不编感悟');
    expect(src).not.toContain('### 第2步：正文脚本');
    expect(src).not.toContain('### 第3步：优化建议');
  });

  it('文案和正文台词必须一致；结果区有「复制纯文案」', () => {
    expect(src).toMatch(/第3步的口播台词必须和这段逐字一致/);
    expect(src).toMatch(/label: "复制纯文案"/);
    expect(src).toMatch(/extractPlainCopy\(body\)/);
  });
});

/**
 * 审稿优化也要有纯文字版（2026-10-02 产品方）。
 * 「复制纯文案」挪到结果面板顶部统一给：原来是脚本页传的 nextActions，有了「继续创作」之后不显示了。
 */
describe('审稿优化的纯文字文案', () => {
  const p = { draftContent: '原稿', platform: '抖音', duration: '60秒', scriptType: '教知识型' } as Parameters<typeof buildReviewPrompt>[0];

  it('两种模式都在「优化后的完整脚本」之后出一节纯文字文案，规则和脚本板块一样', () => {
    for (const compareMode of [false, true]) {
      const prompt = buildReviewPrompt({ ...p, compareMode });
      const opt = prompt.indexOf('优化后的完整脚本');
      const plain = prompt.indexOf(`### ${compareMode ? 6 : 5}. 纯文字文案`);
      expect(opt, String(compareMode)).toBeGreaterThan(0);
      expect(plain, String(compareMode)).toBeGreaterThan(opt);
      expect(prompt).toMatch(/不要【】标注、emoji、加粗、序号、列表符号/);
      expect(prompt).toMatch(/必须和上面优化后脚本里的台词\*\*逐字一致\*\*/);
    }
  });

  it('问题清单和优化稿都就近写着「不许编数字和经历」（实测编出「开车50公里」「回头客占8成」）', () => {
    const prompt = buildReviewPrompt(p);
    const rule = /没有的数字、经历、事件[\s\S]*?都不补造[\s\S]*?未提供的必要信息写在文案外说明待补/;
    const list = prompt.slice(prompt.indexOf('### 3. 问题清单'), prompt.indexOf('优化后的完整脚本'));
    const opt = prompt.slice(prompt.indexOf('优化后的完整脚本'), prompt.indexOf('纯文字文案'));
    expect(list).toMatch(rule);
    expect(opt).toMatch(rule);
  });

  const RESULT = '### 1. 总评\n- 8.5 分\n### 4. 优化后的完整脚本\n【开场钩子】0-3秒\n台词：你绝对想不到\n### 5. 纯文字文案\n你绝对想不到\n这家店的牛肉是现切的';

  it('能从审稿结果里取出纯文案', () => {
    expect(extractPlainCopy(RESULT)).toBe('你绝对想不到\n这家店的牛肉是现切的');
  });

  it('加了这一节之后，带去分镜、开篇的仍然是优化后的完整脚本（不是纯文案）', () => {
    expect(creationScript('review', RESULT)).toBe('【开场钩子】0-3秒\n台词：你绝对想不到');
  });

  it('模型在「## 4. 优化后的完整脚本」下面用一级标题写段落（线上实测），也不截断；带去分镜的不能变成整份报告', () => {
    const real = '## 3. 问题清单\n…\n## 4. 优化后的完整脚本\n# 【开场钩子】0-5秒 | 💰金钱钩子\n台词：人均30块\n# 【中段展开】5-25秒\n台词：我们1根只穿8串\n## 5. 纯文字文案\n人均30块\n我们1根只穿8串';
    const opt = creationScript('review', real);
    expect(opt).toContain('【开场钩子】');
    expect(opt).toContain('【中段展开】');
    expect(opt).not.toContain('问题清单');
    expect(opt).not.toContain('纯文字文案');
    expect(extractPlainCopy(real)).toBe('人均30块\n我们1根只穿8串');
  });

  it('结果面板顶部统一给「复制纯文案」：脚本、审稿都能用', () => {
    const panel = readCode('components/workspace/ResultPanel.tsx');
    expect(panel).toMatch(/extractPlainCopy\(view\)/); // 画布里改过的取最新一版
    expect(panel).toMatch(/label="复制纯文案"/);
  });
});
