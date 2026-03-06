-- 移除 DRC 相关字段和索引

DROP INDEX IF EXISTS idx_files_pending_drc;

ALTER TABLE files DROP COLUMN IF EXISTS format;
ALTER TABLE files DROP COLUMN IF EXISTS conversion_status;
ALTER TABLE files DROP COLUMN IF EXISTS drc_file_id;
ALTER TABLE files DROP COLUMN IF EXISTS model_metadata;
ALTER TABLE files DROP COLUMN IF EXISTS conversion_time;
ALTER TABLE files DROP COLUMN IF EXISTS conversion_error;
