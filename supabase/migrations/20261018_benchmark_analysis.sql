-- 对标拆解的结果（2026-10-18）：每次拆解存一份报告，挂在对标账号下面。原始材料（截图、文档、视频）不存，只存报告和「读到了什么」。
-- 可重复执行。

CREATE TABLE IF NOT EXISTS public.benchmark_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.benchmark_accounts(id) ON DELETE CASCADE,
  materials text[] NOT NULL DEFAULT '{}',
  report text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_analyses_account ON public.benchmark_analyses (account_id, created_at DESC);

ALTER TABLE public.benchmark_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own benchmark analyses" ON public.benchmark_analyses;
CREATE POLICY "own benchmark analyses" ON public.benchmark_analyses
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
