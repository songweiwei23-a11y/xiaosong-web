import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { directionSeedOf, isDirectionBlock } from '@/lib/direction-seed';
import { topicReference } from '@/lib/creation-continuation';
import { creationSettingsBlock } from '@/lib/creation-settings';
import { assignTopicSlots, audiencePool, topicSlotsBlock } from '@/lib/topic-slots';
import { topicDiversityOf } from '@/lib/topic-diversity';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';
import { VIRAL_ELEMENTS } from '@/lib/viral-elements';

const DIRECTION = [
  '### 方向1：同一件外套，换搭配看差别',
  '- **视频目的**：流量型',
  '- **出发点**：人是店员，货是店里的大码外套，场是试衣镜前。反差落在同一件外套搭配不同内搭和下装。',
  '- **内容类型**：第19计 **对比改造**',
  '- **讲法**：晒过程，先说任务，再逐件换搭，最后并排展示。',
  '- **第一秒画面**：出镜者站在试穿镜前，拿着同一件外套。',
  '- **标题**：★同一件外套换内搭差在哪',
  '- **内容方向**：围绕换季、上学、日常出门等场景，展示同一件外套与不同内搭、下装的组合。',
  '- **为什么**：这条把大码外套放进真实场景里，新号最需要这种一眼能看懂的内容。',
  '- **切入角度**：',
  '  - 对比切入 ｜ 同一件外套换搭配 ｜ 对比 ｜ 与其他角度不同的是看的维度',
  '- **题眼池**：',
  '  - 同一件外套的前后搭配（来源：客户常问「怎么搭」）',
  '  - 上学和带娃穿同一件（来源：档案的目标职业）',
  '- **节奏**：第1周',
].join('\n');

describe('P1 方向只给种子：范围和切入角度，不给人群、讲法、标题、镜头', () => {
  it('能识别方向块', () => {
    expect(isDirectionBlock(DIRECTION)).toBe(true);
    expect(isDirectionBlock('## 选题1：一条普通的选题')).toBe(false);
  });
  it('种子含方向名、范围、切入角度、大致目的；不含人、讲法、标题、第一秒', () => {
    const seed = directionSeedOf(DIRECTION) ?? '';
    expect(seed).toContain('方向：同一件外套，换搭配看差别');
    expect(seed).toContain('范围：围绕换季、上学、日常出门等场景');
    expect(seed).toContain('角度：对比切入');
    expect(seed).toContain('题眼：同一件外套的前后搭配');
    expect(seed).toContain('题眼：上学和带娃穿同一件');
    expect(seed).toContain('核心目的（不能改）：流量型');
    expect(seed).not.toContain('出镜者');
    expect(seed).not.toContain('讲法');
    expect(seed).not.toContain('第一秒');
    expect(seed).not.toContain('★');
    expect(seed).not.toContain('对比改造');
  });
  it('选题拿到的参考原文是种子，不是整段方向', () => {
    const ref = topicReference({ sourceContent: DIRECTION, originContent: DIRECTION, settings: {} });
    expect(ref).toContain('【方向种子');
    expect(ref).not.toContain('第一秒画面');
    expect(ref).not.toContain('出镜者站在试穿镜前');
  });
  it('非方向的参考原文保持原样（不影响脚本等其他来源）', () => {
    const ref = topicReference({ sourceContent: '一段普通的脚本正文', originContent: '一段普通的脚本正文', settings: {} });
    expect(ref).toContain('一段普通的脚本正文');
    expect(ref).not.toContain('方向种子');
  });
});

describe('P2 连续设置：选题层只锁目的，人群、结构、拍法、元素逐条分配', () => {
  const s = { purpose: '流量型' as const, audience: '宝妈', tactic: '对比改造', scriptType: 'show', structure: 'train', topic: '同一件外套' };
  it('选题层：不锁人群、结构、拍法，锁目的和用户原意', () => {
    const block = creationSettingsBlock(s, 'topic');
    expect(block).toContain('视频目的：流量型');
    expect(block).not.toContain('目标人群');
    expect(block).not.toContain('拍法：');
    expect(block).not.toContain('脚本结构');
    expect(block).toContain('人群、结构、拍法、元素由选题层逐条分配');
  });
  it('选题到脚本的连续设置保持原样：全部锁定', () => {
    const block = creationSettingsBlock(s);
    expect(block).toContain('目标人群：宝妈');
    expect(block).toContain('方向、人群、目的、结构和时长不得擅自更换');
  });
});

