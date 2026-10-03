-- 素材库 + 创作进度的落地状态（2026-10-02）
-- 可以重复执行

-- ---------- 素材库 ----------
-- 各板块生成结果里"好的内容"，用户点收藏存进来；按分类浏览、随时拿去继续创作。
-- 存的是那一段正文本身（勾选几条就是几行），不是指向历史记录：
-- 历史会被删、被翻页翻没，收藏的东西要一直在。
create table if not exists public.material_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 属于哪个账号档案；为空 = 没选档案时收藏的
  profile_id uuid references public.user_profiles(id) on delete set null,
  -- 分类：topic 选题 / script 脚本 / storyboard 分镜 / review 审稿稿 / title 标题封面 /
  --       opening 开篇钩子 / direction 方向方案 / remix 二创 / breakdown 拆解 /
  --       positioning 定位 / deal 成交理由 / other 其他
  category text not null default 'other',
  -- 从哪个板块收藏的（中文名，界面显示用）
  source text not null default '',
  title text not null default '未命名素材',
  content text not null,
  note text not null default '',
  -- 同一段内容只收藏一次（按正文指纹去重）
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists material_library_dedupe on public.material_library (user_id, content_hash);
create index if not exists material_library_list on public.material_library (user_id, profile_id, category, created_at desc);

alter table public.material_library enable row level security;
drop policy if exists "own materials" on public.material_library;
create policy "own materials" on public.material_library for all using (auth.uid() = user_id);

-- ---------- 创作进度：落地状态 ----------
-- 原来作品只记到"标题封面做完"为止，拍没拍、发没发系统不知道。
-- none 还没拍 / shot 已拍摄 / published 已发布
alter table public.works add column if not exists shoot_status text not null default 'none';
alter table public.works add column if not exists shot_at timestamptz;
alter table public.works add column if not exists published_at timestamptz;

notify pgrst, 'reload schema';
