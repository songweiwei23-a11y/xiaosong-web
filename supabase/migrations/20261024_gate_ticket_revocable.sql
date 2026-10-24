-- 门票的「可撤销」选项（2026-10-24）：每张门票都有这一项。默认可撤销，已有的门票全部可撤销；
-- 设为不可撤销的门票撤不掉。撤销后的效果：这张门票发出去的设备不能再进开物；
-- 但已经注册、并且有使用记录的账号本身不受影响（见 lib/gate-tickets.ts 的 accountBlockedBy）。

alter table public.gate_tickets add column if not exists revocable boolean not null default true;

comment on column public.gate_tickets.revocable is '能不能撤销。false 的门票撤不掉（撤销按钮不显示，接口也拒绝）';

notify pgrst, 'reload schema';
