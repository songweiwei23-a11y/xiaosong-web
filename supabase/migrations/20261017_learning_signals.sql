-- 「越用越懂你」二期（见 docs/越用越懂你_二期方案_20261017.md）
--
-- 1) 结果反馈带上档案、结果节选、对照组标记：反馈才能进偏好学习，学到的是「哪种写法不对、哪种有用」。
--    旧的反馈行三列都是空的，照常显示统计；学习只看带档案的新反馈。
-- 2) 学习信号表：每次生成记一行（板块、档案、是不是对照组、结果开头的指纹）。
--    反馈来的时候按指纹对回生成记录，就知道这条结果是不是对照组生成的。只存指纹，不存全文。
-- 两张表都只许服务端（service_role）读写：开 RLS、不建策略。

ALTER TABLE result_feedback ADD COLUMN IF NOT EXISTS profile_id UUID NULL REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE result_feedback ADD COLUMN IF NOT EXISTS excerpt TEXT NULL;
ALTER TABLE result_feedback ADD COLUMN IF NOT EXISTS control BOOLEAN NULL;

CREATE INDEX IF NOT EXISTS result_feedback_profile_idx ON result_feedback (user_id, profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_signals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NULL,
  kind TEXT NOT NULL CHECK (kind IN ('generation', 'fact_dismiss')),
  board TEXT NULL,
  control BOOLEAN NULL,
  head_hash TEXT NULL,
  payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_signals_user_kind_idx ON user_signals (user_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS user_signals_head_idx ON user_signals (user_id, head_hash);

ALTER TABLE user_signals ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_signals'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_signals', pol.policyname);
  END LOOP;
END $$;

-- 不建任何策略 = 除 service_role 外一律拒绝

SELECT '越用越懂你二期的表已建好' AS 结果;
