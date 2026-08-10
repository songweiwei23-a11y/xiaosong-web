-- 支付订单表（记录每笔支付）
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL, -- 'basic' | 'pro' | 'enterprise'
  plan_name TEXT NOT NULL, -- '基础会员' | '专业会员' | '企业版'
  billing_cycle TEXT NOT NULL, -- 'monthly' | 'yearly'
  amount DECIMAL(10, 2) NOT NULL, -- 支付金额
  
  -- 支付方式和状态
  payment_method TEXT NOT NULL, -- 'alipay' | 'wechat'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'reviewing' | 'approved' | 'rejected' | 'expired'
  
  -- 支付凭证
  proof_image_url TEXT, -- 用户上传的支付截图 URL
  proof_uploaded_at TIMESTAMPTZ, -- 凭证上传时间
  
  -- 审核信息
  reviewed_by UUID REFERENCES auth.users(id), -- 审核管理员 ID
  reviewed_at TIMESTAMPTZ, -- 审核时间
  review_note TEXT, -- 审核备注（拒绝原因等）
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours' -- 订单过期时间（24小时）
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON public.payment_orders(created_at DESC);

-- RLS 策略
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的订单
CREATE POLICY "Users can view own orders"
  ON public.payment_orders FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能创建自己的订单
CREATE POLICY "Users can create own orders"
  ON public.payment_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的订单（上传凭证）
CREATE POLICY "Users can update own orders"
  ON public.payment_orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 管理员可以查看所有订单
CREATE POLICY "Admins can view all orders"
  ON public.payment_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_settings
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 管理员可以更新订单（审核）
CREATE POLICY "Admins can update orders"
  ON public.payment_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_settings
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 自动更新 updated_at 的触发器
CREATE OR REPLACE FUNCTION update_payment_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_orders_updated_at
  BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_orders_updated_at();

-- 注释
COMMENT ON TABLE public.payment_orders IS '支付订单表（方案A：固定收款码+人工审核）';
COMMENT ON COLUMN public.payment_orders.status IS 'pending:待支付, reviewing:审核中, approved:已通过, rejected:已拒绝, expired:已过期';
