-- 首页拦截（第一道）：按人发门票（2026-10-16）。
--
-- gate_tickets：门票。
--   kind = 'invite'：管理员发给某个人（或某一批人）的邀请。claim_until 之前能拿来进门，max_devices 台设备内有效。
--   kind = 'admin'：管理员自己的长期门票，管理员新设备上用它直接过第一道，不依赖登录。
--   库里只存门票的摘要（sha256），门票原文只在生成时显示一次。撤销 = 写 revoked_at。
-- gate_device_passes：用门票进门后，这台浏览器 Cookie 对应一行（同样只存摘要）。进门 30 天内有效；门票撤销后立即失效。
-- site_gate_settings：一行。没有这一行时首页不拦（新部署不会锁站）；第一张管理员门票生成时自动写入并开启，之后默认一直开着，
--   只有管理员手动关闭（应急）才会关。
-- 三张表只给服务端读写（启用 RLS、不建策略，并收回 anon / authenticated 的权限）。
--
-- 应急恢复（门票都丢了，又开着拦截）：在 Supabase SQL 编辑器执行
--   update public.site_gate_settings set enabled = false where id = 1;

CREATE TABLE IF NOT EXISTS public.gate_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('invite', 'admin')),
  secret_hash text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 200),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  claim_until timestamptz,
  max_devices integer NOT NULL DEFAULT 3 CHECK (max_devices BETWEEN 1 AND 50),
  devices_used integer NOT NULL DEFAULT 0 CHECK (devices_used >= 0),
  revoked_at timestamptz,
  last_claimed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.gate_device_passes (
  cookie_hash text PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.gate_tickets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS gate_device_passes_ticket_idx ON public.gate_device_passes (ticket_id);

CREATE TABLE IF NOT EXISTS public.site_gate_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.gate_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_device_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_gate_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gate_tickets, public.gate_device_passes, public.site_gate_settings FROM anon, authenticated;

-- 兑换门票：检查 + 占用设备数 + 写入设备通行，在一个事务里完成，两个人同时用最后一台设备也只会有一个成功。
CREATE OR REPLACE FUNCTION public.claim_gate_ticket(p_secret_hash text, p_cookie_hash text, p_device_days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.gate_tickets%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.gate_tickets WHERE secret_hash = p_secret_hash FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF t.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;
  IF t.kind = 'invite' AND t.claim_until IS NOT NULL AND t.claim_until <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF t.devices_used >= t.max_devices THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full');
  END IF;
  INSERT INTO public.gate_device_passes (cookie_hash, ticket_id, expires_at)
    VALUES (p_cookie_hash, t.id, now() + make_interval(days => p_device_days));
  UPDATE public.gate_tickets SET devices_used = devices_used + 1, last_claimed_at = now() WHERE id = t.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_gate_ticket(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gate_ticket(text, text, integer) TO service_role;
