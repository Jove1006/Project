-- 回滚脚本：撤销 up.sql 中的所有操作
-- 必须按依赖的反向顺序删除，否则外键约束会报错
-- files 依赖 medical_records → medical_records 依赖 hospitals + body_parts → 触发器函数被三张表引用

DROP TABLE IF EXISTS files;              -- 先删：依赖 medical_records
DROP TABLE IF EXISTS medical_records;    -- 再删：依赖 hospitals 和 body_parts
DROP TABLE IF EXISTS hospitals;          -- 然后删：被 medical_records 引用，现已无依赖
DROP TABLE IF EXISTS body_parts;         -- 然后删：被 medical_records 引用，现已无依赖
DROP FUNCTION IF EXISTS update_updated_at_column();  -- 最后删：三张表的触发器都已随表删除
