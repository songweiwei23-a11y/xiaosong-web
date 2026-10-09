-- 作废首页公开体验码 START26（2026-10-04 产品方：注册必须用邀请码，想要邀请码必须找管理员）。
-- 首页链接已经不再自动带这个码（lib/landing.ts 的 REGISTER_URL），但码本身还有效、还有名额，
-- 知道它的人照样能注册，所以要在库里作废。只改这一个码的状态，已经用它注册的账号不受影响。
-- 也可以在后台「邀请码」页找到 START26 点作废，效果一样。

UPDATE invitation_codes
SET status = 'revoked'
WHERE upper(code) = 'START26' AND status = 'active';

-- 跑完看一眼：status 应为 revoked
SELECT code, status, use_count, max_uses FROM invitation_codes WHERE upper(code) = 'START26';
