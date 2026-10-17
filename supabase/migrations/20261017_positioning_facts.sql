-- 整改 B4（2026-10-17）：账号定位记下「保存时档案事实的指纹」，档案事实改了以后定位页提醒「按旧档案写的」。
-- 只加一列，可重复执行。没有这一列时接口会照常保存定位，只是不做过期提醒。

ALTER TABLE public.account_positioning ADD COLUMN IF NOT EXISTS profile_facts TEXT NULL;

COMMENT ON COLUMN public.account_positioning.profile_facts IS '保存定位时档案事实的指纹（lib/creative-brief 的 profileFactsFingerprint），用于判断定位是否按旧档案写的';
