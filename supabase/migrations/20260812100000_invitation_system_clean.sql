-- =============================================
-- 邀请码系统 - 精简版
-- =============================================

-- 1. 邀请码主表
CREATE TABLE IF NOT EXISTS invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'disabled')),
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'basic', 'pro', 'enterprise')),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- 2. 邀请关系表
CREATE TABLE IF NOT EXISTS invitation_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_code TEXT NOT NULL,
  reward_granted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(invitee_id)
);

-- 3. 使用记录表
CREATE TABLE IF NOT EXISTS invitation_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 索引
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_status ON invitation_codes(status);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_created_by ON invitation_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_invitation_relationships_inviter ON invitation_relationships(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitation_relationships_invitee ON invitation_relationships(invitee_id);

-- 5. 用户表添加字段
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS invitation_code_used TEXT,
  ADD COLUMN IF NOT EXISTS account_activated BOOLEAN DEFAULT TRUE;

-- 6. user_quotas表添加字段
ALTER TABLE user_quotas
  ADD COLUMN IF NOT EXISTS registered_with_invitation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_legacy_user BOOLEAN DEFAULT FALSE;

-- 7. 生成邀请码函数
CREATE OR REPLACE FUNCTION generate_invitation_code(
  p_created_by UUID,
  p_plan_type TEXT DEFAULT 'free',
  p_expires_days INT DEFAULT 30,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := 'XS-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM invitation_codes WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  INSERT INTO invitation_codes (code, created_by, plan_type, expires_at, notes)
  VALUES (
    v_code,
    p_created_by,
    p_plan_type,
    CASE WHEN p_expires_days > 0 THEN NOW() + (p_expires_days || ' days')::INTERVAL ELSE NULL END,
    p_notes
  );
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 使用邀请码函数
CREATE OR REPLACE FUNCTION use_invitation_code(
  p_code TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_invitation
  FROM invitation_codes
  WHERE code = p_code
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '邀请码不存在');
  END IF;
  
  IF v_invitation.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', '邀请码已失效');
  END IF;
  
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < NOW() THEN
    UPDATE invitation_codes SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'message', '邀请码已过期');
  END IF;
  
  UPDATE invitation_codes
  SET status = 'used', used_by = p_user_id, used_at = NOW()
  WHERE id = v_invitation.id;
  
  UPDATE user_profiles
  SET invitation_code_used = p_code, account_activated = TRUE
  WHERE user_id = p_user_id;
  
  UPDATE user_quotas
  SET registered_with_invitation = TRUE
  WHERE user_id = p_user_id;
  
  IF v_invitation.created_by IS NOT NULL THEN
    INSERT INTO invitation_relationships (inviter_id, invitee_id, invitation_code)
    VALUES (v_invitation.created_by, p_user_id, p_code)
    ON CONFLICT (invitee_id) DO NOTHING;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', '邀请码使用成功',
    'plan_type', v_invitation.plan_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 权限设置
GRANT EXECUTE ON FUNCTION generate_invitation_code TO authenticated;
GRANT EXECUTE ON FUNCTION use_invitation_code TO authenticated, anon;

SELECT 'Invitation system setup completed' AS status;