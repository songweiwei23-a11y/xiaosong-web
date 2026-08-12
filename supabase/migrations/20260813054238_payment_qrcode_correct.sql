-- =============================================
-- 收款二维码功能 - 适配实际表结构
-- =============================================

-- 1. 插入收款二维码配置
INSERT INTO system_config (key, value, description, updated_at)
VALUES 
    ('payment_wechat_qrcode', '{"url": null, "enabled": true}'::jsonb, '微信收款二维码配置', NOW()),
    ('payment_alipay_qrcode', '{"url": null, "enabled": true}'::jsonb, '支付宝收款二维码配置', NOW()),
    ('payment_config', '{"enabled": true, "manual_confirm": true}'::jsonb, '收款功能总配置', NOW())
ON CONFLICT (key) DO NOTHING;

-- 2. 更新二维码URL的函数
CREATE OR REPLACE FUNCTION update_payment_qrcode(
    p_payment_type TEXT,
    p_qrcode_url TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE system_config
    SET 
        value = jsonb_set(value, '{url}', to_jsonb(p_qrcode_url)),
        updated_at = NOW()
    WHERE key = 'payment_' || p_payment_type || '_qrcode';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_payment_qrcode TO authenticated;

-- 3. 获取收款配置的函数
CREATE OR REPLACE FUNCTION get_payment_config()
RETURNS jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_object_agg(key, value)
    INTO result
    FROM system_config
    WHERE key LIKE 'payment_%';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_payment_config TO anon, authenticated;

SELECT 'Payment QR code setup completed' AS status;