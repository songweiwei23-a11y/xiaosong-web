-- 个人风格预设（2026-10-03）：只加表，不动已有数据；可以重复执行。
-- 用法见 lib/creator-presets.ts，接口 app/api/creator-presets/route.ts。
-- 示例只来自用户认可的好稿（material_library.kind = 'approved'，见 20261003_library_assets.sql）或用户自己贴的稿子。

create table if not exists public.creator_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 适用档案；为空 = 全部档案通用。
  -- 故意不加外键：档案删了预设照样留着（不丢用户写的东西），页面上显示「档案已删除」，用户自己决定改到哪个档案。
  -- 若用 on delete set null，在用的那份会和「全部档案」的在用预设撞唯一索引，反而把删档案卡住。
  profile_id uuid,
  name text not null,
  -- 表达风格：语气、用词、节奏
  style text not null default '',
  -- 结构：开头、展开、收尾
  structure text not null default '',
  -- [{ title, content, libraryId? }]，最多 3 条
  examples jsonb not null default '[]'::jsonb,
  -- 正在采用：同一账号同一档案（或「全部档案」）最多一份
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_presets_list on public.creator_presets (user_id, profile_id, updated_at desc);
create unique index if not exists creator_presets_one_active
  on public.creator_presets (user_id, coalesce(profile_id::text, 'all'))
  where is_active;

alter table public.creator_presets enable row level security;
drop policy if exists "own presets" on public.creator_presets;
create policy "own presets" on public.creator_presets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
