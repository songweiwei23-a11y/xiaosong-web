-- 原子自增用户配额使用次数
-- 由服务端 API 路由在生成成功后调用（lib/api-guard.ts -> incrementUsageServer）
create or replace function increment_quota_used(p_user_id uuid)
returns void
language sql
security definer
as $$
  update user_settings
  set quota_used = coalesce(quota_used, 0) + 1
  where user_id = p_user_id;
$$;
