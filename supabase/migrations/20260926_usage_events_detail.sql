-- 使用记录加一列内容：自由对话的提问和回答（截断后）、用的哪个档案。
-- 自由对话不写生成记录，没有这一列，管理后台的实时监控只知道"有人聊了一次"，
-- 看不到聊的是什么。
-- 只加列、不改已有数据；没跑这个迁移时网站照常运行（写入和监控都有退路）。

alter table public.usage_events
  add column if not exists detail jsonb;
