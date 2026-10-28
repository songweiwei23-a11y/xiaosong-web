-- 代理分成（2026-10-28）：管理员手动开通代理；代理用自己生成的邀请码拉新用户；
-- 这些用户购买会员后，按统一费率计分成，每月结算一次（系统只记账，打款线下做）。
--
-- agents：代理。一个账号最多一条；由管理员开通。
-- agent_program_settings：统一费率（一行）。所有代理同一个比例。
-- agent_referrals：用户绑定到代理。用户唯一，第一次绑定为准，不追溯老用户。
-- agent_settlements：每个代理每个月的结算快照。同一代理同一个月只结一次。
-- invitation_codes.agent_id：代理自己生成的邀请码带上它；多人可以用（max_uses 很大）。
--
-- 五张表只给服务端读写（启用 RLS、不建策略，并收回 anon / authenticated 的权限）。
-- 代理身份不放进 admin_roles：那张表一有记录就算管理员，会绕过首页拦截。

-- 删除是 RESTRICT：代理和它的客户、结算快照是账，不能因为删用户被静默删掉。要停用，就在后台改状态。
CREATE TABLE IF NOT EXISTS public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 60),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_program_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_rate numeric(5, 4) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.agent_program_settings (id, commission_rate) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.agent_referrals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT,
  invitation_code text NOT NULL,
  bound_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_referrals_agent_idx ON public.agent_referrals (agent_id, bound_at DESC);
CREATE INDEX IF NOT EXISTS agent_referrals_code_idx ON public.agent_referrals (invitation_code);

CREATE TABLE IF NOT EXISTS public.agent_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT,
  period text NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  order_count integer NOT NULL CHECK (order_count >= 0),
  paid_amount numeric(12, 2) NOT NULL CHECK (paid_amount >= 0),
  commission_rate numeric(5, 4) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
  commission_amount numeric(12, 2) NOT NULL CHECK (commission_amount >= 0),
  settled_at timestamptz NOT NULL DEFAULT now(),
  settled_by uuid,
  UNIQUE (agent_id, period)
);

ALTER TABLE public.invitation_codes ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS invitation_codes_agent_idx ON public.invitation_codes (agent_id);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agents, public.agent_program_settings, public.agent_referrals, public.agent_settlements FROM anon, authenticated;
