-- 在数据库层强制「无邀请码不得注册」
--
-- 【为什么不能只靠后台开关】Supabase 控制台里的
-- Authentication → Allow new users to sign up 关掉之后，
-- 浏览器直接 POST /auth/v1/signup 就会被拒。理论上够了。
--
-- 但实测：开关关过之后，直接调用仍然返回 HTTP 200 并发放了登录令牌，
-- 账号真的被创建。连续探测两次都是这样，排除了缓存延迟。
-- 也就是说这道门取决于面板上某个不易确认的状态——而且以后任何人
-- 无意中把它打开，产品就又变回完全开放，没有任何提示。
--
-- 所以把判断放进数据库：auth.users 上加一个插入前触发器，
-- 没有「注册授权」就直接拒绝。这条路不依赖任何面板设置，
-- 也拦得住所有绕过前端的调用。

-- ---------- 注册授权 ----------
--
-- 服务端在建号之前先往这里写一行，建号成功时触发器把它消费掉。
-- 相当于一张一次性的入场券：谁发的、什么时候发的，都留痕。
CREATE TABLE IF NOT EXISTS registration_authorizations (
  email TEXT PRIMARY KEY,
  invitation_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE registration_authorizations ENABLE ROW LEVEL SECURITY;

-- 清空既有策略再决定。上次 RLS 迁移栽过一次：只 DROP 了几个猜的名字，
-- 漏掉的宽松策略还在，而策略之间是「或」的关系，新限制形同虚设。
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'registration_authorizations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.registration_authorizations', pol.policyname);
  END LOOP;
END $$;

-- 不建任何策略 = 除 service_role 外一律拒绝。
-- 一旦让浏览器能往这张表写，就等于把入场券的发放权交出去了。

-- ---------- 触发器 ----------
CREATE OR REPLACE FUNCTION enforce_invite_only_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER            -- GoTrue 以 supabase_auth_admin 身份插入，需要提权才读得到这张表
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- 消费入场券。券必须是 15 分钟内发的——
  -- 不设时限的话，一张早年遗留的券会一直躺在那里当后门。
  DELETE FROM registration_authorizations
  WHERE lower(email) = lower(NEW.email)
    AND created_at > NOW() - INTERVAL '15 minutes';

  -- 取受影响行数判断有没有消费到券。
  -- 这里不能写 GET DIAGNOSTICS ... = FOUND：FOUND 是 PL/pgSQL 的特殊变量，
  -- 直接读即可，GET DIAGNOSTICS 只接受 ROW_COUNT 这类诊断项，
  -- 写成 FOUND 会报 42601 unrecognized GET DIAGNOSTICS item。
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    -- 顺手清掉过期的券，不用为此单开定时任务。
    -- 必须放在成功分支里：下面 RAISE EXCEPTION 会回滚整个事务，
    -- 写在异常分支里的 DELETE 永远提交不了，等于一句白写的代码。
    DELETE FROM registration_authorizations WHERE created_at < NOW() - INTERVAL '1 day';
    RETURN NEW;
  END IF;

  RAISE EXCEPTION '注册需要邀请码'
    USING HINT = '请通过产品的注册页面并填写有效邀请码';
END $$;

DROP TRIGGER IF EXISTS trg_invite_only_signup ON auth.users;

CREATE TRIGGER trg_invite_only_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invite_only_signup();

REVOKE ALL ON FUNCTION enforce_invite_only_signup() FROM PUBLIC;

-- ---------- 需要手动加人时怎么办 ----------
--
-- 这个触发器对所有插入一视同仁，包括在 Supabase 控制台里手动建用户。
-- 需要放行某个邮箱时，先发一张券，15 分钟内建号即可：
--
--   INSERT INTO registration_authorizations (email, invitation_code)
--   VALUES ('someone@example.com', '手动放行');
--
-- 想整个关掉这道门（不推荐）：
--
--   DROP TRIGGER trg_invite_only_signup ON auth.users;

-- 跑完确认触发器装上了
SELECT tgname AS 触发器, tgenabled AS 状态
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND NOT tgisinternal;
