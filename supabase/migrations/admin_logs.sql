-- admin_logs 表（管理员操作审计）
-- 在 Supabase Dashboard → SQL Editor 执行以下 SQL：

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB
);

CREATE INDEX idx_admin_logs_admin ON public.admin_logs (admin_user_id, created_at DESC);
CREATE INDEX idx_admin_logs_target ON public.admin_logs (target_user_id, created_at DESC);

-- RLS 策略：只有管理员能查询审计日志（通过 service_role 写入，无需 insert 策略）
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理员可查看审计日志"
  ON public.admin_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );
