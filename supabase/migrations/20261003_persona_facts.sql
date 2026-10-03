-- 人设事实卡（2026-10-03）
--
-- persona_facts：出镜人是谁、和店的关系、从哪来、干这行几年、在本地多久、主卖什么、招牌、一句话经历、其他硬事实。
-- 形如 {"host":"主厨老王","origin":"成都","yearsInTrade":"做川菜 9 年","yearsLocal":"来南乐半年", ...}
-- 所有板块生成时以它为准（见 lib/persona-facts.ts）。可以为空。

alter table public.user_profiles add column if not exists persona_facts jsonb;

notify pgrst, 'reload schema';
