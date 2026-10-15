-- 首页应急登录（2026-10-17）：门票丢了的管理员，可以在提示页用「邮箱 + 密码 + 验证器码」换一台设备的通行。
-- 默认关闭。只有绑定了验证器（TOTP）的管理员账号能用；每次成功都写入操作日志。
-- 应急恢复同上：update public.site_gate_settings set enabled = false where id = 1;

ALTER TABLE public.site_gate_settings
  ADD COLUMN IF NOT EXISTS admin_login boolean NOT NULL DEFAULT false;
