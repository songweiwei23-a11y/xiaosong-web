# 📋 中期方案实施计划

## 第一步：修改数据库表结构

在 account_positioning 表中添加新字段：
- strategy_summary（文本类型）：选题策划专用的战略摘要

SQL:
\\\sql
ALTER TABLE account_positioning 
ADD COLUMN strategy_summary TEXT;
\\\

## 第二步：修改保存逻辑

在 savePositioning 函数中：
1. 使用 extractRelevantPositioningInfo 函数生成 strategy_summary
2. 保存到数据库

## 第三步：修改选题策划工作台

在选题策划的 handlePositioningSelect 中：
1. 使用 positioning.strategy_summary 而不是 positioning.full_content
2. 如果 strategy_summary 为空，使用 extractRelevantPositioningInfo 过滤

## 第四步：移除最终过滤

因为 strategy_summary 已经是干净的，不再需要最终过滤

---

现在开始实施...

