-- 首页门票撤销要把「用这张门票进门的账号」也请出去（2026-10-18）。
-- 1) 设备通行记下它属于哪个账号（登录后访问时记）；
-- 2) 撤销门票时，把用它进门的账号记到 gate_user_blocks，之后这些账号只能凭有效的设备通行进门。
-- 可重复执行。没执行时：撤销门票仍然让设备通行失效，但已登录的账号不会被请出去（和原来一样）。

ALTER TABLE public.gate_device_passes ADD COLUMN IF NOT EXISTS user_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_gate_device_passes_ticket ON public.gate_device_passes (ticket_id);

CREATE TABLE IF NOT EXISTS public.gate_user_blocks (
  user_id uuid PRIMARY KEY,
  ticket_id uuid NULL,
  blocked_at timestamptz NOT NULL DEFAULT now()
);

-- 只给服务端（service role）读写，前端不直接访问
ALTER TABLE public.gate_user_blocks ENABLE ROW LEVEL SECURITY;
