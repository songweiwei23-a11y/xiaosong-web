/**
 * 脚本结果新增「第2步：纯文字文案」：只有要念出来的话，方便复制。
 * 原来的结构不动，只是正文脚本从第2步挪到第3步、优化建议挪到第4步。
 */
import { describe, it, expect } from 'vitest';
import { extractPlainCopy } from '@/lib/script-copy';
import { readSource } from './helpers/source';

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
});

describe('脚本页的输出顺序', () => {
  const src = readSource('app/dashboard/script/page.tsx');

  it('1 策略卡 → 2 纯文字文案 → 3 正文脚本 → 4 优化建议，原来的要求一条没少', () => {
    const at = (s: string) => src.indexOf(s);
    const steps = ['### 第1步：脚本策略卡', '### 第2步：纯文字文案', '### 第3步：正文脚本', '### 第4步：优化建议'];
    for (const s of steps) expect(at(s), s).toBeGreaterThan(0);
    for (let i = 1; i < steps.length; i++) expect(at(steps[i])).toBeGreaterThan(at(steps[i - 1]));
    // 原来第2步正文脚本的格式硬要求原样还在
    for (const keep of ['【开场钩子】0-8秒', '**金句**', '【镜头X】', '至少标注3处情绪波点']) expect(src).toContain(keep);
    expect(src).not.toContain('### 第2步：正文脚本');
    expect(src).not.toContain('### 第3步：优化建议');
  });

  it('文案和正文台词必须一致；结果区有「复制纯文案」', () => {
    expect(src).toMatch(/第3步的口播台词必须和这段逐字一致/);
    expect(src).toMatch(/label: "复制纯文案"/);
    expect(src).toMatch(/extractPlainCopy\(body\)/);
  });
});
