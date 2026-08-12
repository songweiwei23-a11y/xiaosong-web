-- =============================================
-- 收款二维码功能 - 数据库配置
-- =============================================

-- 1. 确保system_config表存在并添加二维码配置字段
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT,
    config_type TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 插入二维码配置项
INSERT INTO system_config (config_key, config_value, config_type, description)
VALUES 
    ('payment_wechat_qrcode', NULL, 'image_url', '微信收款二维码URL'),
    ('payment_alipay_qrcode', NULL, 'image_url', '支付宝收款二维码URL'),
    ('payment_enabled', 'true', 'boolean', '是否启用收款功能')
ON CONFLICT (config_key) DO NOTHING;

-- 3. 创建更新配置的函数
CREATE OR REPLACE FUNCTION update_payment_qrcode(
    p_payment_type TEXT,
    p_qrcode_url TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE system_config
    SET config_value = p_qrcode_url,
        updated_at = NOW()
    WHERE config_key = 'payment_' || p_payment_type || '_qrcode';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_payment_qrcode TO authenticated;

-- 4. 创建获取所有配置的函数
CREATE OR REPLACE FUNCTION get_payment_config()
RETURNS TABLE (
    wechat_qrcode TEXT,
    alipay_qrcode TEXT,
    payment_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        MAX(CASE WHEN config_key = 'payment_wechat_qrcode' THEN config_value END) as wechat_qrcode,
        MAX(CASE WHEN config_key = 'payment_alipay_qrcode' THEN config_value END) as alipay_qrcode,
        (MAX(CASE WHEN config_key = 'payment_enabled' THEN config_value END) = 'true')::boolean as payment_enabled
    FROM system_config
    WHERE config_key IN ('payment_wechat_qrcode', 'payment_alipay_qrcode', 'payment_enabled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_payment_config TO anon, authenticated;

SELECT 'Payment QR code setup completed' AS status;