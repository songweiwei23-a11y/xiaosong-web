// 对标拆解报告的排版（2026-11-02 产品方：原来整段原文直接显示，### 和 ** 都露在外面）：按 Markdown 排，顶上章节按钮
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reportSections } from '@/components/benchmark/BenchmarkReport';

describe('对标拆解报告的排版', () => {
  it('章节按钮取报告里的大标题，去掉序号和括号里的说明', () => {
    const r = '### 一、材料清单\n- x\n### 二、核心结论（先看这 8 条）\n#### 1. 人设定位\n### 十一、对我们的参考\n';
    expect(reportSections(r)).toEqual(['材料清单', '核心结论', '对我们的参考']);
    expect(reportSections('没有标题的一段话')).toEqual([]);
  });

  it('正在生成的报告和已保存的拆解都按 Markdown 排，不再用 pre 原样显示', () => {
    const analyzer = fs.readFileSync('components/benchmark/BenchmarkAnalyzer.tsx', 'utf8');
    const page = fs.readFileSync('app/dashboard/benchmark/page.tsx', 'utf8');
    expect(analyzer).toContain('<BenchmarkReport report={report} streaming={running} />');
    expect(page).toContain('<BenchmarkReport report={x.report} />');
    for (const src of [analyzer, page]) expect(src).not.toMatch(/<pre[^>]*>\{(report|x\.report)\}/);
    expect(fs.readFileSync('components/benchmark/BenchmarkReport.tsx', 'utf8')).toContain('<Markdown>{report}</Markdown>');
  });
});
