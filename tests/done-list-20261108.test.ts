/**
 * 「已经做过」避重清单（2026-11-08 产品方定）：只带已拍、已发作品的标题和打法，不带正文、场地；
 * 只给出选题、出方向的板块。10-31 关掉的历史产出回灌（HISTORY_IN_GENERATION）保持关着。
 */
import { describe, expect, it } from 'vitest';
import { doneListOf, doneListPromptBlock, readDoneList } from '@/lib/done-list';
import { buildContextBlock, DONE_LIST_IN_PROMPT, type CreatorContext } from '@/lib/creator-context';
import { HISTORY_IN_GENERATION } from '@/lib/creative-history';
import { readCode } from './helpers/source';

const works = [
  { id: '1', title: '老板娘熬了十二年的底料', shoot_status: 'published', published_at: '2026-10-20T00:00:00Z' },
  { id: '2', title: '一桌客人吃哭了', shoot_status: 'shot', shot_at: '2026-10-25T00:00:00Z' },
  { id: '3', title: '还没拍的选题', shoot_status: 'todo' },
  { id: '4', title: '「老板娘熬了十二年的底料」', shoot_status: 'published', published_at: '2026-09-01T00:00:00Z' },
  { id: '5', title: '降温后，棚子和清汤羊排锅一起入镜', shoot_status: 'published', published_at: '2026-10-01T00:00:00Z' },
  { id: '6', title: '凌晨四点起锅', shoot_status: 'published', published_at: '2026-10-02T00:00:00Z' },
];
const settings = new Map<string, Record<string, unknown>>([['1', { tactic: '反差计', purpose: '人设型', direction: '不该出现的正文' }]]);

describe('清单里有什么', () => {
  it('只要已拍、已发；新的在前；同名去重；带场地字样的不要；只有标题、状态、目的、打法', () => {
    const list = doneListOf(works, settings);
    expect(list.map((d) => d.title)).toEqual(['一桌客人吃哭了', '老板娘熬了十二年的底料']);
    expect(list[1]).toEqual({ title: '老板娘熬了十二年的底料', status: '已发布', tactic: '反差计', purpose: '人设型' });
    expect(JSON.stringify(list)).not.toContain('不该出现的正文');
  });
  it('接口传来的只留认识的字段', () => {
    expect(readDoneList([{ title: '  a ', status: '已拍摄', extra: 'x' }, { nope: 1 }, 'x'])).toEqual([{ title: 'a', status: '已拍摄', tactic: null, purpose: null }]);
    expect(readDoneList(null)).toEqual([]);
  });
});

describe('进哪些板块、怎么说', () => {
  const ctx = { profile: { id: 'p', profile_name: '老张火锅' }, positioning: null, dealReasons: [], doneList: doneListOf(works, settings) } as CreatorContext;
  it('真实模型对照发现清单会把模型往旧题上拽：先不写进任何板块的提示词', () => {
    expect(DONE_LIST_IN_PROMPT).toBe(false);
    for (const b of ['topic', 'direction', 'freeChat'] as const) expect(buildContextBlock(ctx, b)).not.toContain('已经拍过、发过的');
    for (const b of ['script', 'remix', 'storyboard', 'title', 'review', 'growth'] as const) expect(buildContextBlock(ctx, b)).not.toContain('已经拍过、发过的');
  });
  it('写明不带季节、地点、细节，不提这份清单；空清单不出块', () => {
    const block = doneListPromptBlock(ctx.doneList);
    expect(block).toContain('季节、时令、地点、具体细节一律不带进新内容');
    expect(block).toContain('不要在结果里提到这份清单');
    expect(doneListPromptBlock([])).toBe('');
  });
  it('历史产出（正文）回灌仍然关着；清单和概况走同一个接口，页面和助理都读', () => {
    expect(HISTORY_IN_GENERATION).toBe(false);
    expect(readCode('app/api/work-insights/route.ts')).toMatch(/loadDoneList\(guard\.userId!, profileId\)/);
    expect(readCode('hooks/useCreatorContext.ts')).toMatch(/doneList = readDoneList\(d\?\.doneList\)/);
    expect(readCode('lib/assistant/board-context.ts')).toMatch(/doneList = readDoneList\(got\?\.doneList\)/);
  });
});
