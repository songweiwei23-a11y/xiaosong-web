/**
 * 已有创作简报时，徽章不能说「还没生成」（体检 T05 / P1-3）。
 * 方案 D 的空清单保持不动：选题、脚本、分镜、方向本来就不读简报。
 */
import { describe, it, expect } from 'vitest';
import { briefBadgeCopy, briefLoadOf } from '@/lib/brief-badge';
import { manifestOf } from '@/lib/context-manifest';
import { readCode } from './helpers/source';

const BRIEF = `### 1. 一句话定位

南乐本土编导

### 2. 人设与口吻

唠嗑，不摆专家架子

### 3. 说给谁听

客流在掉的餐馆老板

### 4. 内容方向

晒过程为主

### 5. 凭什么信你

先干出效果再谈钱

### 6. 怎么拍

一个人、手机

### 8. 绝对不能说

不承诺涨粉`;

describe('有简报时选题徽章不能说还没生成', () => {
  it('选题有简报：说明这次不读，不引导去生成', () => {
    const copy = briefBadgeCopy({ board: 'topic', brief: BRIEF, load: 'ok' });
    expect(copy.text).not.toContain('还没生成');
    expect(copy.text).toContain('本板块这次不读简报，只用档案');
    expect(copy.link).toBeNull();
    // 这句话只从判定函数来，组件不能再写死一套
    expect(readCode('components/workspace/ContextBadge.tsx')).toContain('briefBadgeCopy(');
    expect(readCode('components/workspace/ContextBadge.tsx')).toContain('{briefCopy.text}');
    expect(readCode('components/workspace/ContextBadge.tsx')).not.toContain('还没生成创作简报');
  });

  it('脚本、分镜、方向同样：有简报也不说还没生成（清单仍是空的）', () => {
    for (const board of ['script', 'storyboard', 'direction'] as const) {
      expect(manifestOf(board)?.brief, board).toEqual([]);
      const copy = briefBadgeCopy({ board, brief: BRIEF, load: 'ok' });
      expect(copy.text, board).not.toContain('还没生成');
      expect(copy.text, board).toContain('本板块这次不读简报');
      expect(copy.link, board).toBeNull();
    }
  });
});

describe('没有记录、标题对不上、读取失败，三句分开', () => {
  it('没有简报记录才说还没生成，并链到去生成', () => {
    const copy = briefBadgeCopy({ board: 'topic', brief: null, load: 'missing' });
    expect(copy.text).toContain('还没生成创作简报');
    expect(copy.link).toEqual({ href: '/dashboard/creative-brief', label: '去生成' });
    // 不把方案 D 不读简报的板块说成「做完就会自动用上」
    expect(copy.text).not.toContain('都会自动用上');
  });

  it('审稿、标题的小节标题对不上时，不说还没生成，也不叫人去生成', () => {
    const messy = '## 账号概况\n\n这是一份没有标准小节标题的简报';
    for (const board of ['review', 'title'] as const) {
      const copy = briefBadgeCopy({ board, brief: messy, load: 'ok' });
      expect(copy.text, board).not.toContain('还没生成');
      expect(copy.text, board).toContain('没对上');
      expect(copy.link?.label, board).not.toBe('去生成');
    }
  });

  it('对得上的段会写明已经带上', () => {
    const review = briefBadgeCopy({ board: 'review', brief: BRIEF, load: 'ok' });
    expect(review.text).toContain('创作简报已带上');
    expect(review.text).toContain('人设与口吻');
    expect(review.text).not.toContain('还没生成');
    expect(review.attached).toBe(true);

    const partial = briefBadgeCopy({
      board: 'title',
      brief: '### 1. 一句话定位\n\n南乐编导',
      load: 'ok',
    });
    expect(partial.text).toContain('一句话定位');
    expect(partial.text).not.toContain('还没生成');
  });

  it('读取失败不说成还没生成；读成功但数组是空的，才是没有', () => {
    expect(briefLoadOf({ fetched: false, parsed: false, brief: null })).toBe('error');
    expect(briefLoadOf({ fetched: true, parsed: false, brief: null })).toBe('error');
    expect(briefLoadOf({ fetched: true, parsed: true, brief: null })).toBe('missing');
    expect(briefLoadOf({ fetched: true, parsed: true, brief: '  ' })).toBe('missing');
    expect(briefLoadOf({ fetched: true, parsed: true, brief: BRIEF })).toBe('ok');

    for (const board of ['topic', 'review', 'title', 'growth'] as const) {
      const copy = briefBadgeCopy({ board, brief: null, load: 'error' });
      expect(copy.text, board).not.toContain('还没生成');
      expect(copy.text, board).toContain('没有读成功');
      expect(copy.link, board).toBeNull();
    }
    // 没带上读取结果（比如整次上下文失败）：同样不能猜成还没生成
    const unknown = briefBadgeCopy({ board: 'script', brief: null });
    expect(unknown.text).not.toContain('还没生成');
  });
});

describe('起号页用自己的板块', () => {
  it('传 growth，有简报就写已带上，而不是脚本那份空清单', () => {
    expect(readCode('app/dashboard/growth/page.tsx')).toMatch(/<ContextBadge board="growth"/);
    expect(readCode('app/dashboard/growth/page.tsx')).not.toMatch(/<ContextBadge board="script"/);
    const copy = briefBadgeCopy({ board: 'growth', brief: BRIEF, load: 'ok' });
    expect(copy.text).toContain('创作简报已带上');
    expect(copy.text).toContain('一句话定位');
    expect(copy.text).not.toContain('还没生成');
    expect(copy.link).toBeNull();
  });

  it('页面和助理取简报时，都把读取失败和没有记录分开', () => {
    expect(readCode('hooks/useCreatorContext.ts')).toContain('briefLoadOf(');
    expect(readCode('hooks/useCreatorContext.ts')).toMatch(/brief, briefAt, briefFacts, briefLoad/);
    expect(readCode('lib/assistant/board-context.ts')).toContain('briefLoadOf(');
  });
});
