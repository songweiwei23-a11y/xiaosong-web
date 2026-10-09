import { describe, expect, it } from 'vitest';
import { buildContentPlanPrompt, checkPlan, lastMonthPublished, parsePlanDirections, suggestMonthCount } from '@/lib/content-plan';
import { resolveMix } from '@/lib/content-mix';
import { splitCreationItems, itemsNoun } from '@/lib/creation-items';
import { buildCreationHandoff, CREATION_SOURCES, RECOMMENDED_NEXT } from '@/lib/creation-flow';
import { getFeatureFromTaskType } from '@/lib/task-type';
import { DURABLE_CREATIVE_TASKS } from '@/lib/creative-history';

const resolved = resolveMix(null, { preset: 'custom', custom: { 流量型: 50, 人设型: 25, 变现型: 25 } });

const sample = `# 2026年10月内容规划（共 8 条）

## 📌 这个月的思路
上个月没有作品数据。

## 🧭 内容方向（勾选想做的方向，带去创作方向、选题或脚本接着做）

### 方向1：装修避坑知识
- **视频目的**：流量型
- **内容类型**：冷知识
- **内容方向**：讲买家具前要注意的事
- **本月条数**：4 条
- **为什么**：新号先拿流量

### 方向2：老板带你挑
- **视频目的**：人设型
- **内容类型**：晒过程
- **内容方向**：老板现场帮人配一套
- **本月条数**：2 条

### 方向3：节后到店理由
- **视频目的**：变现型
- **内容类型**：聊观点
- **内容方向**：人少能慢慢挑
- **本月条数**：2 条

## 🗓 四周节奏
| 周 | 发几条 | 来自哪几个方向 |`;

describe('当月内容规划', () => {
  it('提示词：带今天日期、条数、按目的的条数，不出具体选题', () => {
    const q = buildContentPlanPrompt({ lastMonth: '1-4', recordedLastMonth: 2, count: 8, focus: ['store'], events: '月底店庆', notes: '', resolved, today: new Date(2026, 9, 9) });
    expect(q).toContain('2026年10月9日');
    expect(q).toContain('这个月一共发 8 条');
    expect(q).toContain('流量型 4 条、人设型 2 条、变现型 2 条');
    expect(q).toContain('不出具体选题');
    expect(q).toContain('系统里记录的已发布作品 2 条');
    expect(q).toContain('月底店庆');
    expect(q).toContain('### 方向1：');
  });
  it('提示词：方向写满 15～20 个，流量型不许出现教知识', () => {
    const q = buildContentPlanPrompt({ lastMonth: '1-4', recordedLastMonth: 2, count: 16, focus: [], events: '', notes: '', resolved, today: new Date(2026, 9, 9) });
    expect(q).toContain('15～20 个');
    expect(q).toContain('少于 15 个不算完成');
    expect(q).toContain('流量型那一行只写流量打法');
    expect(q).toContain('教知识、行业干货、避坑一律归变现型');
    expect(q).not.toContain('3～6 个');
  });
  it('解析方向并核对配比', () => {
    expect(parsePlanDirections(sample).map((d) => [d.role, d.count])).toEqual([['流量型', 4], ['人设型', 2], ['变现型', 2]]);
    expect(checkPlan(sample, resolved, 8).ok).toBe(true);
    const off = checkPlan(sample.replace('本月条数**：4 条', '本月条数**：3 条'), resolved, 8);
    expect(off.ok).toBe(false);
    expect(off.sum).toBe(7);
  });
  it('上个月发布数只算上个自然月、已发布的', () => {
    const now = new Date(2026, 9, 9);
    const works = [
      { shoot_status: 'published' as const, published_at: '2026-09-03T10:00:00+08:00' },
      { shoot_status: 'published' as const, published_at: '2026-09-28T10:00:00+08:00' },
      { shoot_status: 'published' as const, published_at: '2026-10-02T10:00:00+08:00' },
      { shoot_status: 'shot' as const, published_at: null },
    ];
    expect(lastMonthPublished(works, now)).toBe(2);
  });
  it('推荐条数稳着加', () => {
    expect(suggestMonthCount('0')).toBe(8);
    expect(suggestMonthCount('9-12')).toBe(12);
    expect(suggestMonthCount('21+')).toBe(20);
  });
  it('结果里的方向能勾，带去选题时目的、类型、条数自动选好', () => {
    const parts = splitCreationItems(sample);
    expect(parts.items).toHaveLength(3);
    expect(itemsNoun(parts.items)).toBe('方向思路');
    expect(CREATION_SOURCES['content-plan']).toBe('内容规划');
    expect(RECOMMENDED_NEXT['content-plan']).toEqual(['direction', 'topic', 'script']);
    const payload = buildCreationHandoff('content-plan', 'topic', parts.items[0].body, { from: '内容规划' });
    expect(payload.settings?.purpose).toBe('流量型');
    expect(payload.settings?.scriptType).not.toBe('teach');
    expect(payload.settings?.topicCount).toBe(4);
    expect(payload.target).toBe('/dashboard/topic');
  });
  it('计费归到创作方向那一项', () => {
    expect(getFeatureFromTaskType('内容规划')).toBe('direction');
  });
  it('结果能存进历史（服务端和补存都要认这个任务类型）', () => {
    expect(DURABLE_CREATIVE_TASKS.has('内容规划')).toBe(true);
  });
});
