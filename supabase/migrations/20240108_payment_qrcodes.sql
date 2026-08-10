-- 收款码配置表（管理员上传收款二维码）
CREATE TABLE IF NOT EXISTS public.payment_qrcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method TEXT NOT NULL UNIQUE, -- 'alipay' | 'wechat'
  qrcode_url TEXT NOT NULL, -- 二维码图片 URL
  account_name TEXT, -- 收款账户名（可选）
  is_active BOOLEAN DEFAULT TRUE, -- 是否启用
  
  updated_by UUID REFERENCES auth.users(id), -- 更新人
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 策略
ALTER TABLE public.payment_qrcodes ENABLE ROW LEVEL SECURITY;

-- 所有人可以查看（用于支付页面显示）
CREATE POLICY "Anyone can view active qrcodes"
  ON public.payment_qrcodes FOR SELECT
  USING (is_active = TRUE);

-- 管理员可以管理
CREATE POLICY "Admins can manage qrcodes"
  ON public.payment_qrcodes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_settings
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 初始化数据（占位符，管理员后续上传真实二维码）
INSERT INTO public.payment_qrcodes (payment_method, qrcode_url, account_name, is_active)
VALUES 
  ('alipay', '/placeholder-alipay-qr.png', '小宋编导知识大全', FALSE),
  ('wechat', '/placeholder-wechat-qr.png', '小宋编导知识大全', FALSE)
ON CONFLICT (payment_method) DO NOTHING;

COMMENT ON TABLE public.payment_qrcodes IS '收款二维码配置表';
