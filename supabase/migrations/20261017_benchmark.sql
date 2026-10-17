-- 整改 C · 对标账号追踪 + 热点线索（2026-10-17）。全部是手动录入，不做任何自动抓取。
-- 可重复执行。执行后「对标」页才能保存数据。

CREATE TABLE IF NOT EXISTS public.benchmark_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NULL,
  name text NOT NULL,
  platform text NULL,
  link text NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.benchmark_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.benchmark_accounts(id) ON DELETE CASCADE,
  title text NOT NULL,
  published_on date NULL,
  views integer NULL,
  likes integer NULL,
  completion numeric NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hot_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_url text NULL,
  seen_on date NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_accounts_user ON public.benchmark_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_videos_account ON public.benchmark_videos (account_id);
CREATE INDEX IF NOT EXISTS idx_hot_topics_user ON public.hot_topics (user_id, created_at DESC);

ALTER TABLE public.benchmark_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hot_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own benchmark accounts" ON public.benchmark_accounts;
CREATE POLICY "own benchmark accounts" ON public.benchmark_accounts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own benchmark videos" ON public.benchmark_videos;
CREATE POLICY "own benchmark videos" ON public.benchmark_videos
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own hot topics" ON public.hot_topics;
CREATE POLICY "own hot topics" ON public.hot_topics
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
