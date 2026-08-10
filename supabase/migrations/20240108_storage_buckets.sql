-- Create storage buckets for payment system
-- Run this in Supabase SQL Editor

-- 1. Create bucket for payment proof images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,
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
-- Public read access
CREATE POLICY "Public read payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs');

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
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin update qrcodes"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'payment-qrcodes'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin delete qrcodes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-qrcodes'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);