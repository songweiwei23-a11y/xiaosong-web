-- 添加 strategy_summary 字段到 account_positioning 表
-- 用于存储选题策划专用的战略摘要

ALTER TABLE account_positioning 
ADD COLUMN IF NOT EXISTS strategy_summary TEXT;

COMMENT ON COLUMN account_positioning.strategy_summary IS '选题策划专用的战略摘要，只包含核心定位、目标用户、差异化优势等，不含执行细节';
