/**
 * 素材库 + 创作进度（2026-10-02）。
 * 产品方：所有板块的生成结果都能收藏进素材库，按分类找、随时继续创作；
 * 进行中的内容显示做到哪一步、拍没拍、发没发，并提醒。
 */
import { describe, it, expect } from 'vitest';
import { libraryCategory, draftFromItem, draftFromBody, CATEGORY_NEXT, LIBRARY_CATEGORIES } from '@/lib/library';
import { splitCreationItems } from '@/lib/creation-items';
import { workReminder, progressGroup, type Work } from '@/lib/works';
import { CREATION_DESTINATIONS, CREATION_SOURCES } from '@/lib/creation-flow';
import { readCode } from './helpers/source';

describe('素材库分类', () => {
  it('专门板块出的按板块归；自由对话按认出的内容类型归', () => {
    expect(libraryCategory('topic')).toBe('topic');
    expect(libraryCategory('growth')).toBe('opening');
    expect(libraryCategory('content-positioning')).toBe('positioning');
    // 账号运营板块里勾选的方向、做法：按内容归——那是创作灵感（产品方 2026-10-02）
    expect(libraryCategory('content-positioning', 'direction')).toBe('direction');
    expect(libraryCategory('positioning', 'plan')).toBe('plan');
    expect(libraryCategory('content-positioning', 'item')).toBe('positioning');
    expect(libraryCategory('deal-reason')).toBe('deal');
    expect(libraryCategory('free-chat', 'topic')).toBe('topic');
    expect(libraryCategory('free-chat', 'script')).toBe('script');
    expect(libraryCategory('free-chat', 'direction')).toBe('direction');
    expect(libraryCategory('free-chat', 'item')).toBe('other');
    expect(libraryCategory('knowledge')).toBe('other');
    // 选题页里的一条就是选题，哪怕它的正文里有口播
    expect(libraryCategory('topic', 'script')).toBe('topic');
  });

  it('勾选的一条存成一份：标题用真正的题目', () => {
    const p = splitCreationItems('### 1. 【流量型】成本选题\n**选题：** 国庆濮阳免费开放的5个地方\n### 2. 【变现型】怀旧\n**选题：** 戚城公园国庆雅集');
    const d = draftFromItem(p.items[0], 'free-chat', '高阶自由对话');
    expect(d).toMatchObject({ title: '国庆濮阳免费开放的5个地方', category: 'topic', source: '高阶自由对话' });
    expect(d.content).toContain('【流量型】成本选题');
  });

  it('整份存成一份：标题取第一个标题行', () => {
    expect(draftFromBody('# 📝 晒过程｜一元火锅怎么给料\n口播……', 'script', '脚本生成')).toMatchObject({ title: '📝 晒过程｜一元火锅怎么给料', category: 'script' });
    expect(draftFromBody('没有标题的一段话', 'knowledge', '知识库').title).toBe('没有标题的一段话');
  });

  it('每个分类都有推荐的下一步，而且都是真实存在的板块', () => {
    const dest = new Set(CREATION_DESTINATIONS.map((d) => d.id));
    for (const c of LIBRARY_CATEGORIES) {
      expect(CATEGORY_NEXT[c.id].length, c.label).toBeGreaterThan(0);
      for (const t of CATEGORY_NEXT[c.id]) expect(dest.has(t), `${c.label} → ${t}`).toBe(true);
    }
  });
});

