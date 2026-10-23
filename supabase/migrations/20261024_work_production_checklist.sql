-- 拍摄标记同步云端（2026-10-24，体检 F03）
-- 逐镜头「拍完了」的标记存到作品上，换设备、换浏览器都能看到。格式见 lib/production-checklist.ts：{"ids": [...], "updatedAt": "..."}
-- 只加一列，可重复执行。没有这一列时，拍摄标记仍保存在本机（接口会提示「暂时不能同步」）。

alter table public.works add column if not exists production_checklist jsonb;

comment on column public.works.production_checklist is '拍摄标记：{"ids": [镜头编号...], "updatedAt": ISO 时间}，合并时以 updatedAt 新的为准';

notify pgrst, 'reload schema';
