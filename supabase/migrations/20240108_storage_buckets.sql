-- Create storage buckets for payment system
-- Run this in Supabase SQL Editor

-- 1. Create bucket for payment proof images
--
-- 【必须是私有桶】这里原本写的是 public = true，而线上实际是 false。
-- 文件和现实不符：拿这份迁移去开新环境，就会真的建出一个公开桶，
-- 而里面装的是用户的转账截图——含姓名、金额，有的还带账号尾号。
-- 线上实测过匿名和公开 URL 都读不到，说明当初是在控制台手动改回私有的，
-- 但没人回来改这个文件。
-- 管理员看图走的是 createSignedUrl（30 分钟有效），不需要公开桶。
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create bucket for QR code images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-qrcodes',
  'payment-qrcodes',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for payment-proofs bucket
--
-- 【读权限收到本人 + 管理员】原策略是 USING (bucket_id = 'payment-proofs')，
-- 没有任何身份条件，等于"谁都能读"。桶是私有的时候这条没造成实际泄露
-- （已实测：匿名与公开 URL 均被拒），但它是一颗雷——桶的公开性一旦被
-- 改回 true，全部转账截图立刻对外可见。策略本身就该写对。
CREATE POLICY "Users read own payment proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 管理员要看凭证才能审单。这里与 requireAdmin 的口径保持一致：
-- admin_roles 表优先，user_settings.is_admin 兼容旧数据。
CREATE POLICY "Admins read payment proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs'
  AND (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_settings WHERE user_id = auth.uid() AND is_admin = true)
  )
);

-- Authenticated users can upload
CREATE POLICY "Authenticated upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs' 
  AND auth.role() = 'authenticated'
);

-- Users can update their own uploads
CREATE POLICY "Users update own payment proofs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'payment-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Storage policies for payment-qrcodes bucket
-- Public read access
CREATE POLICY "Public read qrcodes"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-qrcodes');

-- Only admins can upload/update QR codes
CREATE POLICY "Admin upload qrcodes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-qrcodes'
  -- 原本查的是 profiles 表，而库里根本没有这张表（是 user_profiles）。
  -- 引用它的策略要么建不起来、要么一执行就报「关系不存在」，
  -- 结果就是管理员在后台传不了收款码。口径与 requireAdmin 对齐。
  AND (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_settings WHERE user_id = auth.uid() AND is_admin = true)
  )
);

CREATE POLICY "Admin update qrcodes"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'payment-qrcodes'
  -- 原本查的是 profiles 表，而库里根本没有这张表（是 user_profiles）。
  -- 引用它的策略要么建不起来、要么一执行就报「关系不存在」，
  -- 结果就是管理员在后台传不了收款码。口径与 requireAdmin 对齐。
  AND (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_settings WHERE user_id = auth.uid() AND is_admin = true)
  )
);

CREATE POLICY "Admin delete qrcodes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-qrcodes'
  -- 原本查的是 profiles 表，而库里根本没有这张表（是 user_profiles）。
  -- 引用它的策略要么建不起来、要么一执行就报「关系不存在」，
  -- 结果就是管理员在后台传不了收款码。口径与 requireAdmin 对齐。
  AND (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_settings WHERE user_id = auth.uid() AND is_admin = true)
  )
);