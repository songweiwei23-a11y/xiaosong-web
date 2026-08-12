-- =============================================
-- Storage RLS 策略 - payment-qrcodes bucket
-- =============================================

-- 1. 允许所有人读取(因为是收款码,需要公开展示)
CREATE POLICY "Anyone can view payment QR codes"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-qrcodes');

-- 2. 允许认证用户上传
CREATE POLICY "Authenticated users can upload payment QR codes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-qrcodes');

-- 3. 允许认证用户更新
CREATE POLICY "Authenticated users can update payment QR codes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payment-qrcodes');

-- 4. 允许认证用户删除
CREATE POLICY "Authenticated users can delete payment QR codes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payment-qrcodes');

SELECT 'Storage RLS policies created for payment-qrcodes' AS status;