describe('收藏入口', () => {
  const links = readCode('components/workspace/CreationLinks.tsx');
  it('所有板块结果下面的「继续创作」都带收藏按钮；勾选列表展开时一条一条存，否则整份存', () => {
    expect(links).toMatch(/收藏到素材库/);
    expect(links).toMatch(/const pickMode = selectable && pickOpen/);
    expect(links).toMatch(/pickMode\s*\? parts\.items\.filter\(\(it\) => picked\.has\(it\.id\)\)\.map\(\(it\) => draftFromItem\(it, board, label\)\)/);
    expect(links).toMatch(/: \[draftFromBody\(body, board, label, context\?\.title\)\]/);
    // 素材库「全部产出」里收藏：按内容原本的板块归类（脚本库里收藏的进「脚本」）
    expect(links).toMatch(/const board = favoriteBoard \|\| source;/);
  });

  it('素材库里的素材能继续创作，按分类推荐下一步，不再显示收藏按钮', () => {
    expect(CREATION_SOURCES.library).toBe('素材库');
    const page = readCode('app/dashboard/library/page.tsx');
    // 列表只有预览：正文点开（或点继续创作）时取回，再交给 CreationLinks
    expect(page).toMatch(/<CreationLinks body=\{full\.content\} hideFavorite recommended=\{CATEGORY_NEXT/);
  });

  it('接口：按本人读写、同一段内容只存一次、迁移没跑时说清楚', () => {
    const api = readCode('app/api/library/route.ts');
    expect(api.match(/\.eq\('user_id', guard\.userId!\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(api).toMatch(/onConflict: 'user_id,content_hash', ignoreDuplicates: true/);
    expect(api).toMatch(/20261002_library_and_progress\.sql/);
    const sql = readCode('supabase/migrations/20261002_library_and_progress.sql');
    expect(sql).toMatch(/create unique index if not exists material_library_dedupe on public\.material_library \(user_id, content_hash\)/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/add column if not exists shoot_status text not null default 'none'/);
  });

  it('侧边栏：「我的作品」换成「素材库」+「创作进度」', () => {
    const sb = readCode('components/dashboard/Sidebar.tsx');
    expect(sb).toMatch(/name: "素材库", href: "\/dashboard\/library"/);
    expect(sb).toMatch(/name: "创作进度", href: "\/dashboard\/works"/);
    expect(sb).not.toMatch(/name: "我的作品"/);
  });
});

describe('创作进度', () => {
  const NOW = Date.parse('2026-10-10T12:00:00Z');
  const w = (over: Partial<Work>): Work => ({ id: 'w', title: 't', profile_id: null, is_done: false, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-10T10:00:00Z', stages: [], doneCount: 0, ...over });

  it('分组：创作中 / 待拍摄（内容做完了） / 已拍摄 / 已发布；迁移没跑时按还没拍算', () => {
    expect(progressGroup(w({}))).toBe('active');
    expect(progressGroup(w({ is_done: true }))).toBe('toShoot');
    expect(progressGroup(w({ shoot_status: 'shot' }))).toBe('shot');
    expect(progressGroup(w({ is_done: true, shoot_status: 'published' }))).toBe('published');
  });

  it('提醒：做好几天没拍、拍完几天没发、好几天没动', () => {
    expect(workReminder(w({ is_done: true, updated_at: '2026-10-07T12:00:00Z' }), NOW)).toMatchObject({ text: '内容都做好 3 天了，还没拍——安排拍摄吧', tone: 'warn' });
    expect(workReminder(w({ shoot_status: 'shot', shot_at: '2026-10-07T12:00:00Z' }), NOW)).toMatchObject({ text: '拍完 3 天了还没发，剪好就发吧', tone: 'warn' });
    expect(workReminder(w({ updated_at: '2026-10-05T12:00:00Z' }), NOW)).toMatchObject({ text: '已经 5 天没动了', tone: 'warn' });
    expect(workReminder(w({}), NOW)).toBeNull();
    expect(workReminder(w({ shoot_status: 'published', published_at: '2026-10-09T00:00:00Z' }), NOW)?.tone).toBe('done');
  });

  it('接口记下拍摄、发布的时间；改回还没拍时清掉', () => {
    const api = readCode('app/api/works/route.ts');
    expect(api).toMatch(/\['none', 'shot', 'published'\]\.includes\(body\.shootStatus\)/);
    expect(api).toMatch(/body\.shootStatus === 'none'\) \{ patch\.shot_at = null; patch\.published_at = null \}/);
  });

  it('顶栏「进行中」不再显示已拍摄、已发布的', () => {
    expect(readCode('components/dashboard/InProgressStrip.tsx')).toMatch(/!w\.is_done && \(w\.shoot_status \?\? "none"\) === "none"/);
  });
});
