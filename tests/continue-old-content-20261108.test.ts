/**
 * 旧选题、素材库里的内容「继续创作」报错、带过去的信息和原来不一样（2026-11-08 产品方）。
 * 查出来的几处：
 * 1. 历史里存的是润色前的稿子，页面显示润色后的，按正文一字不差认不回那条 → 退回当前表单的设置
 * 2. 选题库里的旧选题带去写脚本，用的是页面上当前结果、当前表单的设置，不是那一批当时的
 * 3. 素材库带出去的来源写作「素材库·选题策划」，认不出是选题 / 脚本，按普通内容带
 * 4. 旧编号（作品删了、换了档案）：保存直接报「作品与当前档案不匹配」；格式不对整份判无效
 */
import { describe, expect, it } from 'vitest';
import { findHistoryRecord } from '@/lib/history-match';
import { settingsForResult } from '@/lib/creation-settings';
import { originForResult } from '@/lib/creation-continuation';
import { readCreationSnapshot } from '@/lib/creation-snapshot';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { persistCreativeHistory } from '@/lib/creative-history';
import { readCode } from './helpers/source';

const OLD = `## 方向1：凌晨四点的后厨\n- 为什么：老板娘熬底料十二年\n- ★标题：别只盯着价格，看看这锅底料\n\n## 方向2：一桌客人吃哭了\n- 为什么：真实反应\n- ★标题：县城老板最怕什么`;
const POLISHED = OLD.replace('别只盯着价格，看看这锅底料', '这锅底料我熬了十二年');
const history = [
  { id: 'b2', result: '## 方向1：完全不同的一批\n- 为什么：别的\n- ★标题：别的标题', input_data: { originContent: '另一批的原意', purposes: ['立人设'] } },
  { id: 'b1', result: OLD, input_data: { originContent: '想给县城老板做引流', creationSettings: { purpose: '流量型', userIntent: '引流到店' } } },
];

describe('认回原来那条历史记录', () => {
  it('润色改了标题也认得回；多了空白也认得回；完全不同的认不回', () => {
    expect(findHistoryRecord(POLISHED, history)?.id).toBe('b1');
    expect(findHistoryRecord(OLD.replace(/\n/g, '\n\n  '), history)?.id).toBe('b1');
    expect(findHistoryRecord('## 新的一份\n- 内容完全不一样\n- 另一条', history)).toBeUndefined();
    expect(findHistoryRecord('', history)).toBeUndefined();
  });

  it('润色后的正文带去下一步：用那一批当时的原意和设置，不用当前表单', () => {
    expect(originForResult(POLISHED, history, '现在表单里写的')).toBe('想给县城老板做引流');
    const s = settingsForResult(POLISHED, history, { purpose: '变现型', userIntent: '现在表单的' });
    expect(s.userIntent).toBe('引流到店');
    expect(s.purpose).toBe('流量型');
  });
});

describe('保存历史：同一条再存时换成最终显示的版本', () => {
  function fakeDb(existing: { task_type: string; input_data: Record<string, unknown>; result: string }) {
    const updates: unknown[] = [];
    const db: any = {
      from: () => ({
        insert: async () => ({ error: { code: '23505' } }),
        select: () => { const q: any = { eq: () => q, maybeSingle: async () => ({ data: existing, error: null }) }; return q; },
        update: (row: unknown) => { updates.push(row); const q: any = { eq: () => q, then: (r: any) => Promise.resolve({ error: null }).then(r) }; return q; },
      }),
    };
    return { db, updates };
  }
  const input = { id: 'h1', taskType: '创作方向', profileId: 'p1', inputData: {}, result: POLISHED };

  it('服务端先存了润色前的：页面润色完再存同一条，正文更新成润色后的', async () => {
    const { db, updates } = fakeDb({ task_type: '创作方向', input_data: { profileId: 'p1' }, result: OLD });
    expect(await persistCreativeHistory(db, 'u1', input)).toBe(true);
    expect(updates).toEqual([{ result: POLISHED }]);
  });

  it('别的板块、别的档案的同编号记录：不动', async () => {
    const other = fakeDb({ task_type: '内容规划', input_data: { profileId: 'p1' }, result: OLD });
    expect(await persistCreativeHistory(other.db, 'u1', input)).toBe(false);
    expect(other.updates).toEqual([]);
    const otherProfile = fakeDb({ task_type: '创作方向', input_data: { profileId: 'p2' }, result: OLD });
    expect(await persistCreativeHistory(otherProfile.db, 'u1', input)).toBe(false);
    expect(otherProfile.updates).toEqual([]);
  });
});

