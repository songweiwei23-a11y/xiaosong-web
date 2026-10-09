-- 素材库：真实素材、认可的好稿、选题索引（2026-10-03）
-- 只加结构，不删、不改已有数据；可以重复执行。
-- 依赖 20261002_library_and_progress.sql（material_library 表）。

-- ---------- 素材来源 ----------
-- ai       AI 生成后收藏的（默认，已有的收藏都算这一类）
-- real     用户自己记录的真实素材：客户问题、原话、做了什么、过程、真实结果、可拍画面、使用许可
-- approved 用户点了「认可为好稿」的：可以拿去当风格示例（creator_presets 只认这一类）
alter table public.material_library add column if not exists kind text not null default 'ai';
-- 真实素材的结构化字段（客户问题、原话……），正文 content 由这些字段拼出来，方便搜索和继续创作
alter table public.material_library add column if not exists fields jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'material_library_kind_check') then
    alter table public.material_library
      add constraint material_library_kind_check check (kind in ('ai', 'real', 'approved'));
  end if;
end $$;

create index if not exists material_library_kind on public.material_library (user_id, kind, created_at desc);

-- ---------- 选题索引 ----------
-- 选题一批出十几条，素材库按一条一条列。原来每次打开都把最近 300 批的全文拿出来拆，
-- 300 批以前的看不到，数量也少算。这里给每一批存一份拆好的标题、预览和可搜索文字：
-- 只在批次新出现、或者删过其中几条（input_data.deletedTopics 变了）时重拆一次。
-- 历史记录删了，索引跟着删（on delete cascade）。
create table if not exists public.library_topic_index (
  history_id uuid primary key references public.script_history(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 档案：uuid 字符串；没有档案的旧记录记 'default'（和 lib/profile-history 的范围一致）
  profile_key text not null default 'default',
  created_at timestamptz not null,
  work_id uuid,
  -- 这一批拆出几条
  item_count int not null default 0,
  -- [{ t: 标题, p: 预览, s: 用来搜索的纯文字 }]
  items jsonb not null default '[]'::jsonb,
  -- 整批的纯文字，先用它筛出可能命中的批次，再逐条筛
  search_text text not null default '',
  -- input_data.deletedTopics 的条数：删过选题后和这里对不上就重拆
  version int not null default 0,
  indexed_at timestamptz not null default now()
);

create index if not exists library_topic_index_list on public.library_topic_index (user_id, profile_key, created_at desc);

alter table public.library_topic_index enable row level security;
drop policy if exists "own topic index" on public.library_topic_index;
-- 接口用登录用户的身份读写（lib/admin-auth 的 getServerSupabase），只能动自己的行
create policy "own topic index" on public.library_topic_index for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';

-- ---------- 回填 ----------
-- 不需要手动回填：素材库「全部产出」每次打开都会把还没索引的批次补上（每次最多 120 批），
-- 旧数据多时页面会显示「还在整理 N 批旧选题」并自动接着整理，直到全部补齐。
-- 想一次补完，可以反复打开素材库「全部产出」，或调用 GET /api/library/outputs 直到返回的 indexing 为 0。
