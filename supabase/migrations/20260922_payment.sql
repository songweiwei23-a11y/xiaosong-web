-- 收款链路：下单 → 上传转账凭证 → 后台人工审核 → 自动开通套餐
--
-- 【为什么现在才建】后台的「订单审核」和「收款二维码」两页、
-- /api/admin/orders/review、/api/admin/analytics 都在查 payment_orders
-- 和 payment_qrcodes，而这两张表在数据库里从来就不存在——
-- 页面永远显示「加载失败」，审核接口必然 500，营收数据恒为空。
--
-- 这里只做人工核对：用户转账后上传截图，管理员看图放行。
-- 不接支付宝/微信的真实支付接口（那需要企业资质和签约）。

-- ============ 订单 ============
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 套餐 id（basic/pro/enterprise），与 lib/config/plans.ts 的 id 一一对应。
  -- 审核通过后直接拿它写 subscriptions.plan。
  -- 原先的审核接口是拿 plan_name.replace('会员','') 去推 id 的，
  -- 「基础会员」推出来是「基础」——不是任何一个合法套餐，开通必然失败。
  plan_id TEXT NOT NULL CHECK (plan_id IN ('basic', 'pro', 'enterprise')),

  -- 下单当时的显示名与价格。快照下来，日后改名改价不影响历史订单的对账。
  plan_name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),

  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('alipay', 'wechat')),

  -- pending   下单了还没传凭证
  -- reviewing 传了凭证，等管理员看
  -- approved  已放行，套餐已开通
  -- rejected  被拒，附 review_note
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),

  proof_image_url TEXT,
  review_note TEXT,
  reviewer_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proof_uploaded_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
);

-- 后台按状态筛 + 按时间倒序，这是订单页唯一的查询方式
CREATE INDEX IF NOT EXISTS idx_payment_orders_review
  ON payment_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user
  ON payment_orders (user_id, created_at DESC);

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own orders read" ON payment_orders;
DROP POLICY IF EXISTS "own orders create" ON payment_orders;
DROP POLICY IF EXISTS "own orders upload proof" ON payment_orders;

-- 用户只看得到自己的订单
CREATE POLICY "own orders read" ON payment_orders
  FOR SELECT USING (auth.uid() = user_id);

-- 只能给自己下单
CREATE POLICY "own orders create" ON payment_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 只能改自己的、且只在「还没审」的阶段改（用途就是补传凭证）。
-- 审核动作走服务端 service_role，不受这条限制。
CREATE POLICY "own orders upload proof" ON payment_orders
  FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('pending', 'reviewing'))
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'reviewing'));

-- ============ 收款二维码 ============
CREATE TABLE IF NOT EXISTS payment_qrcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method TEXT UNIQUE NOT NULL CHECK (payment_method IN ('alipay', 'wechat')),
  qrcode_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 预置两行。后台那页是「更换二维码」的交互（UPDATE），不是新增，
-- 表里没有这两行的话点上传会静默什么都不发生。
INSERT INTO payment_qrcodes (payment_method, is_active)
VALUES ('alipay', FALSE), ('wechat', FALSE)
ON CONFLICT (payment_method) DO NOTHING;

ALTER TABLE payment_qrcodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qrcodes readable by signed in" ON payment_qrcodes;

-- 登录用户都要看得到（付款页要显示收款码）；写入只允许 service_role，
-- 也就是只能通过后台接口改，前端拿 anon key 改不动。
CREATE POLICY "qrcodes readable by signed in" ON payment_qrcodes
  FOR SELECT TO authenticated USING (TRUE);

-- ============ 图片存储 ============
-- 收款码是要公开展示的；转账凭证含用户的支付信息，不公开。
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-qrcodes', 'payment-qrcodes', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "qrcode images public read" ON storage.objects;
DROP POLICY IF EXISTS "proof upload own" ON storage.objects;
DROP POLICY IF EXISTS "proof read own" ON storage.objects;

CREATE POLICY "qrcode images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-qrcodes');

-- 凭证按 <user_id>/<文件名> 存放，用路径首段限定归属：
-- 用户只能往自己的目录传、也只能读自己的。管理员看图走服务端签名 URL。
CREATE POLICY "proof upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "proof read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
