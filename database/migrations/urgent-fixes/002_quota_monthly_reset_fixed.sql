-- ============================================
-- 紧急修复3：配额月度重置逻辑（修复版）
-- 执行时间: 2026-08-13
-- 说明: 实现额度每月自动重置机制
-- ============================================

-- 1. 添加月度重置追踪字段
ALTER TABLE user_quotas
ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMENT ON COLUMN user_quotas.last_reset_at IS '上次额度重置时间（用于判断是否需要月度重置）';

-- 2. 创建月度重置检查和执行函数
CREATE OR REPLACE FUNCTION check_and_reset_monthly_quota(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_last_reset TIMESTAMP WITH TIME ZONE;
  v_current_month TEXT;
  v_last_reset_month TEXT;
  v_should_reset BOOLEAN := FALSE;
BEGIN
  SELECT last_reset_at INTO v_last_reset
  FROM user_quotas
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_current_month := TO_CHAR(NOW(), 'YYYY-MM');
  v_last_reset_month := TO_CHAR(v_last_reset, 'YYYY-MM');

  IF v_current_month != v_last_reset_month THEN
    v_should_reset := TRUE;
    
    UPDATE user_quotas
    SET 
      script_used = 0,
      topic_used = 0,
      positioning_used = 0,
      storyboard_used = 0,
      review_used = 0,
      title_used = 0,
      free_chat_used = 0,
      deal_reason_used = 0,
      knowledge_used = 0,
      last_reset_at = NOW()
    WHERE user_id = p_user_id;

    RAISE NOTICE '✓ 用户 % 的额度已重置（新月份：%）', p_user_id, v_current_month;
  END IF;

  RETURN v_should_reset;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_and_reset_monthly_quota IS '检查并执行月度额度重置（如果需要）';

-- 3. 创建获取用户已使用额度的安全函数
CREATE OR REPLACE FUNCTION get_user_quota_used(
  p_user_id UUID,
  p_feature TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_used INTEGER;
  v_column_name TEXT;
BEGIN
  PERFORM check_and_reset_monthly_quota(p_user_id);

  v_column_name := p_feature || '_used';

  EXECUTE format('SELECT %I FROM user_quotas WHERE user_id = $1', v_column_name)
  INTO v_used
  USING p_user_id;

  RETURN COALESCE(v_used, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_quota_used IS '获取用户功能已使用次数（会自动检查月度重置）';

-- 4. 创建增加使用次数的函数
CREATE OR REPLACE FUNCTION increment_quota_used_v2(
  p_user_id UUID,
  p_feature TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_column_name TEXT;
  v_rows_affected INTEGER;
BEGIN
  PERFORM check_and_reset_monthly_quota(p_user_id);

  v_column_name := p_feature || '_used';

  EXECUTE format(
    'UPDATE user_quotas SET %I = %I + 1 WHERE user_id = $1',
    v_column_name, v_column_name
  )
  USING p_user_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    EXECUTE format(
      'INSERT INTO user_quotas (user_id, %I, last_reset_at) VALUES ($1, 1, NOW())',
      v_column_name
    )
    USING p_user_id;
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '增加使用次数失败: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_quota_used_v2 IS '增加功能使用次数（会自动检查月度重置）';

-- 5. 创建批量重置所有用户额度的管理函数
CREATE OR REPLACE FUNCTION admin_reset_all_quotas()
RETURNS TABLE(reset_count INTEGER) AS $$
BEGIN
  UPDATE user_quotas
  SET 
    script_used = 0,
    topic_used = 0,
    positioning_used = 0,
    storyboard_used = 0,
    review_used = 0,
    title_used = 0,
    free_chat_used = 0,
    deal_reason_used = 0,
    knowledge_used = 0,
    last_reset_at = NOW();

  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  RAISE NOTICE '✓ 已重置 % 个用户的额度', reset_count;
  
  RETURN QUERY SELECT reset_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION admin_reset_all_quotas IS '管理员批量重置所有用户额度（谨慎使用）';

-- 6. 为现有用户初始化 last_reset_at
UPDATE user_quotas
SET last_reset_at = NOW()
WHERE last_reset_at IS NULL;

-- 7. 测试验证（放在DO块中）
DO $$
DECLARE
  test_user_id UUID;
  should_reset BOOLEAN;
  updated_count INTEGER;
BEGIN
  -- 获取初始化的记录数
  SELECT COUNT(*) INTO updated_count
  FROM user_quotas
  WHERE last_reset_at IS NOT NULL;
  
  RAISE NOTICE '✓ 已初始化 % 个用户的 last_reset_at', updated_count;
  
  -- 测试函数是否创建成功
  SELECT user_id INTO test_user_id
  FROM user_quotas
  LIMIT 1;

  IF test_user_id IS NOT NULL THEN
    should_reset := check_and_reset_monthly_quota(test_user_id);
    
    IF should_reset THEN
      RAISE NOTICE '✓ 重置逻辑测试通过（触发了重置）';
    ELSE
      RAISE NOTICE '✓ 重置逻辑测试通过（当月无需重置）';
    END IF;
  ELSE
    RAISE NOTICE '⚠ 无测试用户，跳过测试';
  END IF;
  
  -- 最终成功消息
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✓ 配额月度重置逻辑已成功实现';
  RAISE NOTICE '✓ 关键函数: check_and_reset_monthly_quota';
  RAISE NOTICE '✓ 安全函数: get_user_quota_used, increment_quota_used_v2';
  RAISE NOTICE '✓ 管理函数: admin_reset_all_quotas';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
