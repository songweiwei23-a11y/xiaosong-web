-- 发布计划 + 素材位置（体检 F2、F4，见 docs/开物体检报告_20261017.md）
--
-- planned_at：这条作品计划哪天发（「本周要发」据此提醒）
-- material_note：视频文件放在哪（网盘或草稿链接，或一句说明）。文件本身不进开物
-- 两列都可以为空；旧的作品不受影响。作品表原有的行级权限照旧。

ALTER TABLE works ADD COLUMN IF NOT EXISTS planned_at TIMESTAMPTZ NULL;
ALTER TABLE works ADD COLUMN IF NOT EXISTS material_note TEXT NULL;

CREATE INDEX IF NOT EXISTS works_planned_idx ON works (user_id, planned_at);

SELECT '发布计划和素材位置已加好' AS 结果;
