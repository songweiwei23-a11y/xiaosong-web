-- 监控和后台查询用的索引（后台扩展方案 P0-1）。
-- 监控每秒按时间范围查询这几张表；没有索引时，数据越多越慢。
-- 只建索引，不改数据。可以重复执行。
-- 注意：表很大时建索引会短暂占用写入，建议在访问量低的时段执行。
create index if not exists script_history_created_idx on public.script_history (created_at desc);
create index if not exists usage_events_created_idx on public.usage_events (created_at desc);
create index if not exists payment_orders_created_idx on public.payment_orders (created_at desc);
create index if not exists payment_orders_status_idx on public.payment_orders (status, created_at desc);
create index if not exists funnel_events_created_idx on public.funnel_events (created_at desc);
