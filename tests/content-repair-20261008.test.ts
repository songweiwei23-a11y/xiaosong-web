import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '@/components/markdown';
import { reconcileReviewScores, reconcileTitleCounts, titleCharacterCount, hasObviousCutoff } from '@/lib/result-reconciliation';
import { businessLines } from '@/lib/profile-summary';
import { splitCreationItems } from '@/lib/creation-items';
import { pendingInterview, boundedResultIssues } from '@/lib/bounded-result-check';

const audit = (name: string) => fs.readFileSync(path.join(process.cwd(), 'docs/全创作板块实测_20261008', name), 'utf8');
const render = (md: string) => renderToStaticMarkup(React.createElement(Markdown, null, md));

describe('真实失败产物回放，不调用模型', () => {
  it('上线网页新增的合计箭头和补充说明不能另留一个8.5分', () => {
    const visible=fs.readFileSync('docs/全板块质量修复_20261008/上线后验收/审稿_首次失败可见正文.md','utf8');
    const text=visible.split('\n').map(line=>line.includes('\t')?`|${line.replace(/\t/g,'|')}|`:line).join('\n');
    const fixed=reconcileReviewScores(text);
    expect(fixed).toContain('合计：94 / 100 → 9.4 / 10');
    expect(fixed).not.toContain('8.5/10');expect(fixed).not.toContain('调整为8.5分');
    expect(fixed).toContain('最终合计为9.4分');
    expect(reconcileReviewScores(fixed)).toBe(fixed);
  });
  it('网页审稿六项合计92：修正8.2/82，不改变任何分项判断', () => {
    const text = audit('网页实测/审稿_可见正文.md').split('\n').map(line => line.includes('\t') ? `|${line.replace(/\t/g, '|')}|` : line).join('\n');
    const fixed = reconcileReviewScores(text);
    expect(fixed).toContain('综合得分：9.2 / 10');
    expect(fixed).toContain('百分制合计：92 / 100');
    expect(fixed).toContain('|事实与证据|20/20|');
    expect(fixed).not.toContain('8.2 分');
    expect(reconcileReviewScores(fixed)).toBe(fixed);
  });
  it('不凭缺项、超权重或另一套评分制猜总分', () => {
    for (const text of ['总评分：8.2分\n|事实与证据|20/20|', '|事实与证据|21/20|\n综合得分：8.2分']) expect(reconcileReviewScores(text)).toBe(text);
  });
  it('标题实际19、19、20字：纠正模型22、23、23，标题正文逐字保留', () => {
    const text = audit('网页实测/标题_可见正文.md');
    const fixed = reconcileTitleCounts(text);
    const counts = [...fixed.matchAll(/字数\*{0,2}[：:]\s*(\d+)/g)].map(m => Number(m[1]));
    expect(counts).toEqual([19, 19, 20]);
    for (const line of text.split('\n').filter(line => /^\d\./.test(line))) expect(fixed).toContain(line);
    expect(reconcileTitleCounts(fixed)).toBe(fixed);
  });
  it('中文、英文和数字按字符计，表情标点空格不计', () => {
    expect(titleCharacterCount('开物 AI，2026！😀')).toBe(8);
    const code = '```\n1. 假标题\n字数：100字\n```';
    expect(reconcileTitleCounts(code)).toBe(code);
  });
  it('实际网页拆解的五个分析维度不当脚本，保留后面的三个真实选题', () => {
    const visible=audit('网页实测/拆文案_可见正文.md');
    const snapshot=audit('网页实测/拆文案_完成.txt');
    const headings=[...snapshot.matchAll(/- heading "(.+)" \[level=(\d)\]/g)];
    let markdown=visible;
    for(const h of headings) markdown=markdown.split('\n').map(line=>line.trim()===h[1]?`${'#'.repeat(Number(h[2]))} ${line}`:line).join('\n');
    const items=splitCreationItems(markdown).items;
    expect(items).toHaveLength(3);
    expect(items.every(item=>item.kind==='topic')).toBe(true);
    expect(items.some(item=>/开篇钩子|脚本结构|信息递进|情绪设计|结尾行动/.test(item.label))).toBe(false);
  });
  it('生产模型以镜头1后未写完的加粗画面标签结束：即使有结束事件也不是完整交付', () => {
    expect(hasObviousCutoff(audit('模型原始记录/14_script_interview_输出.md'))).toBe(true);
    for (const text of ['完整回答', '【画面】样柜。', '**重点**', '请保留【画面】标签', '{"content":"内容"}']) expect(hasObviousCutoff(text)).toBe(false);
  });
});

