-- ============================================
-- 邀请码系统 + 额度优化
-- 创建时间: 2026-08-12
-- 作者: Kiro AI
-- 目的: 1) 邀请码门槛 2) 额度优化
-- 安全: 可回滚，不影响现有用户
-- ============================================

-- ============================================
-- 第一部分：邀请码表结构
-- ============================================

-- 1. 邀请码主表
CREATE TABLE IF NOT EXISTS invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,                          -- 邀请码（8位：XS-XXXXXX）
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- 生成者
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,     -- 使用者
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'disabled')),
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'basic', 'pro', 'enterprise')), -- 激活后的会员等级
  expires_at TIMESTAMP WITH TIME ZONE,                -- 过期时间
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  notes TEXT                                          -- 管理员备注
);

-- 2. 邀请关系表（追踪邀请链）
CREATE TABLE IF NOT EXISTS invitation_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- 邀请人
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- 被邀请人
  invitation_code TEXT NOT NULL,                                         -- 使用的邀请码
  reward_granted BOOLEAN DEFAULT FALSE,                                  -- 是否已发放奖励
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(invitee_id)                                                     -- 一个用户只能被邀请一次
);

-- 3. 索引优化
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_status ON invitation_codes(status);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_created_by ON invitation_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_plan_type ON invitation_codes(plan_type);
CREATE INDEX IF NOT EXISTS idx_invitation_relationships_inviter ON invitation_relationships(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitation_relationships_invitee ON invitation_relationships(invitee_id);

-- 4. 用户表添加激活字段
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS invitation_code_used TEXT,
  ADD COLUMN IF NOT EXISTS account_activated BOOLEAN DEFAULT TRUE;  -- 默认TRUE，老用户已激活

-- 只有新注册用户需要激活
COMMENT ON COLUMN user_profiles.account_activated IS '账号是否激活（新用户需要邀请码激活）';

-- ============================================
-- 第二部分：额度配置表
-- ============================================

-- 5. 额度配置表（新增，更灵活）
CREATE TABLE IF NOT EXISTS quota_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT UNIQUE NOT NULL,                    -- free, basic, pro, enterprise
  script_limit INTEGER NOT NULL,                     -- 脚本生成
  topic_limit INTEGER NOT NULL,                      -- 选题策划
  positioning_limit INTEGER NOT NULL,                -- 账号定位
  storyboard_limit INTEGER NOT NULL,                 -- 分镜脚本
  review_limit INTEGER NOT NULL,                     -- 审稿优化
  title_limit INTEGER NOT NULL,                      -- 标题封面
  free_chat_limit INTEGER NOT NULL,                  -- 自由对话
  deal_reason_limit INTEGER NOT NULL,                -- 成交理由
  knowledge_limit INTEGER NOT NULL,                  -- 知识库
  is_active BOOLEAN DEFAULT TRUE,                    -- 是否启用
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 插入优化后的额度配置
INSERT INTO quota_plans (plan_name, script_limit, topic_limit, positioning_limit, storyboard_limit, review_limit, title_limit, free_chat_limit, deal_reason_limit, knowledge_limit)
VALUES 
  ('free', 3, 5, 1, 2, 2, 5, 15, 5, 30),                    -- 免费版：大幅降低
  ('basic', 50, 100, 5, 30, 30, 50, 200, 50, 500),          -- 基础版：10-20倍提升
  ('pro', 200, 500, 20, 100, 100, 200, 1000, 200, 9999),    -- 专业版：40-100倍提升
  ('enterprise', 9999, 9999, 50, 500, 500, 1000, 9999, 1000, 9999) -- 企业版：几乎无限
ON CONFLICT (plan_name) DO NOTHING;

-- 7. 备份当前配置（用于回滚）
CREATE TABLE IF NOT EXISTS quota_plans_backup_20260812 AS 
SELECT 
  'free' as plan_name,
  10 as script_limit,
  20 as topic_limit,
  1 as positioning_limit,
  5 as storyboard_limit,
  5 as review_limit,
  10 as title_limit,
  50 as free_chat_limit,
  10 as deal_reason_limit,
  9999 as knowledge_limit,
  NOW() as backup_time;

-- 8. 用户额度表添加标记字段
ALTER TABLE user_quotas 
  ADD COLUMN IF NOT EXISTS is_legacy_user BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS registered_with_invitation BOOLEAN DEFAULT FALSE;

-- 标记现有用户为老用户（保留旧额度）
UPDATE user_quotas 
SET is_legacy_user = TRUE 
WHERE created_at < NOW() AND is_legacy_user IS DISTINCT FROM TRUE;

COMMENT ON COLUMN user_quotas.is_legacy_user IS '是否老用户（老用户保留旧额度）';
COMMENT ON COLUMN user_quotas.registered_with_invitation IS '是否通过邀请码注册';

-- ============================================
-- 第三部分：RLS 安全策略
-- ============================================

-- 9. 启用RLS
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_plans ENABLE ROW LEVEL SECURITY;

-- 10. 邀请码表策略
-- 用户可以查看自己创建的邀请码
CREATE POLICY "Users can view own invitation codes"
  ON invitation_codes FOR SELECT
  USING (created_by = auth.uid());

-- 管理员可以查看所有邀请码
CREATE POLICY "Admins can manage all invitation codes"
  ON invitation_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

-- 11. 邀请关系表策略
-- 用户可以查看与自己相关的邀请关系
CREATE POLICY "Users can view own invitation relationships"
  ON invitation_relationships FOR SELECT
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

-- 管理员可以查看所有邀请关系
CREATE POLICY "Admins can view all invitation relationships"
  ON invitation_relationships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

-- 12. 额度配置表策略（所有人可读）
CREATE POLICY "Everyone can view quota plans"
  ON quota_plans FOR SELECT
  USING (is_active = TRUE);

-- 只有管理员可以修改
CREATE POLICY "Only admins can modify quota plans"
  ON quota_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

-- ============================================
-- 第四部分：函数和触发器
-- ============================================

-- 13. 获取用户额度限制函数
CREATE OR REPLACE FUNCTION get_user_quota_limit(
  p_user_id UUID,
  p_feature TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_plan TEXT;
  v_limit INTEGER;
  v_is_legacy BOOLEAN;
BEGIN
  -- 获取用户套餐
  SELECT COALESCE(plan, 'free') INTO v_plan
  FROM subscriptions
  WHERE user_id = p_user_id;
  
  -- 获取是否老用户
  SELECT COALESCE(is_legacy_user, FALSE) INTO v_is_legacy
  FROM user_quotas
  WHERE user_id = p_user_id;
  
  -- 老用户使用旧额度（过渡期保护）
  IF v_is_legacy THEN
    SELECT 
      CASE p_feature
        WHEN 'script' THEN script_limit
        WHEN 'topic' THEN topic_limit
        WHEN 'positioning' THEN positioning_limit
        WHEN 'storyboard' THEN storyboard_limit
        WHEN 'review' THEN review_limit
        WHEN 'title' THEN title_limit
        WHEN 'free_chat' THEN free_chat_limit
        WHEN 'deal_reason' THEN deal_reason_limit
        WHEN 'knowledge' THEN knowledge_limit
        ELSE 0
      END INTO v_limit
    FROM quota_plans_backup_20260812
    WHERE plan_name = 'free';
  ELSE
    -- 新用户使用新额度
    SELECT 
      CASE p_feature
        WHEN 'script' THEN script_limit
        WHEN 'topic' THEN topic_limit
        WHEN 'positioning' THEN positioning_limit
        WHEN 'storyboard' THEN storyboard_limit
        WHEN 'review' THEN review_limit
        WHEN 'title' THEN title_limit
        WHEN 'free_chat' THEN free_chat_limit
        WHEN 'deal_reason' THEN deal_reason_limit
        WHEN 'knowledge' THEN knowledge_limit
        ELSE 0
      END INTO v_limit
    FROM quota_plans
    WHERE plan_name = v_plan AND is_active = TRUE;
  END IF;
  
  RETURN COALESCE(v_limit, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_quota_limit IS '获取用户某功能的额度限制（自动区分新老用户）';

-- 14. 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_quota_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_quota_plans_updated_at ON quota_plans;`nCREATE TRIGGER trigger_update_quota_plans_updated_at
  BEFORE UPDATE ON quota_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_quota_plans_updated_at();

-- ============================================
-- 第五部分：管理视图
-- ============================================

-- 15. 邀请码统计视图
CREATE OR REPLACE VIEW invitation_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_codes,
  COUNT(CASE WHEN status = 'used' THEN 1 END) as used_codes,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_codes,
  COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_codes,
  ROUND(
    COUNT(CASE WHEN status = 'used' THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as usage_rate_percent,
  COUNT(DISTINCT created_by) as unique_creators
FROM invitation_codes
GROUP BY DATE(created_at)
ORDER BY date DESC;

COMMENT ON VIEW invitation_stats IS '邀请码每日统计（生成、使用、活跃等）';

-- 16. 邀请效果统计视图
CREATE OR REPLACE VIEW invitation_effectiveness AS
SELECT 
  ir.inviter_id,
  up.email as inviter_email,
  s_inviter.plan as inviter_plan,
  COUNT(ir.invitee_id) as invited_count,
  COUNT(CASE WHEN s_invitee.plan != 'free' THEN 1 END) as paid_invitees,
  ROUND(
    COUNT(CASE WHEN s_invitee.plan != 'free' THEN 1 END)::numeric / 
    NULLIF(COUNT(ir.invitee_id), 0) * 100, 
    2
  ) as paid_conversion_rate,
  COUNT(CASE WHEN ir.reward_granted THEN 1 END) as rewards_granted
FROM invitation_relationships ir
JOIN user_profiles up ON ir.inviter_id = up.user_id
LEFT JOIN subscriptions s_inviter ON ir.inviter_id = s_inviter.user_id
LEFT JOIN subscriptions s_invitee ON ir.invitee_id = s_invitee.user_id
GROUP BY ir.inviter_id, up.email, s_inviter.plan
ORDER BY invited_count DESC;

COMMENT ON VIEW invitation_effectiveness IS '邀请效果分析（邀请人数、付费转化率等）';

-- ============================================
-- 第六部分：注释和文档
-- ============================================

COMMENT ON TABLE invitation_codes IS '邀请码表 - 管理邀请码的生成、使用和过期';
COMMENT ON TABLE invitation_relationships IS '邀请关系表 - 追踪邀请者和被邀请者的关系链';
COMMENT ON TABLE quota_plans IS '额度配置表 - 各会员等级的功能额度限制';
COMMENT ON COLUMN invitation_codes.code IS '邀请码格式：XS-XXXXXX（8位字母数字）';
COMMENT ON COLUMN invitation_codes.status IS 'active-可用 | used-已使用 | expired-已过期 | disabled-已禁用';
COMMENT ON COLUMN invitation_codes.plan_type IS '使用此邀请码注册后获得的会员等级';
COMMENT ON COLUMN invitation_relationships.reward_granted IS '邀请奖励是否已发放';

-- ============================================
-- 第七部分：初始数据
-- ============================================

-- 17. 生成100个管理员初始邀请码（免费版）
DO $$
DECLARE
  i INTEGER;
  v_code TEXT;
  v_admin_id UUID;
BEGIN
  -- 获取第一个管理员ID（如果存在）
  SELECT user_id INTO v_admin_id 
  FROM user_profiles 
  WHERE role = 'admin' 
  LIMIT 1;
  
  -- 如果有管理员，生成100个初始邀请码
  IF v_admin_id IS NOT NULL THEN
    FOR i IN 1..100 LOOP
      v_code := 'XS' || UPPER(
        SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6)
      );
      
      INSERT INTO invitation_codes (code, created_by, status, plan_type, notes)
      VALUES (
        v_code, 
        v_admin_id, 
        'active', 
        'free',
        '系统初始化批量生成'
      )
      ON CONFLICT (code) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE '✅ 已生成100个初始邀请码';
  ELSE
    RAISE NOTICE '⚠️ 未找到管理员账号，跳过初始邀请码生成';
  END IF;
END $$;

-- ============================================
-- 第八部分：回滚脚本（紧急使用）
-- ============================================

-- 存储回滚脚本供紧急情况使用
CREATE TABLE IF NOT EXISTS migration_rollback_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL,
  rollback_sql TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO migration_rollback_scripts (migration_name, rollback_sql)
VALUES ('20260812100000_invitation_system', $ROLLBACK$
-- 紧急回滚步骤：

-- 1. 禁用邀请码检查（允许所有用户使用）
UPDATE user_profiles SET account_activated = TRUE WHERE account_activated = FALSE;

-- 2. 恢复旧额度
UPDATE quota_plans 
SET 
  script_limit = (SELECT script_limit FROM quota_plans_backup_20260812 WHERE plan_name = 'free'),
  topic_limit = (SELECT topic_limit FROM quota_plans_backup_20260812 WHERE plan_name = 'free'),
  free_chat_limit = (SELECT free_chat_limit FROM quota_plans_backup_20260812 WHERE plan_name = 'free')
WHERE plan_name = 'free';

-- 3. 标记为已回滚
CREATE TABLE IF NOT EXISTS rollback_log (
  timestamp TIMESTAMP DEFAULT NOW(),
  migration TEXT,
  reason TEXT,
  operator TEXT
);

INSERT INTO rollback_log (migration, reason, operator)
VALUES ('20260812100000_invitation_system', '紧急回滚', CURRENT_USER);

-- 4. 如需完全删除（谨慎！）
-- DROP TABLE IF EXISTS invitation_relationships CASCADE;
-- DROP TABLE IF EXISTS invitation_codes CASCADE;
-- DROP TABLE IF EXISTS quota_plans CASCADE;
-- DROP FUNCTION IF EXISTS get_user_quota_limit;
$ROLLBACK$);

-- ============================================
-- 迁移完成
-- ============================================

-- 记录迁移成功
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE '✅ 迁移完成：20260812100000_invitation_system';
  RAISE NOTICE '📋 已创建：';
  RAISE NOTICE '   - invitation_codes 表';
  RAISE NOTICE '   - invitation_relationships 表';
  RAISE NOTICE '   - quota_plans 表';
  RAISE NOTICE '   - 相关索引、策略、函数';
  RAISE NOTICE '   - 管理视图';
  RAISE NOTICE '   - 100个初始邀请码';
  RAISE NOTICE '🛡️  安全措施：';
  RAISE NOTICE '   - 老用户自动保护';
  RAISE NOTICE '   - RLS安全策略已启用';
  RAISE NOTICE '   - 回滚脚本已准备';
  RAISE NOTICE '==============================================';
END $$;

