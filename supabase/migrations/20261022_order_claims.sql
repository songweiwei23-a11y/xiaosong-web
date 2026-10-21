-- 订单认领（后台扩展方案 P1-3）：谁在处理哪一笔待审订单，租约过期后自动释放。
-- 只加列和索引，不改已有数据。可以重复执行。
alter table public.payment_orders add column if not exists claimed_by uuid;
alter table public.payment_orders add column if not exists claimed_at timestamptz;
alter table public.payment_orders add column if not exists claim_lease_until timestamptz;

create index if not exists payment_orders_claim_idx
  on public.payment_orders (status, claim_lease_until);
