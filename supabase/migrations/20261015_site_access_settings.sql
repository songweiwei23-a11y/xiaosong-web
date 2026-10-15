-- 首页拦截的访问码（2026-10-15）。只有一行（id = 1），由后台「首页拦截」页面维护。
-- 没有这行时，首页拦截用服务器环境变量 SITE_ACCESS_CODE 里的访问码（见 lib/site-gate-store）。
-- 访问码是共享的门禁码，要能在后台看到并复制给人，所以存的是原文；表只给服务端（service_role）读写，
-- 浏览器一律拿不到（启用 RLS、不建任何策略，并收回 anon / authenticated 的权限）。

CREATE TABLE IF NOT EXISTS public.site_access_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  code text NOT NULL CHECK (char_length(code) BETWEEN 8 AND 64),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.site_access_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_access_settings FROM anon, authenticated;