describe('事实传递与品类', () => {
  it('合并标签去重，明确产品不混入自定义赛道', () => {
    expect(businessLines({product_category:['沙发', '床', '衣柜', '沙发、床、衣柜'], account_track:['家居家装']})).toEqual(['沙发','床','衣柜']);
  });
  it('兼容把具体菜品放在赛道栏的旧档案', () => {
    expect(businessLines({product_category:['餐饮'],account_track:['美食烹饪','川味烧烤','川菜']})).toEqual(['川味烧烤','川菜']);
  });
});

describe('中文链接边界与渲染安全', () => {
  it.each(['www.gov.cn）发布安排', 'https://www.gov.cn）发布安排', 'www.gov.cn，见公告'])('%s 不生成含中文叙述的错误域名', source => {
    const html = render(source);
    expect(html).toMatch(/href="https?:\/\/www.gov.cn"/);
    expect(html).not.toMatch(/href="[^\"]*(?:%EF|xn--)/);
    expect(html).toContain('公告' === source.slice(-2) ? '见公告' : '发布安排');
  });
  it('显式链接和中文路径保持完整，代码不自动链接', () => {
    expect(render('[政府公告](https://www.gov.cn/政策/安排)')).toContain('href="https://www.gov.cn/');
    expect(render('https://example.com/中文')).toContain('href="https://example.com/');
    expect(render('`www.gov.cn）发布`')).not.toContain('<a');
  });
  it('危险协议依然不成为可执行链接', () => {
    expect(render('[点此](javascript:alert%281%29)')).not.toContain('href="javascript:');
  });
});

describe('交付检查必须区分用户状态与通用提示词', () => {
  it('网页复测中的老板都在说同一件事，仍属于预写采访结论', () => {
    expect(boundedResultIssues('### 1. 县城这条街的老板，国庆后都在说同一件事','标题封面',1,'尚未采访')).not.toEqual([]);
    expect(boundedResultIssues('### 1. 准备问老板：国庆后生意怎么样？','标题封面',1,'尚未采访')).toEqual([]);
  });
  it('两次加强规则后仍失败的实际标题都被检查发现', () => {
    for(const n of [1,2]) {
      const text=fs.readFileSync(`docs/全板块质量修复_20261008/正式模型对照/future_title_${n}_after_交付输出.md`,'utf8');
      expect(boundedResultIssues(text,'标题封面',3,'尚未采访，没有实录')).not.toEqual([]);
    }
  });
  it('问题式和明确准备行动的三个标题可以交付', () => {
    const text='### 1. 国庆前后，生意有什么变化？\n### 2. 准备去街上问问老板\n### 3. 节前节后，店主在想什么？';
    expect(boundedResultIssues(text,'标题封面',3,'尚未采访')).toEqual([]);
  });
  it('有实录时不阻挡已发生采访标题，没有资料不推测状态', () => {
    expect(pendingInterview('采访已完成，三家老板回答已提供')).toBe(false);
    expect(boundedResultIssues('### 1. 我问了三家店','标题封面',1,'采访已完成')).toEqual([]);
    expect(boundedResultIssues('### 1. 我问了三家店','标题封面',1,'')).toEqual([]);
  });
  it('一个二创方案不得交付两个，连续编号与数量都检查', () => {
    expect(boundedResultIssues('### 方案 1：开柜门\n### 方案 2：看抽屉','跨行业二创',1)).not.toEqual([]);
    expect(boundedResultIssues('### 方案 1：开柜门','跨行业二创',1)).toEqual([]);
    expect(boundedResultIssues('### 方案 1：开柜门\n### 方案 3：看抽屉','跨行业二创',2)).not.toEqual([]);
  });
  it('封面本身不预写回答，后面的禁止说明不会被误报', () => {
    const title='### 1. 国庆前后，生意变了吗？\n';
    expect(boundedResultIssues(title+'- 封面配合：「待验证 多店对比」——不预设“不同答案”','标题封面',1,'尚未采访')).toEqual([]);
    expect(boundedResultIssues(title+'- 封面配合：「三家店 真实回答」——用于引发好奇','标题封面',1,'尚未采访')).not.toEqual([]);
  });
});
