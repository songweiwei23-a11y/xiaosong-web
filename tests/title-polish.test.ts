import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { acceptRepair, findTemplateTitles, isTemplateTitle, polishTitles, repairTitlePrompt, replaceTitle, titleOfLine } from '@/lib/title-polish';

const SAMPLE = [
  '## 🧭 内容方向',
  '### 方向1：一条裤子',
  '- **标题**：',
  '  - ★试裤子别只站着照镜子',
  '  - 大码裤子，站着合身，坐下腰头会不会勒',
  '### 2. 大码女生试裤子，别只在镜子前转一圈',
  '### 3. 同一条裤子，站着和坐下差在哪',
].join('\n');

describe('识别万能模板标题', () => {
  it('命中「别只」「你知道吗」「，怎么」「原来，」「N 个技巧」', () => {
    expect(isTemplateTitle('试裤子别只站着照镜子')).toBe(true);
    expect(isTemplateTitle('你知道大码裤子怎么选吗')).toBe(true);
    expect(isTemplateTitle('裤子站着好看，怎么坐下才知道')).toBe(true);
    expect(isTemplateTitle('原来，裤子是这样选的')).toBe(true);
    expect(isTemplateTitle('试衣的 5 个技巧')).toBe(true);
  });
  it('具体的标题不命中', () => {
    expect(isTemplateTitle('同一条裤子，站着和坐下差在哪')).toBe(false);
    expect(isTemplateTitle('大码裤子站着合身，坐下腰头会不会勒')).toBe(false);
  });
  it('两种标题写法都认：★标题、### N. 标题', () => {
    expect(titleOfLine('  - ★试裤子别只站着照镜子')).toBe('试裤子别只站着照镜子');
    expect(titleOfLine('- **标题**：★同一条裤子，站着和坐下差在哪')).toBe('同一条裤子，站着和坐下差在哪');
    expect(titleOfLine('### 2. 大码女生试裤子，别只在镜子前转一圈')).toBe('大码女生试裤子，别只在镜子前转一圈');
    expect(titleOfLine('## 方向标题')).toBeNull();
  });
  it('全文找出模板标题，去重', () => {
    expect(findTemplateTitles(SAMPLE)).toEqual(['试裤子别只站着照镜子', '大码女生试裤子，别只在镜子前转一圈']);
  });
});

describe('采用标准：新标题要过关，过不了就保留原样', () => {
  it('一行、不超 20 字、不是模板、和原来不同，才采用', () => {
    expect(acceptRepair('试裤子别只站着照镜子', '站着合身，坐下才见真章')).toBe('站着合身，坐下才见真章');
    expect(acceptRepair('试裤子别只站着照镜子', '  ★站着合身，坐下才见真章  ')).toBe('站着合身，坐下才见真章');
  });
  it('拒绝：空、多行、超长、仍是模板、和原来一样', () => {
    expect(acceptRepair('原标题', null)).toBeNull();
    expect(acceptRepair('原标题', '第一行\n第二行')).toBeNull();
    expect(acceptRepair('原标题', '这是一个非常非常非常非常长的标题超过二十个字了')).toBeNull();
    expect(acceptRepair('原标题', '试裤子别只站着照镜子')).toBeNull();
    expect(acceptRepair('原标题', '原标题')).toBeNull();
    // 身材评价不采用（2026-10-25 真实模型回答里出现过的两条）
    expect(acceptRepair('试裤子别只站着照镜子', '大码试裤子站着显瘦坐下勒肚子')).toBeNull();
    expect(acceptRepair('大码女生的衣柜，别只剩黑色', '大码女生穿黑色，反而更显壮')).toBeNull();
  });
  it('修改提示词写明：不拿身材开玩笑', () => {
    expect(repairTitlePrompt('原标题', '')).toContain('不写「显瘦」「显胖」「显壮」「勒肚子」');
  });
  it('修改提示词只重写这一条，并带上原标题和字数上限', () => {
    const p = repairTitlePrompt('试裤子别只站着照镜子', '大码女生试裤子');
    expect(p).toContain('只输出新标题一行');
    expect(p).toContain('原标题：试裤子别只站着照镜子');
    expect(p).toContain('不超过 20 个字');
  });
});

describe('精准小改：只换模板标题，其他行一字不动', () => {
  it('模型给出合格的新标题时，只替换那一条', async () => {
    const ask = vi.fn(async (prompt: string) => (prompt.includes('试裤子别只站着照镜子') ? '站着合身，坐下才见真章' : null));
    const { text, tried, accepted } = await polishTitles(SAMPLE, ask);
    expect(tried).toBe(2);
    expect(accepted).toBe(1);
    expect(text).toContain('★站着合身，坐下才见真章');
    expect(text).not.toContain('试裤子别只站着照镜子');
    // 其他行一字不动
    expect(text).toContain('大码裤子，站着合身，坐下腰头会不会勒');
    expect(text).toContain('### 3. 同一条裤子，站着和坐下差在哪');
    expect(text).toContain('### 2. 大码女生试裤子，别只在镜子前转一圈');
  });
  it('模型失败或给出的还是模板：原样保留，不改坏', async () => {
    const ask = vi.fn(async () => '又是别只站着看');
    const { text, accepted } = await polishTitles(SAMPLE, ask);
    expect(accepted).toBe(0);
    expect(text).toBe(SAMPLE);
  });
  it('没有模板标题时不调用模型', async () => {
    const ask = vi.fn(async () => 'x');
    const clean = '### 1. 同一条裤子，站着和坐下差在哪';
    const { text, tried } = await polishTitles(clean, ask);
    expect(tried).toBe(0);
    expect(ask).not.toHaveBeenCalled();
    expect(text).toBe(clean);
  });
});

describe('接线：路由要鉴权，创作方向页生成完要走后处理', () => {
  it('路由 requireUser 鉴权，并调 polishTitles', () => {
    const src = fs.readFileSync('app/api/polish-titles/route.ts', 'utf8');
    expect(src).toMatch(/requireUser\(\)/);
    expect(src).toMatch(/polishTitles\(text, ask, context\)/);
  });
  it('创作方向页生成完调 polishTitlesRemote，保存的是修好的正文', () => {
    const src = fs.readFileSync('app/dashboard/direction/page.tsx', 'utf8');
    expect(src).toMatch(/polishTitlesRemote\(full\)/);
    expect(src).toMatch(/result: polished \}\)/);
  });
});

describe('替换', () => {
  it('同一条标题出现多次，全部换掉', () => {
    expect(replaceTitle('a 别只看 b 别只看', '别只看', '看')).toBe('a 看 b 看');
  });
});
