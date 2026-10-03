-- 数据回流（2026-10-03）：已发布作品的数据
--
-- metrics：{"views":12000,"completion":32.5,"likes":300,"comments":40,"shares":12,"follows":85,"inquiries":6,"deals":2,"note":"上了同城热榜","updatedAt":"..."}
-- 编导在「创作进度」里录；按三种视频和拍法汇总后写进选题、方向、起号、自由对话的提示词（见 lib/performance.ts）。可以为空。

alter table public.works add column if not exists metrics jsonb;

notify pgrst, 'reload schema';
