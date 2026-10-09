-- 我的创作偏好（2026-10-04，docs/越用越懂你_第一版方案_20261004.md，产品方确认）
-- 每个账号的每个档案一行：从画布修改、收藏、已拍已发的内容里学到的创作偏好。
-- 只许服务端读写（app/api/preferences 按本人过滤），浏览器拿不到别人的。
BEGIN;
CREATE TABLE IF NOT EXISTS public.creator_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 档案编号；没有档案的旧内容是 'default'
  profile_key text NOT NULL,
  -- 「让开物从我的使用中学习」，默认开启（产品方定）
  enabled boolean NOT NULL DEFAULT true,
  -- 偏好条目（生效的 + 观察中的），结构见 lib/preferences.ts 的 PreferenceItem
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- 用户删掉或点了「不要学这条」的，以后不再学
  rejected jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- 上次学习时证据的指纹：没有新证据就不再调模型
  signature text,
  -- 改稿量变化（「最近 10 条内容，你平均改动的字数比刚开始少了 X%」）
  stats jsonb,
  learned_at timestamptz,
  -- 用户上次看偏好卡的时间：首页「开物最近又学到 N 条」按它算
  seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, profile_key)
);
ALTER TABLE public.creator_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creator_preferences FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.creator_preferences TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
