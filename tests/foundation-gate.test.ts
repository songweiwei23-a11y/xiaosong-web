import { describe, expect, it } from 'vitest';
import { foundationBlock, foundationNeedOf } from '@/lib/foundation-gate';
import { BOARD_LABEL, BOARD_TASK_TYPE, type BoardKind } from '@/lib/assistant/board-dispatch';
import { TASK_TYPE_TO_FEATURE } from '@/lib/task-type';

// 2026-10-23 地基门槛：「先打地基」三步没做好，不生成创作结果，并告诉用户先去做哪一步

const none = { profileCount: 0, positioningTypes: [] as string[] };
const profileOnly = { profileCount: 1, positioningTypes: [] as string[] };
const positioned = { profileCount: 1, positioningTypes: ['账号定位'] };
const ready = { profileCount: 1, positioningTypes: ['账号定位', '创作简报'] };

describe('地基门槛：各任务需要做到哪一步', () => {
  it('自由对话、知识库查询、AI 推荐、前采建档不需要地基', () => {
    for (const t of ['自由对话', '知识库查询', 'AI推荐', '前采建档']) {
      expect(foundationNeedOf(t)).toBe('open');
    }
  });

  it('账号定位只要档案；商业定位、内容定位、创作简报要账号定位', () => {
    expect(foundationNeedOf('账号定位')).toBe('profile');
    expect(foundationNeedOf('商业定位')).toBe('positioning');
    expect(foundationNeedOf('内容定位')).toBe('positioning');
    expect(foundationNeedOf('创作简报')).toBe('positioning');
  });

  it('选题、脚本等其余创作要三步全做完；没登记的也按这个算', () => {
    for (const t of ['选题策划', '脚本生成', '分镜脚本', '审稿优化', '标题封面', '创作方向', '内容规划', '成交理由', '行业建议', '起号方案', '开篇钩子', '跨行业二创', '拆解爆款', '深度研究', '不存在的板块']) {
      expect(foundationNeedOf(t), t).toBe('brief');
    }
    expect(foundationNeedOf(undefined)).toBe('brief');
  });
});

describe('地基门槛：没做好时告诉用户先去哪', () => {
  it('一步都没做：创作类先提示建档', () => {
    const msg = foundationBlock('brief', none);
    expect(msg).toContain('账号档案');
    expect(msg).toContain('再来生成');
  });

  it('有档案没做定位：创作类提示先做账号定位，不提示简报', () => {
    const msg = foundationBlock('brief', profileOnly);
    expect(msg).toContain('账号定位');
    expect(msg).not.toContain('创作简报');
  });

  it('只差创作简报：创作类提示先生成创作简报', () => {
    const msg = foundationBlock('brief', positioned);
    expect(msg).toContain('创作简报');
  });

  it('定位已做好时，商业定位、内容定位、创作简报可以生成', () => {
    expect(foundationBlock('positioning', positioned)).toBeNull();
  });

  it('三步全做好：放行', () => {
    expect(foundationBlock('brief', ready)).toBeNull();
  });

  it('账号定位只要档案：没有档案要先建档，有了就放行', () => {
    expect(foundationBlock('profile', none)).toContain('账号档案');
    expect(foundationBlock('profile', profileOnly)).toBeNull();
  });

  it('不需要地基的任务任何时候都放行', () => {
    expect(foundationBlock('open', none)).toBeNull();
  });
});

describe('助理派活的板块与生成接口登记一致', () => {
  const kinds = Object.keys(BOARD_LABEL) as BoardKind[];

  it('每个板块都登记了任务类型', () => {
    for (const kind of kinds) {
      expect(BOARD_TASK_TYPE[kind], kind).toBeTruthy();
    }
  });

  it('除深度研究外，板块的任务类型都是生成接口认得的（计费功能也要对得上）', () => {
    for (const kind of kinds) {
      if (kind === 'research') continue;
      const t = BOARD_TASK_TYPE[kind];
      expect(TASK_TYPE_TO_FEATURE[t], `${kind}→${t}`).toBeTruthy();
    }
  });
});
