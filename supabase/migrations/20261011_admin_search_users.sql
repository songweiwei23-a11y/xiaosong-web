-- 后台用户搜索：按邮箱、用户名或用户编号查找，分页返回。
-- Supabase 的 listUsers 不支持按邮箱搜索，只能逐页拉全量，所以在库里做。
-- 只允许 service_role 调用（后台接口用服务端密钥），浏览器和普通用户都不能直接调。
-- 用 strpos 而不是 ILIKE：用户输入里的 % 和 _ 不会被当成通配符。

CREATE OR REPLACE FUNCTION admin_search_users(p_query text, p_limit int, p_offset int)
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    u.banned_until,
    count(*) OVER ()
  FROM auth.users u
  WHERE p_query = ''
     OR strpos(lower(coalesce(u.email::text, '')), lower(p_query)) > 0
     OR u.id::text = lower(p_query)
     OR EXISTS (
       SELECT 1 FROM public.user_profiles p
       WHERE p.user_id = u.id
         AND strpos(lower(coalesce(p.profile_name, '')), lower(p_query)) > 0
     )
  ORDER BY u.created_at DESC
  LIMIT greatest(p_limit, 1)
  OFFSET greatest(p_offset, 0);
$$;

REVOKE ALL ON FUNCTION admin_search_users(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_search_users(text, int, int) TO service_role;

-- 跑完看一眼：空搜索应返回前几个用户
SELECT count(*) AS 用户总数 FROM auth.users;
