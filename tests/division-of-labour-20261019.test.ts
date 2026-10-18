import { describe, it, expect } from 'vitest';
import { adviceContextBlock, staleUpstream } from '@/lib/industry-advice';
import { TOPIC_TAGS, topicTagBlock, topicTagIssues } from '@/lib/output-tags';
import { buildContextBlock, type CreatorContext } from '@/lib/creator-context';
import { manifestOf } from '@/lib/context-manifest';
import { runQualityChecks } from '@/lib/quality-checks';

const base = (over: Partial<CreatorContext> = {}): CreatorContext => ({ profile: null, positioning: null, dealReasons: [], ...over });
const CONTENT = '## 内容定位\n- 系列A：烧烤做法（人设）\n- 系列B：到店实拍（变现）';
const BUSINESS = '## 商业定位\n1. 看到视频\n2. 评论区问地址\n3. 到店消费';

describe('药方过期：上游定位在药方之后更新过', () => {
  it('只报出生成时间晚于药方的上游', () => {
    const stale = staleUpstream('2026-10-01T00:00:00Z', [
      { name: '内容定位', at: '2026-10-05T00:00:00Z' },
      { name: '商业定位', at: '2026-09-20T00:00:00Z' },
      { name: '账号定位', at: null },
    ]);
    expect(stale).toEqual(['内容定位']);
  });

  it('药方时间不明时不误报', () => {
    expect(staleUpstream(null, [{ name: '内容定位', at: '2026-10-05T00:00:00Z' }])).toEqual([]);
    expect(staleUpstream('not-a-date', [{ name: '内容定位', at: '2026-10-05T00:00:00Z' }])).toEqual([]);
  });

  it('药方块里提示先复诊，没有过期时不出现这句', () => {
    const stale = adviceContextBlock('## 本阶段判断\n内容', undefined, ['内容定位']);
    expect(stale).toContain('内容定位在这份药方生成之后更新过');
    expect(stale).toContain('先复诊再照做');
    expect(adviceContextBlock('## 本阶段判断\n内容')).not.toContain('先复诊再照做');
  });
});

describe('选题的四个标签', () => {
  it('标签块列出四个标签，只说明格式，不写具体内容', () => {
    const block = topicTagBlock();
    for (const tag of TOPIC_TAGS) expect(block).toContain(`**【${tag}】**`);
    // 方向是用户的选择：不在内容定位里的，标【自定义】，不硬凑进系列
    expect(block).toContain('【自定义】');
    expect(block).toContain('不硬凑进系列');
    // 小票、价格的数字只用档案里有的（2026-10-19 复测：系列描述里提到小票，选题就编出「27 块」）
    expect(block).toContain('金额打码');
    expect(block).toContain('不替它编数字');
  });

  it('每条都有四个标签就通过', () => {
    const ok = '## 选题1 标题\n【方向】系列A\n【目的】变现\n【结尾动作】评论区问地址\n【成交步骤】到店消费\n拍摄角度...';
    expect(topicTagIssues(ok)).toEqual([]);
  });

  it('缺哪个标签就指出是第几条、缺哪几个', () => {
    const bad = '## 选题1 标题\n【方向】系列A\n【目的】变现\n【结尾动作】评论区问地址\n【成交步骤】到店消费\n\n## 选题2 标题\n【方向】系列B\n【目的】流量';
    expect(topicTagIssues(bad)).toEqual(['第 2 条选题缺少标签「结尾动作、成交步骤」']);
  });

  it('加粗的写法也算', () => {
    const bold = '## 选题1\n**方向**：系列A\n**目的**：人设\n**结尾动作**：关注我\n**成交步骤**：—';
    expect(topicTagIssues(bold)).toEqual([]);
  });

  it('识别不出分段时不误报', () => {
    expect(topicTagIssues('这里只是一段话，没有分节')).toEqual([]);
  });

  it('质检把缺标签记成非阻断的提醒，不挡交付', () => {
    const r = runQualityChecks({ output: '## 选题1\n【方向】系列A', profile: null, taskType: '选题策划' });
    const tagIssues = r.issues.filter((i) => i.detail.includes('缺少标签'));
    expect(tagIssues.length).toBeGreaterThan(0);
    expect(tagIssues.every((i) => i.blocking === false)).toBe(true);
  });
});

describe('每个板块只拿自己需要的定位（清单 deep 字段）', () => {
  it('方案 D：选题、方向不带简报（简报会把没依据的时间、流程带进来）', () => {
    expect(manifestOf('topic')?.brief).toEqual([]);
    expect(manifestOf('direction')?.brief).toEqual([]);
    expect(manifestOf('topic')?.advice).toBeUndefined();
  });

  it('选题、方向拿内容定位；脚本（方案 D）不拿任何深挖定位，也不拿简报和行业建议', () => {
    expect(manifestOf('topic')?.deep).toEqual(['content']);
    expect(manifestOf('direction')?.deep).toEqual(['content']);
    expect(manifestOf('script')?.deep).toBeUndefined();
    expect(manifestOf('script')?.advice).toBe(false);
    expect(manifestOf('script')?.positioning).toBe(false);
    expect(manifestOf('script')?.brief).toEqual([]);
    expect(manifestOf('storyboard')?.deep).toBeUndefined();
    expect(manifestOf('review')?.deep).toBeUndefined();
  });

  it('选题有内容定位的系列清单，并带上四个标签说明', () => {
    const out = buildContextBlock(base({ contentPositioning: CONTENT }), 'topic');
    expect(out).toContain('内容定位（参考系列）');
    expect(out).toContain('系列A：烧烤做法');
    expect(out).toContain('每条选题的四个标签');
    expect(out).not.toContain('商业定位（成交路径）');
  });

  it('脚本只给档案和写作底线：商业定位、内容定位、行业建议、账号定位都不带（方案 D）', () => {
    const out = buildContextBlock(base({
      businessPositioning: BUSINESS, contentPositioning: CONTENT,
      advice: '## 本阶段判断\n内容', positioning: { name: '账号定位', summary: '摘要', full: '账号定位原文' },
    }), 'script');
    expect(out).not.toContain('商业定位（成交路径）');
    expect(out).not.toContain('内容定位（参考系列）');
    expect(out).not.toContain('行业建议（药方）');
    expect(out).not.toContain('账号定位原文');
    expect(out).toContain('三有自检');
  });

  it('分镜不拿任何深挖定位，但药方照样带', () => {
    const out = buildContextBlock(base({ businessPositioning: BUSINESS, contentPositioning: CONTENT, advice: '## 本阶段判断\n内容' }), 'storyboard');
    expect(out).not.toContain('内容定位（参考系列）');
    expect(out).not.toContain('商业定位（成交路径）');
    expect(out).toContain('行业建议（药方）');
  });

  it('只有选题带标签说明', () => {
    const withSomething = base({ advice: '## 本阶段判断\n内容' });
    expect(buildContextBlock(withSomething, 'topic')).toContain('每条选题的四个标签');
    expect(buildContextBlock(withSomething, 'script')).not.toContain('每条选题的四个标签');
  });

  it('药方过期时，创作板块也看得到提示', () => {
    const out = buildContextBlock(base({ advice: '## 本阶段判断\n内容', adviceStale: ['商业定位'] }), 'topic');
    expect(out).toContain('商业定位在这份药方生成之后更新过');
  });
});