describe('P3 不整批锁同一计', () => {
  it('选题的提示词里不再有「本轮所有选题继续用」，也不要求其余选题保持同一拍法', () => {
    const src = fs.readFileSync('lib/boards/topic-query.ts', 'utf8');
    expect(src).not.toContain('本轮所有选题继续用');
    const design = fs.readFileSync('lib/topic-design.ts', 'utf8');
    expect(design).not.toContain('保持同一核心对象和拍法');
    expect(design).toContain('各自换一个人群、一种爆款元素和一种拍法');
  });
});

describe('P4 槽位分配：代码保证人群、元素、拍法各自不重复', () => {
  it('人群从档案的职业和年龄组合，去重', () => {
    const pool = audiencePool({ target_age: '25-30岁、31-40岁', target_occupation: '宝妈、学生' });
    expect(pool.length).toBeGreaterThanOrEqual(2);
    expect(new Set(pool).size).toBe(pool.length);
    expect(pool.some((x) => x.includes('宝妈'))).toBe(true);
    expect(pool.some((x) => x.includes('学生'))).toBe(true);
  });
  it('档案字段是数组（多选）也能取到人群', () => {
    const pool = audiencePool({ target_age: ['25-30岁', '31-40岁'], target_occupation: ['宝妈', '学生'] });
    expect(pool.length).toBeGreaterThanOrEqual(2);
    expect(pool.some((x) => x.includes('宝妈'))).toBe(true);
  });
  it('档案没有职业和年龄时，用兴趣补', () => {
    expect(audiencePool({ target_interests: '大码女装、平价穿搭' })).toEqual(['大码女装', '平价穿搭']);
    expect(audiencePool(null)).toEqual([]);
  });
  it('6 条选题：人群、元素、拍法各不重复（人群足够时）', () => {
    const slots = assignTopicSlots({
      count: 6,
      audiences: ['25-30岁 宝妈', '18-24岁 学生', '31-40岁 上班族', '25-30岁 学生', '31-40岁 宝妈', '18-24岁 宝妈'],
      elements: VIRAL_ELEMENTS.map((e) => e.name.replace(/选题$/, '')),
      tactics: GROWTH_TACTICS.map((t) => t.name),
      firstTactic: '街头采访',
    });
    expect(new Set(slots.map((s) => s.audience)).size).toBe(6);
    expect(new Set(slots.map((s) => s.element)).size).toBe(6);
    expect(new Set(slots.map((s) => s.tactic)).size).toBe(6);
    expect(slots[0].tactic).toBe('街头采访');
  });
  it('拍法池长度与步长互质时，前 N 条拍法不重复', () => {
    const tactics = GROWTH_TACTICS.map((t) => t.name);
    const slots = assignTopicSlots({ count: 12, audiences: ['a'], elements: ['头牌'], tactics });
    expect(new Set(slots.map((s) => s.tactic)).size).toBe(12);
  });
  it('分配表写明每条的三项，并要求互不相同', () => {
    const block = topicSlotsBlock(assignTopicSlots({ count: 2, audiences: ['宝妈', '学生'], elements: ['反差', '人群'], tactics: ['反向操作', '换个视角'] }));
    expect(block).toContain('第1条：人群=宝妈；爆款元素=反差；拍法=反向操作');
    expect(block).toContain('第2条：人群=学生；爆款元素=人群；拍法=换个视角');
    expect(block).toContain('各条互不相同');
  });
});

describe('P5 多样性测量', () => {
  it('统计拍法、爆款元素种数，并数出重复标题', () => {
    const md = [
      '## 选题1：同一件外套换搭配',
      '- 拍法：反向操作，反差用反差',
      '## 选题2：宝妈的一天穿搭',
      '- 拍法：换个视角，人群是重点',
      '## 选题3：宝妈的一天穿搭',
      '- 拍法：换个视角，人群是重点',
    ].join('\n');
    const d = topicDiversityOf(md);
    expect(d.count).toBe(3);
    expect(d.duplicateTitles).toBe(1);
    expect(d.distinctElements).toBeGreaterThanOrEqual(2);
  });
});
