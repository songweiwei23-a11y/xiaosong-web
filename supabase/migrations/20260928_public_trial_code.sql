-- 首页公开体验码：邀请制保留，但小白从首页点进来不用去找码
--
-- 【为什么】注册要邀请码，而完全不懂的小白手上没有码——他点"注册"、看到要填码、
-- 走了，首页做得再好也在这一步漏光。产品方决定保留邀请制，所以做成：
-- 首页点进注册页时自动带上一个公开体验码，小白感觉不到；
-- 管理员随时能作废它（后台邀请码列表里），也能看到有多少人是从首页进来的（use_count）。
--
-- 原来一个码只能用一次（used_by 记一个人）。公开码要多人共用，
-- 所以加两列：最多能用几次、已经用了几次。旧码 max_uses 默认 1，行为不变。

ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS use_count INTEGER NOT NULL DEFAULT 0;

-- 已经被用掉的旧码，次数对上
UPDATE invitation_codes SET use_count = 1 WHERE used_by IS NOT NULL AND use_count = 0;

-- 兑换：还是一条原子 UPDATE（两个人同时提交同一个码，只有该成功的会成功）
--   一次性的码（max_uses = 1）：和原来一样，记下使用者、状态变 used
--   多人共用的码：次数 +1，满了才变 used；used_by 不记（记不下所有人）
CREATE OR REPLACE FUNCTION claim_invitation_code(p_code TEXT, p_user_id UUID)
RETURNS TABLE (ok BOOLEAN, reason TEXT, plan_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row invitation_codes%ROWTYPE;
BEGIN
  UPDATE invitation_codes
  SET use_count = use_count + 1,
      used_by = CASE WHEN max_uses = 1 THEN p_user_id ELSE used_by END,
      used_at = NOW(),
      status = CASE WHEN use_count + 1 >= max_uses THEN 'used' ELSE status END
  WHERE upper(code) = upper(btrim(p_code))
    AND status = 'active'
    AND use_count < max_uses
    AND (max_uses > 1 OR used_by IS NULL)
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, NULL::TEXT, v_row.plan_type;
    RETURN;
  END IF;

  SELECT * INTO v_row FROM invitation_codes
  WHERE upper(code) = upper(btrim(p_code)) LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, '邀请码不存在，请检查是否输错'::TEXT, NULL::TEXT;
  ELSIF v_row.status = 'revoked' THEN
    RETURN QUERY SELECT FALSE, '这个邀请码已被管理员作废'::TEXT, NULL::TEXT;
  ELSIF v_row.max_uses > 1 AND v_row.use_count >= v_row.max_uses THEN
    RETURN QUERY SELECT FALSE, '这个体验码的名额已经用完了，请联系客服领取邀请码'::TEXT, NULL::TEXT;
  ELSIF v_row.used_by IS NOT NULL OR v_row.status = 'used' THEN
    RETURN QUERY SELECT FALSE, '这个邀请码已经被使用过了'::TEXT, NULL::TEXT;
  ELSIF v_row.expires_at IS NOT NULL AND v_row.expires_at <= NOW() THEN
    RETURN QUERY SELECT FALSE, '这个邀请码已过期'::TEXT, NULL::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, '邀请码不可用'::TEXT, NULL::TEXT;
  END IF;
END $$;

REVOKE ALL ON FUNCTION claim_invitation_code(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_invitation_code(TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION claim_invitation_code(TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_invitation_code(TEXT, UUID) TO service_role;

-- 首页用的公开体验码。和代码里 lib/landing.ts 的 PUBLIC_TRIAL_CODE 必须一致。
-- 名额先给 500：够看出效果，也不至于被人拿去无限注册。满了在后台作废再发一个新的即可。
-- 开通的是免费版（plan_type = 'free'），和普通邀请码一样拿免费体验额度。
INSERT INTO invitation_codes (code, status, plan_type, is_public, max_uses, notes, created_by, created_by_admin)
SELECT 'START26', 'active', 'free', TRUE, 500, '首页公开体验码（首屏注册自动带上）',
       (SELECT user_id FROM user_settings WHERE is_admin = TRUE LIMIT 1), TRUE
WHERE NOT EXISTS (SELECT 1 FROM invitation_codes WHERE upper(code) = 'START26');

-- 跑完看一眼
SELECT code, status, is_public, use_count, max_uses FROM invitation_codes WHERE upper(code) = 'START26';
