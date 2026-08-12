-- 修复admin_action_logs表结构
ALTER TABLE admin_action_logs
ADD COLUMN IF NOT EXISTS action TEXT,
ADD COLUMN IF NOT EXISTS target_user_id UUID,
ADD COLUMN IF NOT EXISTS details JSONB;

-- 如果表不存在，创建它
CREATE TABLE IF NOT EXISTS admin_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL,
    action TEXT NOT NULL,
    target_user_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT 'admin_action_logs table fixed' AS status;