describe('选题库的旧选题：用那一批自己的设置', () => {
  it('选题库把这条出自哪一批传给页面；页面按那一批取设置、原意、打法', () => {
    expect(readCode('components/workspace/TopicLibrary.tsx')).toMatch(/onAction\(t\.title, a\.stage, t\.body, t\.batchId\)/);
    const page = readCode('app/dashboard/topic/page.tsx');
    expect(page).toMatch(/const sendTopic = async \(title: string, stage: TopicStage, body\?: string, batchId\?: string\)/);
    expect(page).toMatch(/const batch = batchId \? history\.find\(\(b\) => b\.id === batchId\) : undefined/);
    expect(page).toMatch(/settings: mergeCreationSettings\(ownSettings,/);
    expect(page).toMatch(/originContent: ownOrigin/);
    expect(page).toMatch(/tactic: \(batch \? ownSettings\.tactic : tactic\)/);
    expect(page).not.toMatch(/sendTopic[\s\S]{0,600}settingsForResult\(result, history, currentSettings\), \{ topic: title/);
  });
});

describe('素材库带出去：认得出原来是什么', () => {
  it('收藏的选题 → 写脚本：按选题带，候选题目解析出来', () => {
    const body = '## 选题1：凌晨四点的后厨\n拍法：跟拍\n\n## 选题2：一桌客人吃哭了\n拍法：抓拍';
    const p = buildCreationHandoff('library', 'script', body, { from: '素材库·选题策划', title: '两条选题' });
    expect(p.topicOptions).toEqual(['凌晨四点的后厨', '一桌客人吃哭了']);
    // 对照：修之前带前缀认不出，当成普通内容，一条候选都没有
    expect(buildCreationHandoff('library', 'script', body, { from: '素材库·不认识的', title: '两条选题' }).topicOptions).toEqual([]);
  });

  it('收藏的脚本 → 审稿：脚本正文照原样带过去', () => {
    const body = '## 第1步：脚本策略卡\n策略。\n\n## 第2步：纯文字文案\n这锅底料我熬了十二年。\n\n## 第3步：完整分镜脚本\n镜头。';
    const p = buildCreationHandoff('library', 'review', body, { from: '素材库·脚本生成' });
    expect(p.settings?.workingScript).toBe('这锅底料我熬了十二年。');
    expect(p.scriptContent).toBe('这锅底料我熬了十二年。');
  });

  it('素材是收藏那一刻的样子：不挂回旧作品', () => {
    expect(readCode('app/dashboard/library/page.tsx')).toMatch(/\.\.\.full\.fields\?\.creationContext, workId: undefined/);
  });
});

describe('旧编号：不再整份作废、不再报错', () => {
  it('作品编号、档案编号格式不对：只丢掉这一项，内容照样带', () => {
    const p = readCreationSnapshot({ from: '素材库', target: '/dashboard/script', workId: 'old-work-1', profileId: 'xx', sourceContent: '正文', settings: { topic: '选题' } });
    expect(p).not.toBeNull();
    expect(p!.workId).toBeUndefined();
    expect(p!.profileId).toBeNull();
    expect(p!.sourceContent).toBe('正文');
  });

  it('保存时作品删了 / 换了档案：去掉对不上的编号再存一次，不报错', () => {
    const route = readCode('app/api/creation-sessions/route.ts');
    expect(route).toMatch(/if \(error && \/ownership mismatch\/\.test\(error\.message\)\)/);
    expect(route).toMatch(/delete retry\.workId/);
    expect(route).toMatch(/if \(\/\^profile ownership\/\.test\(error\.message\)\) delete retry\.profileId/);
  });
});
